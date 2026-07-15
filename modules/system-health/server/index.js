const express = require('express');
const registerDisconnectedRoutes = require('./disconnected/routes');
const scheduler = require('./disconnected/scheduler');

module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context;

  scheduler.init(context.secrets);

  context.registerScopes([
    { key: 'system-health:read', label: 'System Health (Read)', description: 'Read system health data', category: 'System Health' },
    { key: 'system-health:write', label: 'System Health (Write)', description: 'Push disconnected readiness data', category: 'System Health' }
  ]);

  const disconnectedRouter = express.Router();
  registerDisconnectedRoutes(disconnectedRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope,
    scheduler
  });
  router.use('/disconnected', disconnectedRouter);

  if (context.registerRefresh) {
    context.registerRefresh('disconnected-readiness', {
      order: 80,
      timeout: 600000,
      cadence: '1h',
      description: 'Fetches disconnected readiness reports from GitHub Actions artifacts.',
      handler: async function() {
        return scheduler.runFetch(storage);
      }
    });
  }

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const data = await storage.readFromStorage('system-health/disconnected/reports.json');
      const lastFetch = await storage.readFromStorage('system-health/disconnected/last-fetch.json');
      return {
        dataAvailable: !!(data && data.repos && Object.keys(data.repos).length > 0),
        repoCount: data ? Object.keys(data.repos || {}).length : 0,
        fetchedAt: data ? data.lastSyncedAt : null,
        lastFetchStatus: lastFetch ? lastFetch.status : null,
        tokenSource: scheduler.getTokenSource()
      };
    });
  }
};
