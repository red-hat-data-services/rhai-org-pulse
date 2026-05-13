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
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  const { JIRA_HOST, jiraRequest } = require('../../../../shared/server/jira');

  const { createJiraClient } = require('./jira-client');
  const jiraClient = createJiraClient({ jiraRequest, jiraHost: JIRA_HOST });

  const { performRefresh } = require('./orchestration');

  // Storage helpers — all allocation data under allocation/ prefix
  function allocRead(key) { return readFromStorage(allocationKey(key)); }
  function allocWrite(key, data) { writeToStorage(allocationKey(key), data); }

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
  router.post('/allocation/refresh', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
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
  router.get('/allocation/refresh/status', function(_req, res) {
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
  router.get('/allocation/team/:teamId/summary', function(req, res) {
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
  router.get('/allocation/org/:orgKey/summary', function(req, res) {
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
  router.get('/allocation/global/summary', function(_req, res) {
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
  router.get('/allocation/board/:boardId/sprints', function(req, res) {
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
  router.get('/allocation/sprints/:sprintId/issues', function(req, res) {
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

  // ─── Classification Pipeline Routes ───

  const {
    triggerPipeline,
    getPipelineStatus,
    downloadArtifact,
    upsertSchedule,
    getSchedule
  } = require('./classification-pipeline');

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/classification/config:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get classification configuration
   *     security: [{ admin: [] }]
   */
  router.get('/allocation/classification/config', requireAdmin, function(_req, res) {
    try {
      const config = allocRead('classification-config.json') || {
        enabled: false,
        frequency: 'every-6-hours',
        lookbackHours: 12
      };
      res.json(config);
    } catch (error) {
      console.error('[classification] Get config error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/classification/config:
   *   post:
   *     tags: ['Allocation']
   *     summary: Update classification configuration and schedule
   *     security: [{ admin: [] }]
   */
  router.post('/allocation/classification/config', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Classification config disabled in demo mode' });
    }

    try {
      const { enabled, frequency, lookbackHours } = req.body;

      // Validate frequency
      const validFrequencies = ['hourly', 'every-6-hours', 'every-12-hours', 'daily'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({ error: 'Invalid frequency' });
      }

      // Validate lookbackHours
      if (typeof lookbackHours !== 'number' || lookbackHours < 1 || lookbackHours > 168) {
        return res.status(400).json({ error: 'Lookback hours must be between 1 and 168' });
      }

      // Save config
      const config = { enabled, frequency, lookbackHours };
      allocWrite('classification-config.json', config);

      // Update GitLab schedule
      try {
        const schedule = await upsertSchedule({
          frequency,
          lookbackHours,
          enabled
        });

        res.json({
          status: 'success',
          config,
          schedule
        });
      } catch (scheduleError) {
        console.error('[classification] Schedule update error:', scheduleError);
        // Config saved but schedule failed - return partial success
        res.json({
          status: 'partial',
          config,
          error: scheduleError.message
        });
      }
    } catch (error) {
      console.error('[classification] Save config error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/classification/test:
   *   post:
   *     tags: ['Allocation']
   *     summary: Test classification on a single issue
   *     security: [{ admin: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               issueKey:
   *                 type: string
   *               dryRun:
   *                 type: boolean
   */
  router.post('/allocation/classification/test', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Classification disabled in demo mode' });
    }

    try {
      const { issueKey, dryRun = true } = req.body;

      if (!issueKey) {
        return res.status(400).json({ error: 'issueKey is required' });
      }

      const jql = `key = ${issueKey}`;

      const pipeline = await triggerPipeline({
        jql,
        dryRun,
        limit: 1
      });

      res.json({
        status: 'triggered',
        pipeline
      });
    } catch (error) {
      console.error('[classification] Test trigger error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/classification/bulk:
   *   post:
   *     tags: ['Allocation']
   *     summary: Trigger bulk classification
   *     security: [{ admin: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               jql:
   *                 type: string
   *               dryRun:
   *                 type: boolean
   *               limit:
   *                 type: number
   */
  router.post('/allocation/classification/bulk', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Classification disabled in demo mode' });
    }

    try {
      const { jql, dryRun = true, limit = 1000 } = req.body;

      if (!jql) {
        return res.status(400).json({ error: 'jql is required' });
      }

      const pipeline = await triggerPipeline({
        jql,
        dryRun,
        limit
      });

      res.json({
        status: 'triggered',
        pipeline
      });
    } catch (error) {
      console.error('[classification] Bulk trigger error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/classification/pipeline/:pipelineId:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get pipeline status and results
   *     security: [{ admin: [] }]
   */
  router.get('/allocation/classification/pipeline/:pipelineId', requireAdmin, async function(req, res) {
    try {
      const { pipelineId } = req.params;

      const status = await getPipelineStatus(pipelineId);

      let results = null;
      if (status.status === 'success') {
        try {
          results = await downloadArtifact(pipelineId);
        } catch (artifactError) {
          console.warn('[classification] Artifact download failed:', artifactError);
        }
      }

      res.json({
        status: status.status,
        pipeline: status,
        results
      });
    } catch (error) {
      console.error('[classification] Get pipeline error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/classification/schedule:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get current schedule info
   *     security: [{ admin: [] }]
   */
  router.get('/allocation/classification/schedule', requireAdmin, async function(_req, res) {
    try {
      const schedule = await getSchedule();
      res.json({ schedule });
    } catch (error) {
      console.error('[classification] Get schedule error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

};
