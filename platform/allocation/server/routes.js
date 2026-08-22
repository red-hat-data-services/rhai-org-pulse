/**
 * Allocation routes for team-tracker module.
 * Mounted at /api/modules/team-tracker/allocation/ by the team-tracker server.
 */

const _teamStoreModule = require('../../../shared/server/team-store');
const { extractBoardId } = _teamStoreModule;
const { getOrgDisplayNames } = require('../../../shared/server/roster-sync/config');
const permissions = require('../../../shared/server/permissions');
const { allocationKey } = require('./config');

// Normalise the team-store API across two generations of the core package:
//  - core ≤ 2.0.x: factory pattern — module.exports = { createTeamStore, extractBoardId, … }
//  - core ≥ 2.0.64 (npm): standalone functions — module.exports = { readTeams, updateTeamFields, … }
function _getTeamStore(storage) {
  if (typeof _teamStoreModule.createTeamStore === 'function') {
    return _teamStoreModule.createTeamStore(storage);
  }
  return {
    readTeams: () => _teamStoreModule.readTeams(storage),
    updateTeamFields: (teamId, fields, actorEmail) => _teamStoreModule.updateTeamFields(storage, teamId, fields, actorEmail)
  };
}

function isValidBoardId(id) { return /^(\d+|kanban-\d+)$/.test(id); }
function isValidSprintId(id) { return /^(\d+|kanban-\d+)$/.test(id); }
function isValidTeamId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id); }
const REFRESH_COOLDOWN_MS = 60_000;
const ALLOCATION_MODES = ['points', 'counts'];

module.exports = function registerAllocationRoutes(router, context) {
  const { storage, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;
  const teamStore = _getTeamStore(storage);

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // Allocation strategy and Jira transport are self-loaded by this extension's
  // server entry (./index.js) and threaded in via context — core no longer
  // provides context.allocationStrategy or an env-authed shared jiraRequest.
  const strategy = context.allocationStrategy || null;
  const jiraRequest = context.jiraRequest;
  const JIRA_HOST = context.jiraHost;

  const { createJiraClient } = require('./jira-client');
  const extraFields = strategy?.getJiraFields ? strategy.getJiraFields() : null;
  const jiraClient = createJiraClient({ jiraRequest, jiraHost: JIRA_HOST, extraFields });

  const { performRefresh, refreshTeam, rebuildRollups } = require('./orchestration');

  // Shared fetchers passed to the orchestration layer.
  const jiraFetchers = {
    fetchSprints: jiraClient.fetchSprints,
    fetchSprintIssues: jiraClient.fetchSprintIssues,
    fetchBoardConfiguration: jiraClient.fetchBoardConfiguration,
    fetchFilterJql: jiraClient.fetchFilterJql,
    fetchIssuesByJql: jiraClient.fetchIssuesByJql,
    fetchBoardType: jiraClient.fetchBoardType
  };

  // Storage helpers -- all allocation data under allocation/ prefix
  async function allocRead(key) { return await readFromStorage(allocationKey(key)); }
  async function allocWrite(key, data) { await writeToStorage(allocationKey(key), data); }

  // Tag each team in a rollup with whether it has configured an allocation
  // basis, derived from LIVE team metadata (not the summary snapshot) so the
  // count is always current and reflects setting changes immediately.
  async function enrichConfigured(teamsArr) {
    if (!Array.isArray(teamsArr) || teamsArr.length === 0) return teamsArr;
    const teamData = await teamStore.readTeams();
    const teamsById = teamData.teams || {};
    return teamsArr.map(t => {
      const mode = teamsById[t.teamId]?.metadata?.allocationMode;
      return { ...t, allocationConfigured: mode === 'points' || mode === 'counts' };
    });
  }

  // Mirrors team-tracker's requireTeamPurview: admins, team-admins, and managers
  // with a report on the team may edit team settings. Kept self-contained here
  // (the extension can't import team-tracker internals) using shared/permissions.
  async function hasTeamPurview(req, teamId) {
    if (req.isAdmin || req.isTeamAdmin) return true;
    if (!req.userUid) return false;
    const registry = await readFromStorage('team-data/registry.json');
    if (!registry || !registry.people) return false;
    const managerMap = permissions.buildManagerMap(registry);
    const managed = permissions.getManagedUids(req.userUid, managerMap);
    for (const uid of managed) {
      const person = registry.people[uid];
      if (person && Array.isArray(person.teamIds) && person.teamIds.includes(teamId)) return true;
    }
    return false;
  }

  // Strategy metadata endpoint

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

  // Refresh state (in-memory)

  const refreshState = {
    running: false,
    startedAt: null,
    completedAt: null,
    lastResult: null
  };

  // Refresh routes

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/refresh:
   *   post:
   *     tags: ['Allocation']
   *     summary: Trigger allocation data refresh from Jira
   *     description: >
   *       A team-scoped refresh (teamId provided) may be triggered by any
   *       authenticated user and only updates that team's board/sprint data and
   *       team summary. A full refresh (no teamId) rebuilds org/global summaries
   *       and requires admin.
   *     parameters:
   *       - in: query
   *         name: teamId
   *         schema:
   *           type: string
   *         description: Refresh a single team (optional). Omit for a full, admin-only refresh.
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
   *       403:
   *         description: Admin required for a full refresh
   */
  router.post('/allocation/refresh', requireScope('metrics:write'), async function(req, res) {
    const teamId = req.query.teamId || req.body.teamId;
    const hardRefresh = req.body.hardRefresh || false;

    if (teamId && !isValidTeamId(teamId)) {
      return res.status(400).json({ error: 'Invalid request parameter' });
    }

    // Full (unscoped) refresh rebuilds org/global summaries and stays admin-only.
    // Team-scoped refreshes are self-service for any authenticated user.
    if (!teamId && !req.isAdmin) {
      return res.status(403).json({ error: 'Admin access required for a full refresh. Pass a teamId to refresh a single team.' });
    }

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

    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();
    res.json({ status: 'started', scope: teamId ? 'team' : 'full' });

    setImmediate(async function() {
      try {
        // Read all teams from team-store
        const teamData = await teamStore.readTeams();
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

        let message;
        if (teamId) {
          // Team-scoped: fetch only this team's Jira data + write its team summary…
          console.log(`\n[allocation] Starting team-scoped refresh for ${teamId}`);
          for (const team of teams) {
            await refreshTeam({ team, strategy, hardRefresh, ...jiraFetchers, readStorage: allocRead, writeStorage: allocWrite });
          }
          // …then rebuild org/global rollups from ALL teams' on-disk summaries.
          // This is cheap (no Jira) and keeps other teams intact — no clobber.
          const allTeams = Object.values(teamData.teams || {});
          await rebuildRollups({ strategy, teams: allTeams, readStorage: allocRead, writeStorage: allocWrite });
          message = teams.length ? `Refreshed team ${teamId}` : `Team ${teamId} has no allocation boards`;
        } else {
          console.log(`\n[allocation] Starting full refresh: ${teams.length} teams with allocation boards`);
          const result = await performRefresh({
            teams, strategy, hardRefresh, ...jiraFetchers, readStorage: allocRead, writeStorage: allocWrite
          });
          message = `Processed ${result.teamCount} teams`;
        }

        const completedAt = new Date().toISOString();
        refreshState.lastResult = { status: 'success', message, completedAt };
        refreshState.completedAt = completedAt;
        console.log(`[allocation] Refresh complete: ${message}`);
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

  // Refresh Registry Handler

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
      const teamData = await teamStore.readTeams();
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

  // Summary routes

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
  router.get('/allocation/team/:teamId/summary', requireScope('metrics:read'), async function(req, res) {
    try {
      const { teamId } = req.params;
      if (!isValidTeamId(teamId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = await allocRead(`summaries/team-${teamId}.json`);
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
   * /api/modules/team-tracker/allocation/team/{teamId}/settings:
   *   get:
   *     tags: ['Allocation']
   *     summary: Get a team's allocation settings and the caller's edit permission
   *     parameters:
   *       - in: path
   *         name: teamId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: "{ allocationMode: 'points'|'counts'|null, configured: boolean, canEdit: boolean }"
   */
  router.get('/allocation/team/:teamId/settings', requireScope('metrics:read'), async function(req, res) {
    try {
      const { teamId } = req.params;
      if (!isValidTeamId(teamId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const teamData = await teamStore.readTeams();
      const team = teamData.teams && teamData.teams[teamId];
      if (!team) return res.status(404).json({ error: 'Team not found' });
      const mode = team.metadata?.allocationMode;
      const configured = mode === 'points' || mode === 'counts';
      const canEdit = await hasTeamPurview(req, teamId);
      // allocationMode is null until a manager explicitly configures a basis.
      res.json({ allocationMode: configured ? mode : null, configured, canEdit });
    } catch (error) {
      console.error('[allocation] Read team settings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/team/{teamId}/settings:
   *   put:
   *     tags: ['Allocation']
   *     summary: Update a team's allocation calculation basis
   *     description: Requires team purview (admin, team-admin, or a manager with a report on the team).
   *     parameters:
   *       - in: path
   *         name: teamId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               allocationMode:
   *                 type: string
   *                 enum: [points, counts]
   *     responses:
   *       200:
   *         description: Updated settings
   *       400:
   *         description: Invalid allocationMode
   *       403:
   *         description: Not authorized for this team
   *       404:
   *         description: Team not found
   */
  router.put('/allocation/team/:teamId/settings', requireScope('metrics:write'), async function(req, res) {
    try {
      const { teamId } = req.params;
      const { allocationMode } = req.body || {};
      if (!isValidTeamId(teamId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      if (!ALLOCATION_MODES.includes(allocationMode)) {
        return res.status(400).json({ error: `allocationMode must be one of: ${ALLOCATION_MODES.join(', ')}` });
      }
      if (DEMO_MODE) {
        return res.status(403).json({ error: 'Settings are read-only in demo mode' });
      }
      if (!(await hasTeamPurview(req, teamId))) {
        return res.status(403).json({ error: 'Not authorized for this team' });
      }
      const result = await teamStore.updateTeamFields(teamId, { allocationMode }, req.auditActor);
      if (!result) return res.status(404).json({ error: 'Team not found' });
      res.json({ allocationMode });
    } catch (error) {
      console.error('[allocation] Update team settings error:', error);
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
  router.get('/allocation/org/:orgKey/summary', requireScope('metrics:read'), async function(req, res) {
    try {
      const orgParam = req.params.orgKey;
      // Try direct lookup first (orgParam is already an orgKey)
      let data = await allocRead(`summaries/org-${orgParam}.json`);
      // If not found, resolve display name to orgKey
      if (!data) {
        const displayNames = await getOrgDisplayNames(storage);
        const resolvedKey = Object.entries(displayNames).find(([, name]) => name === orgParam)?.[0];
        if (resolvedKey) {
          data = await allocRead(`summaries/org-${resolvedKey}.json`);
        }
      }
      if (!data) {
        return res.json({ lastUpdated: null, totalPoints: 0, teamCount: 0, boardCount: 0, buckets: {} });
      }
      data.teams = await enrichConfigured(data.teams);
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
  router.get('/allocation/global/summary', requireScope('metrics:read'), async function(_req, res) {
    try {
      const data = await allocRead('summaries/global.json');
      if (!data) {
        return res.json({ lastUpdated: null, totalPoints: 0, teamCount: 0, boardCount: 0, buckets: {} });
      }
      data.teams = await enrichConfigured(data.teams);
      res.json(data);
    } catch (error) {
      console.error('[allocation] Read global summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Sprint data routes

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
  router.get('/allocation/board/:boardId/sprints', requireScope('metrics:read'), async function(req, res) {
    try {
      const { boardId } = req.params;
      if (!isValidBoardId(boardId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }

      // If sprintFilter query param, try filter-specific index first
      const sprintFilter = req.query.sprintFilter;
      if (sprintFilter) {
        const filterKey = sprintFilter.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const filtered = await allocRead(`sprints/board-${boardId}-${filterKey}.json`);
        if (filtered) return res.json({ synced: true, ...filtered });
      }

      const data = await allocRead(`sprints/board-${boardId}.json`);
      if (!data) {
        // No index file for this board yet — it has never been synced from Jira.
        // `synced: false` lets the client distinguish this from a synced board
        // that genuinely has no sprints.
        return res.json({ synced: false, sprints: [] });
      }
      res.json({ synced: true, ...data });
    } catch (error) {
      console.error('[allocation] Read sprints error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * @openapi
   * /api/modules/team-tracker/allocation/board/{boardId}/all-sprints:
   *   get:
   *     tags: ['Allocation']
   *     summary: Live-fetch a board's full (unfiltered) sprint list from Jira
   *     description: >
   *       Used to preview which sprints a name filter would include. Returns the
   *       complete sprint list straight from Jira (not the filtered, stored
   *       index), most recent first.
   *     parameters:
   *       - in: path
   *         name: boardId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: All sprints for the board
   *       400:
   *         description: Invalid board id
   *       502:
   *         description: Could not reach Jira
   */
  router.get('/allocation/board/:boardId/all-sprints', requireScope('metrics:read'), async function(req, res) {
    const { boardId } = req.params;
    if (!isValidBoardId(boardId)) {
      return res.status(400).json({ error: 'Invalid request parameter' });
    }
    // Kanban boards have no sprints; nothing to preview.
    if (String(boardId).startsWith('kanban-')) {
      return res.json({ sprints: [], boardType: 'kanban' });
    }
    if (DEMO_MODE) {
      return res.json({ sprints: [] });
    }
    try {
      // Kanban boards reject the sprint API, so detect type first.
      let boardType = 'scrum';
      try { boardType = await jiraClient.fetchBoardType(boardId); } catch { /* default scrum */ }
      if (boardType === 'kanban') {
        return res.json({ sprints: [], boardType: 'kanban' });
      }
      const sprints = await jiraClient.fetchSprints(boardId);
      const sorted = sprints
        .map(s => ({ id: s.id, name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate }))
        .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
      res.json({ sprints: sorted });
    } catch (error) {
      console.error('[allocation] Fetch all sprints error:', error.message);
      res.status(502).json({ error: 'Could not load sprints from Jira' });
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
  router.get('/allocation/sprints/:sprintId/issues', requireScope('metrics:read'), async function(req, res) {
    try {
      const { sprintId } = req.params;
      if (!isValidSprintId(sprintId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = await allocRead(`sprints/${sprintId}.json`);
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
