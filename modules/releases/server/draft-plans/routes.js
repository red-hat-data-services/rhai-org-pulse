const { fetchDraftPlans, DATA_PREFIX, DEFAULT_CONFIG, KNOWN_PRODUCTS } = require('./fetch');
const { logAudit } = require('../planning/audit-log');
const { normalizeDraft } = require('./normalize');
const {
  resolveDraftPlanSession,
  applySessionToMeta,
  authorizeEditorSave
} = require('./acl');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const COOLDOWN_MS = 5 * 60 * 1000;
const VERSION_RE = /^[a-zA-Z0-9 ._-]{1,50}$/;
const DEMO_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'draft-3.6-demo.json');

function loadDemoFixture() {
  try {
    var raw = JSON.parse(fs.readFileSync(DEMO_FIXTURE_PATH, 'utf8'));
    return normalizeDraft(raw);
  } catch (err) {
    console.warn('[releases/draft-plans] Failed to load demo fixture:', err.message);
    return null;
  }
}

function emptyEditorEnvelope(planVersion, baseGeneratedAt) {
  return {
    edits: {},
    meta: {
      planVersion: planVersion || null,
      baseGeneratedAt: baseGeneratedAt || null,
      currentUser: 'Admin',
      isPlanAdmin: true,
      editorsAllowlist: null,
      frozenEvents: {},
      finalGaFrozen: false,
      locked: false,
      lockedBy: null,
      lockedAt: null
    },
    audit: []
  };
}

async function listCyclesForProduct(storage, product) {
  var byVersion = {};

  // Published pipeline drafts (post-!25 storage layout)
  if (storage.listStorageFiles) {
    try {
      var files = await storage.listStorageFiles(DATA_PREFIX + '/drafts/' + product);
      for (var i = 0; i < files.length; i++) {
        var name = files[i];
        if (!name.endsWith('.json')) continue;
        var ver = name.replace(/\.json$/, '');
        var raw = await storage.readFromStorage(DATA_PREFIX + '/drafts/' + product + '/' + name);
        if (!raw) continue;
        var normalized = normalizeDraft(raw);
        byVersion[ver] = {
          version: normalized.version || ver,
          product: product,
          label: product + ' ' + (normalized.version || ver),
          source: 'pipeline',
          demoMode: !!normalized.demoMode,
          generatedAt: normalized.generatedAt || null,
          candidateCount: normalized.summary && normalized.summary.candidateCount != null
            ? normalized.summary.candidateCount
            : (normalized.candidates ? normalized.candidates.length : null)
        };
      }
    } catch (err) {
      console.warn('[releases/draft-plans] list drafts failed:', err.message);
    }
  }

  // Legacy release-plan.json versions (planner catalog, may lack editor draft)
  var plan = await storage.readFromStorage(DATA_PREFIX + '/' + product + '/release-plan.json');
  if (plan && Array.isArray(plan.releases)) {
    for (var p = 0; p < plan.releases.length; p++) {
      var pr = plan.releases[p];
      if (!pr || !pr.version) continue;
      if (byVersion[pr.version]) continue;
      byVersion[pr.version] = {
        version: pr.version,
        product: product,
        label: product + ' ' + pr.version,
        source: 'release-plan',
        demoMode: false,
        generatedAt: plan.generatedAt || null,
        candidateCount: null,
        editorAvailable: false
      };
    }
  }

  // Demo fixture fills gaps (and is default when nothing else exists)
  var demo = loadDemoFixture();
  if (demo && demo.version) {
    if (!byVersion[demo.version] || byVersion[demo.version].source === 'release-plan') {
      byVersion[demo.version] = {
        version: demo.version,
        product: product,
        label: product + ' ' + demo.version,
        source: byVersion[demo.version] ? 'demo+release-plan' : 'demo',
        demoMode: true,
        generatedAt: demo.generatedAt || null,
        candidateCount: demo.summary && demo.summary.candidateCount != null
          ? demo.summary.candidateCount
          : (demo.candidates ? demo.candidates.length : 0),
        editorAvailable: true
      };
    }
  }

  var cycles = Object.keys(byVersion)
    .map(function(k) { return byVersion[k]; })
    .sort(function(a, b) {
      return String(b.version).localeCompare(String(a.version), undefined, { numeric: true });
    });

  for (var c = 0; c < cycles.length; c++) {
    if (cycles[c].editorAvailable === undefined) cycles[c].editorAvailable = true;
  }

  return cycles;
}

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


  // express-rate-limit is recognized by CodeQL js/missing-rate-limiting (custom
  // Map middleware is not). Per-user key keeps interactive red-pen editing usable.
  const editorSaveRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: function(req) {
      return req.userEmail || 'anonymous';
    },
    handler: function(req, res) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
  });


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
   * /api/modules/releases/draft-plans/cycles:
   *   get:
   *     tags: [Releases]
   *     summary: List available draft-plan cycles for the red-pen editor
   *     parameters:
   *       - in: query
   *         name: product
   *         schema: { type: string }
   *         description: Product family (e.g. RHOAI)
   *     responses:
   *       200:
   *         description: Available cycles (pipeline drafts, release-plan catalog, demo fixture)
   */
  router.get('/cycles', requireAuth, requireScope('releases:read'), async function(req, res) {
    var product = req.query.product || 'RHOAI';
    if (KNOWN_PRODUCTS.indexOf(product) === -1) {
      return res.status(400).json({ error: 'Unknown product. Expected one of: ' + KNOWN_PRODUCTS.join(', ') });
    }
    var cycles = await listCyclesForProduct(storage, product);
    var defaultVersion = cycles.length > 0 ? cycles[0].version : null;
    // Prefer demo/pipeline editor-ready cycle over catalog-only entries
    for (var i = 0; i < cycles.length; i++) {
      if (cycles[i].editorAvailable !== false) {
        defaultVersion = cycles[i].version;
        break;
      }
    }
    res.json({
      product: product,
      products: KNOWN_PRODUCTS.slice(),
      defaultVersion: defaultVersion,
      cycles: cycles
    });
  });

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

  /**
   * @openapi
   * /api/modules/releases/draft-plans/editor/{version}:
   *   get:
   *     tags: [Releases]
   *     summary: Get draft plan base + red-pen editor state for a version
   *     parameters:
   *       - in: path
   *         name: version
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: product
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Draft plan with editor state (edits, meta, audit)
   *       400:
   *         description: Invalid version format or unknown product
   *       404:
   *         description: No draft plan data found
   */
  router.get('/editor/:version', requireAuth, requireScope('releases:read'), async function(req, res) {
    var version = req.params.version;
    if (!VERSION_RE.test(version)) {
      return res.status(400).json({ error: 'Invalid version format' });
    }

    var product = req.query.product || 'RHOAI';
    if (KNOWN_PRODUCTS.indexOf(product) === -1) {
      return res.status(400).json({ error: 'Unknown product: ' + product });
    }
    var draftRaw = await storage.readFromStorage(DATA_PREFIX + '/drafts/' + product + '/' + version + '.json');
    var draft = draftRaw ? normalizeDraft(draftRaw) : null;

    if (!draft || !draft.candidates || draft.candidates.length === 0) {
      if (version === '3.6') {
        draft = loadDemoFixture();
      }
    }

    if (!draft || !draft.candidates || draft.candidates.length === 0) {
      return res.status(404).json({ error: 'No draft plan data found for version ' + version });
    }

    var editorKey = DATA_PREFIX + '/editor/' + product + '/' + version + '.json';
    var stored = await storage.readFromStorage(editorKey);
    var envelope = emptyEditorEnvelope(draft.version, draft.generatedAt);
    if (stored && typeof stored === 'object') {
      if (stored.edits && typeof stored.edits === 'object') envelope.edits = stored.edits;
      if (stored.meta && typeof stored.meta === 'object') {
        envelope.meta = Object.assign({}, envelope.meta, stored.meta);
      }
      if (Array.isArray(stored.audit)) envelope.audit = stored.audit;
    }

    var session = await resolveDraftPlanSession(req, storage);
    envelope.meta = applySessionToMeta(
      envelope.meta,
      session,
      session.canImpersonate ? envelope.meta.currentUser : null
    );

    res.json({
      draft: draft,
      ceilingsByComponent: draft.ceilingsByComponent || {},
      edits: envelope.edits,
      meta: envelope.meta,
      audit: envelope.audit,
      session: {
        actor: session.actor,
        email: session.email,
        uid: session.uid,
        rosterMatched: session.rosterMatched,
        isPlanAdmin: session.isPlanAdmin,
        canImpersonate: session.canImpersonate,
        demoMode: session.demoMode
      }
    });
  });

  /**
   * @openapi
   * /api/modules/releases/draft-plans/editor/{version}:
   *   put:
   *     tags: [Releases]
   *     summary: Persist red-pen edits, meta, and audit for a draft plan version
   *     parameters:
   *       - in: path
   *         name: version
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: product
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Editor state saved
   *       400:
   *         description: Invalid version format, unknown product, or missing required fields
   *       403:
   *         description: Forbidden by draft-plan ACL
   *       429:
   *         description: Rate limit exceeded
   */
  router.put('/editor/:version', requireAuth, requireScope('releases:write'), editorSaveRateLimit, async function(req, res) {
    var version = req.params.version;
    if (!VERSION_RE.test(version)) {
      return res.status(400).json({ error: 'Invalid version format' });
    }

    var product = (req.query.product || (req.body && req.body.product) || 'RHOAI');
    if (KNOWN_PRODUCTS.indexOf(product) === -1) {
      return res.status(400).json({ error: 'Unknown product: ' + product });
    }
    var body = req.body || {};
    if (!body.edits || typeof body.edits !== 'object' || Array.isArray(body.edits)) {
      return res.status(400).json({ error: 'edits object is required' });
    }
    if (!body.meta || typeof body.meta !== 'object' || Array.isArray(body.meta)) {
      return res.status(400).json({ error: 'meta object is required' });
    }
    if (body.audit !== undefined && !Array.isArray(body.audit)) {
      return res.status(400).json({ error: 'audit must be an array' });
    }

    var session = await resolveDraftPlanSession(req, storage);
    var editorKey = DATA_PREFIX + '/editor/' + product + '/' + version + '.json';
    var previous = await storage.readFromStorage(editorKey);
    if (!previous) previous = emptyEditorEnvelope(version, null);

    var draftRaw = await storage.readFromStorage(DATA_PREFIX + '/drafts/' + product + '/' + version + '.json');
    var draft = draftRaw ? normalizeDraft(draftRaw) : null;
    if ((!draft || !draft.candidates || draft.candidates.length === 0) && version === '3.6') {
      draft = loadDemoFixture();
    }

    var authz = authorizeEditorSave(session, draft, previous, body);
    if (!authz.ok) {
      return res.status(authz.status).json({ error: authz.error });
    }

    var payload = {
      edits: body.edits,
      meta: authz.meta,
      audit: Array.isArray(body.audit) ? body.audit.slice(0, 500) : [],
      savedAt: new Date().toISOString()
    };

    await storage.writeToStorage(editorKey, payload);

    var user = session.actor || req.userEmail || 'unknown';
    await logAudit(storage.readFromStorage.bind(storage), storage.writeToStorage.bind(storage), {
      domain: 'draft-plans',
      version: version,
      action: 'editor_save',
      user: user,
      summary: 'Saved draft plan editor state for ' + product + ' ' + version,
      details: {
        editCount: Object.keys(payload.edits).length,
        auditCount: payload.audit.length,
        finalGaFrozen: !!(payload.meta && payload.meta.finalGaFrozen),
        actor: session.actor,
        isPlanAdmin: !!payload.meta.isPlanAdmin
      }
    });

    res.json({
      status: 'saved',
      savedAt: payload.savedAt,
      meta: payload.meta,
      session: {
        actor: session.actor,
        email: session.email,
        isPlanAdmin: session.isPlanAdmin,
        canImpersonate: session.canImpersonate
      }
    });
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
    if (!VERSION_RE.test(version)) {
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
    if (!VERSION_RE.test(version)) {
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
