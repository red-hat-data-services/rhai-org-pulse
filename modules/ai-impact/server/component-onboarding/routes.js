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
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  // ─── Static routes first ───

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

    await writeComponentOnboardingAtomic(writeToStorage, data);

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });
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
   *     responses:
   *       200:
   *         description: All component onboarding data with latest projections
   */
  router.get('/component-onboarding', requireScope('ai-impact:read'), async function(req, res) {
    const data = await readComponentOnboarding(readFromStorage);
    res.json(getLatestProjection(data));
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
    res.json({ latest: entry.latest, history: entry.history });
  });
};
