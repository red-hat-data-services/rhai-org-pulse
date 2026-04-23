const express = require('express');
const { validateAssessment } = require('./validation');
const {
  readAssessments,
  writeAssessmentsAtomic,
  upsertAssessment,
  getLatestProjection,
  countHistoryEntries
} = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '10mb' });

// Max entries in a single bulk request
const BULK_CAP = 5000;

/**
 * Register assessment routes on the module router.
 * CRITICAL: Static routes are registered BEFORE parameterized routes
 * to prevent /assessments/:key from swallowing /assessments/status and /assessments/bulk.
 *
 * Pagination note: GET /assessments returns all assessments in a single response.
 * At ~1,630 entries with slim projections (~100 bytes each), this is ~160KB.
 * If assessment count grows past ~10,000, add cursor-based pagination with ?limit=&after= parameters.
 *
 * @param {import('express').Router} router
 * @param {object} context - Module context with storage and auth middleware
 */
module.exports = function registerAssessmentRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage } = storage;

  // ─── 1. Static routes FIRST ───

  // GET /assessments/status (Admin) — assessment data status for settings page
  router.get('/assessments/status', requireAdmin, function(req, res) {
    const data = readAssessments(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      totalAssessed: data.totalAssessed,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  // POST /assessments/bulk (Admin) — bulk upsert assessments
  router.post('/assessments/bulk', requireAdmin, jsonLimit, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Assessment ingest disabled in demo mode' });
    }

    const { assessments } = req.body;
    if (!Array.isArray(assessments)) {
      return res.status(400).json({ error: 'assessments must be an array' });
    }
    if (assessments.length > BULK_CAP) {
      return res.status(400).json({ error: `Bulk payload exceeds maximum of ${BULK_CAP} entries` });
    }

    const data = readAssessments(readFromStorage);
    const counts = { created: 0, updated: 0, unchanged: 0 };
    const errors = [];

    for (const entry of assessments) {
      if (!entry || typeof entry !== 'object' || !entry.id) {
        errors.push({ id: entry?.id || 'unknown', error: 'Missing id field' });
        continue;
      }

      const result = validateAssessment(entry);
      if (!result.valid) {
        errors.push({ id: entry.id, errors: result.errors });
        continue;
      }

      const status = upsertAssessment(data, entry.id, result.data);
      counts[status]++;
    }

    data.lastSyncedAt = new Date().toISOString();
    data.totalAssessed = Object.keys(data.assessments).length;

    writeAssessmentsAtomic(data);

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });
  });

  // DELETE /assessments (Admin) — clear all assessment data
  router.delete('/assessments', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Assessment ingest disabled in demo mode' });
    }

    writeAssessmentsAtomic({ lastSyncedAt: null, totalAssessed: 0, assessments: {} });
    res.json({ status: 'cleared' });
  });

  // GET /assessments — list all latest assessments (slim projection)
  router.get('/assessments', function(req, res) {
    const data = readAssessments(readFromStorage);
    res.json(getLatestProjection(data));
  });

  // ─── 2. Parameterized routes AFTER ───

  // GET /assessments/:key — single RFE assessment + history
  router.get('/assessments/:key', function(req, res) {
    const data = readAssessments(readFromStorage);
    const entry = data.assessments[req.params.key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      latest: entry.latest,
      history: entry.history
    });
  });

  // PUT /assessments/:key (Admin) — upsert single assessment
  router.put('/assessments/:key', requireAdmin, jsonLimit, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Assessment ingest disabled in demo mode' });
    }

    const result = validateAssessment(req.body);
    if (!result.valid) {
      return res.status(400).json({ errors: result.errors });
    }

    const data = readAssessments(readFromStorage);
    const status = upsertAssessment(data, req.params.key, result.data);

    data.lastSyncedAt = new Date().toISOString();
    data.totalAssessed = Object.keys(data.assessments).length;

    writeAssessmentsAtomic(data);
    res.json({ status });
  });
};
