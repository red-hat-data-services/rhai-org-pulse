/**
 * Execution domain routes for the releases module.
 *
 * Migrated from modules/feature-traffic/server/index.js.
 * Storage paths migrated to releases/execution/ (Phase 5).
 */

const express = require('express');
const scheduler = require('./scheduler');
const {
  getToken,
  getTokenSource,
  loadConfig,
  manualRefresh,
  onConfigSave,
  setOnCadenceChange
} = scheduler;
const { logAudit } = require('../planning/audit-log');
const { mergeAiReview } = require('./ai-review-merge');
const { writeFeatures } = require('./feature-store');

const DATA_PREFIX = 'releases/execution';
const jsonLimit = express.json({ limit: '10mb' });

function stripZStream(value) {
  if (!value) return value
  return String(value).replace(/\.z\b/gi, '')
}

/**
 * @openapi
 * /api/modules/releases/execution/features:
 *   get:
 *     summary: List all features with summary metrics
 *     tags: [Releases - Execution]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: version
 *         schema: { type: string }
 *       - in: query
 *         name: health
 *         schema: { type: string }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Feature list
 */

/**
 * @openapi
 * /api/modules/releases/execution/features/{key}:
 *   get:
 *     summary: Full feature detail
 *     tags: [Releases - Execution]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Feature detail
 *       400:
 *         description: Invalid key format
 *       404:
 *         description: Feature not found
 */

/**
 * @openapi
 * /api/modules/releases/execution/status:
 *   get:
 *     summary: Data freshness and sync info
 *     tags: [Releases - Execution]
 *     responses:
 *       200:
 *         description: Status info
 */

/**
 * @openapi
 * /api/modules/releases/execution/versions:
 *   get:
 *     summary: List unique fix versions across all features
 *     tags: [Releases - Execution]
 *     responses:
 *       200:
 *         description: Version list
 */

/**
 * @openapi
 * /api/modules/releases/execution/refresh:
 *   post:
 *     summary: Trigger manual data refresh (admin only)
 *     tags: [Releases - Execution]
 *     responses:
 *       200:
 *         description: Refresh result
 *       429:
 *         description: Cooldown active
 */

/**
 * @openapi
 * /api/modules/releases/execution/config:
 *   get:
 *     summary: Get current fetch configuration (admin only)
 *     tags: [Releases - Execution]
 *     responses:
 *       200:
 *         description: Config data
 *   post:
 *     summary: Save fetch configuration (admin only)
 *     tags: [Releases - Execution]
 *     responses:
 *       200:
 *         description: Save result
 */

/**
 * @openapi
 * /api/modules/releases/execution/features/{key}/refresh:
 *   post:
 *     summary: On-demand single-feature refresh from Jira
 *     tags: [Releases - Execution]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Refreshed feature
 *       400:
 *         description: Invalid key format
 *       404:
 *         description: Feature not found
 *       429:
 *         description: Per-key cooldown active
 */

module.exports = function registerExecutionRoutes(router, context) {
  // Initialize scheduler with secrets and jira client
  const jira = context.jira || null;
  if (context.secrets) scheduler.init(context.secrets, jira);

  const { storage, requireAuth, requireScope } = context;

  function readDataFile(relativePath) {
    return storage.readFromStorage(`${DATA_PREFIX}/${relativePath}`);
  }

  // GET /features — list all features with summary metrics
  router.get('/features', requireAuth, requireScope('releases:read'), function(req, res) {
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
      const normalizedFilter = stripZStream(versionFilter);
      features = features.filter(f =>
        f.fixVersions && f.fixVersions.some(v => stripZStream(v) === normalizedFilter)
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
  router.get('/features/:key', requireAuth, requireScope('releases:read'), function(req, res) {
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

  // POST /features/:key/refresh — on-demand single-feature refresh from Jira
  const perKeyLastRefresh = new Map();
  const PER_KEY_COOLDOWN_MS = 60 * 1000;

  router.post('/features/:key/refresh', requireAuth, requireScope('releases:read'), async function(req, res) {
    const key = req.params.key.toUpperCase();

    if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid feature key format' });
    }

    const existing = readDataFile(`features/${key}.json`);
    if (!existing) {
      return res.status(404).json({ error: `Feature ${key} not found` });
    }

    // Per-key cooldown
    const lastRefresh = perKeyLastRefresh.get(key) || 0;
    const elapsed = Date.now() - lastRefresh;
    if (lastRefresh > 0 && elapsed < PER_KEY_COOLDOWN_MS) {
      const retryAfter = Math.ceil((PER_KEY_COOLDOWN_MS - elapsed) / 1000);
      return res.status(429).json({ status: 'cooldown', retryAfter });
    }

    if (!jira) {
      return res.status(503).json({ error: 'Jira client not configured' });
    }

    try {
      const { enrichFeatures } = require('./jira-enrich');
      const { mergeFeatureData, writeFeatures } = require('./feature-store');

      const enrichmentMap = await enrichFeatures([key], jira.jiraRequest, jira.fetchAllJqlResults);
      const jiraData = enrichmentMap.get(key) || null;
      const merged = mergeFeatureData(existing, null, jiraData);

      await writeFeatures(storage, [merged]);
      perKeyLastRefresh.set(key, Date.now());

      res.json(merged);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /status — data freshness and sync info
  router.get('/status', requireAuth, requireScope('releases:read'), function(req, res) {
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
  router.get('/versions', requireAuth, requireScope('releases:read'), function(req, res) {
    const index = readDataFile('index.json');
    if (!index || !index.features) {
      return res.json({ versions: [] });
    }

    const versions = new Set();
    for (const f of index.features) {
      for (const v of (f.fixVersions || [])) {
        versions.add(stripZStream(v));
      }
    }

    res.json({ versions: [...versions].sort() });
  });

  // POST /refresh — trigger manual data refresh (admin only)
  router.post('/refresh', context.requireAdmin, requireScope('releases:write'), async function(req, res) {
    if (context.isRefreshRunning && context.isRefreshRunning()) {
      return res.status(409).json({ status: 'error', message: 'A global refresh is already in progress' });
    }
    try {
      const result = await manualRefresh(storage);
      if (result.httpStatus === 429) {
        return res.status(429).json({ status: result.status, retryAfter: result.retryAfter });
      }
      logAudit(storage.readFromStorage, storage.writeToStorage, {
        domain: 'execution',
        action: 'manual_refresh',
        user: req.userEmail || 'unknown',
        summary: 'Manual execution data refresh: ' + (result.status || 'unknown'),
        details: { status: result.status, fileCount: result.fileCount }
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /config — get current fetch configuration (admin only)
  router.get('/config', context.requireAdmin, requireScope('releases:write'), function(req, res) {
    const config = loadConfig(storage);
    res.json({
      ...config,
      tokenConfigured: !!getToken(),
      tokenSource: getTokenSource()
    });
  });

  // POST /config — save fetch configuration (admin only)
  router.post('/config', context.requireAdmin, requireScope('releases:write'), async function(req, res) {
    try {
      const result = await onConfigSave(storage, req.body);
      logAudit(storage.readFromStorage, storage.writeToStorage, {
        domain: 'execution',
        action: 'config_save',
        user: req.userEmail || 'unknown',
        summary: 'Updated execution fetch configuration',
        details: { enabled: req.body.enabled, projectPath: req.body.projectPath }
      });
      res.json(result);
    } catch (err) {
      const status = err.message && (
        err.message.includes('must be') || err.message.includes('must start')
      ) ? 400 : 500;
      res.status(status).json({ status: 'error', message: err.message });
    }
  });

  // ─── AI Review internal API ───

  /**
   * @openapi
   * /api/modules/releases/execution/ai-review/bulk:
   *   post:
   *     summary: Bulk upsert AI review data into unified feature store
   *     tags: [Releases - Execution]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               features:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     key: { type: string }
   *                     aiReview: { type: object }
   *     responses:
   *       200:
   *         description: Upsert results with created/updated/unchanged counts
   */
  router.post('/ai-review/bulk', context.requireAdmin, requireScope('releases:write'), jsonLimit, async function(req, res) {
    const { features } = req.body;
    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'features must be an array' });
    }
    if (features.length > 5000) {
      return res.status(400).json({ error: 'Bulk payload exceeds maximum of 5000 entries' });
    }

    try {
      const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
      const toWrite = [];

      const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

      for (let i = 0; i < features.length; i++) {
        const entry = features[i];
        if (!entry || !entry.key || !entry.aiReview) {
          counts.skipped++;
          continue;
        }
        if (!KEY_RE.test(entry.key)) {
          counts.skipped++;
          continue;
        }

        const existing = readDataFile('features/' + entry.key + '.json');
        const { aiReview, status } = mergeAiReview(
          existing ? existing.aiReview : null,
          entry.aiReview
        );

        counts[status]++;

        if (status !== 'unchanged') {
          const feature = existing || { key: entry.key, summary: entry.aiReview.title || '' };
          feature.aiReview = aiReview;
          feature._sources = feature._sources || {};
          feature._sources.aiReview = new Date().toISOString();
          toWrite.push(feature);
        }
      }

      if (toWrite.length > 0) {
        await writeFeatures(storage, toWrite);
      }

      res.json(counts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/releases/execution/ai-review:
   *   delete:
   *     summary: Remove AI review data from all features (async)
   *     tags: [Releases - Execution]
   *     responses:
   *       200:
   *         description: Deletion started
   */
  router.delete('/ai-review', context.requireAdmin, requireScope('releases:write'), function(req, res) {
    res.json({ status: 'started', message: 'AI review data removal started' });

    // Process in background
    (async function() {
      try {
        const fileNames = storage.listStorageFiles(DATA_PREFIX + '/features');
        if (!fileNames || fileNames.length === 0) return;

        const toWrite = [];
        for (let i = 0; i < fileNames.length; i++) {
          if (!fileNames[i].endsWith('.json')) continue;
          const feature = storage.readFromStorage(DATA_PREFIX + '/features/' + fileNames[i]);
          if (feature && feature.aiReview) {
            delete feature.aiReview;
            if (feature._sources) {
              delete feature._sources.aiReview;
            }
            toWrite.push(feature);
          }
        }

        if (toWrite.length > 0) {
          await writeFeatures(storage, toWrite);
        }
        console.log('[execution] Removed AI review data from ' + toWrite.length + ' features');
      } catch (err) {
        console.error('[execution] AI review data removal failed:', err.message);
      }
    })();
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

  // Handler config defined once — single source of truth
  const handlerConfig = {
    order: 70,
    timeout: 600000,
    description: 'Fetches execution pipeline data from GitLab CI artifacts for release tracking.',
    handler: async function(options) {
      options = options || {};
      if (options.skipCooldown) {
        const { runFetch } = require('./scheduler');
        return runFetch(storage);
      }
      return manualRefresh(storage);
    }
  };

  if (context.registerRefresh) {
    const initialConfig = loadConfig(storage);
    context.registerRefresh('execution', {
      ...handlerConfig,
      cadence: initialConfig.refreshIntervalHours + 'h'
    });

    // Wire config save to re-register with updated cadence
    setOnCadenceChange(function(newCadenceStr) {
      context.registerRefresh('execution', {
        ...handlerConfig,
        cadence: newCadenceStr
      });
    });

    // Register Jira enrichment periodic sync (Phase 3)
    if (jira) {
      const { syncAllFeatures, discoverFromJira, reconcileTrackingData } = require('./jira-sync');

      const enrichmentConfig = initialConfig.jiraEnrichment || {};
      const syncIntervalHours = enrichmentConfig.syncIntervalHours || 6;

      const enrichmentHandler = async function() {
        const config = loadConfig(storage);
        const jiraEnrichConfig = config.jiraEnrichment || {};
        if (!jiraEnrichConfig.enabled) {
          return { status: 'skipped', message: 'Jira enrichment disabled' };
        }

        const result = await syncAllFeatures(storage, jira.jiraRequest, jira.fetchAllJqlResults);

        // Feature discovery (Phase 4)
        if (jiraEnrichConfig.discoveryEnabled) {
          try {
            const discovery = await discoverFromJira(
              storage, jira.jiraRequest, jira.fetchAllJqlResults, jiraEnrichConfig
            );
            result.discovery = discovery;
          } catch (err) {
            console.warn('[execution] Feature discovery failed:', err.message);
          }
        }

        // Tracking data reconciliation
        try {
          const reconciliation = await reconcileTrackingData(storage);
          result.reconciliation = reconciliation;
        } catch (err) {
          console.warn('[execution] Tracking reconciliation failed:', err.message);
        }

        return result;
      };

      context.registerRefresh('jira-enrichment', {
        order: 75,
        cadence: syncIntervalHours + 'h',
        timeout: 120000,
        description: 'Enriches execution data with Jira issue details, status transitions, and tracking reconciliation.',
        handler: enrichmentHandler
      });
    }
  }
};
