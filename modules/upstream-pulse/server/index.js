const fetch = require('node-fetch');

const DEFAULT_BASE_URL = 'http://backend.ambient-code--upstream-pulse.svc.cluster.local:3000';

function getBaseUrl() {
  return (process.env.UPSTREAM_PULSE_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function proxyRequest(path, query = {}) {
  const base = getBaseUrl();
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    timeout: 30000,
    headers: { 'Accept': 'application/json' }
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
