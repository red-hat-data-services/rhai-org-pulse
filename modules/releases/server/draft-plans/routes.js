const { fetchDraftPlans, DATA_PREFIX, DEFAULT_CONFIG, KNOWN_PRODUCTS } = require('./fetch');
const { logAudit } = require('../planning/audit-log');

const COOLDOWN_MS = 5 * 60 * 1000;

module.exports = async function registerDraftPlanRoutes(router, context) {
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

  async function loadConfig() {
    var stored = await storage.readFromStorage(DATA_PREFIX + '/config.json');
    return Object.assign({}, DEFAULT_CONFIG, stored || {});
  }

  async function saveConfig(config) {
    await storage.writeToStorage(DATA_PREFIX + '/config.json', config);
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
    var config = await loadConfig();
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
      await storage.writeToStorage(DATA_PREFIX + '/last-fetch.json', errorResult);
      refreshState = { running: false, lastResult: errorResult };
      throw err;
    } finally {
      fetchInProgress = false;
    }
  }

  // ─── Fixed-path routes (before parameterized) ──────────────────────

  /**
   * @openapi
   * /api/modules/releases/draft-plans/releases:
   *   get:
   *     tags: [Releases]
   *     summary: List draft plan versions with health summary
   *     parameters:
   *       - in: query
   *         name: product
   *         schema: { type: string }
   *         description: Filter by product (e.g. RHOAI)
   *     responses:
   *       200:
   *         description: Draft plan releases with health data
   */
  router.get('/releases', requireAuth, requireScope('releases:read'), async function(req, res) {
    var productFilter = req.query.product || null;
    var results = [];

    for (var i = 0; i < KNOWN_PRODUCTS.length; i++) {
      var product = KNOWN_PRODUCTS[i];
      if (productFilter && product !== productFilter) continue;

      var plan = await storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-plan.json');
      var health = await storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-health.json');

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

    var lastFetch = await storage.readFromStorage(DATA_PREFIX + '/last-fetch.json');
    res.json({
      fetchedAt: lastFetch ? lastFetch.timestamp : null,
      products: results
    });
  });

  /**
   * @openapi
   * /api/modules/releases/draft-plans/refresh:
   *   post:
   *     tags: [Releases]
   *     summary: Trigger draft plans data refresh from GitLab
   *     responses:
   *       200:
   *         description: Refresh result
   *       400:
   *         description: Fetch is disabled
   *       409:
   *         description: Global refresh already in progress
   *       429:
   *         description: Cooldown active
   *       500:
   *         description: No token configured or fetch error
   */
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

    var config = await loadConfig();
    if (!config.enabled) {
      return res.status(400).json({ status: 'error', message: 'Draft plans fetch is disabled. Enable it in config.' });
    }

    try {
      var result = await doFetch();
      await logAudit(storage.readFromStorage, storage.writeToStorage, {
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

  /**
   * @openapi
   * /api/modules/releases/draft-plans/refresh/status:
   *   get:
   *     tags: [Releases]
   *     summary: Get draft plans refresh progress and last fetch info
   *     responses:
   *       200:
   *         description: Refresh status
   */
  router.get('/refresh/status', requireAuth, requireScope('releases:read'), async function(req, res) {
    var lastFetch = await storage.readFromStorage(DATA_PREFIX + '/last-fetch.json');
    res.json({
      running: refreshState.running,
      startedAt: refreshState.startedAt || null,
      lastResult: refreshState.lastResult,
      lastFetch: lastFetch || null
    });
  });

  /**
   * @openapi
   * /api/modules/releases/draft-plans/config:
   *   get:
   *     tags: [Releases]
   *     summary: Get draft plans fetch configuration
   *     responses:
   *       200:
   *         description: Current configuration with token status
   */
  router.get('/config', requireAuth, requireScope('releases:write'), async function(req, res) {
    var config = await loadConfig();
    res.json(Object.assign({}, config, {
      tokenConfigured: !!getToken(),
      tokenSource: getTokenSource()
    }));
  });

  /**
   * @openapi
   * /api/modules/releases/draft-plans/config:
   *   post:
   *     tags: [Releases]
   *     summary: Update draft plans fetch configuration
   *     responses:
   *       200:
   *         description: Configuration saved (optionally triggers fetch if newly enabled)
   *       400:
   *         description: Invalid configuration values
   */
  router.post('/config', requireAuth, requireScope('releases:write'), async function(req, res) {
    try {
      validateConfig(req.body);
      var oldConfig = await loadConfig();
      var config = Object.assign({}, oldConfig, req.body);
      await saveConfig(config);

      await logAudit(storage.readFromStorage, storage.writeToStorage, {
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

  /**
   * @openapi
   * /api/modules/releases/draft-plans/{version}:
   *   get:
   *     tags: [Releases]
   *     summary: Get full draft plan for a specific version
   *     parameters:
   *       - in: path
   *         name: version
   *         required: true
   *         schema: { type: string }
   *         description: Release version (e.g. 3.5)
   *       - in: query
   *         name: product
   *         schema: { type: string }
   *         description: Filter by product
   *     responses:
   *       200:
   *         description: Draft plan data for the version
   *       400:
   *         description: Invalid version format
   *       404:
   *         description: No data found for version
   */
  router.get('/:version', requireAuth, requireScope('releases:read'), async function(req, res) {
    var version = req.params.version;
    if (!/^[a-zA-Z0-9 ._-]{1,50}$/.test(version)) {
      return res.status(400).json({ error: 'Invalid version format' });
    }

    var productFilter = req.query.product || null;
    var result = { version: version, products: {} };

    for (var i = 0; i < KNOWN_PRODUCTS.length; i++) {
      var product = KNOWN_PRODUCTS[i];
      if (productFilter && product !== productFilter) continue;

      var plan = await storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-plan.json');
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

  /**
   * @openapi
   * /api/modules/releases/draft-plans/{version}/health:
   *   get:
   *     tags: [Releases]
   *     summary: Get health details for a specific version
   *     parameters:
   *       - in: path
   *         name: version
   *         required: true
   *         schema: { type: string }
   *         description: Release version (e.g. 3.5)
   *       - in: query
   *         name: product
   *         schema: { type: string }
   *         description: Filter by product
   *     responses:
   *       200:
   *         description: Health data for the version
   *       400:
   *         description: Invalid version format
   *       404:
   *         description: No health data found for version
   */
  router.get('/:version/health', requireAuth, requireScope('releases:read'), async function(req, res) {
    var version = req.params.version;
    if (!/^[a-zA-Z0-9 ._-]{1,50}$/.test(version)) {
      return res.status(400).json({ error: 'Invalid version format' });
    }

    var productFilter = req.query.product || null;
    var result = { version: version, products: {} };

    for (var i = 0; i < KNOWN_PRODUCTS.length; i++) {
      var product = KNOWN_PRODUCTS[i];
      if (productFilter && product !== productFilter) continue;

      var health = await storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-health.json');
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
    var initialConfig = await loadConfig();

    registerRefresh('draft-plans', {
      order: 80,
      timeout: 300000,
      description: 'Fetches draft release plan data from the release-planning-data GitLab repository.',
      cadence: initialConfig.refreshIntervalHours + 'h',
      handler: async function() {
        var config = await loadConfig();
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
      var lastFetch = await storage.readFromStorage(DATA_PREFIX + '/last-fetch.json');
      var config = await loadConfig();
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
