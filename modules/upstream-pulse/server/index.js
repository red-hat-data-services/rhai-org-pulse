const fetch = require('node-fetch');

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

async function checkConnection() {
  try {
    const base = getBaseUrl();
    const response = await fetch(`${base}/health`, { timeout: 5000 });
    return { reachable: true, status: response.status };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
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
      const data = await proxyRequest('/api/metrics/leadership');
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

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const connection = await checkConnection();
      return {
        baseUrl: getBaseUrl(),
        configured: !!process.env.UPSTREAM_PULSE_API_URL,
        connection
      };
    });
  }
};
