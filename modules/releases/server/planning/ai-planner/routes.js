const express = require('express');
const { validateSnapshot } = require('./validation');
const { readAIPlanner, writeAIPlanner, projectSnapshot, emptySnapshot } = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '25mb' });

/**
 * Register AI Planner routes on the planning router.
 * Mirrors the epic-decomposer push/GET pattern.
 *
 * @param {import('express').Router} router
 * @param {object} context - { storage, requireAuth, requireAdmin, requireScope }
 */
module.exports = function registerAIPlannerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner/status:
   *   get:
   *     summary: AI Planner snapshot status
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Last sync time and feature count
   */
  router.get('/ai-planner/status', requireAuth, requireScope('releases:read'), async function(req, res) {
    const data = await readAIPlanner(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      featureCount: data.featureCount,
      dataDate: data.dataDate
    });
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner:
   *   post:
   *     summary: Push the AI Planner snapshot (CSV export)
   *     tags: [releases-planning]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               features:
   *                 type: array
   *               bugQueue:
   *                 type: array
   *     responses:
   *       200:
   *         description: Snapshot stored
   *       400:
   *         description: Invalid snapshot
   */
  router.post('/ai-planner', requireAdmin, requireScope('releases:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'AI Planner ingest disabled in demo mode' });
    }

    const result = validateSnapshot(req.body);
    if (!result.valid) {
      return res.status(400).json({ errors: result.errors });
    }

    const snapshot = projectSnapshot(result.data);
    await writeAIPlanner(writeToStorage, snapshot);

    res.json({
      status: 'stored',
      featureCount: snapshot.featureCount,
      lastSyncedAt: snapshot.lastSyncedAt
    });
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner:
   *   delete:
   *     summary: Clear the stored AI Planner snapshot
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Snapshot cleared
   */
  router.delete('/ai-planner', requireAdmin, requireScope('releases:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'AI Planner ingest disabled in demo mode' });
    }

    await writeAIPlanner(writeToStorage, { ...emptySnapshot(), lastSyncedAt: new Date().toISOString() });
    res.json({ status: 'cleared' });
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner:
   *   get:
   *     summary: AI Planner snapshot for the tab
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Features, bug queue, and metadata
   */
  router.get('/ai-planner', requireAuth, requireScope('releases:read'), async function(req, res) {
    const data = await readAIPlanner(readFromStorage);
    res.json(data);
  });
};
