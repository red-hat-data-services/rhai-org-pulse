const express = require('express');
const { validateFeature } = require('./validation');
const {
  readFeatures,
  writeFeaturesAtomic,
  upsertFeature,
  getLatestProjection,
  countHistoryEntries
} = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '10mb' });

// Max entries in a single bulk request
const BULK_CAP = 5000;

/**
 * Register feature routes on the module router.
 * Static routes are registered BEFORE parameterized routes.
 *
 * @param {import('express').Router} router
 * @param {object} context - Module context with storage and auth middleware
 */
module.exports = function registerFeatureRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage } = storage;

  // ─── 1. Static routes FIRST ───

  // GET /features/status (Admin) — feature data status for settings page
  router.get('/features/status', requireAdmin, function(req, res) {
    const data = readFeatures(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      totalFeatures: data.totalFeatures,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  // POST /features/bulk (Admin) — bulk upsert features
  router.post('/features/bulk', requireAdmin, jsonLimit, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Feature ingest disabled in demo mode' });
    }

    const { features } = req.body;
    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'features must be an array' });
    }
    if (features.length > BULK_CAP) {
      return res.status(400).json({ error: `Bulk payload exceeds maximum of ${BULK_CAP} entries` });
    }

    const data = readFeatures(readFromStorage);
    const counts = { created: 0, updated: 0, unchanged: 0 };
    const errors = [];

    for (const entry of features) {
      if (!entry || typeof entry !== 'object' || (!entry.key && !entry.strat_id)) {
        errors.push({ key: entry?.key || entry?.strat_id || 'unknown', error: 'Missing key field' });
        continue;
      }

      const result = validateFeature(entry);
      if (!result.valid) {
        errors.push({ key: entry.key || entry.strat_id || 'unknown', errors: result.errors });
        continue;
      }

      const status = upsertFeature(data, result.data.key, result.data);
      counts[status]++;
    }

    data.lastSyncedAt = new Date().toISOString();
    data.totalFeatures = Object.keys(data.features).length;

    writeFeaturesAtomic(data);

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });
  });

  // DELETE /features (Admin) — clear all feature data
  router.delete('/features', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Feature ingest disabled in demo mode' });
    }

    writeFeaturesAtomic({ lastSyncedAt: null, totalFeatures: 0, features: {} });
    res.json({ status: 'cleared' });
  });

  // GET /features — list all features (slim projection)
  router.get('/features', function(req, res) {
    const data = readFeatures(readFromStorage);
    res.json(getLatestProjection(data));
  });

  // ─── 2. Parameterized routes AFTER ───

  // GET /features/:key — single feature + history
  router.get('/features/:key', function(req, res) {
    const data = readFeatures(readFromStorage);
    const entry = data.features[req.params.key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      latest: entry.latest,
      history: entry.history
    });
  });

  // PUT /features/:key (Admin) — upsert single feature
  router.put('/features/:key', requireAdmin, jsonLimit, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Feature ingest disabled in demo mode' });
    }

    const result = validateFeature(req.body);
    if (!result.valid) {
      return res.status(400).json({ errors: result.errors });
    }

    const data = readFeatures(readFromStorage);
    const status = upsertFeature(data, req.params.key, result.data);

    data.lastSyncedAt = new Date().toISOString();
    data.totalFeatures = Object.keys(data.features).length;

    writeFeaturesAtomic(data);
    res.json({ status });
  });
};
