const express = require('express');
const { validateQualityReport } = require('./validation');
const {
  readReports,
  writeReportsAtomic,
  upsertReport,
  repoKeyFromSlug,
  getListProjection,
  countHistoryEntries,
  readHtmlReport,
  writeHtmlReport
} = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '50mb' });
const BULK_CAP = 5000;

/**
 * Register quality report routes on the module router.
 * Static routes registered BEFORE parameterized routes.
 *
 * @param {import('express').Router} router
 * @param {object} context
 */
module.exports = function registerQualityRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  // ─── Static routes FIRST ───

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/status:
   *   get:
   *     summary: Quality report data status for settings page
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Data freshness info
   */
  router.get('/reports/status', requireAdmin, requireScope('system-health:read'), async function(req, res) {
    const data = await readReports(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      totalReports: data.totalReports,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/bulk:
   *   post:
   *     summary: Bulk upsert quality reports from CI pipeline
   *     tags: [System Health - Quality Reports]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reports:
   *                 type: array
   *     responses:
   *       200:
   *         description: Upsert result with created/updated/unchanged counts
   */
  router.post('/reports/bulk', requireAdmin, requireScope('system-health:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Quality report ingest disabled in demo mode' });
    }

    const { reports } = req.body;
    if (!Array.isArray(reports)) {
      return res.status(400).json({ error: 'reports must be an array' });
    }
    if (reports.length > BULK_CAP) {
      return res.status(400).json({ error: 'Bulk payload exceeds maximum of ' + BULK_CAP + ' entries' });
    }

    const data = await readReports(readFromStorage);
    const counts = { created: 0, updated: 0, unchanged: 0 };
    const errors = [];

    for (const entry of reports) {
      if (!entry || typeof entry !== 'object') {
        errors.push({ id: 'unknown', error: 'Entry must be an object' });
        continue;
      }

      const result = validateQualityReport(entry);
      if (!result.valid) {
        errors.push({ id: entry.id || entry.repository || 'unknown', errors: result.errors });
        continue;
      }

      const repoKey = entry.id || repoKeyFromSlug(result.data.repository);
      const reportData = { ...result.data };

      if (entry.reportHtml && typeof entry.reportHtml === 'string') {
        try {
          await writeHtmlReport(writeToStorage, repoKey, entry.reportHtml);
          reportData.hasHtmlReport = true;
        } catch (err) {
          console.error('[system-health/quality] Failed to write HTML for %s: %s', repoKey, err.message);
        }
      }

      const status = upsertReport(data, repoKey, reportData);
      counts[status]++;
    }

    data.lastSyncedAt = new Date().toISOString();
    data.totalReports = Object.keys(data.reports).length;

    await writeReportsAtomic(writeToStorage, data);

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/reports:
   *   delete:
   *     summary: Clear all quality report data (admin only)
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Data cleared
   */
  router.delete('/reports', requireAdmin, requireScope('system-health:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Quality report ingest disabled in demo mode' });
    }

    await writeReportsAtomic(writeToStorage, { lastSyncedAt: null, totalReports: 0, reports: {} });
    res.json({ status: 'cleared' });
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/refresh:
   *   post:
   *     summary: Trigger manual quality report fetch from GitLab CI artifacts (admin only)
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Refresh result
   *       429:
   *         description: Cooldown active
   */
  if (context.scheduler) {
    router.post('/refresh', requireAdmin, requireScope('system-health:write'), async function(req, res) {
      if (DEMO_MODE) {
        return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
      }
      try {
        const result = await context.scheduler.manualRefresh(context.storage);
        if (result.httpStatus === 429) {
          return res.status(429).json({ status: result.status, retryAfter: result.retryAfter });
        }
        res.json(result);
      } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
      }
    });
  }

  /**
   * @openapi
   * /api/modules/system-health/quality/config:
   *   get:
   *     summary: Get quality report GitLab fetch configuration
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Current fetch configuration
   */
  router.get('/config', requireAdmin, requireScope('system-health:read'), async function(req, res) {
    const { getConfig } = require('./gitlab-fetch');
    res.json(await getConfig(readFromStorage));
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/config:
   *   post:
   *     summary: Update quality report GitLab fetch configuration
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Configuration saved
   */
  router.post('/config', requireAdmin, requireScope('system-health:write'), express.json(), async function(req, res) {
    const { saveConfig } = require('./gitlab-fetch');
    try {
      const saved = await saveConfig(writeToStorage, req.body);
      res.json({ status: 'saved', config: saved });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── List route (before parameterized) ───

  /**
   * @openapi
   * /api/modules/system-health/quality/reports:
   *   get:
   *     summary: List all latest quality reports (slim projection)
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Quality report list with scores and metadata
   */
  router.get('/reports', requireAuth, requireScope('system-health:read'), async function(req, res) {
    const data = await readReports(readFromStorage);
    res.json(getListProjection(data));
  });

  // ─── Parameterized routes AFTER ───

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/{key}/html:
   *   get:
   *     summary: Serve HTML quality report for a repository
   *     tags: [System Health - Quality Reports]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema: { type: string }
   *         description: Repo key in owner--repo format
   *     responses:
   *       200:
   *         description: HTML report
   *       404:
   *         description: Report not found
   */
  router.get('/reports/:key/html', requireAuth, requireScope('system-health:read'), async function(req, res) {
    const key = req.params.key;

    if (key.length > 200 || !/^[a-zA-Z0-9._-]+--[a-zA-Z0-9._-]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid repo key format. Expected owner--repo.' });
    }

    const html = await readHtmlReport(readFromStorage, key);
    if (!html) {
      return res.status(404).json({ error: 'HTML report not found for ' + key });
    }

    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:;");
    res.type('html').send(html);
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/{key}:
   *   get:
   *     summary: Full quality report with history for a single repository
   *     tags: [System Health - Quality Reports]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema: { type: string }
   *         description: Repo key in owner--repo format
   *     responses:
   *       200:
   *         description: Report with history
   *       404:
   *         description: Report not found
   */
  router.get('/reports/:key', requireAuth, requireScope('system-health:read'), async function(req, res) {
    const key = req.params.key;

    if (key.length > 200 || !/^[a-zA-Z0-9._-]+--[a-zA-Z0-9._-]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid repo key format. Expected owner--repo.' });
    }

    const data = await readReports(readFromStorage);
    const entry = data.reports[key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      latest: entry.latest,
      history: entry.history
    });
  });
};
