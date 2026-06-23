const {
  readReports,
  writeReportsAtomic,
  getSummaryProjection
} = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * @openapi
 * /api/modules/system-health/disconnected/summary:
 *   get:
 *     summary: Aggregated readiness summary for dashboard
 *     tags: [System Health - Disconnected Readiness]
 *     parameters:
 *       - in: query
 *         name: score
 *         schema: { type: string, enum: [READY, NOT READY] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string }
 *       - in: query
 *         name: sortDir
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Readiness summary
 */

/**
 * @openapi
 * /api/modules/system-health/disconnected/repos/{repoKey}:
 *   get:
 *     summary: Full report with history for a single repo
 *     tags: [System Health - Disconnected Readiness]
 *     parameters:
 *       - in: path
 *         name: repoKey
 *         required: true
 *         schema: { type: string }
 *         description: Repo key in owner--repo format
 *     responses:
 *       200:
 *         description: Repo report with history
 *       400:
 *         description: Invalid repo key format
 *       404:
 *         description: Repo not found
 */

/**
 * @openapi
 * /api/modules/system-health/disconnected/status:
 *   get:
 *     summary: Data freshness info
 *     tags: [System Health - Disconnected Readiness]
 *     responses:
 *       200:
 *         description: Status info
 */

/**
 * @openapi
 * /api/modules/system-health/disconnected:
 *   delete:
 *     summary: Clear all disconnected readiness data (admin only)
 *     tags: [System Health - Disconnected Readiness]
 *     responses:
 *       200:
 *         description: Data cleared
 */

/**
 * @openapi
 * /api/modules/system-health/disconnected/refresh:
 *   post:
 *     summary: Trigger manual artifact fetch (admin only)
 *     tags: [System Health - Disconnected Readiness]
 *     responses:
 *       200:
 *         description: Refresh result
 *       429:
 *         description: Cooldown active
 */

module.exports = function registerDisconnectedRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorageAtomic } = storage;

  router.get('/summary', requireAuth, requireScope('system-health:read'), function(req, res) {
    const data = readReports(readFromStorage);
    const summary = getSummaryProjection(data);

    let repos = summary.repos;

    const scoreFilter = req.query.score;
    if (scoreFilter) {
      repos = repos.filter(r => r.score === scoreFilter);
    }

    const SORTABLE_FIELDS = ['repo', 'score', 'blockerCount', 'infoCount', 'rulesPassedCount', 'lastScanDate'];
    const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'repo';
    const sortDir = req.query.sortDir === 'desc' ? -1 : 1;
    repos.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * sortDir;
      return String(aVal).localeCompare(String(bVal)) * sortDir;
    });

    res.json({ ...summary, repos });
  });

  router.get('/repos/:repoKey', requireAuth, requireScope('system-health:read'), function(req, res) {
    const repoKey = req.params.repoKey;

    if (!/^[a-zA-Z0-9._-]+--[a-zA-Z0-9._-]+$/.test(repoKey)) {
      return res.status(400).json({ error: 'Invalid repo key format. Expected owner--repo.' });
    }

    const sepIdx = repoKey.indexOf('--');
    const repoSlug = repoKey.slice(0, sepIdx) + '/' + repoKey.slice(sepIdx + 2);
    const data = readReports(readFromStorage);
    const entry = data.repos[repoSlug];

    if (!entry) {
      return res.status(404).json({ error: `Report not found for ${repoSlug}` });
    }

    res.json({
      latest: entry.latest,
      history: entry.history
    });
  });

  router.get('/status', requireAuth, requireScope('system-health:read'), function(req, res) {
    const data = readReports(readFromStorage);
    res.json({
      dataAvailable: Object.keys(data.repos).length > 0,
      lastSyncedAt: data.lastSyncedAt,
      repoCount: data.repoCount || Object.keys(data.repos).length
    });
  });

  router.delete('/', requireAdmin, requireScope('system-health:write'), function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Disabled in demo mode' });
    }
    writeReportsAtomic(writeToStorageAtomic, { lastSyncedAt: null, repoCount: 0, repos: {} });
    res.json({ status: 'cleared' });
  });

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
};
