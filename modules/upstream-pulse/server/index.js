const fetch = require('node-fetch');
const { getAllPeople } = require('../../../shared/server/roster');

const DEFAULT_BASE_URL = 'http://backend.ambient-code--upstream-pulse.svc.cluster.local:3000';
const PROXY_TIMEOUT = 90_000;
const CACHE_TTL = 3 * 60 * 1000;

const responseCache = new Map();

function getBaseUrl() {
  return (process.env.UPSTREAM_PULSE_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getCacheKey(path, query) {
  const sorted = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `${path}?${sorted}`;
}

async function proxyRequest(path, query = {}) {
  const cacheKey = getCacheKey(path, query);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    timeout: PROXY_TIMEOUT,
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`Upstream Pulse returned ${response.status}: ${body.slice(0, 200)}`);
    err.upstreamStatus = response.status;
    throw err;
  }

  const data = await response.json();
  responseCache.set(cacheKey, { data, ts: Date.now() });

  if (responseCache.size > 100) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < 20; i++) responseCache.delete(oldest[i][0]);
  }

  return data;
}

function buildIdentityHeaders(req) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  // Forward gateway identity headers when present (production behind OAuth proxy).
  // In dev, these headers are absent so the standalone backend uses its own DEV_IDENTITY.
  if (req.headers?.['x-forwarded-email']) headers['x-forwarded-email'] = req.headers['x-forwarded-email'];
  if (req.headers?.['x-forwarded-user']) headers['x-forwarded-user'] = req.headers['x-forwarded-user'];
  if (req.headers?.['x-forwarded-groups']) headers['x-forwarded-groups'] = req.headers['x-forwarded-groups'];
  return headers;
}

async function proxyMutatingRequest(path, body, req) {
  const base = getBaseUrl();
  const url = new URL(path, base);
  const headers = buildIdentityHeaders(req);

  const response = await fetch(url.toString(), {
    method: 'POST',
    timeout: PROXY_TIMEOUT,
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || `Upstream Pulse returned ${response.status}`);
    err.upstreamStatus = response.status;
    err.upstreamBody = data;
    throw err;
  }

  return data;
}

async function proxyAdminGet(path, query, req) {
  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  const headers = buildIdentityHeaders(req);

  const response = await fetch(url.toString(), {
    timeout: PROXY_TIMEOUT,
    headers,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`Upstream Pulse returned ${response.status}: ${body.slice(0, 200)}`);
    err.upstreamStatus = response.status;
    throw err;
  }

  return response.json();
}

async function checkConnection() {
  try {
    const base = getBaseUrl();
    const response = await fetch(`${base}/health`, { timeout: 5000 });
    return { reachable: true, status: response.status };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

const ROSTER_PUSH_SOURCE = 'org_pulse_roster';
const ROSTER_PUSH_REPLACES = ['github_org_sync'];
const ROSTER_PUSH_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours
const ROSTER_PUSH_STARTUP_DELAY = 2 * 60 * 1000; // 2 minutes
const ROSTER_PUSH_TIMEOUT = 5 * 60 * 1000; // 5 minutes (bulk sync processes hundreds of members)

let _lastPushGeneratedAt = null;

function getServiceIdentityHeaders() {
  const serviceUser = process.env.UPSTREAM_SYNC_SERVICE_USER || 'roster-sync-service';
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-forwarded-user': serviceUser,
    'x-forwarded-email': serviceUser + '@internal'
  };
}

async function pushRosterToUpstream(storage) {
  const allPeople = getAllPeople(storage);

  const people = [];
  for (const p of allPeople) {
    if (!p.github || !p.github.username) continue;
    people.push({
      name: p.name,
      email: p.email || null,
      githubUsername: p.github.username,
      employeeId: p.uid || null,
      department: p._teamGrouping || p.miroTeam || null,
      role: p.title || null
    });
  }

  if (people.length === 0) {
    console.log('[upstream-pulse] Roster push skipped: no people with GitHub usernames');
    return { skipped: true, reason: 'no_people' };
  }

  const base = getBaseUrl();
  const url = base + '/api/admin/team-members/sync';
  const body = {
    source: ROSTER_PUSH_SOURCE,
    replacesSources: ROSTER_PUSH_REPLACES,
    people: people
  };

  console.log('[upstream-pulse] Pushing ' + people.length + ' roster members to ' + url);
  const response = await fetch(url, {
    method: 'POST',
    timeout: ROSTER_PUSH_TIMEOUT,
    headers: getServiceIdentityHeaders(),
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(function() { return {}; });
  if (!response.ok) {
    throw new Error('Roster push failed (' + response.status + '): ' + (data.error || 'unknown'));
  }

  console.log('[upstream-pulse] Roster push complete:', JSON.stringify(data));
  return data;
}

function startPeriodicRosterPush(storage) {
  if (process.env.DEMO_MODE === 'true') return;

  function checkAndPush() {
    try {
      const registry = storage.readFromStorage('team-data/registry.json');
      if (!registry || !registry.meta || !registry.meta.generatedAt) return;

      const generatedAt = registry.meta.generatedAt;
      if (_lastPushGeneratedAt === generatedAt) return;

      pushRosterToUpstream(storage).then(function(result) {
        if (!result.skipped) {
          _lastPushGeneratedAt = generatedAt;
        }
      }).catch(function(err) {
        console.warn('[upstream-pulse] Periodic roster push failed:', err.message);
      });
    } catch (err) {
      console.warn('[upstream-pulse] Periodic roster push check failed:', err.message);
    }
  }

  const startupTimer = setTimeout(checkAndPush, ROSTER_PUSH_STARTUP_DELAY);
  if (startupTimer.unref) startupTimer.unref();
  const intervalTimer = setInterval(checkAndPush, ROSTER_PUSH_INTERVAL);
  if (intervalTimer.unref) intervalTimer.unref();
}

module.exports = function registerRoutes(router, context) {

  function handleProxyError(res, err) {
    const status = err.upstreamStatus || 502;
    console.error('[upstream-pulse]', err.message);
    res.status(status).json({
      error: 'Upstream Pulse request failed',
      message: err.message
    });
  }

  router.get('/config', async function(req, res) {
    try {
      const connection = await checkConnection();
      res.json({
        baseUrl: getBaseUrl(),
        configured: !!process.env.UPSTREAM_PULSE_API_URL,
        connection
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/dashboard', async function(req, res) {
    try {
      const data = await proxyRequest('/api/metrics/dashboard', {
        days: req.query.days,
        githubOrg: req.query.githubOrg,
        projectId: req.query.projectId
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/contributors', async function(req, res) {
    try {
      const data = await proxyRequest('/api/metrics/contributors', {
        days: req.query.days,
        limit: req.query.limit,
        githubOrg: req.query.githubOrg,
        projectId: req.query.projectId
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/leadership', async function(req, res) {
    try {
      const data = await proxyRequest('/api/metrics/leadership', {
        githubOrg: req.query.githubOrg,
        projectId: req.query.projectId,
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/projects', async function(req, res) {
    try {
      const data = await proxyRequest('/api/projects', {
        githubOrg: req.query.githubOrg
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/orgs', async function(req, res) {
    try {
      const data = await proxyRequest('/api/orgs', {
        days: req.query.days
      });
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.get('/project-jobs', async function(req, res) {
    try {
      const projectId = req.query.projectId;
      if (!projectId) {
        return res.status(400).json({ error: 'projectId query param is required' });
      }
      const base = getBaseUrl();
      const response = await fetch(`${base}/api/system/status`, {
        timeout: PROXY_TIMEOUT,
        headers: { 'Accept': 'application/json' },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const err = new Error(`Upstream Pulse returned ${response.status}: ${body.slice(0, 200)}`);
        err.upstreamStatus = response.status;
        throw err;
      }
      const data = await response.json();
      const jobs = (data.recentJobs || []).filter(j => j.projectId === projectId);
      res.json({ jobs });
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  // ── Admin routes (require team-tracker admin) ──────────────────

  const { requireAdmin } = context;

  router.get('/repo-info', requireAdmin, async function(req, res) {
    try {
      const data = await proxyAdminGet('/api/github/repo-info', {
        org: req.query.org,
        repo: req.query.repo,
      }, req);
      res.json(data);
    } catch (err) {
      handleProxyError(res, err);
    }
  });

  router.post('/projects', requireAdmin, async function(req, res) {
    try {
      const data = await proxyMutatingRequest('/api/projects', req.body, req);
      for (const key of responseCache.keys()) {
        if (key.startsWith('/api/projects') || key.startsWith('/api/metrics/dashboard') || key.startsWith('/api/orgs')) {
          responseCache.delete(key);
        }
      }
      res.json(data);
    } catch (err) {
      const status = err.upstreamStatus || 502;
      console.error('[upstream-pulse] POST /projects:', err.message);
      res.status(status).json(err.upstreamBody || {
        error: 'Upstream Pulse request failed',
        message: err.message,
      });
    }
  });

  // ── Roster push (sync org-pulse team data to upstream-pulse) ──

  router.post('/roster-push', requireAdmin, async function(req, res) {
    try {
      const result = await pushRosterToUpstream(context.storage);
      if (!result.skipped) {
        const registry = context.storage.readFromStorage('team-data/registry.json');
        if (registry && registry.meta) _lastPushGeneratedAt = registry.meta.generatedAt;
      }
      res.json(result);
    } catch (err) {
      console.error('[upstream-pulse] Manual roster push failed:', err.message);
      res.status(502).json({ error: 'Roster push failed', message: err.message });
    }
  });

  // Start periodic roster push (checks registry.json for changes)
  startPeriodicRosterPush(context.storage);

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const connection = await checkConnection();
      return {
        baseUrl: getBaseUrl(),
        configured: !!process.env.UPSTREAM_PULSE_API_URL,
        connection,
        rosterPush: {
          lastPushGeneratedAt: _lastPushGeneratedAt,
          serviceUser: process.env.UPSTREAM_SYNC_SERVICE_USER || 'roster-sync-service'
        }
      };
    });
  }
};
