const express = require('express');
const { validateTestPlan } = require('./validation');
const {
  readTestPlans,
  writeTestPlansAtomic,
  upsertTestPlan,
  getLatestProjection,
  countHistoryEntries
} = require('./storage');
const { syncTestPlansFromJira, acquireLock, releaseLock } = require('./jira-sync');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '10mb' });

const BULK_CAP = 5000;

// ─── Sync state (in-memory) ───

const syncState = {
  running: false,
  startedAt: null,
  lastResult: null
};

/**
 * Run the Jira sync in the background. Updates syncState.
 * @param {Function} readFromStorage
 */
async function runSync(readFromStorage, writeToStorageAtomic) {
  if (syncState.running) return;
  if (!acquireLock()) {
    console.warn('[ai-impact] Test plan sync skipped: write lock held');
    return;
  }

  syncState.running = true;
  syncState.startedAt = new Date().toISOString();

  try {
    const result = await syncTestPlansFromJira(readFromStorage, writeToStorageAtomic);
    syncState.lastResult = {
      status: result.errors.length > 0 ? 'partial' : 'success',
      message: `Synced ${result.synced} test plans: ${result.updated} updated (${result.statusChanged} review status changes), ${result.notFound} not found in Jira`,
      errors: result.errors.length > 0 ? result.errors : undefined,
      completedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('[ai-impact] Test plan Jira sync failed:', err);
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

module.exports = function registerTestPlanRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorageAtomic } = storage;

  // ─── 1. Static routes FIRST ───

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans/status:
   *   get:
   *     summary: Get test plan data status
   *     tags: [AI Impact - Test Plans]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Test plan data status
   */
  router.get('/test-plans/status', requireAdmin, requireScope('ai-impact:read'), function(req, res) {
    const data = readTestPlans(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      lastJiraSyncAt: data.lastJiraSyncAt || null,
      totalTestPlans: data.totalTestPlans,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans/sync/status:
   *   get:
   *     summary: Get test plan Jira sync status
   *     tags: [AI Impact - Test Plans]
   *     responses:
   *       200:
   *         description: Sync state for polling
   */
  router.get('/test-plans/sync/status', requireScope('ai-impact:read'), function(req, res) {
    res.json(syncState);
  });

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans/sync:
   *   post:
   *     summary: Trigger test plan Jira label sync
   *     tags: [AI Impact - Test Plans]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Sync started or skipped
   */
  router.post('/test-plans/sync', requireAdmin, requireScope('ai-impact:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Sync disabled in demo mode' });
    }
    if (syncState.running || context.isRefreshRunning()) {
      return res.json({ status: 'already_running' });
    }

    res.json({ status: 'started' });
    runSync(readFromStorage, writeToStorageAtomic);
  });

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans/bulk:
   *   post:
   *     summary: Bulk upsert test plans
   *     tags: [AI Impact - Test Plans]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               testPlans:
   *                 type: array
   *     responses:
   *       200:
   *         description: Bulk upsert results
   */
  router.post('/test-plans/bulk', requireAdmin, requireScope('ai-impact:write'), jsonLimit, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Test plan ingest disabled in demo mode' });
    }

    const { testPlans } = req.body;
    if (!Array.isArray(testPlans)) {
      return res.status(400).json({ error: 'testPlans must be an array' });
    }
    if (testPlans.length > BULK_CAP) {
      return res.status(400).json({ error: `Bulk payload exceeds maximum of ${BULK_CAP} entries` });
    }

    const data = readTestPlans(readFromStorage);
    const counts = { created: 0, updated: 0, unchanged: 0 };
    const errors = [];

    for (const entry of testPlans) {
      const entryKey = entry?.key || entry?.source_key;
      if (!entry || typeof entry !== 'object' || !entryKey) {
        errors.push({ id: entryKey || 'unknown', error: 'Missing key field' });
        continue;
      }

      const result = validateTestPlan(entry);
      if (!result.valid) {
        errors.push({ id: entryKey, errors: result.errors });
        continue;
      }

      const status = upsertTestPlan(data, entryKey, result.data);
      counts[status]++;
    }

    if (counts.created > 0 || counts.updated > 0) {
      data.lastSyncedAt = new Date().toISOString();
      data.totalTestPlans = Object.keys(data.testPlans).length;
      writeTestPlansAtomic(writeToStorageAtomic, data);
    }

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });

    // Fire-and-forget: sync labels from Jira after bulk ingest.
    // Delay to allow remaining batches from the same pipeline push to complete.
    if (counts.created > 0 || counts.updated > 0) {
      setTimeout(() => {
        console.log('[ai-impact] Triggering post-ingest test plan Jira sync');
        runSync(readFromStorage, writeToStorageAtomic);
      }, 10000);
    }
  });

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans:
   *   delete:
   *     summary: Clear all test plan data
   *     tags: [AI Impact - Test Plans]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Test plan data cleared
   */
  router.delete('/test-plans', requireAdmin, requireScope('ai-impact:write'), function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Test plan ingest disabled in demo mode' });
    }

    writeTestPlansAtomic(writeToStorageAtomic, { lastSyncedAt: null, totalTestPlans: 0, testPlans: {} });
    res.json({ status: 'cleared' });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans:
   *   get:
   *     summary: List all test plans (slim projection)
   *     tags: [AI Impact - Test Plans]
   *     responses:
   *       200:
   *         description: All test plans with latest scores
   */
  router.get('/test-plans', requireScope('ai-impact:read'), function(req, res) {
    const data = readTestPlans(readFromStorage);
    res.json(getLatestProjection(data));
  });

  // ─── 2. Parameterized routes AFTER ───

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans/{key}:
   *   get:
   *     summary: Get single test plan with history
   *     tags: [AI Impact - Test Plans]
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Test plan detail with history
   *       404:
   *         description: Not found
   */
  router.get('/test-plans/:key', requireScope('ai-impact:read'), function(req, res) {
    const data = readTestPlans(readFromStorage);
    const entry = data.testPlans[req.params.key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      latest: entry.latest,
      history: entry.history
    });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/test-plans/{key}:
   *   put:
   *     summary: Upsert single test plan
   *     tags: [AI Impact - Test Plans]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Upsert result
   *       400:
   *         description: Validation errors
   */
  router.put('/test-plans/:key', requireAdmin, requireScope('ai-impact:write'), jsonLimit, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Test plan ingest disabled in demo mode' });
    }

    const result = validateTestPlan(req.body);
    if (!result.valid) {
      return res.status(400).json({ errors: result.errors });
    }

    const data = readTestPlans(readFromStorage);
    const status = upsertTestPlan(data, req.params.key, result.data);

    data.lastSyncedAt = new Date().toISOString();
    data.totalTestPlans = Object.keys(data.testPlans).length;

    writeTestPlansAtomic(writeToStorageAtomic, data);
    res.json({ status });
  });

  if (context.registerRefresh) {
    context.registerRefresh('test-plan-sync', {
      order: 60,
      timeout: 600000,
      handler: async function() {
        if (DEMO_MODE) return;
        await runSync(readFromStorage, writeToStorageAtomic);
      }
    });
  }
};
