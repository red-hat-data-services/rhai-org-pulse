const express = require('express');
const registerDisconnectedRoutes = require('./disconnected/routes');
const disconnectedScheduler = require('./disconnected/scheduler');
const registerQualityRoutes = require('./quality/routes');
const qualityScheduler = require('./quality/scheduler');
const aicpE2ERoutes = require('./odh-e2e-health/routes');
const aicpE2EScheduler = require('./odh-e2e-health/scheduler');
const blockerJiras = require('./odh-e2e-health/blocker-jiras');

module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context;

  disconnectedScheduler.init(context.secrets);
  qualityScheduler.init(context.secrets);

  context.registerScopes([
    { key: 'system-health:read', label: 'System Health (Read)', description: 'Read system health data', category: 'System Health' },
    { key: 'system-health:write', label: 'System Health (Write)', description: 'Push system health data', category: 'System Health' }
  ]);

  const disconnectedRouter = express.Router();
  registerDisconnectedRoutes(disconnectedRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope,
    scheduler: disconnectedScheduler
  });
  router.use('/disconnected', disconnectedRouter);

  const qualityRouter = express.Router();
  registerQualityRoutes(qualityRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope,
    scheduler: qualityScheduler
  });
  router.use('/quality', qualityRouter);

  const aicpE2ERouter = express.Router();
  aicpE2ERoutes(aicpE2ERouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope
  });
  router.use('/odh-e2e-health', aicpE2ERouter);

  if (context.registerRefresh) {
    context.registerRefresh('disconnected-readiness', {
      order: 80,
      timeout: 600000,
      cadence: '1h',
      description: 'Fetches disconnected readiness reports from GitHub Actions artifacts.',
      handler: async function () {
        return disconnectedScheduler.runFetch(storage);
      }
    });

    context.registerRefresh('quality-reports', {
      order: 85,
      timeout: 600000,
      cadence: '24h',
      description: 'Fetches quality analysis reports from GitLab CI pipeline artifacts.',
      handler: async function () {
        return qualityScheduler.runFetch(storage);
      }
    });

    context.registerRefresh('odh-e2e-health', {
      order: 90,
      timeout: 300000, // 5 minutes
      cadence: '1h', // Check every hour for new data
      description: 'Fetches opendatahub-operator E2E test health data from OpenShift Prow CI.',
      handler: async function () {
        return aicpE2EScheduler.refreshE2EHealthData({
          logger: console,
          config: context.secrets,
          storage: storage
        });
      }
    });

    context.registerRefresh('odh-e2e-blocker-jiras', {
      order: 91,
      timeout: 120000, // 2 minutes
      cadence: '1h',
      description: 'Fetches auto-filed opendatahub-operator E2E blocker JIRAs from Jira.',
      handler: async function () {
        return blockerJiras.refreshBlockerJiras({
          logger: console,
          config: context.secrets,
          storage: storage
        });
      }
    });

  }

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function () {
      const disconnectedData = await storage.readFromStorage('system-health/disconnected/reports.json');
      const disconnectedLastFetch = await storage.readFromStorage('system-health/disconnected/last-fetch.json');
      const qualityData = await storage.readFromStorage('system-health/quality/reports.json');
      const qualityLastFetch = await storage.readFromStorage('system-health/quality/last-fetch.json');
      const odhE2EData = await storage.readFromStorage('system-health/odh-e2e-health.json');
      const blockerJiraData = await storage.readFromStorage('system-health/odh-e2e-blocker-jiras.json');

      return {
        disconnected: {
          dataAvailable: !!(disconnectedData && disconnectedData.repos && Object.keys(disconnectedData.repos).length > 0),
          repoCount: disconnectedData ? Object.keys(disconnectedData.repos || {}).length : 0,
          fetchedAt: disconnectedData ? disconnectedData.lastSyncedAt : null,
          lastFetchStatus: disconnectedLastFetch ? disconnectedLastFetch.status : null,
          tokenSource: disconnectedScheduler.getTokenSource()
        },
        quality: {
          dataAvailable: !!(qualityData && qualityData.reports && Object.keys(qualityData.reports).length > 0),
          repoCount: qualityData ? Object.keys(qualityData.reports || {}).length : 0,
          fetchedAt: qualityData ? qualityData.lastSyncedAt : null,
          lastFetchStatus: qualityLastFetch ? qualityLastFetch.status : null,
          tokenSource: qualityScheduler.getTokenSource()
        },
        aicpE2E: {
          dataAvailable: !!(odhE2EData && odhE2EData.recentRuns && odhE2EData.recentRuns.length > 0),
          runsCount: odhE2EData ? (odhE2EData.recentRuns?.length || 0) : 0,
          accumulatedRunsCount: odhE2EData ? (odhE2EData.accumulatedRuns?.length || 0) : 0,
          fetchedAt: odhE2EData ? odhE2EData.lastSyncedAt : null,
          dataSource: odhE2EData ? (odhE2EData.dataSource || 'unknown') : 'none',
          prowJobsMetrics: odhE2EData?.prowJobsMetrics ? {
            totalProwJobs: odhE2EData.prowJobsMetrics.totalProwJobs || 0,
            filteredJobs: odhE2EData.prowJobsMetrics.filteredJobs || 0,
            dataTransferMB: odhE2EData.prowJobsMetrics.dataTransferMB || 0
          } : null,
          suiteHealth: odhE2EData?.suites ? {
            odh: odhE2EData.suites.odh?.dailyStatus?.status || 'unknown',
            rhoai: odhE2EData.suites.rhoai?.dailyStatus?.status || 'unknown'
          } : null,
          componentStats: odhE2EData ? Object.keys(odhE2EData.componentStats || {}).length : 0,
          historicalTrends: odhE2EData?.historical_trends ? odhE2EData.historical_trends.daily_status?.length || 0 : 0
        },
        blockerJiras: {
          available: !!(blockerJiraData && blockerJiraData.available),
          reason: blockerJiraData ? (blockerJiraData.reason || null) : null,
          count: blockerJiraData ? (blockerJiraData.count || 0) : 0,
          fetchedAt: blockerJiraData ? blockerJiraData.lastSyncedAt : null
        }
      };
    });
  }
};
