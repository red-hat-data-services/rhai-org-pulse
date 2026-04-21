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
  const { fetchAutofixData, computeAutofixMetrics, buildTrendData: buildAutofixTrend } = require('./jira/autofix-fetcher');

  // Assessment routes (Phase 1: Storage + Ingest API)
  const registerAssessmentRoutes = require('./assessments/routes');
  registerAssessmentRoutes(router, context);

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

  // ─── Autofix data ───

  const VALID_AUTOFIX_TIME_WINDOWS = ['week', 'month', '3months'];

  router.get('/autofix-data', function(req, res) {
    const timeWindow = VALID_AUTOFIX_TIME_WINDOWS.includes(req.query.timeWindow)
      ? req.query.timeWindow
      : 'month';

    const data = readFromStorage('ai-impact/autofix-data.json');
    if (!data || !data.issues) {
      return res.json({
        fetchedAt: null,
        jiraHost: JIRA_HOST,
        metrics: { triageTotal: 0, triageVerdicts: {}, autofixStates: {}, autofixTotal: 0, successRate: 0, windowTotal: 0, totalIssues: 0 },
        trendData: [],
        issues: []
      });
    }

    const metrics = computeAutofixMetrics(data.issues, timeWindow);
    const trendData = buildAutofixTrend(data.issues, timeWindow);

    res.json({
      fetchedAt: data.fetchedAt,
      jiraHost: JIRA_HOST,
      metrics,
      trendData,
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
    writeToStorage('ai-impact/autofix-data.json', null);
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

      // Fetch RFE data
      const issues = await fetchRFEData(jiraRequest, config);
      const withLinks = await resolveLinkedFeatures(jiraRequest, issues, config);
      writeToStorage('ai-impact/rfe-data.json', {
        fetchedAt: new Date().toISOString(),
        issues: withLinks
      });

      // Fetch autofix data
      let autofixCount = 0;
      try {
        const autofixIssues = await fetchAutofixData(jiraRequest, config);
        writeToStorage('ai-impact/autofix-data.json', {
          fetchedAt: new Date().toISOString(),
          issues: autofixIssues
        });
        autofixCount = autofixIssues.length;
      } catch (autofixErr) {
        console.error('[ai-impact] Autofix data refresh failed:', autofixErr.message);
      }

      refreshState.lastResult = {
        status: 'success',
        message: `Fetched ${withLinks.length} RFEs, ${autofixCount} autofix issues`,
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
      const rfeData = readFromStorage('ai-impact/rfe-data.json');
      const autofixData = readFromStorage('ai-impact/autofix-data.json');
      return {
        refreshState,
        rfe: {
          dataExists: !!rfeData,
          issueCount: rfeData?.issues?.length || 0,
          fetchedAt: rfeData?.fetchedAt || null
        },
        autofix: {
          dataExists: !!autofixData,
          issueCount: autofixData?.issues?.length || 0,
          fetchedAt: autofixData?.fetchedAt || null
        }
      };
    });
  }
};
