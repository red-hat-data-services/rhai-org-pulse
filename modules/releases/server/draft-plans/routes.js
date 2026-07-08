const { fetchDraftPlans, DATA_PREFIX, DEFAULT_CONFIG, KNOWN_PRODUCTS } = require('./fetch');
const { logAudit } = require('../planning/audit-log');

const COOLDOWN_MS = 5 * 60 * 1000;

module.exports = function registerDraftPlanRoutes(router, context) {
  const { storage, requireAuth, requireScope, secrets, registerRefresh, isRefreshRunning } = context;

  let fetchInProgress = false;
  let lastSuccessfulFetch = 0;
  let refreshState = { running: false, lastResult: null };

  function getToken() {
    if (!secrets) return null;
    return secrets.DRAFT_PLANS_GITLAB_TOKEN || secrets.GITLAB_TOKEN || null;
  }

  function getTokenSource() {
    if (!secrets) return null;
    if (secrets.DRAFT_PLANS_GITLAB_TOKEN) return 'DRAFT_PLANS_GITLAB_TOKEN';
    if (secrets.GITLAB_TOKEN) return 'GITLAB_TOKEN';
    return null;
  }

  function loadConfig() {
    var stored = storage.readFromStorage(DATA_PREFIX + '/config.json');
    return Object.assign({}, DEFAULT_CONFIG, stored || {});
  }

  function saveConfig(config) {
    storage.writeToStorage(DATA_PREFIX + '/config.json', config);
  }

  function validateConfig(input) {
    if (input.gitlabBaseUrl !== undefined) {
      if (typeof input.gitlabBaseUrl !== 'string' || !input.gitlabBaseUrl.startsWith('https://')) {
        throw new Error('gitlabBaseUrl must start with https://');
      }
    }
    if (input.projectId !== undefined) {
      if (typeof input.projectId !== 'string' || !/^\d+$/.test(input.projectId)) {
        throw new Error('projectId must be a numeric string');
      }
    }
    if (input.refreshIntervalHours !== undefined) {
      if (typeof input.refreshIntervalHours !== 'number' || input.refreshIntervalHours < 1 || input.refreshIntervalHours > 168) {
        throw new Error('refreshIntervalHours must be between 1 and 168');
      }
    }
    if (input.branch !== undefined && typeof input.branch !== 'string') {
      throw new Error('branch must be a string');
    }
    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
      throw new Error('enabled must be a boolean');
    }
  }

  async function doFetch() {
    var token = getToken();
    if (!token) {
      return { status: 'error', message: 'No GitLab token configured. Set DRAFT_PLANS_GITLAB_TOKEN or GITLAB_TOKEN.' };
    }
    var config = loadConfig();
    if (!config.enabled) {
      return { status: 'skipped', message: 'Draft plans fetch is disabled' };
    }
    fetchInProgress = true;
    refreshState = { running: true, startedAt: new Date().toISOString(), lastResult: refreshState.lastResult };
    try {
      var result = await fetchDraftPlans(storage, config, token);
      if (result.status === 'success') {
        lastSuccessfulFetch = Date.now();
      }
      refreshState = { running: false, lastResult: result };
      return result;
    } catch (err) {
      var errorResult = { status: 'error', message: err.message, timestamp: new Date().toISOString() };
      storage.writeToStorage(DATA_PREFIX + '/last-fetch.json', errorResult);
      refreshState = { running: false, lastResult: errorResult };
      throw err;
    } finally {
      fetchInProgress = false;
    }
  }

  // ─── Fixed-path routes (before parameterized) ──────────────────────

  router.get('/releases', requireAuth, requireScope('releases:read'), function(req, res) {
    var productFilter = req.query.product || null;
    var results = [];

    for (var i = 0; i < KNOWN_PRODUCTS.length; i++) {
      var product = KNOWN_PRODUCTS[i];
      if (productFilter && product !== productFilter) continue;

      var plan = storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-plan.json');
      var health = storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-health.json');

      if (!plan && !health) continue;

      var releases = [];
      var healthByVersion = {};

      if (health && Array.isArray(health.releases)) {
        for (var h = 0; h < health.releases.length; h++) {
          var hr = health.releases[h];
          healthByVersion[hr.version] = hr;
        }
      }

      if (plan && Array.isArray(plan.releases)) {
        for (var p = 0; p < plan.releases.length; p++) {
          var pr = plan.releases[p];
          var hv = healthByVersion[pr.version] || {};
          releases.push({
            version: pr.version,
            totalFeatures: hv.totalFeatures || null,
            committed: hv.committed || null,
            planned: hv.planned || null,
            healthStatus: hv.healthStatus || null,
            featureHealth: hv.featureHealth || null,
            overcommitRatio: hv.overcommitRatio || null
          });
        }
      }

      results.push({
        product: product,
        generatedAt: (plan && plan.generatedAt) || (health && health.generatedAt) || null,
        releases: releases
      });
    }

    var lastFetch = storage.readFromStorage(DATA_PREFIX + '/last-fetch.json');
    res.json({
      fetchedAt: lastFetch ? lastFetch.timestamp : null,
      products: results
    });
  });

  router.post('/refresh', requireAuth, requireScope('releases:write'), async function(req, res) {
    if (isRefreshRunning && isRefreshRunning()) {
      return res.status(409).json({ status: 'error', message: 'A global refresh is already in progress' });
    }

    var now = Date.now();
    var elapsed = now - lastSuccessfulFetch;
    if (lastSuccessfulFetch > 0 && elapsed < COOLDOWN_MS) {
      var retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({ status: 'cooldown', retryAfter: retryAfter });
    }

    if (fetchInProgress) {
      return res.json({ status: 'already_running' });
    }

    var token = getToken();
    if (!token) {
      return res.status(500).json({ status: 'error', message: 'No GitLab token configured. Set DRAFT_PLANS_GITLAB_TOKEN or GITLAB_TOKEN.' });
    }

    var config = loadConfig();
    if (!config.enabled) {
      return res.status(400).json({ status: 'error', message: 'Draft plans fetch is disabled. Enable it in config.' });
    }

    try {
      var result = await doFetch();
      logAudit(storage.readFromStorage, storage.writeToStorage, {
        domain: 'draft-plans',
        action: 'manual_refresh',
        user: req.userEmail || 'unknown',
        summary: 'Manual draft plans data refresh: ' + (result.status || 'unknown'),
        details: { status: result.status, fileCount: result.fileCount }
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message, timestamp: new Date().toISOString() });
    }
  });

  router.get('/refresh/status', requireAuth, requireScope('releases:read'), function(req, res) {
    var lastFetch = storage.readFromStorage(DATA_PREFIX + '/last-fetch.json');
    res.json({
      running: refreshState.running,
      startedAt: refreshState.startedAt || null,
      lastResult: refreshState.lastResult,
      lastFetch: lastFetch || null
    });
  });

  router.get('/config', requireAuth, requireScope('releases:write'), function(req, res) {
    var config = loadConfig();
    res.json(Object.assign({}, config, {
      tokenConfigured: !!getToken(),
      tokenSource: getTokenSource()
    }));
  });

  router.post('/config', requireAuth, requireScope('releases:write'), async function(req, res) {
    try {
      validateConfig(req.body);
      var oldConfig = loadConfig();
      var config = Object.assign({}, DEFAULT_CONFIG, req.body);
      saveConfig(config);

      logAudit(storage.readFromStorage, storage.writeToStorage, {
        domain: 'draft-plans',
        action: 'config_save',
        user: req.userEmail || 'unknown',
        summary: 'Updated draft plans fetch configuration',
        details: { enabled: config.enabled, projectId: config.projectId }
      });

      if (config.enabled && !oldConfig.enabled && getToken()) {
        try {
          var result = await doFetch();
          return res.json({ status: 'saved_and_fetched', fetchResult: result });
        } catch (err) {
          return res.json({ status: 'saved', fetchError: err.message });
        }
      }

      res.json({ status: 'saved' });
    } catch (err) {
      var status = (err.message && (err.message.includes('must be') || err.message.includes('must start'))) ? 400 : 500;
      res.status(status).json({ status: 'error', message: err.message });
    }
  });

  // ─── Parameterized routes ──────────────────────────────────────────

  router.get('/:version', requireAuth, requireScope('releases:read'), function(req, res) {
    var version = req.params.version;
    if (!/^[a-zA-Z0-9._-]{1,50}$/.test(version)) {
      return res.status(400).json({ error: 'Invalid version format' });
    }

    var productFilter = req.query.product || null;
    var result = { version: version, products: {} };

    for (var i = 0; i < KNOWN_PRODUCTS.length; i++) {
      var product = KNOWN_PRODUCTS[i];
      if (productFilter && product !== productFilter) continue;

      var plan = storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-plan.json');
      if (!plan || !Array.isArray(plan.releases)) continue;

      var match = null;
      for (var p = 0; p < plan.releases.length; p++) {
        if (plan.releases[p].version === version) {
          match = plan.releases[p];
          break;
        }
      }

      if (match) {
        result.products[product] = {
          generatedAt: plan.generatedAt || null,
          summary: plan.summary || null,
          capacity: plan.capacity || null,
          release: match
        };
      }
    }

    if (Object.keys(result.products).length === 0) {
      return res.status(404).json({ error: 'No draft plan data found for version ' + version });
    }

    res.json(result);
  });

  router.get('/:version/health', requireAuth, requireScope('releases:read'), function(req, res) {
    var version = req.params.version;
    if (!/^[a-zA-Z0-9._-]{1,50}$/.test(version)) {
      return res.status(400).json({ error: 'Invalid version format' });
    }

    var productFilter = req.query.product || null;
    var result = { version: version, products: {} };

    for (var i = 0; i < KNOWN_PRODUCTS.length; i++) {
      var product = KNOWN_PRODUCTS[i];
      if (productFilter && product !== productFilter) continue;

      var health = storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-health.json');
      if (!health || !Array.isArray(health.releases)) continue;

      var match = null;
      for (var h = 0; h < health.releases.length; h++) {
        if (health.releases[h].version === version) {
          match = health.releases[h];
          break;
        }
      }

      if (match) {
        result.products[product] = {
          generatedAt: health.generatedAt || null,
          historicalCapacity: health.historicalCapacity || null,
          velocitySource: health.velocitySource || null,
          release: match
        };
      }
    }

    if (Object.keys(result.products).length === 0) {
      return res.status(404).json({ error: 'No health data found for version ' + version });
    }

    res.json(result);
  });

  // ─── registerRefresh ──────────────────────────────────────────────

  if (registerRefresh) {
    var initialConfig = loadConfig();

    registerRefresh('draft-plans', {
      order: 80,
      timeout: 300000,
      description: 'Fetches draft release plan data from the release-planning-data GitLab repository.',
      cadence: initialConfig.refreshIntervalHours + 'h',
      handler: async function() {
        var config = loadConfig();
        if (!config.enabled) {
          return { status: 'skipped', message: 'Draft plans fetch is disabled' };
        }
        var token = getToken();
        if (!token) {
          return { status: 'error', message: 'No GitLab token configured' };
        }
        var elapsed = Date.now() - lastSuccessfulFetch;
        if (lastSuccessfulFetch > 0 && elapsed < COOLDOWN_MS) {
          return { status: 'cooldown', retryAfter: Math.ceil((COOLDOWN_MS - elapsed) / 1000) };
        }
        try {
          return await doFetch();
        } catch (err) {
          return { status: 'error', message: err.message, timestamp: new Date().toISOString() };
        }
      }
    });
  }

  // ─── registerDiagnostics ──────────────────────────────────────────

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      var lastFetch = storage.readFromStorage(DATA_PREFIX + '/last-fetch.json');
      var config = loadConfig();
      return {
        lastFetchStatus: lastFetch ? lastFetch.status : null,
        lastFetchTimestamp: lastFetch ? lastFetch.timestamp : null,
        fileCount: lastFetch ? lastFetch.fileCount : 0,
        configured: config.enabled && !!getToken(),
        tokenSource: getTokenSource()
      };
    });
  }
};
