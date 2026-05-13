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
async function runSync(readFromStorage) {
  if (syncState.running) return;
  if (!acquireLock()) {
    console.warn('[ai-impact] Test plan sync skipped: write lock held');
    return;
  }

  syncState.running = true;
  syncState.startedAt = new Date().toISOString();

  try {
    const result = await syncTestPlansFromJira(readFromStorage);
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
  const { storage, requireAdmin } = context;
  const { readFromStorage } = storage;

  // ─── 1. Static routes FIRST ───

  router.get('/test-plans/status', requireAdmin, function(req, res) {
    const data = readTestPlans(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      lastJiraSyncAt: data.lastJiraSyncAt || null,
      totalTestPlans: data.totalTestPlans,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  // GET /test-plans/sync/status — sync state for polling
  router.get('/test-plans/sync/status', function(req, res) {
    res.json(syncState);
  });

  // POST /test-plans/sync (Admin) — trigger Jira label sync
  router.post('/test-plans/sync', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Sync disabled in demo mode' });
    }
    if (syncState.running) {
      return res.json({ status: 'already_running' });
    }

    res.json({ status: 'started' });
    runSync(readFromStorage);
  });

  router.post('/test-plans/bulk', requireAdmin, jsonLimit, function(req, res) {
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

    data.lastSyncedAt = new Date().toISOString();
    data.totalTestPlans = Object.keys(data.testPlans).length;

    writeTestPlansAtomic(data);

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
        runSync(readFromStorage);
      }, 10000);
    }
  });

  router.delete('/test-plans', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Test plan ingest disabled in demo mode' });
    }

    writeTestPlansAtomic({ lastSyncedAt: null, totalTestPlans: 0, testPlans: {} });
    res.json({ status: 'cleared' });
  });

  router.get('/test-plans', function(req, res) {
    const data = readTestPlans(readFromStorage);
    res.json(getLatestProjection(data));
  });

  // ─── 2. Parameterized routes AFTER ───

  router.get('/test-plans/:key', function(req, res) {
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

  router.put('/test-plans/:key', requireAdmin, jsonLimit, function(req, res) {
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

    writeTestPlansAtomic(data);
    res.json({ status });
  });
};
