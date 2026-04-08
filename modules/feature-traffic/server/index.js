const {
  getToken,
  getTokenSource,
  loadConfig,
  manualRefresh,
  onConfigSave,
  initScheduler
} = require('./scheduler');

const DATA_PREFIX = 'feature-traffic';

module.exports = function registerRoutes(router, context) {
  const { storage } = context;

  function readDataFile(relativePath) {
    return storage.readFromStorage(`${DATA_PREFIX}/${relativePath}`);
  }

  // Initialize scheduler on module load
  initScheduler(storage);

  // GET /features — list all features with summary metrics
  router.get('/features', function(req, res) {
    const index = readDataFile('index.json');
    if (!index || !index.features) {
      return res.json({
        fetchedAt: null,
        featureCount: 0,
        features: [],
        message: 'No data available. Configure GitLab CI integration in Settings to fetch feature traffic data.'
      });
    }

    // Optional filters
    let features = index.features;

    const statusFilter = req.query.status;
    if (statusFilter) {
      const statuses = statusFilter.split(',');
      features = features.filter(f => statuses.includes(f.status));
    }

    const versionFilter = req.query.version;
    if (versionFilter) {
      features = features.filter(f =>
        f.fixVersions && f.fixVersions.includes(versionFilter)
      );
    }

    const healthFilter = req.query.health;
    if (healthFilter) {
      const healths = healthFilter.split(',');
      features = features.filter(f => healths.includes(f.health));
    }

    // Sort
    const SORTABLE_FIELDS = ['key', 'summary', 'status', 'health', 'completionPct', 'epicCount', 'issueCount', 'blockerCount'];
    const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'key';
    const sortDir = req.query.sortDir === 'desc' ? -1 : 1;
    features.sort(function(a, b) {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * sortDir;
      }
      return String(aVal || '').localeCompare(String(bVal || '')) * sortDir;
    });

    res.json({
      fetchedAt: index.fetchedAt,
      featureCount: features.length,
      features
    });
  });

  // GET /features/:key — full feature detail
  router.get('/features/:key', function(req, res) {
    const key = req.params.key.toUpperCase();

    // Validate key format (RHAISTRAT in production, TEST* in demo mode)
    if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid feature key format' });
    }

    const feature = readDataFile(`features/${key}.json`);
    if (!feature) {
      return res.status(404).json({ error: `Feature ${key} not found` });
    }

    res.json(feature);
  });

  // GET /status — data freshness and sync info
  router.get('/status', function(req, res) {
    const index = readDataFile('index.json');
    const lastFetch = readDataFile('last-fetch.json');
    const config = loadConfig(storage);
    const token = getToken();

    const result = {
      dataAvailable: !!index,
      fetchedAt: index?.fetchedAt || null,
      schemaVersion: index?.schemaVersion || null,
      featureCount: index?.featureCount || 0,
      dataSource: config.projectPath
        ? `gitlab-ci (${config.projectPath})`
        : 'gitlab-ci',
      configured: config.enabled && !!token,
      tokenSource: getTokenSource()
    };

    if (lastFetch) {
      result.lastFetch = lastFetch;
    }

    // Staleness warning: data >48h old
    if (lastFetch?.timestamp) {
      const ageMs = Date.now() - new Date(lastFetch.timestamp).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      if (ageHours > 48) {
        result.staleWarning = true;
        const ageDays = Math.floor(ageHours / 24);
        result.dataAge = ageDays === 1 ? '1 day' : `${ageDays} days`;
      }
    }

    // Next scheduled fetch estimate
    if (config.enabled && token && config.refreshIntervalHours > 0) {
      const lastTs = lastFetch?.timestamp ? new Date(lastFetch.timestamp).getTime() : Date.now();
      const nextFetch = new Date(lastTs + config.refreshIntervalHours * 60 * 60 * 1000);
      result.nextScheduledFetch = nextFetch.toISOString();
    }

    res.json(result);
  });

  // GET /versions — list unique fix versions across all features
  router.get('/versions', function(req, res) {
    const index = readDataFile('index.json');
    if (!index || !index.features) {
      return res.json({ versions: [] });
    }

    const versions = new Set();
    for (const f of index.features) {
      for (const v of (f.fixVersions || [])) {
        versions.add(v);
      }
    }

    res.json({ versions: [...versions].sort() });
  });

  // POST /refresh — trigger manual data refresh (admin only)
  router.post('/refresh', context.requireAdmin, async function(req, res) {
    try {
      const result = await manualRefresh(storage);
      if (result.httpStatus === 429) {
        return res.status(429).json({ status: result.status, retryAfter: result.retryAfter });
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /config — get current fetch configuration (admin only)
  router.get('/config', context.requireAdmin, function(req, res) {
    const config = loadConfig(storage);
    res.json({
      ...config,
      tokenConfigured: !!getToken(),
      tokenSource: getTokenSource()
    });
  });

  // POST /config — save fetch configuration (admin only)
  router.post('/config', context.requireAdmin, async function(req, res) {
    try {
      const result = await onConfigSave(storage, req.body);
      res.json(result);
    } catch (err) {
      const status = err.message && (
        err.message.includes('must be') || err.message.includes('must start')
      ) ? 400 : 500;
      res.status(status).json({ status: 'error', message: err.message });
    }
  });

  // Diagnostics
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const index = readDataFile('index.json');
      const lastFetch = readDataFile('last-fetch.json');
      return {
        dataAvailable: !!index,
        featureCount: index?.featureCount || 0,
        fetchedAt: index?.fetchedAt || null,
        schemaVersion: index?.schemaVersion || null,
        lastFetchStatus: lastFetch?.status || null,
        configured: loadConfig(storage).enabled && !!getToken()
      };
    });
  }
};
