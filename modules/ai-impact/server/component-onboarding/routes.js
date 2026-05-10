const express = require('express');
const { validateComponentOnboarding } = require('./validation');
const {
  readComponentOnboarding,
  writeComponentOnboardingAtomic,
  upsertComponent,
  getLatestProjection,
  countHistoryEntries
} = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '10mb' });
const BULK_CAP = 5000;

/**
 * Register component onboarding routes on the module router.
 * Static routes BEFORE parameterized routes.
 */
module.exports = function registerComponentOnboardingRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage } = storage;

  // ─── Static routes first ───

  router.get('/component-onboarding/status', requireAdmin, function(req, res) {
    const data = readComponentOnboarding(readFromStorage);
    res.json({
      fetchedAt: data.fetchedAt,
      totalComponents: data.totalComponents,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  router.post('/component-onboarding/bulk', requireAdmin, jsonLimit, function(req, res) {
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

    const data = readComponentOnboarding(readFromStorage);
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

    writeComponentOnboardingAtomic(data);

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });
  });

  router.delete('/component-onboarding', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Component onboarding ingest disabled in demo mode' });
    }
    writeComponentOnboardingAtomic({ fetchedAt: null, totalComponents: 0, components: {} });
    res.json({ status: 'cleared' });
  });

  router.get('/component-onboarding', function(req, res) {
    const data = readComponentOnboarding(readFromStorage);
    res.json(getLatestProjection(data));
  });

  // ─── Parameterized routes after ───

  router.get('/component-onboarding/:key', function(req, res) {
    const data = readComponentOnboarding(readFromStorage);
    const entry = data.components[req.params.key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ latest: entry.latest, history: entry.history });
  });
};
