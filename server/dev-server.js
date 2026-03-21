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

const { fetchPersonMetrics } = require('./jira/person-metrics');
const { fetchGithubData } = require('./github/contributions');
const { fetchGitlabData } = require('./gitlab/contributions');
const rosterSync = require('./roster-sync');
const rosterSyncConfig = require('./roster-sync/config');
const jiraSyncConfig = require('./jira/config');

if (DEMO_MODE) {
  console.log('Running in DEMO MODE - using fixture data, Jira/GitHub APIs disabled');
}

// ─── Refresh State Tracker ───

const refreshState = {
  running: false,
  scope: null,
  progress: { completed: 0, total: 0, errors: 0 },
  sources: { jira: null, github: null, gitlab: null },
  startedAt: null
};

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

// ─── Admin list seed ───

function seedAdminList() {
  const existing = readFromStorage('allowlist.json');
  if (existing && existing.emails && existing.emails.length > 0) {
    console.log(`Admin list: ${existing.emails.length} admin(s) loaded`);
    return;
  }

  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    console.log('Admin list: empty — first authenticated user will be auto-added as admin');
    return;
  }

  const emails = adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  writeToStorage('allowlist.json', { emails });
  console.log(`Admin list: seeded with ${emails.length} admin(s) from ADMIN_EMAILS`);
}

function isAdmin(email) {
  const adminList = readFromStorage('allowlist.json');
  return adminList && adminList.emails && adminList.emails.includes(email);
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

  // Auto-add first authenticated user as admin if admin list is empty
  const adminList = readFromStorage('allowlist.json');
  if (!adminList || !adminList.emails || adminList.emails.length === 0) {
    const seeded = { emails: [req.userEmail] };
    writeToStorage('allowlist.json', seeded);
    console.log(`Admin list: auto-added first user ${req.userEmail}`);
  }

  req.isAdmin = isAdmin(req.userEmail);
  next();
}

function requireAdmin(req, res, next) {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// Whoami endpoint — returns current user info
app.get('/api/whoami', function(req, res) {
  const email = req.headers['x-forwarded-email'];
  const displayName = req.headers['x-forwarded-preferred-username'] || req.headers['x-forwarded-user'] || email;
  if (email) {
    res.json({ email, displayName, isAdmin: isAdmin(email.toLowerCase()) });
  } else {
    // Local dev fallback
    const devEmail = (process.env.ADMIN_EMAILS || 'local-dev@redhat.com').split(',')[0].trim();
    res.json({ email: devEmail, displayName: devEmail.split('@')[0], isAdmin: isAdmin(devEmail.toLowerCase()) });
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

// ─── Cache paths ───

const GITHUB_CACHE_PATH = 'github-contributions.json';
const GITHUB_HISTORY_CACHE_PATH = 'github-history.json';
const GITLAB_CACHE_PATH = 'gitlab-contributions.json';
const GITLAB_HISTORY_CACHE_PATH = 'gitlab-history.json';
function readGithubCache() {
  return readFromStorage(GITHUB_CACHE_PATH) || { users: {}, fetchedAt: null };
}

function readGithubHistoryCache() {
  return readFromStorage(GITHUB_HISTORY_CACHE_PATH) || { users: {}, fetchedAt: null };
}

function readGitlabCache() {
  return readFromStorage(GITLAB_CACHE_PATH) || { users: {}, fetchedAt: null };
}

function readGitlabHistoryCache() {
  return readFromStorage(GITLAB_HISTORY_CACHE_PATH) || { users: {}, fetchedAt: null };
}

/**
 * Write single-pass GitHub/GitLab results to both contribution and history caches.
 * Single-pass functions return { username: { totalContributions, months, fetchedAt } | null }.
 * We store the full object in the contribution cache, and { months } in the history cache.
 */
function writeSinglePassResults(results, contribCachePath, historyCachePath) {
  const contribCache = readFromStorage(contribCachePath) || { users: {}, fetchedAt: null };
  const historyCache = readFromStorage(historyCachePath) || { users: {}, fetchedAt: null };
  const now = new Date().toISOString();

  for (const [username, data] of Object.entries(results)) {
    if (data) {
      contribCache.users[username] = data;
      historyCache.users[username] = { months: data.months || {}, fetchedAt: data.fetchedAt };
    }
  }

  contribCache.fetchedAt = now;
  historyCache.fetchedAt = now;
  writeToStorage(contribCachePath, contribCache);
  writeToStorage(historyCachePath, historyCache);
}

// ─── Routes: Unified Refresh ───

app.get('/api/refresh/status', requireAdmin, function(req, res) {
  res.json(refreshState);
});

app.post('/api/refresh', requireAdmin, async function(req, res) {
  const { scope, name, teamKey, orgKey } = req.body || {};
  const force = req.body?.force === true;
  const sources = req.body?.sources || { jira: true, github: true, gitlab: true };

  // Validate scope
  if (!scope || !['person', 'team', 'org', 'all'].includes(scope)) {
    return res.status(400).json({ error: 'scope is required: person, team, org, or all' });
  }

  // Validate force
  if (req.body?.force !== undefined && typeof req.body.force !== 'boolean') {
    return res.status(400).json({ error: 'force must be a boolean' });
  }

  // Validate sources
  if (req.body?.sources !== undefined) {
    if (typeof req.body.sources !== 'object' || Array.isArray(req.body.sources)) {
      return res.status(400).json({ error: 'sources must be an object with jira, github, gitlab boolean keys' });
    }
    const validKeys = ['jira', 'github', 'gitlab'];
    for (const key of Object.keys(req.body.sources)) {
      if (!validKeys.includes(key)) {
        return res.status(400).json({ error: `Invalid source key: "${key}". Valid keys: ${validKeys.join(', ')}` });
      }
      if (typeof req.body.sources[key] !== 'boolean') {
        return res.status(400).json({ error: `sources.${key} must be a boolean` });
      }
    }
  }

  // Overlap protection (person scope exempt — it's synchronous)
  if (scope !== 'person' && refreshState.running) {
    return res.status(409).json({
      error: 'Refresh already in progress',
      scope: refreshState.scope,
      progress: refreshState.progress
    });
  }

  const roster = deriveRoster();
  let members;

  // Resolve members based on scope
  if (scope === 'person') {
    let found = null;
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        found = team.members.find(m => m.jiraDisplayName === name || m.name === name);
        if (found) break;
      }
      if (found) break;
    }
    if (!found) {
      return res.status(404).json({ error: `Person "${name}" not found in roster` });
    }
    members = [found];
  } else if (scope === 'team') {
    let team = null;
    const sepIdx = (teamKey || '').indexOf('::');
    if (sepIdx !== -1) {
      const oKey = teamKey.substring(0, sepIdx);
      const tName = teamKey.substring(sepIdx + 2);
      const org = roster.orgs.find(o => o.key === oKey);
      if (org) team = org.teams[tName];
    } else {
      for (const org of roster.orgs) {
        if (org.teams[teamKey]) { team = org.teams[teamKey]; break; }
      }
    }
    if (!team) {
      return res.status(404).json({ error: `Team "${teamKey}" not found in roster` });
    }
    members = dedupeMembers(team.members);
  } else if (scope === 'org') {
    const org = roster.orgs.find(o => o.key === orgKey);
    if (!org) {
      return res.status(404).json({ error: `Org "${orgKey}" not found in roster` });
    }
    const allMembers = [];
    for (const team of Object.values(org.teams)) {
      allMembers.push(...team.members);
    }
    members = dedupeMembers(allMembers);
  } else {
    // scope === 'all'
    const allMembers = [];
    for (const org of roster.orgs) {
      for (const team of Object.values(org.teams)) {
        allMembers.push(...team.members);
      }
    }
    members = dedupeMembers(allMembers);
  }

  // Load Jira project filter config once for all members
  const jiraProjectKeys = jiraSyncConfig.getProjectKeys(storageModule);

  // Helper: refresh Jira for a list of members
  async function refreshJiraMembers(memberList) {
    if (!sources.jira || DEMO_MODE) return;
    const CONCURRENCY = 3;
    let idx = 0;
    let completed = 0;

    async function nextJira() {
      if (idx >= memberList.length) return;
      const member = memberList[idx++];
      try {
        completed++;
        console.log(`[refresh] Jira: ${member.jiraDisplayName} (${completed}/${memberList.length})`);
        const existingData = force ? null : readFromStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`);
        const metrics = await fetchPersonMetrics(jiraRequest, member.jiraDisplayName, {
          nameCache: jiraNameCache,
          existingData,
          email: member.email,
          projectKeys: jiraProjectKeys
        });
        if (metrics._resolvedName) delete metrics._resolvedName;
        writeToStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`, metrics);
        if (refreshState.sources.jira) refreshState.sources.jira.completed++;
      } catch (err) {
        console.error(`[refresh] Jira failed for ${member.jiraDisplayName}:`, err.message);
        refreshState.progress.errors++;
      }
      return nextJira();
    }

    const workers = [];
    for (let w = 0; w < CONCURRENCY; w++) workers.push(nextJira());
    await Promise.all(workers);
    persistNameCache();
  }

  // Helper: refresh GitHub for a list of usernames
  async function refreshGithubUsers(usernames) {
    if (!sources.github || usernames.length === 0) return;
    try {
      const existingCache = force ? {} : readGithubCache().users;
      const results = await fetchGithubData(usernames, {
        existingData: existingCache,
        ttlMs: force ? 0 : undefined
      });
      writeSinglePassResults(results, GITHUB_CACHE_PATH, GITHUB_HISTORY_CACHE_PATH);
      console.log(`[refresh] GitHub: ${Object.keys(results).length} users processed`);
    } catch (err) {
      console.error('[refresh] GitHub failed:', err.message);
      refreshState.progress.errors++;
    }
  }

  // Helper: refresh GitLab for a list of usernames
  async function refreshGitlabUsers(usernames) {
    if (!sources.gitlab || usernames.length === 0) return;
    try {
      const syncConfig = rosterSyncConfig.loadConfig({ readFromStorage }) || {};
      const gitlabGroups = syncConfig.gitlabGroups || [];
      const results = await fetchGitlabData(usernames, { gitlabGroups });
      writeSinglePassResults(results, GITLAB_CACHE_PATH, GITLAB_HISTORY_CACHE_PATH);
      console.log(`[refresh] GitLab: ${Object.keys(results).length} users processed`);
    } catch (err) {
      console.error('[refresh] GitLab failed:', err.message);
      refreshState.progress.errors++;
    }
  }

  // Collect unique GitHub/GitLab usernames
  const githubUsernames = [...new Set(members.filter(m => m.githubUsername).map(m => m.githubUsername))];
  const gitlabUsernames = [...new Set(members.filter(m => m.gitlabUsername).map(m => m.gitlabUsername))];

  // For person scope: synchronous — return results directly
  if (scope === 'person') {
    try {
      const member = members[0];
      const result = { jira: null, github: null, gitlab: null };

      const promises = [];

      // Jira
      if (sources.jira && !DEMO_MODE) {
        promises.push((async () => {
          const existingData = force ? null : readFromStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`);
          const metrics = await fetchPersonMetrics(jiraRequest, member.jiraDisplayName, {
            nameCache: jiraNameCache,
            existingData,
            email: member.email,
            projectKeys: jiraProjectKeys
          });
          if (metrics._resolvedName) {
            persistNameCache();
            delete metrics._resolvedName;
          }
          writeToStorage(`people/${sanitizeFilename(member.jiraDisplayName)}.json`, metrics);
          result.jira = metrics;
        })());
      }

      // GitHub
      if (sources.github && member.githubUsername) {
        promises.push((async () => {
          const existingCache = force ? {} : readGithubCache().users;
          const ghResults = await fetchGithubData([member.githubUsername], {
            existingData: existingCache,
            ttlMs: force ? 0 : undefined
          });
          if (ghResults[member.githubUsername]) {
            writeSinglePassResults(ghResults, GITHUB_CACHE_PATH, GITHUB_HISTORY_CACHE_PATH);
            result.github = ghResults[member.githubUsername];
          }
        })());
      }

      // GitLab
      if (sources.gitlab && member.gitlabUsername) {
        promises.push((async () => {
          const syncConfig = rosterSyncConfig.loadConfig({ readFromStorage }) || {};
          const gitlabGroups = syncConfig.gitlabGroups || [];
          const glResults = await fetchGitlabData([member.gitlabUsername], { gitlabGroups });
          if (glResults[member.gitlabUsername]) {
            writeSinglePassResults(glResults, GITLAB_CACHE_PATH, GITLAB_HISTORY_CACHE_PATH);
            result.gitlab = glResults[member.gitlabUsername];
          }
        })());
      }

      await Promise.allSettled(promises);
      saveLastRefreshed();
      console.log(`[refresh] person "${member.jiraDisplayName}" complete`);
      return res.json(result);
    } catch (error) {
      console.error(`[refresh] person "${name}" error:`, error);
      return res.status(500).json({ error: error.message });
    }
  }

  // For team/org/all: background processing
  refreshState.running = true;
  refreshState.scope = scope;
  refreshState.startedAt = new Date().toISOString();
  refreshState.progress = { errors: 0 };
  refreshState.sources = {
    jira: sources.jira ? { status: 'pending', completed: 0, total: members.length } : { status: 'skipped' },
    github: sources.github ? { status: 'pending', completed: 0, total: githubUsernames.length } : { status: 'skipped' },
    gitlab: sources.gitlab ? { status: 'pending', completed: 0, total: gitlabUsernames.length } : { status: 'skipped' }
  };

  res.json({ status: 'started', memberCount: members.length });

  setImmediate(async () => {
    try {
      // Run all three sources concurrently
      await Promise.allSettled([
        (async () => {
          if (!sources.jira) return;
          refreshState.sources.jira.status = 'running';
          try {
            await refreshJiraMembers(members);
            refreshState.sources.jira.status = 'done';
          } catch (err) {
            refreshState.sources.jira.status = 'error';
            console.error('[refresh] Jira source error:', err.message);
          }
        })(),
        (async () => {
          if (!sources.github || githubUsernames.length === 0) return;
          refreshState.sources.github.status = 'running';
          try {
            await refreshGithubUsers(githubUsernames);
            refreshState.sources.github.status = 'done';
          } catch (err) {
            refreshState.sources.github.status = 'error';
            console.error('[refresh] GitHub source error:', err.message);
          }
        })(),
        (async () => {
          if (!sources.gitlab || gitlabUsernames.length === 0) return;
          refreshState.sources.gitlab.status = 'running';
          try {
            await refreshGitlabUsers(gitlabUsernames);
            refreshState.sources.gitlab.status = 'done';
          } catch (err) {
            refreshState.sources.gitlab.status = 'error';
            console.error('[refresh] GitLab source error:', err.message);
          }
        })()
      ]);

      saveLastRefreshed();
      console.log(`[refresh] ${scope} complete (${members.length} members)`);
    } catch (err) {
      console.error(`[refresh] ${scope} error:`, err);
    } finally {
      refreshState.running = false;
    }
  });
});

function dedupeMembers(members) {
  const seen = new Set();
  return members.filter(m => {
    const key = m.jiraDisplayName || m.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

app.post('/api/teams', requireAdmin, function(req, res) {
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

function saveLastRefreshed() {
  writeToStorage('last-refreshed.json', { timestamp: new Date().toISOString() });
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
      const teamNames = person.miroTeam
        ? person.miroTeam.split(',').map(t => t.trim()).filter(Boolean)
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

app.get('/api/last-refreshed', function(req, res) {
  const data = readFromStorage('last-refreshed.json');
  const jiraConfig = jiraSyncConfig.loadConfig(storageModule);
  res.json({
    timestamp: data?.timestamp || null,
    jiraConfigChangedAt: jiraConfig?.lastConfigChangedAt || null
  });
});

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

    // Check cache (4-hour TTL, or any age in demo mode)
    const cached = readFromStorage(cachePath);
    if (cached) {
      if (DEMO_MODE || (cached.fetchedAt && (Date.now() - new Date(cached.fetchedAt).getTime()) < 4 * 60 * 60 * 1000)) {
        return res.json(cached);
      }
    }

    if (DEMO_MODE) {
      return res.status(404).json({ error: `No demo data for ${name}` });
    }

    // Look up email from roster for more reliable Jira resolution
    let personEmail = null;
    try {
      const roster = deriveRoster();
      for (const org of roster.orgs) {
        for (const team of Object.values(org.teams)) {
          const found = team.members.find(m => m.jiraDisplayName === name || m.name === name);
          if (found) { personEmail = found.email; break; }
        }
        if (personEmail) break;
      }
    } catch { /* roster lookup is best-effort */ }

    // Fetch from Jira, fall back to stale cache if Jira is unavailable
    try {
      const projectKeys = jiraSyncConfig.getProjectKeys(storageModule);
      const metrics = await fetchPersonMetrics(jiraRequest, name, { nameCache: jiraNameCache, email: personEmail, projectKeys });
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

app.delete('/api/jira-name-cache', requireAdmin, function(req, res) {
  jiraNameCache = {};
  writeToStorage('jira-name-map.json', {});
  res.json({ success: true });
});

// ─── Routes: GitHub Contributions ───

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

// ─── Routes: GitLab Contributions ───

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

// ─── Routes: Trends ───

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

app.delete('/api/sprints/:sprintId/annotations/:assignee/:annotationId', requireAdmin, function(req, res) {
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

app.get('/api/allowlist', requireAdmin, function(req, res) {
  try {
    const data = readFromStorage('allowlist.json') || { emails: [] };
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Read allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/allowlist', requireAdmin, function(req, res) {
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

app.delete('/api/allowlist/:email', requireAdmin, function(req, res) {
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

app.get('/api/admin/roster-sync/config', requireAdmin, function(req, res) {
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

app.post('/api/admin/roster-sync/config', requireAdmin, function(req, res) {
  try {
    const { orgRoots, googleSheetId, sheetNames, githubOrgs, gitlabGroups } = req.body;

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
      githubOrgs: githubOrgs || [],
      gitlabGroups: gitlabGroups || [],
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

app.post('/api/admin/roster-sync/trigger', requireAdmin, function(req, res) {
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

app.get('/api/admin/roster-sync/status', requireAdmin, function(req, res) {
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

// ─── Routes: Jira Sync Admin ───

app.get('/api/admin/jira-sync/config', requireAdmin, function(req, res) {
  try {
    const config = jiraSyncConfig.loadConfig(storageModule);
    res.json({ projectKeys: [], ...config });
  } catch (error) {
    console.error('Read jira-sync config error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/jira-sync/config', requireAdmin, function(req, res) {
  try {
    const { projectKeys } = req.body;

    if (!Array.isArray(projectKeys)) {
      return res.status(400).json({ error: 'projectKeys must be an array' });
    }

    // Validate: only non-empty strings, uppercase convention
    const cleaned = projectKeys
      .map(k => typeof k === 'string' ? k.trim().toUpperCase() : '')
      .filter(Boolean);

    // Validate limits
    if (cleaned.length > 50) {
      return res.status(400).json({ error: 'Too many project keys (max 50)' });
    }

    // Validate project key format to prevent JQL injection
    const validProjectKey = /^[A-Z][A-Z0-9_]{1,19}$/;
    for (const key of cleaned) {
      if (!validProjectKey.test(key)) {
        return res.status(400).json({ error: `Invalid project key format: "${key}". Keys must be 2-20 characters, start with a letter, and contain only uppercase letters, digits, and underscores.` });
      }
    }

    // Only update lastConfigChangedAt if project keys actually changed
    const existing = jiraSyncConfig.loadConfig(storageModule);
    const existingKeys = (existing?.projectKeys || []).sort().join(',');
    const newKeys = [...cleaned].sort().join(',');
    const keysChanged = existingKeys !== newKeys;

    const config = {
      projectKeys: cleaned,
      lastConfigChangedAt: keysChanged ? new Date().toISOString() : (existing?.lastConfigChangedAt || null)
    };

    jiraSyncConfig.saveConfig(storageModule, config);
    res.json(config);
  } catch (error) {
    console.error('Save jira-sync config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// CORS preflight
app.options('/api/{*path}', function(req, res) { res.status(200).end(); });

// ─── Start ───

seedAdminList();

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
