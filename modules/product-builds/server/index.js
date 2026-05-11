const { proxyGet } = require('./proxy');

const CONFIG_PATH = 'product-builds/config.json';

const DEFAULT_CONFIG = {
  baseUrl: ''
};

function getConfig(readFromStorage) {
  const saved = readFromStorage(CONFIG_PATH);
  if (saved && typeof saved === 'object' && !saved._deleted && saved.baseUrl) {
    return { ...DEFAULT_CONFIG, ...saved };
  }
  const envUrl = process.env.PRODUCT_BUILDS_API_URL;
  if (envUrl) {
    return { ...DEFAULT_CONFIG, baseUrl: envUrl };
  }
  return { ...DEFAULT_CONFIG };
}

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;

  // --- Config routes (admin) ---

  router.get('/config', requireAdmin, function(req, res) {
    res.json(getConfig(readFromStorage));
  });

  router.post('/config', requireAdmin, function(req, res) {
    const { baseUrl } = req.body;
    if (typeof baseUrl !== 'string') {
      return res.status(400).json({ error: 'baseUrl must be a string' });
    }
    const trimmed = baseUrl.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return res.status(400).json({ error: 'baseUrl must be an HTTP or HTTPS URL' });
    }
    writeToStorage(CONFIG_PATH, { baseUrl: trimmed });
    res.json({ status: 'ok', baseUrl: trimmed });
  });

  // --- Helper to get baseUrl for proxy ---

  function upstream(upstreamPath, req, res) {
    const { baseUrl } = getConfig(readFromStorage);
    return proxyGet(baseUrl, upstreamPath, req.query, res);
  }

  // --- Proxy routes ---

  // Products
  router.get('/products/:key', function(req, res) {
    upstream(`/products/${encodeURIComponent(req.params.key)}`, req, res);
  });

  // Drops
  router.get('/drops', function(req, res) {
    upstream('/drops', req, res);
  });

  router.get('/drops/:key', function(req, res) {
    upstream(`/drops/${encodeURIComponent(req.params.key)}`, req, res);
  });

  router.get('/drops/:key/changelog', function(req, res) {
    upstream(`/drops/${encodeURIComponent(req.params.key)}/changelog`, req, res);
  });

  router.get('/drops/:key/metrics', function(req, res) {
    upstream(`/drops/${encodeURIComponent(req.params.key)}/metrics`, req, res);
  });

  // Series
  router.get('/series', function(req, res) {
    upstream('/series', req, res);
  });

  // Artifacts
  router.get('/artifacts', function(req, res) {
    upstream('/artifacts', req, res);
  });

  router.get('/artifacts/:key', function(req, res) {
    upstream(`/artifacts/${encodeURIComponent(req.params.key)}`, req, res);
  });

  router.get('/artifacts/:key/wheels', function(req, res) {
    upstream(`/artifacts/${encodeURIComponent(req.params.key)}/wheels`, req, res);
  });

  router.get('/artifacts/:key/containers', function(req, res) {
    upstream(`/artifacts/${encodeURIComponent(req.params.key)}/containers`, req, res);
  });
};

module.exports.getConfig = getConfig;
