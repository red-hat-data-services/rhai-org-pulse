module.exports = function registerRoutes(router, context) {
  const { storage } = context;

  // Data lives in data/modules/feature-traffic-data/ (synced via git-static)
  const DATA_PREFIX = 'modules/feature-traffic-data/latest';

  function readDataFile(relativePath) {
    return storage.readFromStorage(`${DATA_PREFIX}/${relativePath}`);
  }

  // GET /features — list all features with summary metrics
  router.get('/features', function(req, res) {
    const index = readDataFile('index.json');
    if (!index || !index.features) {
      return res.json({
        fetchedAt: null,
        featureCount: 0,
        features: [],
        message: 'No data available. Ensure the feature-traffic-data git-static module is configured and synced.'
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

    // Validate key format
    if (!/^RHAISTRAT-\d+$/.test(key)) {
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
    res.json({
      dataAvailable: !!index,
      fetchedAt: index?.fetchedAt || null,
      schemaVersion: index?.schemaVersion || null,
      featureCount: index?.featureCount || 0,
      dataSource: 'git-static module: feature-traffic-data'
    });
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

  // Diagnostics
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const index = readDataFile('index.json');
      return {
        dataAvailable: !!index,
        featureCount: index?.featureCount || 0,
        fetchedAt: index?.fetchedAt || null,
        schemaVersion: index?.schemaVersion || null
      };
    });
  }
};
