/**
 * Allocation Tracker module server entry.
 * Registers Express routes for board discovery, data refresh, and data reading.
 *
 * All routes are mounted at /api/modules/allocation-tracker/ by the module loader.
 */

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // ─── Input validation helpers ───

  function isValidBoardId(id) { return /^(\d+|kanban-\d+)$/.test(id); }
  function isValidSprintId(id) { return /^(\d+|kanban-\d+)$/.test(id); }
  function isValidProjectKey(key) { return /^[A-Z][A-Z0-9_-]{0,30}$/.test(key); }

  /**
   * Validate a string field for path safety (no traversal characters).
   */
  function isPathSafeString(val) {
    if (typeof val !== 'string') return false;
    return !/[/\\]|\.\./.test(val);
  }

  const REFRESH_COOLDOWN_MS = 60_000;

  // Jira helpers from shared package (3 levels up from server/)
  const { JIRA_HOST, jiraRequest } = require('../../../shared/server/jira');

  // Create Jira client using shared jiraRequest
  const { createJiraClient } = require('./jira/jira-client');
  const jiraClient = createJiraClient({ jiraRequest, jiraHost: JIRA_HOST });

  // Import orchestration and classification
  const { discoverBoards, processBoard, processKanbanBoard } = require('./jira/orchestration');
  const { getStoragePrefix, createPrefixedStorage } = require('./jira/config');

  // ─── Storage helpers ───

  function moduleRead(key) { return readFromStorage(`allocation-tracker/${key}`); }
  function moduleWrite(key, data) { writeToStorage(`allocation-tracker/${key}`, data); }

  function readWithFallback(project, key) {
    if (project && project !== 'RHOAIENG') {
      return moduleRead(`data/${project}/${key}`);
    }
    return moduleRead(`data/RHOAIENG/${key}`) || moduleRead(key);
  }

  /**
   * Get storage functions optionally prefixed for a project.
   */
  function getDepsForProject(projectKey) {
    if (!projectKey || projectKey === 'RHOAIENG') {
      return { readStorage: moduleRead, writeStorage: moduleWrite };
    }
    const prefix = getStoragePrefix(projectKey);
    const { read, write } = createPrefixedStorage(prefix, moduleRead, moduleWrite);
    return { readStorage: read, writeStorage: write };
  }

  // ─── Refresh state (in-memory, matches ai-impact pattern) ───

  const refreshState = {
    running: false,
    startedAt: null,
    completedAt: null,
    lastResult: null
  };

  // ─── Refresh routes ───

  router.post('/discover-boards', requireAdmin, async function(req, res) {
    try {
      const projectKey = req.body.projectKey || 'RHOAIENG';
      if (!isValidProjectKey(projectKey)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const deps = getDepsForProject(projectKey);
      console.log(`\n[allocation-tracker] Discovering boards for project ${projectKey}`);

      const result = await discoverBoards({
        projectKey,
        fetchBoards: jiraClient.fetchBoards,
        fetchSprints: jiraClient.fetchSprints,
        readStorage: deps.readStorage,
        writeStorage: deps.writeStorage
      });

      res.json(result);
    } catch (error) {
      console.error('[allocation-tracker] Discover boards error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/refresh', requireAdmin, async function(req, res) {
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

    const projectKey = req.body.projectKey || 'RHOAIENG';
    if (!isValidProjectKey(projectKey)) {
      return res.status(400).json({ error: 'Invalid request parameter' });
    }
    const hardRefresh = req.body.hardRefresh || false;

    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();
    res.json({ status: 'started' });

    // Process in background (matches dev-server setImmediate pattern)
    setImmediate(async function() {
      try {
        const deps = getDepsForProject(projectKey);
        const teamsData = deps.readStorage('teams.json');
        const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];

        console.log(`\n[allocation-tracker] Starting refresh for ${projectKey}: ${enabledTeams.length} boards`);
        const boardResults = [];

        for (const team of enabledTeams) {
          try {
            const board = {
              id: team.boardId,
              name: team.boardName || team.displayName,
              teamId: team.teamId || String(team.boardId),
              sprintFilter: team.sprintFilter || '',
              calculationMode: team.calculationMode || 'points',
              boardType: team.boardType || 'scrum'
            };

            let result;
            if (board.boardType === 'kanban') {
              result = await processKanbanBoard({
                board,
                fetchBoardConfiguration: jiraClient.fetchBoardConfiguration,
                fetchFilterJql: jiraClient.fetchFilterJql,
                fetchIssuesByJql: jiraClient.fetchIssuesByJql,
                readStorage: deps.readStorage,
                writeStorage: deps.writeStorage
              });
            } else {
              result = await processBoard({
                board,
                hardRefresh,
                fetchSprints: jiraClient.fetchSprints,
                fetchSprintIssues: jiraClient.fetchSprintIssues,
                readStorage: deps.readStorage,
                writeStorage: deps.writeStorage
              });
            }
            boardResults.push(result);
            console.log(`  [allocation-tracker] Board ${team.boardName || team.displayName}: ${result.sprintResults.length} sprints`);
          } catch (error) {
            console.error(`  [allocation-tracker] Board ${team.boardName || team.displayName} failed:`, error.message);
          }
        }

        // Build dashboard summary AFTER all boards complete (no race condition)
        const dashboardSummary = { lastUpdated: new Date().toISOString(), boards: {} };
        for (const { board, dashboardSprint, dashboardSprintResult } of boardResults) {
          if (dashboardSprint && dashboardSprintResult) {
            dashboardSummary.boards[board.teamId || board.id] = {
              sprint: {
                id: dashboardSprint.id,
                name: dashboardSprint.name,
                state: dashboardSprint.state,
                startDate: dashboardSprint.startDate,
                endDate: dashboardSprint.endDate
              },
              summary: dashboardSprintResult.summary
            };
          }
        }
        deps.writeStorage('dashboard-summary.json', dashboardSummary);

        const completedAt = new Date().toISOString();
        refreshState.lastResult = {
          status: 'success',
          message: `Processed ${boardResults.length} boards`,
          completedAt
        };
        refreshState.completedAt = completedAt;
        console.log(`[allocation-tracker] Refresh complete: ${boardResults.length} boards processed`);
      } catch (error) {
        console.error('[allocation-tracker] Background refresh error:', error);
        const completedAt = new Date().toISOString();
        refreshState.lastResult = {
          status: 'error',
          message: 'Refresh failed',
          completedAt
        };
        refreshState.completedAt = completedAt;
      } finally {
        refreshState.running = false;
      }
    });
  });

  router.get('/refresh/status', function(req, res) {
    // Return a sanitized copy — strip internal error details from lastResult
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

  // ─── Data reader routes ───

  router.get('/projects', function(req, res) {
    try {
      const data = moduleRead('config/orgs.json');

      if (!data) {
        return res.json({
          orgName: 'AI Engineering',
          projects: [
            { key: 'RHOAIENG', name: 'OpenShift AI Engineering', pillar: 'OpenShift AI' },
            { key: 'AIPCC', name: 'AI Platform Core Components', pillar: 'AIPCC' },
            { key: 'INFERENG', name: 'Inference Engineering', pillar: 'INFERENG' }
          ]
        });
      }

      res.json(data);
    } catch (error) {
      console.error('[allocation-tracker] Read projects error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/org-summary', function(req, res) {
    try {
      const data = moduleRead('data/org-summary.json');

      if (!data) {
        return res.json({ lastUpdated: null, totalPoints: 0, projectCount: 0, boardCount: 0, buckets: {} });
      }

      res.json(data);
    } catch (error) {
      console.error('[allocation-tracker] Read org summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/projects/:projectKey/summary', function(req, res) {
    try {
      const { projectKey } = req.params;
      if (!isValidProjectKey(projectKey)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = readWithFallback(projectKey, 'dashboard-summary.json');

      if (!data) {
        return res.json({ lastUpdated: null, boards: {} });
      }

      res.json(data);
    } catch (error) {
      console.error('[allocation-tracker] Read project summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/boards', function(req, res) {
    try {
      const project = req.query.project || null;
      if (project && !isValidProjectKey(project)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = readWithFallback(project, 'boards.json');

      if (!data) {
        return res.json({ boards: [], lastUpdated: null });
      }

      // Build board-like entries from teams config (one entry per team, supporting sub-teams)
      const teamsData = readWithFallback(project, 'teams.json');
      if (teamsData && teamsData.teams) {
        const boardMap = new Map(data.boards.map(b => [b.id, b]));
        data.boards = teamsData.teams
          .filter(t => t.enabled !== false)
          .map(t => {
            const board = boardMap.get(t.boardId) || {};
            return {
              ...board,
              id: t.teamId || String(t.boardId),
              boardId: t.boardId,
              name: t.boardName || board.name,
              displayName: t.displayName || t.boardName || board.name
            };
          });
      }

      res.json(data);
    } catch (error) {
      console.error('[allocation-tracker] Read boards error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/boards/:boardId/sprints', function(req, res) {
    try {
      const { boardId } = req.params;
      if (!isValidBoardId(boardId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const project = req.query.project || null;
      if (project && !isValidProjectKey(project)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      let data = readWithFallback(project, `sprints/team-${boardId}.json`);
      if (!data) {
        data = readWithFallback(project, `sprints/board-${boardId}.json`);
      }

      if (!data) {
        return res.json({ sprints: [] });
      }

      res.json(data);
    } catch (error) {
      console.error('[allocation-tracker] Read sprints error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/sprints/:sprintId/issues', function(req, res) {
    try {
      const { sprintId } = req.params;
      if (!isValidSprintId(sprintId)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const project = req.query.project || null;
      if (project && !isValidProjectKey(project)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = readWithFallback(project, `sprints/${sprintId}.json`);

      if (!data) {
        return res.status(404).json({
          error: 'Sprint data not found. Please refresh to fetch data from Jira.'
        });
      }

      res.json(data);
    } catch (error) {
      console.error('[allocation-tracker] Read sprint issues error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/teams', function(req, res) {
    try {
      const project = req.query.project || null;
      if (project && !isValidProjectKey(project)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = readWithFallback(project, 'teams.json');
      if (!data) {
        return res.json({ teams: [] });
      }
      res.json(data);
    } catch (error) {
      console.error('[allocation-tracker] Read teams error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/teams', requireAdmin, function(req, res) {
    try {
      const { teams } = req.body;
      if (!teams || !Array.isArray(teams)) {
        return res.status(400).json({ error: 'Request must include "teams" array' });
      }

      // Validate each team object shape
      for (const team of teams) {
        if (team.boardId !== undefined && typeof team.boardId !== 'number') {
          return res.status(400).json({ error: 'Invalid team data' });
        }
        if (team.boardName !== undefined && typeof team.boardName !== 'string') {
          return res.status(400).json({ error: 'Invalid team data' });
        }
        if (team.displayName !== undefined && typeof team.displayName !== 'string') {
          return res.status(400).json({ error: 'Invalid team data' });
        }
        if (team.teamId !== undefined) {
          if (typeof team.teamId !== 'string' || !isPathSafeString(team.teamId)) {
            return res.status(400).json({ error: 'Invalid team data' });
          }
        }
        // Reject path-unsafe characters in string fields
        for (const field of ['boardName', 'displayName']) {
          if (team[field] !== undefined && !isPathSafeString(team[field])) {
            return res.status(400).json({ error: 'Invalid team data' });
          }
        }
      }

      const project = req.query.project || null;
      if (project && !isValidProjectKey(project)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }

      // IMPORTANT: Set manuallyConfigured: true on saved teams so
      // discoverBoards won't auto-disable manually-enabled stale boards
      const teamsWithFlag = teams.map(t => ({ ...t, manuallyConfigured: true }));

      const key = (project && project !== 'RHOAIENG') ? `data/${project}/teams.json` : 'teams.json';

      moduleWrite(key, { teams: teamsWithFlag });
      res.json({ success: true, teams: teamsWithFlag });
    } catch (error) {
      console.error('[allocation-tracker] Save teams error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/projects', requireAdmin, function(req, res) {
    try {
      const { orgName, projects } = req.body;
      if (!projects || !Array.isArray(projects)) {
        return res.status(400).json({ error: 'Request must include "projects" array' });
      }

      for (const project of projects) {
        if (!project.key || !project.name || !project.pillar) {
          return res.status(400).json({
            error: 'Each project must have "key", "name", and "pillar"'
          });
        }
        if (!isValidProjectKey(project.key)) {
          return res.status(400).json({ error: 'Invalid request parameter' });
        }
      }

      moduleWrite('config/orgs.json', { orgName: orgName || 'AI Engineering', projects });
      res.json({ success: true, projects });
    } catch (error) {
      console.error('[allocation-tracker] Save projects error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/dashboard-summary', function(req, res) {
    try {
      const project = req.query.project || null;
      if (project && !isValidProjectKey(project)) {
        return res.status(400).json({ error: 'Invalid request parameter' });
      }
      const data = readWithFallback(project, 'dashboard-summary.json');
      if (data) {
        return res.json(data);
      }

      // Build dashboard summary on-the-fly from existing sprint data
      const teamsData = readWithFallback(project, 'teams.json');
      const boardsData = readWithFallback(project, 'boards.json');
      if (!teamsData?.teams && (!boardsData || !boardsData.boards)) {
        return res.json({ lastUpdated: null, boards: {} });
      }

      const summary = { lastUpdated: boardsData?.lastUpdated || new Date().toISOString(), boards: {} };

      const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];
      for (const team of enabledTeams) {
        const teamId = team.teamId || String(team.boardId);
        let teamSprints = readWithFallback(project, `sprints/team-${teamId}.json`);
        if (!teamSprints) {
          teamSprints = readWithFallback(project, `sprints/board-${team.boardId}.json`);
        }
        if (!teamSprints?.sprints?.length) continue;

        const activeSprint = teamSprints.sprints.find(s => s.state === 'active');
        const dashSprint = activeSprint || [...teamSprints.sprints]
          .filter(s => s.state === 'closed')
          .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];

        if (!dashSprint) continue;

        const sprintData = readWithFallback(project, `sprints/${dashSprint.id}.json`);
        if (!sprintData?.summary) continue;

        summary.boards[teamId] = {
          sprint: {
            id: dashSprint.id,
            name: dashSprint.name,
            state: dashSprint.state,
            startDate: dashSprint.startDate,
            endDate: dashSprint.endDate
          },
          summary: sprintData.summary
        };
      }

      res.json(summary);
    } catch (error) {
      console.error('[allocation-tracker] Read dashboard summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Diagnostics ───

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const teamsData = moduleRead('teams.json');
      const dashData = moduleRead('dashboard-summary.json');
      return {
        refreshState,
        teamsConfigured: !!(teamsData?.teams?.length),
        teamCount: teamsData?.teams?.length || 0,
        dashboardExists: !!dashData,
        lastUpdated: dashData?.lastUpdated || null
      };
    });
  }
};
