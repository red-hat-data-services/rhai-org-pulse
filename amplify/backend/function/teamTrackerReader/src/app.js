const express = require('express');
const bodyParser = require('body-parser');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { readFromS3, writeToS3 } = require('./s3-storage');
const { verifyToken } = require('./verifyToken');

const app = express();
app.use(bodyParser.json());

// Enable CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

const lambdaClient = new LambdaClient({ region: process.env.REGION || 'us-east-1' });

// ─── Allowlist seed ───

async function seedAllowlist() {
  const existing = await readFromS3('allowlist.json');
  if (existing && existing.emails && existing.emails.length > 0) {
    return;
  }

  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    await writeToS3('allowlist.json', { emails: [] });
    return;
  }

  const emails = adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  await writeToS3('allowlist.json', { emails });
}

let allowlistSeeded = false;

// ─── Auth middleware ───

app.use(async function (req, res, next) {
  if (req.method === 'OPTIONS') return next();

  // Seed allowlist on first request
  if (!allowlistSeeded) {
    await seedAllowlist();
    allowlistSeeded = true;
  }

  // Verify Firebase token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  const result = await verifyToken(token);

  if (!result.valid) {
    return res.status(401).json({ error: result.error || 'Invalid or expired token' });
  }

  req.userEmail = result.email;

  // Check allowlist
  const allowlist = await readFromS3('allowlist.json');
  if (!allowlist || !allowlist.emails.includes(req.userEmail)) {
    return res.status(403).json({ error: 'Access denied. You are not on the allowlist.' });
  }

  next();
});

// ─── Routes: Refresh ───

app.post('/refresh', async function (req, res) {
  try {
    const hardRefresh = req.body.hardRefresh || false;

    const teamsData = await readFromS3('teams.json');
    const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];

    // Write initial refresh status
    await writeToS3('refresh-status.json', {
      type: 'started',
      timestamp: new Date().toISOString(),
      boardCount: enabledTeams.length
    });

    // Invoke refresher Lambda asynchronously
    const refresherName = `teamTrackerRefresher-${process.env.ENV || 'dev'}`;
    const command = new InvokeCommand({
      FunctionName: refresherName,
      InvocationType: 'Event',
      Payload: JSON.stringify({ hardRefresh })
    });

    await lambdaClient.send(command);

    res.status(202).json({ status: 'started', boardCount: enabledTeams.length });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/refresh/status', async function (req, res) {
  try {
    const status = await readFromS3('refresh-status.json');
    res.json(status || { type: 'idle' });
  } catch (error) {
    console.error('Refresh status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Reader ───

app.get('/boards', async function (req, res) {
  try {
    const teamsData = await readFromS3('teams.json');
    if (!teamsData || !teamsData.teams) {
      return res.json({ boards: [], lastUpdated: null });
    }

    const boards = teamsData.teams
      .filter(t => t.enabled !== false)
      .map(t => ({
        id: t.teamId || t.boardId,
        boardId: t.boardId,
        name: t.boardName || t.displayName,
        displayName: t.displayName || t.boardName,
        sprintFilter: t.sprintFilter || undefined
      }));

    const boardsData = await readFromS3('boards.json');
    res.json({ boards, lastUpdated: boardsData?.lastUpdated || null });
  } catch (error) {
    console.error('Read boards error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/boards/:boardId/sprints', async function (req, res) {
  try {
    const { boardId } = req.params;
    const data = await readFromS3(`sprints/team-${boardId}.json`)
      || await readFromS3(`sprints/board-${boardId}.json`);
    if (!data) {
      return res.json({ sprints: [] });
    }
    res.json(data);
  } catch (error) {
    console.error('Read sprints error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/boards/:boardId/trend', async function (req, res) {
  try {
    const { boardId } = req.params;
    const sprintIndex = await readFromS3(`sprints/team-${boardId}.json`)
      || await readFromS3(`sprints/board-${boardId}.json`);
    if (!sprintIndex?.sprints?.length) {
      return res.json({ sprints: [] });
    }

    const trendData = [];
    for (const sprint of sprintIndex.sprints) {
      if (sprint.state !== 'closed') continue;
      const sprintData = await readFromS3(`sprints/${sprint.id}.json`);
      if (!sprintData?.metrics) continue;

      const byAssignee = {};
      if (sprintData.byAssignee) {
        for (const [name, data] of Object.entries(sprintData.byAssignee)) {
          byAssignee[name] = {
            pointsCompleted: data.pointsCompleted,
            issuesCompleted: data.issuesCompleted,
            pointsAssigned: data.pointsAssigned,
            completionRate: data.completionRate
          };
        }
      }

      trendData.push({
        sprintId: sprint.id,
        sprintName: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate || sprint.completeDate,
        ...sprintData.metrics,
        byAssignee
      });
    }

    trendData.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    res.json({ sprints: trendData });
  } catch (error) {
    console.error('Read board trend error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/sprints/:sprintId', async function (req, res) {
  try {
    const { sprintId } = req.params;
    const data = await readFromS3(`sprints/${sprintId}.json`);
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

app.get('/teams', async function (req, res) {
  try {
    const data = await readFromS3('teams.json');
    if (!data) {
      return res.json({ teams: [] });
    }
    res.json(data);
  } catch (error) {
    console.error('Read teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/teams', async function (req, res) {
  try {
    const { teams } = req.body;
    if (!teams || !Array.isArray(teams)) {
      return res.status(400).json({ error: 'Request must include "teams" array' });
    }
    await writeToS3('teams.json', { teams });
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Save teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/dashboard-summary', async function (req, res) {
  try {
    const data = await readFromS3('dashboard-summary.json');
    if (data) {
      return res.json(data);
    }

    // Build on-the-fly from existing sprint data
    const teamsData = await readFromS3('teams.json');
    const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];
    if (enabledTeams.length === 0) {
      return res.json({ lastUpdated: null, boards: {} });
    }

    const boardsData = await readFromS3('boards.json');
    const ROLLING_SPRINT_COUNT = 6;
    const summary = { lastUpdated: boardsData?.lastUpdated || null, boards: {} };

    for (const team of enabledTeams) {
      const teamId = team.teamId || String(team.boardId);
      const boardSprints = await readFromS3(`sprints/team-${teamId}.json`)
        || await readFromS3(`sprints/board-${team.boardId}.json`);
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
        const sd = await readFromS3(`sprints/${sprint.id}.json`);
        if (!sd) continue;
        totalCommitted += sd.committed?.totalPoints || 0;
        totalDelivered += sd.delivered?.totalPoints || 0;
        totalScopeChange += sd.metrics?.scopeChangeCount || 0;
        sprintsUsed++;
      }

      summary.boards[teamId] = {
        boardName: team.displayName || team.boardName,
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

app.get('/trend', async function (req, res) {
  try {
    const boardIds = (req.query.boardIds || '').split(',').filter(Boolean);
    if (boardIds.length === 0) {
      return res.json({ months: [] });
    }

    const allSprintData = [];
    for (const boardId of boardIds) {
      const sprintIndex = await readFromS3(`sprints/team-${boardId}.json`)
        || await readFromS3(`sprints/board-${boardId}.json`);
      if (!sprintIndex?.sprints?.length) continue;

      for (const sprint of sprintIndex.sprints) {
        if (sprint.state !== 'closed') continue;
        const sprintData = await readFromS3(`sprints/${sprint.id}.json`);
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

// ─── Routes: Annotations ───

app.get('/sprints/:sprintId/annotations', async function (req, res) {
  try {
    const { sprintId } = req.params;
    const data = await readFromS3(`annotations/${sprintId}.json`);
    res.json(data || { annotations: {} });
  } catch (error) {
    console.error('Read annotations error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/sprints/:sprintId/annotations', async function (req, res) {
  try {
    const { sprintId } = req.params;
    const { assignee, text } = req.body;
    if (!assignee || !text) {
      return res.status(400).json({ error: 'assignee and text are required' });
    }

    const data = await readFromS3(`annotations/${sprintId}.json`) || { annotations: {} };
    if (!data.annotations[assignee]) {
      data.annotations[assignee] = [];
    }

    const annotation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      author: req.userEmail,
      createdAt: new Date().toISOString()
    };

    data.annotations[assignee].push(annotation);
    await writeToS3(`annotations/${sprintId}.json`, data);
    res.json(annotation);
  } catch (error) {
    console.error('Save annotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/sprints/:sprintId/annotations/:assignee/:annotationId', async function (req, res) {
  try {
    const { sprintId, assignee, annotationId } = req.params;
    const data = await readFromS3(`annotations/${sprintId}.json`);
    if (!data?.annotations?.[assignee]) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const before = data.annotations[assignee].length;
    data.annotations[assignee] = data.annotations[assignee].filter(a => a.id !== annotationId);

    if (data.annotations[assignee].length === before) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    if (data.annotations[assignee].length === 0) {
      delete data.annotations[assignee];
    }

    await writeToS3(`annotations/${sprintId}.json`, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Allowlist ───

app.get('/allowlist', async function (req, res) {
  try {
    const data = await readFromS3('allowlist.json') || { emails: [] };
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Read allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/allowlist', async function (req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@redhat.com')) {
      return res.status(400).json({ error: 'Only @redhat.com email addresses are allowed' });
    }

    const data = await readFromS3('allowlist.json') || { emails: [] };
    if (data.emails.includes(normalized)) {
      return res.status(409).json({ error: 'Email is already on the allowlist' });
    }

    data.emails.push(normalized);
    await writeToS3('allowlist.json', data);
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Add to allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/allowlist/:email', async function (req, res) {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const data = await readFromS3('allowlist.json') || { emails: [] };

    if (!data.emails.includes(email)) {
      return res.status(404).json({ error: 'Email not found on allowlist' });
    }

    if (data.emails.length <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last user from the allowlist' });
    }

    data.emails = data.emails.filter(e => e !== email);
    await writeToS3('allowlist.json', data);
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Remove from allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
