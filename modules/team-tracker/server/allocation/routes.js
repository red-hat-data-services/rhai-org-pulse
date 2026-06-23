/**
 * Allocation routes for team-tracker module.
 * Mounted at /api/modules/team-tracker/allocation/ by the team-tracker server.
 */

const { readTeams, extractBoardId } = require('../../../../shared/server/team-store');
const { getOrgDisplayNames } = require('../../../../shared/server/roster-sync/config');
const { allocationKey } = require('./config');

function isValidBoardId(id) { return /^(\d+|kanban-\d+)$/.test(id); }
function isValidSprintId(id) { return /^(\d+|kanban-\d+)$/.test(id); }
const REFRESH_COOLDOWN_MS = 60_000;

module.exports = function registerAllocationRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // Read allocation strategy (loaded by server/platform-loader.js, passed via module context)
  const strategy = context.allocationStrategy || null;

  const { JIRA_HOST, jiraRequest } = require('../../../../shared/server/jira');

  const { createJiraClient } = require('./jira-client');
  const extraFields = strategy?.getJiraFields ? strategy.getJiraFields() : null;
  const jiraClient = createJiraClient({ jiraRequest, jiraHost: JIRA_HOST, extraFields });

  const { performRefresh } = require('./orchestration');

  // Storage helpers — all allocation data under allocation/ prefix
  function allocRead(key) { return readFromStorage(allocationKey(key)); }
  function allocWrite(key, data) { writeToStorage(allocationKey(key), data); }

  // ─── Strategy metadata endpoint ───

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/strategy:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get active allocation strategy metadata
   *     responses:
   *       200:
   *         description: Strategy metadata or unconfigured status
   */
  router.get('/allocation/strategy', requireScope('metrics:read'), function(_req, res) {
    if (!strategy) {
      return res.json({ configured: false });
    }
    res.json({
      configured: true,
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      categories: strategy.categories
    });
  });

  // ─── Refresh state (in-memory) ───

  const refreshState = {
    running: false,
    startedAt: null,
    completedAt: null,
    lastResult: null
  };

  // ─── Refresh routes ───

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/refresh:
   *   post:
   *     tags: ['Allocation']
   *     summary: Trigger allocation data refresh from Jira
   *     security: [{ admin: [] }]
   *     parameters:
   *       - in: query
   *         name: teamId
   *         schema:
   *           type: string
   *         description: Refresh a single team (optional)
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               teamId:
   *                 type: string
   *               hardRefresh:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Refresh status
   */
  router.post('/allocation/refresh', requireAdmin, requireScope('metrics:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
    }
    if (!strategy) {
      return res.json({ status: 'skipped', message: 'No allocation strategy configured' });
    }
    if (refreshState.running) {
      return res.json({ status: 'already_running' });
    }

    // Cooldown check
    if (refreshState.completedAt) {
      const elapsed = Date.now() - new Date(refreshState.completedAt).getTime();
      if (elapsed < REFRESH_COOLDOWN_MS) {
        const retryAfter = Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000);
        return res.json({ status: 'cooldown', retryAfter });
      }
    }

    const teamId = req.query.teamId || req.body.teamId;
    const hardRefresh = req.body.hardRefresh || false;

    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();
    res.json({ status: 'started' });

    setImmediate(async function() {
      try {
        // Read all teams from team-store
        const teamData = readTeams(storage);
        let teams = Object.values(teamData.teams || {});

        // Filter to single team if requested
        if (teamId) {
          teams = teams.filter(t => t.id === teamId);
          if (teams.length === 0) {
            const completedAt = new Date().toISOString();
            refreshState.lastResult = { status: 'error', message: `Team ${teamId} not found`, completedAt };
            refreshState.completedAt = completedAt;
            refreshState.running = false;
            return;
          }
        }

        // Backfill boardId for boards saved before extraction was added
        for (const t of teams) {
          if (Array.isArray(t.boards)) {
            t.boards = t.boards.map(b => b.boardId != null ? b : { ...b, boardId: extractBoardId(b.url) });
          }
        }
        // Filter to teams with at least one board with a boardId
        teams = teams.filter(t => (t.boards || []).some(b => b.boardId));

        console.log(`\n[allocation] Starting refresh: ${teams.length} teams with allocation boards`);

        const result = await performRefresh({
          teams,
          strategy,
          hardRefresh,
          fetchSprints: jiraClient.fetchSprints,
          fetchSprintIssues: jiraClient.fetchSprintIssues,
          fetchBoardConfiguration: jiraClient.fetchBoardConfiguration,
          fetchFilterJql: jiraClient.fetchFilterJql,
          fetchIssuesByJql: jiraClient.fetchIssuesByJql,
          fetchBoardType: jiraClient.fetchBoardType,
          readStorage: allocRead,
          writeStorage: allocWrite
        });

        const completedAt = new Date().toISOString();
        refreshState.lastResult = {
          status: 'success',
          message: `Processed ${result.teamCount} teams`,
          completedAt
        };
        refreshState.completedAt = completedAt;
        console.log(`[allocation] Refresh complete: ${result.teamCount} teams processed`);
      } catch (error) {
        console.error('[allocation] Background refresh error:', error);
        const completedAt = new Date().toISOString();
        refreshState.lastResult = { status: 'error', message: 'Refresh failed', completedAt };
        refreshState.completedAt = completedAt;
      } finally {
        refreshState.running = false;
      }
    });
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/refresh/status:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get allocation refresh status
   *     responses:
   *       200:
   *         description: Current refresh state
   */
  router.get('/allocation/refresh/status', requireScope('metrics:read'), function(_req, res) {
    const sanitized = { ...refreshState };
    if (sanitized.lastResult) {
      sanitized.lastResult = {
        ...sanitized.lastResult,
        message: sanitized.lastResult.status === 'error'
          ? 'Refresh failed'
          : sanitized.lastResult.message
      };
    }
    res.json(sanitized);
  });

  // ─── Refresh Registry Handler ───

  async function runAllocationRefresh(options = {}) {
    if (DEMO_MODE) return;
    if (!strategy) return;
    if (refreshState.running) return;

    if (!options.skipCooldown && refreshState.completedAt) {
      const elapsed = Date.now() - new Date(refreshState.completedAt).getTime();
      if (elapsed < REFRESH_COOLDOWN_MS) return;
    }

    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();

    try {
      const teamData = readTeams(storage);
      let teams = Object.values(teamData.teams || {});

      for (const t of teams) {
        if (Array.isArray(t.boards)) {
          t.boards = t.boards.map(b => b.boardId != null ? b : { ...b, boardId: extractBoardId(b.url) });
        }
      }
      teams = teams.filter(t => (t.boards || []).some(b => b.boardId));

      console.log(`\n[allocation] Starting refresh: ${teams.length} teams with allocation boards`);

      const result = await performRefresh({
        teams,
        strategy,
        hardRefresh: false,
        fetchSprints: jiraClient.fetchSprints,
        fetchSprintIssues: jiraClient.fetchSprintIssues,
        fetchBoardConfiguration: jiraClient.fetchBoardConfiguration,
        fetchFilterJql: jiraClient.fetchFilterJql,
        fetchIssuesByJql: jiraClient.fetchIssuesByJql,
        fetchBoardType: jiraClient.fetchBoardType,
        readStorage: allocRead,
        writeStorage: allocWrite
      });

      const completedAt = new Date().toISOString();
      refreshState.lastResult = {
        status: 'success',
        message: `Processed ${result.teamCount} teams`,
        completedAt
      };
      refreshState.completedAt = completedAt;
      console.log(`[allocation] Refresh complete: ${result.teamCount} teams processed`);
    } catch (error) {
      console.error('[allocation] Refresh error:', error);
      const completedAt = new Date().toISOString();
      refreshState.lastResult = { status: 'error', message: 'Refresh failed', completedAt };
      refreshState.completedAt = completedAt;
    } finally {
      refreshState.running = false;
    }
  }

  if (context.registerRefresh) context.registerRefresh('allocation', {
    order: 40,
    timeout: 600000,
    description: 'Fetches sprint data from Jira boards and classifies issues for team allocation tracking.',
    handler: async function(options) {
      await runAllocationRefresh(options);
    },
    status: async function() {
      return { ...refreshState };
    }
  });

  // ─── Summary routes ───

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/team/{teamId}/summary:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get allocation summary for a team
   *     parameters:
   *       - in: path
   *         name: teamId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Team allocation summary
   */
  router.get('/allocation/team/:teamId/summary', requireScope('metrics:read'), function(req, res) {
    try {
      const { teamId } = req.params;
      const data = allocRead(`summaries/team-${teamId}.json`);
      if (!data) {
        return res.json({ lastUpdated: null, totalPoints: 0, boardCount: 0, buckets: {} });
      }
      res.json(data);
    } catch (error) {
      console.error('[allocation] Read team summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/org/{orgKey}/summary:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get allocation summary for an org
   *     parameters:
   *       - in: path
   *         name: orgKey
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Org allocation summary
   */
  router.get('/allocation/org/:orgKey/summary', requireScope('metrics:read'), function(req, res) {
    try {
      const orgParam = req.params.orgKey;
      // Try direct lookup first (orgParam is already an orgKey)
      let data = allocRead(`summaries/org-${orgParam}.json`);
      // If not found, resolve display name to orgKey
      if (!data) {
        const displayNames = getOrgDisplayNames(storage);
        const resolvedKey = Object.entries(displayNames).find(([, name]) => name === orgParam)?.[0];
        if (resolvedKey) {
          data = allocRead(`summaries/org-${resolvedKey}.json`);
        }
      }
      if (!data) {
        return res.json({ lastUpdated: null, totalPoints: 0, teamCount: 0, boardCount: 0, buckets: {} });
      }
      res.json(data);
    } catch (error) {
      console.error('[allocation] Read org summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/global/summary:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get global allocation summary across all orgs
   *     responses:
   *       200:
   *         description: Global allocation summary
   */
  router.get('/allocation/global/summary', requireScope('metrics:read'), function(_req, res) {
    try {
      const data = allocRead('summaries/global.json');
      if (!data) {
        return res.json({ lastUpdated: null, totalPoints: 0, teamCount: 0, boardCount: 0, buckets: {} });
      }
      res.json(data);
    } catch (error) {
      console.error('[allocation] Read global summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Sprint data routes ───

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/board/{boardId}/sprints:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get sprint list for a board
   *     parameters:
   *       - in: path
   *         name: boardId
   *         required: true
   *         schema:
   *           type: string
   *       - in: query
   *         name: sprintFilter
   *         schema:
   *           type: string
   *         description: Filter sprints by name
   *     responses:
   *       200:
   *         description: Board sprint index
   */
  router.get('/allocation/board/:boardId/sprints', requireScope('metrics:read'), function(req, res) {
    try {
      const { boardId } = req.params;
      if (!isValidBoardId(boardId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }

      // If sprintFilter query param, try filter-specific index first
      const sprintFilter = req.query.sprintFilter;
      if (sprintFilter) {
        const filterKey = sprintFilter.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const filtered = allocRead(`sprints/board-${boardId}-${filterKey}.json`);
        if (filtered) return res.json(filtered);
      }

      const data = allocRead(`sprints/board-${boardId}.json`);
      if (!data) {
        return res.json({ sprints: [] });
      }
      res.json(data);
    } catch (error) {
      console.error('[allocation] Read sprints error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/sprints/{sprintId}/issues:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get classified issues for a sprint
   *     parameters:
   *       - in: path
   *         name: sprintId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Sprint issue data with classification
   *       404:
   *         description: Sprint data not found
   */
  router.get('/allocation/sprints/:sprintId/issues', requireScope('metrics:read'), function(req, res) {
    try {
      const { sprintId } = req.params;
      if (!isValidSprintId(sprintId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = allocRead(`sprints/${sprintId}.json`);
      if (!data) {
        return res.status(404).json({
          error: 'Sprint data not found. Please refresh to fetch data from Jira.'
        });
      }
      res.json(data);
    } catch (error) {
      console.error('[allocation] Read sprint issues error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

};
