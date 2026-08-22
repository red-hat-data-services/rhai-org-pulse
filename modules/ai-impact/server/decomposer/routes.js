const express = require('express');
const { validateSnapshot } = require('./validation');
const {
  readDecomposer,
  writeDecomposer,
  projectSnapshot,
  emptySnapshot
} = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
// data.json is a single document (~600KB); allow generous headroom.
const jsonLimit = express.json({ limit: '25mb' });

/**
 * Register epic-decomposer routes on the module router.
 * The epic-decomposer pipeline PUSHES its canonical data.json snapshot here
 * (mirrors the strat-creator → /features/bulk integration). Org Pulse stores
 * a projected subset and serves it to the Feature Decomposer tab.
 *
 * Static routes are registered BEFORE parameterized routes.
 *
 * @param {import('express').Router} router
 * @param {object} context - Module context with storage and auth middleware
 */
module.exports = function registerDecomposerRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  /**
   * @openapi
   * /api/modules/ai-impact/decomposer/status:
   *   get:
   *     summary: Epic-decomposer snapshot status
   *     tags: [AI Impact - Decomposer]
   *     responses:
   *       200:
   *         description: Last sync time and run/strategy counts
   */
  router.get('/decomposer/status', requireAdmin, requireScope('ai-impact:read'), async function(req, res) {
    const data = await readDecomposer(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      generatedAt: data.generatedAt,
      counts: data.counts
    });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/decomposer:
   *   post:
   *     summary: Push the canonical epic-decomposer data.json snapshot
   *     tags: [AI Impact - Decomposer]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Snapshot stored (projected subset)
   *       400:
   *         description: Invalid snapshot payload
   */
  router.post('/decomposer', requireAdmin, requireScope('ai-impact:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Decomposer ingest disabled in demo mode' });
    }

    const result = validateSnapshot(req.body);
    if (!result.valid) {
      return res.status(400).json({ errors: result.errors });
    }

    const snapshot = projectSnapshot(result.data);
    snapshot.lastSyncedAt = new Date().toISOString();
    await writeDecomposer(writeToStorage, snapshot);

    res.json({
      status: 'stored',
      runs: snapshot.runs.length,
      strategies: snapshot.strategies.length
    });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/decomposer:
   *   delete:
   *     summary: Clear the stored epic-decomposer snapshot
   *     tags: [AI Impact - Decomposer]
   *     responses:
   *       200:
   *         description: Snapshot cleared
   */
  router.delete('/decomposer', requireAdmin, requireScope('ai-impact:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Decomposer ingest disabled in demo mode' });
    }
    await writeDecomposer(writeToStorage, { ...emptySnapshot(), lastSyncedAt: new Date().toISOString() });
    res.json({ status: 'cleared' });
  });

  /**
   * @openapi
   * /api/modules/ai-impact/decomposer:
   *   get:
   *     summary: Epic-decomposer snapshot for the Feature Decomposer tab
   *     tags: [AI Impact - Decomposer]
   *     responses:
   *       200:
   *         description: Projected snapshot (aggregates, runs, slim strategies)
   */
  router.get('/decomposer', requireScope('ai-impact:read'), async function(req, res) {
    const data = await readDecomposer(readFromStorage);
    // JIRA_HOST is non-secret config (AGENTS.md #9 exempts it) — used to
    // build /browse links to strategies and epics in the UI.
    const jiraHost = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
    res.json({ ...data, jiraHost });
  });
};
