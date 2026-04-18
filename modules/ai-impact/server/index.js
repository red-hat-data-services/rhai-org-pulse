module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // Jira helpers from shared package (no duplication)
  const { JIRA_HOST, jiraRequest } = require('../../../shared/server/jira');

  const { fetchRFEData } = require('./jira/rfe-fetcher');
  const { resolveLinkedFeatures } = require('./jira/link-resolver');
  const { getConfig, saveConfig } = require('./config');
  const { computeAllMetrics } = require('./metrics');

  // ─── Refresh state (in-memory) ───

  const refreshState = {
    running: false,
    startedAt: null,
    lastResult: null
  };

  // ─── Routes ───

  const VALID_TIME_WINDOWS = ['week', 'month', '3months'];

  router.get('/rfe-data', function(req, res) {
    const timeWindow = VALID_TIME_WINDOWS.includes(req.query.timeWindow)
      ? req.query.timeWindow
      : 'month';

    const data = readFromStorage('ai-impact/rfe-data.json');
    if (!data || !data.issues) {
      return res.json({
        fetchedAt: null,
        jiraHost: JIRA_HOST,
        metrics: { createdPct: 0, createdChange: 0, trend: 'stable', revisedCount: 0, priorRevisedCount: 0, windowTotal: 0, totalRFEs: 0 },
        trendData: [],
        breakdown: [],
        issues: []
      });
    }

    // Compute metrics server-side from cached issues
    const config = getConfig(readFromStorage);
    const { metrics, trendData, breakdown } = computeAllMetrics(data.issues, timeWindow, config);

    res.json({
      fetchedAt: data.fetchedAt,
      jiraHost: JIRA_HOST,
      metrics,
      trendData,
      breakdown,
      issues: data.issues
    });
  });

  router.get('/config', requireAdmin, function(req, res) {
    res.json(getConfig(readFromStorage));
  });

  router.post('/config', requireAdmin, function(req, res) {
    try {
      saveConfig(writeToStorage, req.body);
      res.json({ status: 'saved' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/cache', requireAdmin, function(req, res) {
    writeToStorage('ai-impact/rfe-data.json', null);
    res.json({ status: 'cleared' });
  });

  router.get('/refresh/status', function(req, res) {
    res.json(refreshState);
  });

  router.post('/refresh', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
    }
    if (refreshState.running) {
      return res.json({ status: 'already_running' });
    }
    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();
    res.json({ status: 'started' });

    try {
      const config = getConfig(readFromStorage);
      const issues = await fetchRFEData(jiraRequest, config);
      const withLinks = await resolveLinkedFeatures(jiraRequest, issues, config);

      writeToStorage('ai-impact/rfe-data.json', {
        fetchedAt: new Date().toISOString(),
        issues: withLinks
      });

      refreshState.lastResult = {
        status: 'success',
        message: `Fetched ${withLinks.length} RFEs`,
        completedAt: new Date().toISOString()
      };
    } catch (err) {
      console.error('[ai-impact] Refresh failed:', err);
      refreshState.lastResult = {
        status: 'error',
        message: err.message,
        completedAt: new Date().toISOString()
      };
    } finally {
      refreshState.running = false;
    }
  });

  // ─── Diagnostics ───

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const data = readFromStorage('ai-impact/rfe-data.json');
      return {
        refreshState,
        dataExists: !!data,
        issueCount: data?.issues?.length || 0,
        fetchedAt: data?.fetchedAt || null
      };
    });
  }
};
