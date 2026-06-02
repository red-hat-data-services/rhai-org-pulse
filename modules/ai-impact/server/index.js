module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  // Register module scopes
  context.registerScopes([
    { key: 'ai-impact:read', label: 'AI Impact (Read)', description: 'Read AI impact data', category: 'AI Impact' },
    { key: 'ai-impact:write', label: 'AI Impact (Write)', description: 'Push/clear AI impact data', category: 'AI Impact' }
  ]);

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // Jira helpers from shared package (no duplication)
  const { createJiraClient } = require('../../../shared/server/jira');
  const jira = createJiraClient({
    email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
    token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
    host: process.env.JIRA_HOST
  });
  const { jiraRequest, JIRA_HOST } = jira;

  const { fetchRFEData } = require('./jira/rfe-fetcher');
  const { resolveLinkedFeatures } = require('./jira/link-resolver');
  const { getConfig, saveConfig } = require('./config');
  const { computeAllMetrics } = require('./metrics');
  const { fetchAutofixData, computeAutofixMetrics, buildTrendData: buildAutofixTrend } = require('./jira/autofix-fetcher');
  const { fetchDocData, fetchDocActivityEvents, fetchDocCumulativeStats, fetchDocCompletedData, computeDocMetrics, buildDocTrendData, resolveMRLinksFromKpiData } = require('./jira/doc-fetcher');
  const mrStatus = require('./mr-status');
  const { enrichMRStatuses } = mrStatus;

  // Initialize sub-modules with secrets
  mrStatus.init(context.secrets);
  const { fetchMrKpiData } = require('./gitlab/mr-kpi-fetcher');

  // Assessment routes (Phase 1: Storage + Ingest API)
  const registerAssessmentRoutes = require('./assessments/routes');
  registerAssessmentRoutes(router, context);

  // Feature review routes
  const registerFeatureRoutes = require('./features/routes');
  registerFeatureRoutes(router, context);

  // Test plan quality routes
  const registerTestPlanRoutes = require('./test-plans/routes');
  registerTestPlanRoutes(router, context);

  // Component onboarding routes (Build & Release)
  const registerComponentOnboardingRoutes = require('./component-onboarding/routes');
  registerComponentOnboardingRoutes(router, context);

  // ─── Refresh state (in-memory) ───

  const refreshState = {
    running: false,
    startedAt: null,
    lastResult: null
  };

  // ─── Routes ───

  const VALID_TIME_WINDOWS = ['week', 'month', '3months'];

  router.get('/rfe-data', requireScope('ai-impact:read'), function(req, res) {
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

  router.get('/autofix-data', requireScope('ai-impact:read'), function(req, res) {
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

  // ─── Documentation data ───

  function shiftDocDates(data) {
    if (!data.fetchedAt) return data;
    const offset = Date.now() - new Date(data.fetchedAt).getTime();
    if (Math.abs(offset) < 60 * 60 * 1000) return data;

    function shift(iso) {
      if (!iso) return iso;
      return new Date(new Date(iso).getTime() + offset).toISOString();
    }

    return {
      ...data,
      fetchedAt: new Date().toISOString(),
      issues: data.issues.map(i => ({
        ...i,
        created: shift(i.created),
        updated: shift(i.updated),
        docContributedDate: shift(i.docContributedDate),
        docInvokedDate: shift(i.docInvokedDate)
      })),
      labelEvents: (data.labelEvents || []).map(e => ({
        ...e,
        date: shift(e.date)
      })),
      activityEvents: (data.activityEvents || []).map(e => ({
        ...e,
        date: shift(e.date)
      }))
    };
  }

  router.get('/doc-data', requireScope('ai-impact:read'), function(req, res) {
    const rawData = readFromStorage('ai-impact/doc-data.json');
    if (!rawData || !rawData.issues) {
      return res.json({
        fetchedAt: null,
        jiraHost: JIRA_HOST,
        metrics: { demandCount: 0, coverageCount: 0, coverageRate: 0, invokedCount: 0, totalLabelEvents: 0 },
        trendData: [],
        issues: []
      });
    }

    const data = DEMO_MODE ? shiftDocDates(rawData) : rawData;
    const activity = data.activityEvents || data.labelEvents || [];
    const metrics = computeDocMetrics(data.issues, activity);
    const trendData = buildDocTrendData(data.issues, activity);

    res.json({
      fetchedAt: data.fetchedAt,
      jiraHost: JIRA_HOST,
      metrics,
      trendData,
      issues: data.issues,
      completedIssues: data.completedIssues || [],
      cumulativeStats: data.cumulativeStats || null
    });
  });

  /**
   * @openapi
   * /modules/ai-impact/doc-mr-kpi-data:
   *   get:
   *     summary: MR KPI data fetched directly from GitLab
   *     tags: [ai-impact]
   *     responses:
   *       200:
   *         description: MR KPI data with merge request metrics
   */
  router.get('/doc-mr-kpi-data', requireScope('ai-impact:read'), function(req, res) {
    const data = readFromStorage('ai-impact/doc-mr-kpi-data.json');
    if (!data || !data.mergeRequests) {
      return res.json({ fetchedAt: null, mergeRequests: [] });
    }
    res.json(data);
  });

  router.get('/config', requireAdmin, requireScope('ai-impact:write'), function(req, res) {
    res.json(getConfig(readFromStorage));
  });

  router.post('/config', requireAdmin, requireScope('ai-impact:write'), function(req, res) {
    try {
      saveConfig(writeToStorage, req.body);
      res.json({ status: 'saved' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/cache', requireAdmin, requireScope('ai-impact:write'), function(req, res) {
    writeToStorage('ai-impact/rfe-data.json', null);
    writeToStorage('ai-impact/autofix-data.json', null);
    writeToStorage('ai-impact/doc-data.json', null);
    writeToStorage('ai-impact/doc-mr-kpi-data.json', null);
    res.json({ status: 'cleared' });
  });

  router.get('/refresh/status', requireScope('ai-impact:read'), function(req, res) {
    res.json(refreshState);
  });

  async function runAiImpactRefresh() {
    if (DEMO_MODE) return;

    const config = getConfig(readFromStorage);

    const issues = await fetchRFEData(jiraRequest, config);
    const withLinks = await resolveLinkedFeatures(jiraRequest, issues, config);
    writeToStorage('ai-impact/rfe-data.json', {
      fetchedAt: new Date().toISOString(),
      issues: withLinks
    });

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

    let mrKpiCount = 0;
    let mrKpiData = null;
    try {
      const mrKpiResult = await fetchMrKpiData();
      mrKpiData = {
        fetchedAt: new Date().toISOString(),
        mergeRequests: mrKpiResult.mergeRequests
      };
      writeToStorage('ai-impact/doc-mr-kpi-data.json', mrKpiData);
      mrKpiCount = mrKpiResult.mergeRequests.length;
    } catch (mrKpiErr) {
      console.error('[ai-impact] MR KPI data refresh failed:', mrKpiErr.message);
    }

    let docCount = 0;
    try {
      const docResult = await fetchDocData(jiraRequest, config);
      let completedIssues = [];
      try {
        completedIssues = await fetchDocCompletedData(jiraRequest, config, { mrKpiData });
      } catch (compErr) {
        console.error('[ai-impact] Documentation completed data fetch failed:', compErr.message);
      }
      let activityEvents = [];
      try {
        activityEvents = await fetchDocActivityEvents(jiraRequest, config);
      } catch (actErr) {
        console.error('[ai-impact] Documentation activity events fetch failed:', actErr.message);
      }
      let cumulativeStats = null;
      try {
        cumulativeStats = await fetchDocCumulativeStats(jiraRequest, config);
      } catch (statsErr) {
        console.error('[ai-impact] Documentation cumulative stats fetch failed:', statsErr.message);
      }
      if (mrKpiData) {
        resolveMRLinksFromKpiData(docResult.issues, mrKpiData);
      }
      try {
        await enrichMRStatuses(docResult.issues);
        await enrichMRStatuses(completedIssues);
      } catch (mrErr) {
        console.error('[ai-impact] MR status enrichment failed:', mrErr.message);
      }
      writeToStorage('ai-impact/doc-data.json', {
        fetchedAt: new Date().toISOString(),
        issues: docResult.issues,
        labelEvents: docResult.labelEvents,
        activityEvents,
        completedIssues,
        cumulativeStats
      });
      docCount = docResult.issues.length;
    } catch (docErr) {
      console.error('[ai-impact] Documentation data refresh failed:', docErr.message);
    }

    refreshState.lastResult = {
      status: 'success',
      message: `Fetched ${withLinks.length} RFEs, ${autofixCount} autofix issues, ${docCount} doc issues, ${mrKpiCount} MR KPIs`,
      completedAt: new Date().toISOString()
    };
  }

  router.post('/refresh', requireAdmin, requireScope('ai-impact:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
    }
    if (refreshState.running || context.isRefreshRunning()) {
      return res.json({ status: 'already_running' });
    }
    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();
    res.json({ status: 'started' });

    try {
      await runAiImpactRefresh();
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

  if (context.registerRefresh) {
    context.registerRefresh('refresh', {
      order: 50,
      timeout: 600000,
      handler: async function() {
        await runAiImpactRefresh();
      }
    });
  }

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const rfeData = readFromStorage('ai-impact/rfe-data.json');
      const autofixData = readFromStorage('ai-impact/autofix-data.json');
      const docData = readFromStorage('ai-impact/doc-data.json');
      const coData = readFromStorage('ai-impact/component-onboarding-data.json');
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
        },
        documentation: {
          dataExists: !!docData,
          issueCount: docData?.issues?.length || 0,
          fetchedAt: docData?.fetchedAt || null
        },
        componentOnboarding: {
          dataExists: !!coData,
          componentCount: coData?.totalComponents || 0,
          fetchedAt: coData?.fetchedAt || null
        }
      };
    });
  }
};
