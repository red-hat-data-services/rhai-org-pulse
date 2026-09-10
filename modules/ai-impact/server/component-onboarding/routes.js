const express = require('express');
const { validateComponentOnboarding } = require('./validation');
const {
  readComponentOnboarding,
  writeComponentOnboardingAtomic,
  upsertComponent,
  getLatestProjection,
  projectComponent,
  countHistoryEntries
} = require('./storage');
const { syncComponentOnboardingFromJira, enrichTargetVersionsFromJira, acquireLock, releaseLock } = require('./jira-sync');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '10mb' });
const BULK_CAP = 5000;

const syncState = {
  running: false,
  startedAt: null,
  lastResult: null
};

/**
 * Run Jira target-version enrichment in the background.
 */
async function runSync(readFromStorage, writeToStorage, jiraRequest) {
  if (syncState.running) return;
  if (!jiraRequest) {
    console.warn('[ai-impact] Component onboarding Jira sync skipped: no Jira client');
    return;
  }
  if (!acquireLock()) {
    console.warn('[ai-impact] Component onboarding Jira sync skipped: write lock held');
    return;
  }

  syncState.running = true;
  syncState.startedAt = new Date().toISOString();

  try {
    const result = await syncComponentOnboardingFromJira(readFromStorage, writeToStorage, jiraRequest);
    syncState.lastResult = {
      status: result.errors.length > 0 ? 'partial' : 'success',
      message: `Enriched ${result.updated} of ${result.synced} components from Jira Target Version`,
      errors: result.errors.length > 0 ? result.errors : undefined,
      completedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('[ai-impact] Component onboarding Jira sync failed:', err);
    syncState.lastResult = {
      status: 'error',
      message: err.message,
      completedAt: new Date().toISOString()
    };
  } finally {
    syncState.running = false;
    releaseLock();
  }
}

/**
 * Register component onboarding routes on the module router.
 * Static routes BEFORE parameterized routes.
 */
module.exports = function registerComponentOnboardingRoutes(router, context) {
  const { storage, requireAdmin, requireScope, jiraRequest } = context;
  const { readFromStorage, writeToStorage } = storage;

  // ─── Static routes first ───

  /**
   * @openapi
   * /api/modules/ai-impact/component-onboarding/sync/status:
   *   get:
   *     summary: Get component onboarding Jira target-version sync status
   *     tags: [AI Impact - Component Onboarding]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Sync status
   */
  router.get('/component-onboarding/sync/status', requireScope('ai-impact:read'), function(req, res) {
    res.json(syncState);
  });

  /**
   * @openapi
   * /api/modules/ai-impact/component-onboarding/sync:
   *   post:
   *     summary: Enrich component onboarding target versions from Jira
   *     tags: [AI Impact - Component Onboarding]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Sync started or skipped
   */
  router.post('/component-onboarding/sync', requireAdmin, requireScope('ai-impact:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Component onboarding sync disabled in demo mode' });
    }
    if (syncState.running || context.isRefreshRunning()) {
      return res.json({ status: 'already_running' });
    }
    res.json({ status: 'started' });
    runSync(readFromStorage, writeToStorage, jiraRequest);
  });

  /**
   * @openapi
   * /api/modules/ai-impact/component-onboarding/status:
   *   get:
   *     summary: Get component onboarding data status
   *     tags: [AI Impact - Component Onboarding]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Component onboarding data status
   */
  router.get('/component-onboarding/status', requireAdmin, requireScope('ai-impact:read'), async function(req, res) {
    const data = await readComponentOnboarding(readFromStorage);
    res.json({
      fetchedAt: data.fetchedAt,
      totalComponents: data.totalComponents,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/component-onboarding/bulk:
   *   post:
   *     summary: Bulk upsert component onboarding data
   *     tags: [AI Impact - Component Onboarding]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Bulk upsert result
   */
  router.post('/component-onboarding/bulk', requireAdmin, requireScope('ai-impact:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Component onboarding ingest disabled in demo mode' });
    }

    const { components } = req.body;
    if (!Array.isArray(components)) {
      return res.status(400).json({ error: 'components must be an array' });
    }
    if (components.length > BULK_CAP) {
      return res.status(400).json({ error: `Bulk payload exceeds maximum of ${BULK_CAP} entries` });
    }

    const data = await readComponentOnboarding(readFromStorage);
    const counts = { created: 0, updated: 0, unchanged: 0 };
    const errors = [];

    for (const entry of components) {
      if (!entry || typeof entry !== 'object' || !entry.key) {
        errors.push({ key: entry?.key || 'unknown', error: 'Missing key field' });
        continue;
      }

      const result = validateComponentOnboarding(entry);
      if (!result.valid) {
        errors.push({ key: entry.key, errors: result.errors });
        continue;
      }

      const status = upsertComponent(data, result.data.key, result.data);
      counts[status]++;
    }

    data.fetchedAt = new Date().toISOString();
    data.totalComponents = Object.keys(data.components).length;

    if (jiraRequest && (counts.created > 0 || counts.updated > 0)) {
      try {
        await enrichTargetVersionsFromJira(data, jiraRequest);
      } catch (err) {
        console.error('[ai-impact] Inline component onboarding target version enrichment failed:', err.message);
      }
    }

    await writeComponentOnboardingAtomic(writeToStorage, data);

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });

    if (counts.created > 0 || counts.updated > 0) {
      setTimeout(() => {
        console.log('[ai-impact] Triggering post-ingest component onboarding Jira sync');
        runSync(readFromStorage, writeToStorage, jiraRequest);
      }, 10000);
    }
  });

  /**
   * @openapi
   * /api/modules/ai-impact/component-onboarding:
   *   delete:
   *     summary: Clear all component onboarding data
   *     tags: [AI Impact - Component Onboarding]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Data cleared
   */
  router.delete('/component-onboarding', requireAdmin, requireScope('ai-impact:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Component onboarding ingest disabled in demo mode' });
    }
    await writeComponentOnboardingAtomic(writeToStorage, { fetchedAt: null, totalComponents: 0, components: {} });
    res.json({ status: 'cleared' });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/component-onboarding:
   *   get:
   *     summary: Get all component onboarding data
   *     tags: [AI Impact - Component Onboarding]
   *     parameters:
   *       - in: query
   *         name: version
   *         required: false
   *         schema:
   *           type: string
   *         description: Filter results by targetVersion (exact match).
   *     responses:
   *       200:
   *         description: All component onboarding data with latest projections
   */
  router.get('/component-onboarding', requireScope('ai-impact:read'), async function(req, res) {
    const data = await readComponentOnboarding(readFromStorage);
    const version = typeof req.query.version === 'string' && req.query.version.trim()
      ? req.query.version.trim()
      : null;
    res.json(getLatestProjection(data, version ? { version } : undefined));
  });

  // ─── Parameterized routes after ───

  /**
   * @openapi
   * /api/modules/ai-impact/component-onboarding/{key}:
   *   get:
   *     summary: Get single component onboarding detail
   *     tags: [AI Impact - Component Onboarding]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Component latest data and history
   *       404:
   *         description: Component not found
   */
  router.get('/component-onboarding/:key', requireScope('ai-impact:read'), async function(req, res) {
    const data = await readComponentOnboarding(readFromStorage);
    const entry = data.components[req.params.key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      latest: projectComponent(entry),
      history: entry.history
    });
  });

  if (context.registerRefresh) {
    context.registerRefresh('component-onboarding-sync', {
      order: 65,
      timeout: 600000,
      description: 'Enriches component onboarding target versions from Jira customfield_10855.',
      handler: async function() {
        if (DEMO_MODE) return;
        await runSync(readFromStorage, writeToStorage, jiraRequest);
      }
    });
  }
};
