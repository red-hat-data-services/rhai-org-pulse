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

// Demo mode: use fixtures instead of data directory
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const storageModule = DEMO_MODE ? require('./demo-storage') : require('./storage');
const { readFromStorage, writeToStorage, listStorageFiles } = storageModule;

const { createJiraClient } = require('./jira/jira-client');
const { discoverBoards, performRefresh } = require('./jira/orchestration');
const { fetchPersonMetrics } = require('./jira/person-metrics');

if (DEMO_MODE) {
  console.log('🎭 Running in DEMO MODE - using fixture data, Jira/GitHub APIs disabled');
}

// Firebase Admin for production token verification
let firebaseAdmin = null;
if (process.env.NODE_ENV === 'production' || process.env.FIREBASE_AUTH === 'true') {
  firebaseAdmin = require('firebase-admin');
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp();
  }
}

const app = express();
app.use(express.json());

// Enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Demo mode: block refresh routes that would call external APIs
if (DEMO_MODE) {
  app.use(function(req, res, next) {
    if (req.method === 'POST' && req.path.includes('refresh')) {
      return res.json({
        status: 'skipped',
        message: 'Refresh disabled in demo mode - using fixture data'
      });
    }
    next();
  });
}

const JIRA_HOST = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
const PORT = process.env.API_PORT || 3001;

// ─── Allowlist seed ───

function seedAllowlist() {
  const existing = readFromStorage('allowlist.json');
  if (existing && existing.emails && existing.emails.length > 0) {
    console.log(`Allowlist: ${existing.emails.length} user(s) loaded`);
    return;
  }

  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    console.warn('WARNING: No allowlist.json and ADMIN_EMAILS not set — all API requests will 403');
    writeToStorage('allowlist.json', { emails: [] });
    return;
  }

  const emails = adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  writeToStorage('allowlist.json', { emails });
  console.log(`Allowlist: seeded with ${emails.length} email(s) from ADMIN_EMAILS`);
}

// ─── Auth middleware ───

async function authMiddleware(req, res, next) {
  // Skip CORS preflight
  if (req.method === 'OPTIONS') return next();

  // Determine user email
  if (firebaseAdmin) {
    // Production: verify Firebase ID token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    try {
      const token = authHeader.split('Bearer ')[1];
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      req.userEmail = decoded.email.toLowerCase();
    } catch (err) {
      console.error('[auth] Token verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } else {
    // Local dev: use hardcoded email
    req.userEmail = 'local-dev@redhat.com';
  }

  // Check allowlist
  const allowlist = readFromStorage('allowlist.json');
  if (!allowlist || !allowlist.emails.includes(req.userEmail)) {
    return res.status(403).json({ error: 'Access denied. You are not on the allowlist.' });
  }

  next();
}

app.use(authMiddleware);

// ─── Jira API helpers ───

function getJiraAuth() {
  const token = process.env.JIRA_TOKEN;
  const email = process.env.JIRA_EMAIL;
  if (!token || !email) {
    throw new Error(
      'JIRA_TOKEN and JIRA_EMAIL environment variables must be set.\n' +
      'Set them in a .env file or pass them directly:\n' +
      '  JIRA_EMAIL=you@redhat.com JIRA_TOKEN=your-api-token node server/dev-server.js'
    );
  }
  return Buffer.from(`${email}:${token}`).toString('base64');
}

async function jiraRequest(path, { method = 'GET', body } = {}) {
  const auth = getJiraAuth();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const options = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${JIRA_HOST}${path}`, options);

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

app.get('/api/refresh/stream', function(req, res) {
  const hardRefresh = req.query.hardRefresh === 'true';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  let clientDisconnected = false;
  req.on('close', () => { clientDisconnected = true; });

  function sendEvent(data) {
    if (!clientDisconnected) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  performRefresh({
    ...orchestrationDeps,
    hardRefresh,
    onProgress: sendEvent
  }).then(() => {
    if (!clientDisconnected) res.end();
  }).catch((error) => {
    console.error('SSE refresh error:', error);
    sendEvent({ type: 'error', message: error.message });
    if (!clientDisconnected) res.end();
  });
});

// ─── Routes: Reader ───

app.get('/api/boards', function(req, res) {
  try {
    const teamsData = readFromStorage('teams.json');
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

    const boardsData = readFromStorage('boards.json');
    res.json({ boards, lastUpdated: boardsData?.lastUpdated || null });
  } catch (error) {
    console.error('Read boards error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boards/:boardId/sprints', function(req, res) {
  try {
    const { boardId } = req.params;
    const data = readFromStorage(`sprints/team-${boardId}.json`)
      || readFromStorage(`sprints/board-${boardId}.json`);
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
    const sprintIndex = readFromStorage(`sprints/team-${boardId}.json`)
      || readFromStorage(`sprints/board-${boardId}.json`);
    if (!sprintIndex?.sprints?.length) {
      return res.json({ sprints: [] });
    }

    const trendData = [];
    for (const sprint of sprintIndex.sprints) {
      if (sprint.state !== 'closed') continue;
      const sprintData = readFromStorage(`sprints/${sprint.id}.json`);
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
    const teamsData = readFromStorage('teams.json');
    const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];
    if (enabledTeams.length === 0) {
      return res.json({ lastUpdated: null, boards: {} });
    }

    const boardsData = readFromStorage('boards.json');
    const ROLLING_SPRINT_COUNT = 6;
    const summary = { lastUpdated: boardsData?.lastUpdated || null, boards: {} };

    for (const team of enabledTeams) {
      const teamId = team.teamId || String(team.boardId);
      const boardSprints = readFromStorage(`sprints/team-${teamId}.json`)
        || readFromStorage(`sprints/board-${team.boardId}.json`);
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

app.get('/api/trend', function(req, res) {
  try {
    const boardIds = (req.query.boardIds || '').split(',').filter(Boolean);
    if (boardIds.length === 0) {
      return res.json({ months: [] });
    }

    const allSprintData = [];
    for (const boardId of boardIds) {
      const sprintIndex = readFromStorage(`sprints/team-${boardId}.json`)
        || readFromStorage(`sprints/board-${boardId}.json`);
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

// ─── Jira Name Resolution Cache ───

let jiraNameCache = readFromStorage('jira-name-map.json') || {};

function persistNameCache() {
  writeToStorage('jira-name-map.json', jiraNameCache);
}

// ─── Routes: Roster & Person Metrics ───

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function readRosterFull() {
  return readFromStorage('org-roster-full.json');
}

/**
 * Derive team groupings from the full org roster.
 * Groups members by jiraTeam within each org leader's scope.
 * Returns { orgs: [ { key, leader, teams: { teamName: { displayName, members } } } ] }
 */
const ORG_DISPLAY_NAMES = {
  shgriffi: 'AI Platform',
  crobson: 'AAET',
  tgunders: 'AI Platform Core Components',
  tibrahim: 'Inference Engineering',
  kaixu: 'AI Innovation',
  moromila: 'WatsonX.ai'
};

const EXCLUDED_TITLES = ['Intern', 'Collaborative Partner', 'Independent Contractor'];

function deriveRoster() {
  const full = readRosterFull();
  const orgs = [];

  for (const [orgKey, orgData] of Object.entries(full.orgs)) {
    const teamMap = {};
    const allMembers = [orgData.leader, ...orgData.members]
      .filter(p => !EXCLUDED_TITLES.includes(p.title));

    for (const person of allMembers) {
      // Split comma-separated team names so multi-team people appear in each team
      const teamNames = person.jiraTeam
        ? person.jiraTeam.split(',').map(t => t.trim()).filter(Boolean)
        : ['_unassigned'];

      const memberEntry = {
        name: person.name,
        jiraDisplayName: person.name,
        uid: person.uid,
        email: person.email,
        title: person.title,
        specialty: person.specialty || null,
        manager: person.managerUid || null,
        miroTeam: person.miroTeam || null,
        jiraComponent: person.jiraComponent || null,
        jiraTeam: person.jiraTeam || null,
        status: person.status || null,
        githubUsername: person.githubUsername || null,
        gitlabUsername: person.gitlabUsername || null,
        geo: person.geo || null,
        location: person.location || null,
        country: person.country || null,
        city: person.city || null
      };

      for (const teamName of teamNames) {
        if (!teamMap[teamName]) {
          teamMap[teamName] = {
            displayName: teamName === '_unassigned' ? 'Unassigned' : teamName,
            members: []
          };
        }
        teamMap[teamName].members.push(memberEntry);
      }
    }

    orgs.push({
      key: orgKey,
      displayName: ORG_DISPLAY_NAMES[orgKey] || orgData.leader.name,
      leader: {
        name: orgData.leader.name,
        uid: orgData.leader.uid,
        title: orgData.leader.title
      },
      teams: teamMap
    });
  }

  return { vp: full.vp, orgs };
}

app.get('/api/roster', function(req, res) {
  try {
    const roster = deriveRoster();
    res.json(roster);
  } catch (error) {
    console.error('Read roster error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/people/metrics', function(req, res) {
  try {
    const files = listStorageFiles('people');
    if (files.length === 0) return res.json({});

    const result = {};
    for (const file of files) {
      try {
        const data = readFromStorage(`people/${file}`);
        if (data.jiraDisplayName) {
          result[data.jiraDisplayName] = {
            resolvedCount: data.resolved?.count ?? 0,
            resolvedPoints: data.resolved?.storyPoints ?? 0,
            inProgressCount: data.inProgress?.count ?? 0,
            avgCycleTimeDays: data.cycleTime?.avgDays ?? null,
            fetchedAt: data.fetchedAt
          };
        }
      } catch {
        // skip malformed files
      }
    }
    res.json(result);
  } catch (error) {
    console.error('Read bulk people metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/person/:jiraDisplayName/metrics', async function(req, res) {
  try {
    const name = decodeURIComponent(req.params.jiraDisplayName);
    const key = sanitizeFilename(name);
    const cachePath = `people/${key}.json`;
    const forceRefresh = req.query.refresh === 'true';

    // Check cache (4-hour TTL, or any age in demo mode)
    const cached = (!forceRefresh || DEMO_MODE) ? readFromStorage(cachePath) : null;
    if (cached) {
      if (DEMO_MODE || (cached.fetchedAt && (Date.now() - new Date(cached.fetchedAt).getTime()) < 4 * 60 * 60 * 1000)) {
        return res.json(cached);
      }
    }

    if (DEMO_MODE) {
      return res.status(404).json({ error: `No demo data for ${name}` });
    }

    // Fetch from Jira, fall back to stale cache if Jira is unavailable
    try {
      const metrics = await fetchPersonMetrics(jiraRequest, name, { nameCache: jiraNameCache });
      if (metrics._resolvedName) {
        persistNameCache();
        delete metrics._resolvedName;
      }
      writeToStorage(cachePath, metrics);
      return res.json(metrics);
    } catch (jiraErr) {
      if (cached) {
        console.warn(`Jira fetch failed for ${name}, returning stale cache:`, jiraErr.message);
        return res.json({ ...cached, stale: true, staleReason: 'Jira is temporarily unavailable' });
      }
      throw jiraErr;
    }
  } catch (error) {
    console.error(`Person metrics error (${req.params.jiraDisplayName}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/team/:teamKey/metrics', function(req, res) {
  try {
    const teamKey = decodeURIComponent(req.params.teamKey);
    const roster = deriveRoster();

    // teamKey format: "orgKey::teamName"
    const sepIdx = teamKey.indexOf('::');
    let team = null;
    let orgKey = null;
    let teamName = null;

    if (sepIdx !== -1) {
      orgKey = teamKey.substring(0, sepIdx);
      teamName = teamKey.substring(sepIdx + 2);
      const org = roster.orgs.find(o => o.key === orgKey);
      if (org) team = org.teams[teamName];
    } else {
      // Fallback: search all orgs for the team name
      for (const org of roster.orgs) {
        if (org.teams[teamKey]) {
          team = org.teams[teamKey];
          orgKey = org.key;
          teamName = teamKey;
          break;
        }
      }
    }

    if (!team) {
      return res.status(404).json({ error: `Team "${teamKey}" not found in roster` });
    }

    // Deduplicate members by jiraDisplayName
    const seen = new Set();
    const uniqueMembers = team.members.filter(m => {
      if (seen.has(m.jiraDisplayName)) return false;
      seen.add(m.jiraDisplayName);
      return true;
    });

    let resolvedCount = 0;
    let resolvedPoints = 0;
    let inProgressCount = 0;
    let cycleTimesSum = 0;
    let cycleTimesCount = 0;
    const members = [];
    const resolvedIssues = [];

    for (const member of uniqueMembers) {
      const key = sanitizeFilename(member.jiraDisplayName);
      const cached = readFromStorage(`people/${key}.json`);
      const memberData = {
        name: member.name,
        jiraDisplayName: member.jiraDisplayName,
        specialty: member.specialty,
        metrics: null
      };

      if (cached) {
        memberData.metrics = {
          fetchedAt: cached.fetchedAt,
          resolvedCount: cached.resolved?.count || 0,
          resolvedPoints: cached.resolved?.storyPoints || 0,
          inProgressCount: cached.inProgress?.count || 0,
          avgCycleTimeDays: cached.cycleTime?.avgDays
        };
        resolvedCount += cached.resolved?.count || 0;
        resolvedPoints += cached.resolved?.storyPoints || 0;
        inProgressCount += cached.inProgress?.count || 0;
        if (cached.resolved?.issues) {
          for (const issue of cached.resolved.issues) {
            resolvedIssues.push({ ...issue, assignee: member.jiraDisplayName });
          }
        }
        if (cached.cycleTime?.avgDays != null) {
          cycleTimesSum += cached.cycleTime.avgDays;
          cycleTimesCount++;
        }
      }

      members.push(memberData);
    }

    res.json({
      teamKey,
      displayName: team.displayName,
      memberCount: uniqueMembers.length,
      aggregate: {
        resolvedCount,
        resolvedPoints,
        inProgressCount,
        avgCycleTimeDays: cycleTimesCount > 0 ? +(cycleTimesSum / cycleTimesCount).toFixed(1) : null
      },
      members,
      resolvedIssues
    });
  } catch (error) {
    console.error(`Team metrics error (${req.params.teamKey}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/roster/refresh', function(req, res) {
  try {
    const roster = deriveRoster();

    // Collect unique members across all orgs and teams
    const seen = new Set();
    const uniqueMembers = [];
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        for (const member of team.members) {
          if (!seen.has(member.jiraDisplayName)) {
            seen.add(member.jiraDisplayName);
            uniqueMembers.push(member);
          }
        }
      }
    }

    res.json({ status: 'started', memberCount: uniqueMembers.length });

    // Background fetch with concurrency limit of 3
    setImmediate(async () => {
      const CONCURRENCY = 3;
      let i = 0;
      let completed = 0;

      async function next() {
        if (i >= uniqueMembers.length) return;
        const member = uniqueMembers[i++];
        try {
          console.log(`[roster-refresh] Fetching metrics for ${member.jiraDisplayName} (${++completed}/${uniqueMembers.length})`);
          const metrics = await fetchPersonMetrics(jiraRequest, member.jiraDisplayName, { nameCache: jiraNameCache });
          if (metrics._resolvedName) {
            delete metrics._resolvedName;
          }
          const key = sanitizeFilename(member.jiraDisplayName);
          writeToStorage(`people/${key}.json`, metrics);
        } catch (error) {
          console.error(`[roster-refresh] Failed for ${member.jiraDisplayName}:`, error.message);
          completed++;
        }
        return next();
      }

      const workers = [];
      for (let w = 0; w < CONCURRENCY; w++) {
        workers.push(next());
      }
      await Promise.all(workers);
      persistNameCache();
      console.log(`[roster-refresh] All teams refresh complete (${uniqueMembers.length} members)`);
    });
  } catch (error) {
    console.error('Roster refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/team/:teamKey/refresh', function(req, res) {
  try {
    const teamKey = decodeURIComponent(req.params.teamKey);
    const roster = deriveRoster();

    // teamKey format: "orgKey::teamName"
    let team = null;
    const sepIdx = teamKey.indexOf('::');
    if (sepIdx !== -1) {
      const orgKey = teamKey.substring(0, sepIdx);
      const teamName = teamKey.substring(sepIdx + 2);
      const org = roster.orgs.find(o => o.key === orgKey);
      if (org) team = org.teams[teamName];
    } else {
      for (const org of roster.orgs) {
        if (org.teams[teamKey]) {
          team = org.teams[teamKey];
          break;
        }
      }
    }

    if (!team) {
      return res.status(404).json({ error: `Team "${teamKey}" not found in roster` });
    }

    // Deduplicate members by jiraDisplayName
    const seen = new Set();
    const uniqueMembers = team.members.filter(m => {
      if (seen.has(m.jiraDisplayName)) return false;
      seen.add(m.jiraDisplayName);
      return true;
    });

    res.json({ status: 'started', memberCount: uniqueMembers.length });

    // Background fetch with concurrency limit of 3
    setImmediate(async () => {
      const CONCURRENCY = 3;
      let i = 0;

      async function next() {
        if (i >= uniqueMembers.length) return;
        const member = uniqueMembers[i++];
        try {
          console.log(`[refresh] Fetching metrics for ${member.jiraDisplayName} (${i}/${uniqueMembers.length})`);
          const metrics = await fetchPersonMetrics(jiraRequest, member.jiraDisplayName, { nameCache: jiraNameCache });
          if (metrics._resolvedName) {
            delete metrics._resolvedName;
          }
          const key = sanitizeFilename(member.jiraDisplayName);
          writeToStorage(`people/${key}.json`, metrics);
        } catch (error) {
          console.error(`[refresh] Failed for ${member.jiraDisplayName}:`, error.message);
        }
        return next();
      }

      const workers = [];
      for (let w = 0; w < CONCURRENCY; w++) {
        workers.push(next());
      }
      await Promise.all(workers);
      persistNameCache();
      console.log(`[refresh] Team "${teamKey}" refresh complete`);
    });
  } catch (error) {
    console.error(`Team refresh error (${req.params.teamKey}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jira-name-cache', function(req, res) {
  jiraNameCache = {};
  writeToStorage('jira-name-map.json', {});
  res.json({ success: true });
});

// ─── Routes: GitHub Contributions ───

const { fetchContributions } = require('./github/contributions');

const GITHUB_CACHE_PATH = 'github-contributions.json';

function readGithubCache() {
  return readFromStorage(GITHUB_CACHE_PATH) || { users: {}, fetchedAt: null };
}

app.get('/api/github/contributions', function(req, res) {
  try {
    const cache = readGithubCache();
    res.json(cache);
  } catch (error) {
    console.error('Read GitHub contributions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/github/contributions/:username', function(req, res) {
  try {
    const username = decodeURIComponent(req.params.username);
    const cache = readGithubCache();
    const data = cache.users[username] || null;
    res.json(data);
  } catch (error) {
    console.error('Read GitHub contribution error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/github/contributions/:username/refresh', function(req, res) {
  try {
    const username = decodeURIComponent(req.params.username);
    const results = fetchContributions([username]);
    const cache = readGithubCache();

    if (results[username]) {
      cache.users[username] = results[username];
      writeToStorage(GITHUB_CACHE_PATH, cache);
    }

    res.json(results[username] || null);
  } catch (error) {
    console.error('GitHub single user refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/github/refresh', function(req, res) {
  try {
    const roster = deriveRoster();

    // Collect all unique GitHub usernames across all orgs
    const usernameMap = {}; // githubUsername -> person name
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        for (const member of team.members) {
          if (member.githubUsername && !usernameMap[member.githubUsername]) {
            usernameMap[member.githubUsername] = member.name;
          }
        }
      }
    }

    const usernames = Object.keys(usernameMap);
    res.json({ status: 'started', usernameCount: usernames.length });

    // Fetch in background
    setImmediate(() => {
      try {
        const results = fetchContributions(usernames);
        const cache = readGithubCache();

        for (const [username, data] of Object.entries(results)) {
          if (data) {
            cache.users[username] = data;
          }
        }
        cache.fetchedAt = new Date().toISOString();

        writeToStorage(GITHUB_CACHE_PATH, cache);
        console.log(`[github] Refresh complete. ${Object.keys(results).length} users processed.`);
      } catch (err) {
        console.error('[github] Refresh failed:', err.message);
      }
    });
  } catch (error) {
    console.error('GitHub refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: GitLab Contributions ───

const { fetchContributions: fetchGitlabContributions, fetchContributionHistory: fetchGitlabContributionHistory } = require('./gitlab/contributions');

const GITLAB_CACHE_PATH = 'gitlab-contributions.json';
const GITLAB_HISTORY_CACHE_PATH = 'gitlab-history.json';

function readGitlabCache() {
  return readFromStorage(GITLAB_CACHE_PATH) || { users: {}, fetchedAt: null };
}

function readGitlabHistoryCache() {
  return readFromStorage(GITLAB_HISTORY_CACHE_PATH) || { users: {}, fetchedAt: null };
}

app.get('/api/gitlab/contributions', function(req, res) {
  try {
    const cache = readGitlabCache();
    res.json(cache);
  } catch (error) {
    console.error('Read GitLab contributions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/gitlab/contributions/:username', function(req, res) {
  try {
    const username = decodeURIComponent(req.params.username);
    const cache = readGitlabCache();
    const data = cache.users[username] || null;
    res.json(data);
  } catch (error) {
    console.error('Read GitLab contribution error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gitlab/contributions/:username/refresh', async function(req, res) {
  try {
    const username = decodeURIComponent(req.params.username);
    const results = await fetchGitlabContributions([username]);
    const cache = readGitlabCache();

    if (results[username]) {
      cache.users[username] = results[username];
      writeToStorage(GITLAB_CACHE_PATH, cache);
    }

    res.json(results[username] || null);
  } catch (error) {
    console.error('GitLab single user refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gitlab/refresh', function(req, res) {
  try {
    const roster = deriveRoster();

    // Collect all unique GitLab usernames across all orgs
    const usernameMap = {}; // gitlabUsername -> person name
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        for (const member of team.members) {
          if (member.gitlabUsername && !usernameMap[member.gitlabUsername]) {
            usernameMap[member.gitlabUsername] = member.name;
          }
        }
      }
    }

    const usernames = Object.keys(usernameMap);
    res.json({ status: 'started', usernameCount: usernames.length });

    // Fetch in background
    setImmediate(async () => {
      try {
        const results = await fetchGitlabContributions(usernames);
        const cache = readGitlabCache();

        for (const [username, data] of Object.entries(results)) {
          if (data) {
            cache.users[username] = data;
          }
        }
        cache.fetchedAt = new Date().toISOString();

        writeToStorage(GITLAB_CACHE_PATH, cache);
        console.log(`[gitlab] Refresh complete. ${Object.keys(results).length} users processed.`);
      } catch (err) {
        console.error('[gitlab] Refresh failed:', err.message);
      }
    });
  } catch (error) {
    console.error('GitLab refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trends/gitlab/refresh', function(req, res) {
  try {
    const roster = deriveRoster();
    const usernames = [];
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        for (const member of team.members) {
          if (member.gitlabUsername && !usernames.includes(member.gitlabUsername)) {
            usernames.push(member.gitlabUsername);
          }
        }
      }
    }

    res.json({ status: 'started', usernameCount: usernames.length });

    setImmediate(async () => {
      try {
        const results = await fetchGitlabContributionHistory(usernames);
        const cache = readGitlabHistoryCache();
        for (const [username, data] of Object.entries(results)) {
          if (data) {
            cache.users[username] = data;
          }
        }
        cache.fetchedAt = new Date().toISOString();
        writeToStorage(GITLAB_HISTORY_CACHE_PATH, cache);
        console.log(`[gitlab] History refresh complete. ${Object.keys(results).length} users processed.`);
      } catch (err) {
        console.error('[gitlab] History refresh failed:', err.message);
      }
    });
  } catch (error) {
    console.error('GitLab history refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Trends ───

const { fetchContributionHistory } = require('./github/contributions');

const GITHUB_HISTORY_CACHE_PATH = 'github-history.json';

function readGithubHistoryCache() {
  return readFromStorage(GITHUB_HISTORY_CACHE_PATH) || { users: {}, fetchedAt: null };
}

/**
 * Build Jira trends from cached person metrics files.
 * Returns monthly buckets with resolved counts, points, and cycle times.
 */
function buildJiraTrends() {
  const files = listStorageFiles('people');
  if (files.length === 0) return {};

  const roster = deriveRoster();

  // Build person -> org/team lookup
  const personLookup = {};
  for (const org of roster.orgs) {
    for (const [teamName, team] of Object.entries(org.teams)) {
      for (const member of team.members) {
        const name = member.jiraDisplayName || member.name;
        if (!personLookup[name]) {
          personLookup[name] = { orgKey: org.key, teamKey: `${org.key}::${teamName}` };
        }
      }
    }
  }

  // Read all person metrics and extract resolved issues
  const monthlyData = {}; // "YYYY-MM" -> { resolved, points, cycleTimes, byOrg, byTeam, byPerson }

  for (const file of files) {
    try {
      const data = readFromStorage(`people/${file}`);
      if (!data.resolved?.issues) continue;

      const personName = data.jiraDisplayName;
      const lookup = personLookup[personName];

      for (const issue of data.resolved.issues) {
        if (!issue.resolutionDate) continue;
        const monthKey = issue.resolutionDate.slice(0, 7);

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            resolved: 0, points: 0, cycleTimes: [],
            byOrg: {}, byTeam: {}, byPerson: {}
          };
        }
        const bucket = monthlyData[monthKey];
        bucket.resolved++;
        bucket.points += issue.storyPoints || 0;
        if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
          bucket.cycleTimes.push(issue.cycleTimeDays);
        }

        if (lookup) {
          // By org
          if (!bucket.byOrg[lookup.orgKey]) {
            bucket.byOrg[lookup.orgKey] = { resolved: 0, points: 0, cycleTimes: [] };
          }
          bucket.byOrg[lookup.orgKey].resolved++;
          bucket.byOrg[lookup.orgKey].points += issue.storyPoints || 0;
          if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
            bucket.byOrg[lookup.orgKey].cycleTimes.push(issue.cycleTimeDays);
          }

          // By team
          if (!bucket.byTeam[lookup.teamKey]) {
            bucket.byTeam[lookup.teamKey] = { resolved: 0, points: 0, cycleTimes: [] };
          }
          bucket.byTeam[lookup.teamKey].resolved++;
          bucket.byTeam[lookup.teamKey].points += issue.storyPoints || 0;
          if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
            bucket.byTeam[lookup.teamKey].cycleTimes.push(issue.cycleTimeDays);
          }
        }

        // By person
        if (!bucket.byPerson[personName]) {
          bucket.byPerson[personName] = { resolved: 0, points: 0, cycleTimes: [] };
        }
        bucket.byPerson[personName].resolved++;
        bucket.byPerson[personName].points += issue.storyPoints || 0;
        if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
          bucket.byPerson[personName].cycleTimes.push(issue.cycleTimeDays);
        }
      }
    } catch {
      // skip malformed files
    }
  }

  // Compute avg cycle times
  function avgCycleTime(times) {
    if (times.length === 0) return null;
    return +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
  }

  const result = {};
  for (const [month, data] of Object.entries(monthlyData)) {
    result[month] = {
      resolved: data.resolved,
      points: data.points,
      avgCycleTimeDays: avgCycleTime(data.cycleTimes),
      byOrg: {},
      byTeam: {},
      byPerson: {}
    };
    for (const [key, d] of Object.entries(data.byOrg)) {
      result[month].byOrg[key] = { resolved: d.resolved, points: d.points, avgCycleTimeDays: avgCycleTime(d.cycleTimes) };
    }
    for (const [key, d] of Object.entries(data.byTeam)) {
      result[month].byTeam[key] = { resolved: d.resolved, points: d.points, avgCycleTimeDays: avgCycleTime(d.cycleTimes) };
    }
    for (const [key, d] of Object.entries(data.byPerson)) {
      result[month].byPerson[key] = { resolved: d.resolved, points: d.points, avgCycleTimeDays: avgCycleTime(d.cycleTimes) };
    }
  }

  return result;
}

app.get('/api/trends', function(req, res) {
  try {
    const jira = buildJiraTrends();
    const github = readGithubHistoryCache();
    const gitlab = readGitlabHistoryCache();
    res.json({ jira, github, gitlab });
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trends/jira/refresh', async function(req, res) {
  try {
    const roster = deriveRoster();
    const seen = new Set();
    const uniqueMembers = [];
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        for (const member of team.members) {
          const name = member.jiraDisplayName || member.name;
          if (!seen.has(name)) {
            seen.add(name);
            uniqueMembers.push(member);
          }
        }
      }
    }

    res.json({ status: 'started', memberCount: uniqueMembers.length });

    // Background: fetch 365-day metrics for each person
    setImmediate(async () => {
      console.log(`[trends] Starting Jira 365-day refresh for ${uniqueMembers.length} members...`);
      let completed = 0;
      let failed = 0;

      for (const member of uniqueMembers) {
        const name = member.jiraDisplayName || member.name;
        try {
          const metrics = await fetchPersonMetrics(jiraRequest, name, {
            lookbackDays: 365,
            nameCache: jiraNameCache
          });
          if (metrics._resolvedName) delete metrics._resolvedName;
          const key = sanitizeFilename(name);
          writeToStorage(`people/${key}.json`, metrics);
          completed++;
          if (completed % 25 === 0) {
            console.log(`[trends] Jira refresh progress: ${completed}/${uniqueMembers.length}`);
          }
        } catch (error) {
          failed++;
          console.error(`[trends] Failed for ${name}:`, error.message);
        }
      }

      persistNameCache();
      console.log(`[trends] Jira refresh complete. ${completed} succeeded, ${failed} failed.`);
    });
  } catch (error) {
    console.error('Trends Jira refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/trends/github/refresh', function(req, res) {
  try {
    const roster = deriveRoster();
    const usernames = [];
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        for (const member of team.members) {
          if (member.githubUsername && !usernames.includes(member.githubUsername)) {
            usernames.push(member.githubUsername);
          }
        }
      }
    }

    res.json({ status: 'started', usernameCount: usernames.length });

    setImmediate(() => {
      try {
        const results = fetchContributionHistory(usernames);
        const cache = readGithubHistoryCache();
        for (const [username, data] of Object.entries(results)) {
          if (data) {
            cache.users[username] = data;
          }
        }
        cache.fetchedAt = new Date().toISOString();
        writeToStorage(GITHUB_HISTORY_CACHE_PATH, cache);
        console.log(`[github] History refresh complete. ${Object.keys(results).length} users processed.`);
      } catch (err) {
        console.error('[github] History refresh failed:', err.message);
      }
    });
  } catch (error) {
    console.error('GitHub history refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Annotations ───

app.get('/api/sprints/:sprintId/annotations', function(req, res) {
  try {
    const { sprintId } = req.params;
    const data = readFromStorage(`annotations/${sprintId}.json`);
    res.json(data || { annotations: {} });
  } catch (error) {
    console.error('Read annotations error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sprints/:sprintId/annotations', function(req, res) {
  try {
    const { sprintId } = req.params;
    const { assignee, text } = req.body;
    if (!assignee || !text) {
      return res.status(400).json({ error: 'assignee and text are required' });
    }

    const data = readFromStorage(`annotations/${sprintId}.json`) || { annotations: {} };
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
    writeToStorage(`annotations/${sprintId}.json`, data);
    res.json(annotation);
  } catch (error) {
    console.error('Save annotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sprints/:sprintId/annotations/:assignee/:annotationId', function(req, res) {
  try {
    const { sprintId, assignee, annotationId } = req.params;
    const data = readFromStorage(`annotations/${sprintId}.json`);
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

    writeToStorage(`annotations/${sprintId}.json`, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Allowlist ───

app.get('/api/allowlist', function(req, res) {
  try {
    const data = readFromStorage('allowlist.json') || { emails: [] };
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Read allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/allowlist', function(req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@redhat.com')) {
      return res.status(400).json({ error: 'Only @redhat.com email addresses are allowed' });
    }

    const data = readFromStorage('allowlist.json') || { emails: [] };
    if (data.emails.includes(normalized)) {
      return res.status(409).json({ error: 'Email is already on the allowlist' });
    }

    data.emails.push(normalized);
    writeToStorage('allowlist.json', data);
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Add to allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/allowlist/:email', function(req, res) {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const data = readFromStorage('allowlist.json') || { emails: [] };

    if (!data.emails.includes(email)) {
      return res.status(404).json({ error: 'Email not found on allowlist' });
    }

    if (data.emails.length <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last user from the allowlist' });
    }

    data.emails = data.emails.filter(e => e !== email);
    writeToStorage('allowlist.json', data);
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Remove from allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

// CORS preflight
app.options('/api/{*path}', function(req, res) { res.status(200).end(); });

// ─── Start ───

seedAllowlist();

app.listen(PORT, function() {
  console.log(`\nTeam Tracker dev server running at http://localhost:${PORT}`);
  console.log(`Jira host: ${JIRA_HOST}`);
  console.log(`Local storage: ./data/`);
  console.log(`JIRA_TOKEN: ${process.env.JIRA_TOKEN ? 'set' : 'NOT SET (refresh will fail)'}`);
  console.log(`JIRA_EMAIL: ${process.env.JIRA_EMAIL ? 'set' : 'NOT SET (refresh will fail)'}\n`);
});
