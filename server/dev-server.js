/**
 * Local development server
 *
 * Combines fetcher and reader Express routes into a single
 * server, using local file storage instead of S3.
 *
 * Usage:
 *   JIRA_TOKEN=your-token node server/dev-server.js
 *
 * Or with a .env file:
 *   node -r dotenv/config server/dev-server.js
 */

const express = require('express');
const fetch = require('node-fetch');
const { readFromStorage, writeToStorage } = require('./storage');
const { createJiraClient } = require('./jira/jira-client');
const { discoverBoards, performRefresh } = require('./jira/orchestration');

const app = express();
app.use(express.json());

// Enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

const JIRA_HOST = process.env.JIRA_HOST || 'https://issues.redhat.com';
const PORT = process.env.API_PORT || 3001;

// ─── Auth middleware (skip Firebase verification in local dev) ───

function localAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('  [auth] No auth header - OK in local dev');
  }
  req.userEmail = 'local-dev@redhat.com';
  next();
}

app.use(localAuth);

// ─── Jira API helpers ───

function getJiraToken() {
  const token = process.env.JIRA_TOKEN;
  if (!token) {
    throw new Error(
      'JIRA_TOKEN environment variable is not set.\n' +
      'Set it in a .env file or pass it directly:\n' +
      '  JIRA_TOKEN=your-token node server/dev-server.js'
    );
  }
  return token;
}

async function jiraRequest(path) {
  const token = getJiraToken();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`${JIRA_HOST}${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('retry-after'), 10);
      const delay = (!isNaN(retryAfter) && retryAfter > 0) ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
      console.warn(`[Jira API] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira API error (${response.status}): ${text}`);
    }

    return response.json();
  }
}

// Create Jira client
const jiraClient = createJiraClient({ jiraRequest, jiraHost: JIRA_HOST });

const orchestrationDeps = {
  ...jiraClient,
  readStorage: readFromStorage,
  writeStorage: writeToStorage
};

// ─── Routes: Fetcher ───

app.post('/api/discover-boards', async function(req, res) {
  try {
    console.log('\nDiscovering boards for project RHOAIENG');
    const result = await discoverBoards(orchestrationDeps);
    res.json(result);
  } catch (error) {
    console.error('Discover boards error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refresh', function(req, res) {
  const hardRefresh = req.body.hardRefresh || false;

  const teamsData = readFromStorage('teams.json');
  const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];

  res.json({ status: 'started', boardCount: enabledTeams.length });

  setImmediate(async () => {
    try {
      console.log(`\nStarting refresh: ${enabledTeams.length} boards (hardRefresh: ${hardRefresh})`);
      await performRefresh({ ...orchestrationDeps, hardRefresh });
      console.log('Refresh complete');
    } catch (error) {
      console.error('Background refresh error:', error);
    }
  });
});

// ─── Routes: Reader ───

app.get('/api/boards', function(req, res) {
  try {
    const data = readFromStorage('boards.json');
    if (!data) {
      return res.json({ boards: [], lastUpdated: null });
    }

    // Merge with team config
    const teamsData = readFromStorage('teams.json');
    if (teamsData && teamsData.teams) {
      const teamMap = new Map(teamsData.teams.map(t => [t.boardId, t]));
      data.boards = data.boards
        .map(board => {
          const teamConfig = teamMap.get(board.id);
          return {
            ...board,
            displayName: teamConfig?.displayName || board.name,
            enabled: teamConfig?.enabled !== false
          };
        })
        .filter(board => board.enabled);
    }

    res.json(data);
  } catch (error) {
    console.error('Read boards error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boards/:boardId/sprints', function(req, res) {
  try {
    const { boardId } = req.params;
    const data = readFromStorage(`sprints/board-${boardId}.json`);
    if (!data) {
      return res.json({ sprints: [] });
    }
    res.json(data);
  } catch (error) {
    console.error('Read sprints error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boards/:boardId/trend', function(req, res) {
  try {
    const { boardId } = req.params;
    const sprintIndex = readFromStorage(`sprints/board-${boardId}.json`);
    if (!sprintIndex?.sprints?.length) {
      return res.json({ sprints: [] });
    }

    const trendData = [];
    for (const sprint of sprintIndex.sprints) {
      if (sprint.state !== 'closed') continue;
      const sprintData = readFromStorage(`sprints/${sprint.id}.json`);
      if (!sprintData?.metrics) continue;
      trendData.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate || sprint.completeDate,
        ...sprintData.metrics
      });
    }

    // Sort chronologically
    trendData.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    res.json({ sprints: trendData });
  } catch (error) {
    console.error('Read board trend error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sprints/:sprintId', function(req, res) {
  try {
    const { sprintId } = req.params;
    const data = readFromStorage(`sprints/${sprintId}.json`);
    if (!data) {
      return res.status(404).json({
        error: 'Sprint data not found. Please refresh to fetch data from Jira.'
      });
    }
    res.json(data);
  } catch (error) {
    console.error('Read sprint data error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/teams', function(req, res) {
  try {
    const data = readFromStorage('teams.json');
    if (!data) {
      return res.json({ teams: [] });
    }
    res.json(data);
  } catch (error) {
    console.error('Read teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams', function(req, res) {
  try {
    const { teams } = req.body;
    if (!teams || !Array.isArray(teams)) {
      return res.status(400).json({ error: 'Request must include "teams" array' });
    }
    writeToStorage('teams.json', { teams });
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Save teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard-summary', function(req, res) {
  try {
    const data = readFromStorage('dashboard-summary.json');
    if (data) {
      return res.json(data);
    }

    // Build on-the-fly from existing sprint data
    const boardsData = readFromStorage('boards.json');
    if (!boardsData || !boardsData.boards) {
      return res.json({ lastUpdated: null, boards: {} });
    }

    const teamsData = readFromStorage('teams.json');
    const enabledBoardIds = new Set(
      teamsData?.teams?.filter(t => t.enabled !== false).map(t => t.boardId) || boardsData.boards.map(b => b.id)
    );

    const ROLLING_SPRINT_COUNT = 6;
    const summary = { lastUpdated: boardsData.lastUpdated, boards: {} };

    for (const board of boardsData.boards) {
      if (!enabledBoardIds.has(board.id)) continue;

      const boardSprints = readFromStorage(`sprints/board-${board.id}.json`);
      if (!boardSprints?.sprints?.length) continue;

      const closedSprints = [...boardSprints.sprints]
        .filter(s => s.state === 'closed')
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

      if (closedSprints.length === 0) continue;

      const latestClosed = closedSprints[0];
      const recentSprints = closedSprints.slice(0, ROLLING_SPRINT_COUNT);

      let totalCommitted = 0;
      let totalDelivered = 0;
      let totalScopeChange = 0;
      let sprintsUsed = 0;

      for (const sprint of recentSprints) {
        const sd = readFromStorage(`sprints/${sprint.id}.json`);
        if (!sd) continue;
        totalCommitted += sd.committed?.totalPoints || 0;
        totalDelivered += sd.delivered?.totalPoints || 0;
        totalScopeChange += sd.metrics?.scopeChangeCount || 0;
        sprintsUsed++;
      }

      summary.boards[board.id] = {
        boardName: board.name,
        sprint: {
          id: latestClosed.id,
          name: latestClosed.name,
          state: latestClosed.state,
          startDate: latestClosed.startDate,
          endDate: latestClosed.endDate
        },
        metrics: {
          commitmentReliabilityPoints: totalCommitted > 0
            ? Math.round((totalDelivered / totalCommitted) * 100)
            : 0,
          avgVelocityPoints: sprintsUsed > 0 ? Math.round(totalDelivered / sprintsUsed) : 0,
          avgScopeChange: sprintsUsed > 0 ? +(totalScopeChange / sprintsUsed).toFixed(1) : 0,
          sprintsUsed
        }
      };
    }

    res.json(summary);
  } catch (error) {
    console.error('Read dashboard summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/trend', function(req, res) {
  try {
    const boardIds = (req.query.boardIds || '').split(',').filter(Boolean).map(Number);
    if (boardIds.length === 0) {
      return res.json({ months: [] });
    }

    const allSprintData = [];
    for (const boardId of boardIds) {
      const sprintIndex = readFromStorage(`sprints/board-${boardId}.json`);
      if (!sprintIndex?.sprints?.length) continue;

      for (const sprint of sprintIndex.sprints) {
        if (sprint.state !== 'closed') continue;
        const sprintData = readFromStorage(`sprints/${sprint.id}.json`);
        if (!sprintData?.metrics) continue;
        allSprintData.push({
          endDate: sprint.endDate || sprint.completeDate,
          velocityPoints: sprintData.metrics.velocityPoints || 0,
          velocityCount: sprintData.metrics.velocityCount || 0,
          committedPoints: sprintData.committed?.totalPoints || 0,
          deliveredPoints: sprintData.delivered?.totalPoints || 0
        });
      }
    }

    // Aggregate into monthly buckets
    const buckets = {};
    for (const sprint of allSprintData) {
      if (!sprint.endDate) continue;
      const date = new Date(sprint.endDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets[key]) {
        buckets[key] = { month: key, velocityPoints: 0, velocityCount: 0, committedPoints: 0, deliveredPoints: 0, sprintCount: 0 };
      }
      const b = buckets[key];
      b.velocityPoints += sprint.velocityPoints;
      b.velocityCount += sprint.velocityCount;
      b.committedPoints += sprint.committedPoints;
      b.deliveredPoints += sprint.deliveredPoints;
      b.sprintCount += 1;
    }

    const months = Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
    res.json({ months });
  } catch (error) {
    console.error('Read aggregate trend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// CORS preflight
app.options('/api/{*path}', function(req, res) { res.status(200).end(); });

// ─── Start ───

app.listen(PORT, function() {
  console.log(`\nTeam Tracker dev server running at http://localhost:${PORT}`);
  console.log(`Jira host: ${JIRA_HOST}`);
  console.log(`Local storage: ./data/`);
  console.log(`JIRA_TOKEN: ${process.env.JIRA_TOKEN ? 'set' : 'NOT SET (refresh will fail)'}\n`);
});
