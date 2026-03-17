/**
 * Team Tracker API server
 *
 * Combines fetcher and reader Express routes into a single
 * server, using local file storage.
 *
 * Usage:
 *   JIRA_EMAIL=you@redhat.com JIRA_TOKEN=your-token node server/dev-server.js
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
const rosterSync = require('./roster-sync');
const rosterSyncConfig = require('./roster-sync/config');

if (DEMO_MODE) {
  console.log('Running in DEMO MODE - using fixture data, Jira/GitHub APIs disabled');
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
    console.log('Allowlist: empty — first authenticated user will be auto-added as admin');
    return;
  }

  const emails = adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  writeToStorage('allowlist.json', { emails });
  console.log(`Allowlist: seeded with ${emails.length} email(s) from ADMIN_EMAILS`);
}

// ─── Health check (before auth) ───

app.get('/healthz', function(req, res) {
  res.json({ status: 'ok' });
});

// ─── Auth middleware ───
// In production, the OpenShift OAuth proxy sets X-Forwarded-Email/X-Forwarded-User headers.
// In local dev, fall back to a hardcoded email.

async function authMiddleware(req, res, next) {
  // Skip CORS preflight
  if (req.method === 'OPTIONS') return next();

  const email = req.headers['x-forwarded-email'];
  if (email) {
    req.userEmail = email.toLowerCase();
  } else {
    // Local dev: use env-configured or hardcoded email
    req.userEmail = (process.env.ADMIN_EMAILS || 'local-dev@redhat.com').split(',')[0].trim().toLowerCase();
  }

  // Check allowlist — auto-add first authenticated user if empty
  const allowlist = readFromStorage('allowlist.json');
  if (!allowlist || !allowlist.emails || allowlist.emails.length === 0) {
    const seeded = { emails: [req.userEmail] };
    writeToStorage('allowlist.json', seeded);
    console.log(`Allowlist: auto-added first user ${req.userEmail}`);
  } else if (!allowlist.emails.includes(req.userEmail)) {
    return res.status(403).json({ error: 'Access denied. You are not on the allowlist.' });
  }

  next();
}

// Whoami endpoint — returns current user info
app.get('/api/whoami', function(req, res) {
  const email = req.headers['x-forwarded-email'];
  const displayName = req.headers['x-forwarded-preferred-username'] || req.headers['x-forwarded-user'] || email;
  if (email) {
    res.json({ email, displayName });
  } else {
    // Local dev fallback
    const devEmail = (process.env.ADMIN_EMAILS || 'local-dev@redhat.com').split(',')[0].trim();
    res.json({ email: devEmail, displayName: devEmail.split('@')[0] });
  }
});

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
function getOrgDisplayNames() {
  const fromConfig = rosterSyncConfig.getOrgDisplayNames(storageModule);
  if (Object.keys(fromConfig).length > 0) return fromConfig;
  // Fallback for backward compatibility with existing roster files
  return {};
}

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
      displayName: getOrgDisplayNames()[orgKey] || orgData.leader.name,
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
    const full = readRosterFull();
    if (!full) {
      return res.json({ orgs: [] });
    }
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

app.post('/api/github/contributions/:username/refresh', async function(req, res) {
  try {
    const username = decodeURIComponent(req.params.username);
    const results = await fetchContributions([username]);
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
    fetchContributions(usernames).then(function(results) {
      const cache = readGithubCache();

      for (const [username, data] of Object.entries(results)) {
        if (data) {
          cache.users[username] = data;
        }
      }
      cache.fetchedAt = new Date().toISOString();

      writeToStorage(GITHUB_CACHE_PATH, cache);
      console.log(`[github] Refresh complete. ${Object.keys(results).length} users processed.`);
    }).catch(function(err) {
      console.error('[github] Refresh failed:', err.message);
    });
  } catch (error) {
    console.error('GitHub refresh error:', error);
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
    res.json({ jira, github });
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

    fetchContributionHistory(usernames).then(function(results) {
      const cache = readGithubHistoryCache();
      for (const [username, data] of Object.entries(results)) {
        if (data) {
          cache.users[username] = data;
        }
      }
      cache.fetchedAt = new Date().toISOString();
      writeToStorage(GITHUB_HISTORY_CACHE_PATH, cache);
      console.log(`[github] History refresh complete. ${Object.keys(results).length} users processed.`);
    }).catch(function(err) {
      console.error('[github] History refresh failed:', err.message);
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

// ─── Routes: Roster Sync Admin ───

app.get('/api/admin/roster-sync/config', function(req, res) {
  try {
    const config = rosterSyncConfig.loadConfig(storageModule);
    if (!config) {
      return res.json({ configured: false });
    }
    res.json({ configured: true, ...config });
  } catch (error) {
    console.error('Read roster-sync config error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/roster-sync/config', function(req, res) {
  try {
    const { orgRoots, googleSheetId, sheetNames } = req.body;

    if (!orgRoots || !Array.isArray(orgRoots) || orgRoots.length === 0) {
      return res.status(400).json({ error: 'At least one org root is required' });
    }

    for (const root of orgRoots) {
      if (!root.uid || !root.displayName) {
        return res.status(400).json({ error: 'Each org root must have uid and displayName' });
      }
    }

    // Preserve sync metadata from existing config
    const existing = rosterSyncConfig.loadConfig(storageModule) || {};
    const config = {
      orgRoots,
      googleSheetId: googleSheetId || null,
      sheetNames: sheetNames || [],
      lastSyncAt: existing.lastSyncAt || null,
      lastSyncStatus: existing.lastSyncStatus || null,
      lastSyncError: existing.lastSyncError || null
    };

    rosterSyncConfig.saveConfig(storageModule, config);

    // Schedule daily sync if not already running
    if (!DEMO_MODE) {
      rosterSync.scheduleDaily(storageModule);
    }

    res.json({ configured: true, ...config });
  } catch (error) {
    console.error('Save roster-sync config error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/roster-sync/trigger', function(req, res) {
  try {
    if (rosterSync.isSyncInProgress()) {
      return res.json({ status: 'already_running' });
    }

    if (!rosterSyncConfig.isConfigured(storageModule)) {
      return res.status(400).json({ error: 'Roster sync is not configured' });
    }

    // Start sync in background
    rosterSync.runSync(storageModule).then(function(result) {
      console.log('[roster-sync] On-demand sync result:', result.status);
    }).catch(function(err) {
      console.error('[roster-sync] On-demand sync error:', err);
    });

    res.json({ status: 'started' });
  } catch (error) {
    console.error('Trigger roster-sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/roster-sync/status', function(req, res) {
  try {
    const config = rosterSyncConfig.loadConfig(storageModule);
    res.json({
      configured: rosterSyncConfig.isConfigured(storageModule),
      syncing: rosterSync.isSyncInProgress(),
      lastSyncAt: config ? config.lastSyncAt : null,
      lastSyncStatus: config ? config.lastSyncStatus : null,
      lastSyncError: config ? config.lastSyncError : null
    });
  } catch (error) {
    console.error('Roster-sync status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// CORS preflight
app.options('/api/{*path}', function(req, res) { res.status(200).end(); });

// ─── Start ───

seedAllowlist();

// Start daily roster sync if configured
if (!DEMO_MODE && rosterSyncConfig.isConfigured(storageModule)) {
  rosterSync.scheduleDaily(storageModule);
  console.log('Roster sync: daily schedule active');
} else if (!DEMO_MODE) {
  console.log('Roster sync: not configured (visit Settings to set up)');
}

app.listen(PORT, function() {
  console.log(`\nTeam Tracker dev server running at http://localhost:${PORT}`);
  console.log(`Jira host: ${JIRA_HOST}`);
  console.log(`Local storage: ./data/`);
  console.log(`JIRA_TOKEN: ${process.env.JIRA_TOKEN ? 'set' : 'NOT SET (refresh will fail)'}`);
  console.log(`JIRA_EMAIL: ${process.env.JIRA_EMAIL ? 'set' : 'NOT SET (refresh will fail)'}\n`);
});
