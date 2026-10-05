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
 * @param {object} context - { storage, requireAuth, requireAdmin, requireScope, buildFeatureReadiness, listStorageFiles }
 */
module.exports = function registerAIPlannerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope, buildFeatureReadiness, listStorageFiles } = context;
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
   *     summary: AI Planner snapshot for the tab (live data from feature-readiness)
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Live features, bug queue, and metadata
   */
  router.get('/ai-planner', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      const readiness = await buildFeatureReadiness(readFromStorage, null, listStorageFiles);

      const allFeatures = (readiness.pendingReview || []).concat(readiness.ready || []);

      // Map to iframe expectations (index.html lines 2863-2869)
      const features = allFeatures.map(f => ({
        Key: f.key,
        Summary: f.title,
        Components: f.components || [],
        Team: f.team || '',
        Priority: f.priority || '',
        Outcome: f.bigRock || '',
        PlannedFor: (f.targetVersions && f.targetVersions[0]) || '',
        Score: f.riceScore || 0,
        // FPDoR is an object {passedCount, totalCount} - convert to string format
        FPDoR: f.fpdor ? (f.fpdor.passedCount + '/' + f.fpdor.totalCount) : '0/17',
        // The planner weights risk and confidence off the failed item names; without
        // them every feature scores as a clean pass (w:100, LOW risk, 95% confidence).
        'Failed FPDoR Items': ((f.fpdor && f.fpdor.items) || [])
          .filter(item => item.pass === false)
          .map(item => item.name)
          .join('; '),
        Confidence: f.confidence || 'not-ready',
        Labels: (f.labels || []).join(', '),
        'Fix Version': f.fixVersion || '',
        'Release Type': f.releaseType || '',
        Status: f.status || '',
        // pmOwner is a {displayName} object on the Jira path and a string elsewhere;
        // the planner contract is a string, so flatten before it leaves the API.
        PM: (f.pmOwner && typeof f.pmOwner === 'object' ? f.pmOwner.displayName : f.pmOwner) || '',
        DeliveryOwner: f.deliveryOwner || ''
      }));

      // bugQueue comes from CSV upload; for live-only mode, return empty
      // (buildFeatureReadiness doesn't include component bug data)
      const bugQueue = [];

      res.json({
        features: features,
        bugQueue: bugQueue,
        featureCount: features.length,
        lastSyncedAt: (readiness.meta && readiness.meta.lastSyncedAt) || new Date().toISOString(),
        metadata: {
          source: 'live',
          generatedAt: new Date().toISOString(),
          version: '1.0'
        }
      });
    } catch (err) {
      console.error('AI Planner GET error:', err);
      res.status(500).json({ error: err.message });
    }
  });
};
