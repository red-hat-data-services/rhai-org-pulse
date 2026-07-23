/**
 * Releases module — main server entry point.
 *
 * Mounts the release registry router and sub-domain routers (planning,
 * execution, delivery) at their respective sub-paths. Also runs storage
 * migration on startup and registers unified audit routes.
 */

const express = require('express');
const { registerRegistryRoutes } = require('./registry');
const registerPlanningRoutes = require('./planning/routes');
const registerExecutionRoutes = require('./execution/routes');
const registerFeatureTrackingRoutes = require('./execution/feature-tracking-routes');
const registerDeliveryRoutes = require('./delivery/routes');
const registerHygieneRoutes = require('./hygiene/routes');
const registerTvFvDeltaRoutes = require('./tv-fv-delta/routes');
const registerFeaturePressureRoutes = require('./feature-pressure/routes');
const registerPmHubRoutes = require('./pm-hub/routes');
const registerDraftPlanRoutes = require('./draft-plans/routes');
const registerReleaseReadinessRoutes = require('./release-readiness/routes');
const registerCveSustainingRoutes = require('./cve-sustaining/routes');
const { getAuditLog } = require('./planning/audit-log');

/**
 * Migrate storage paths from old module-specific prefixes to unified
 * releases/ prefixes. Copies files if old paths exist and new paths
 * do not. Does NOT delete old files — admin cleanup handles that.
 *
 * Old → New mappings:
 *   release-planning/ → releases/planning/
 *   feature-traffic/  → releases/execution/
 *   release-analysis/ → releases/delivery/
 */
async function migrateStoragePaths(storage) {
  const { readFromStorage, writeToStorage, listStorageFiles } = storage;

  const migrations = [
    { oldPrefix: 'release-planning', newPrefix: 'releases/planning' },
    { oldPrefix: 'feature-traffic', newPrefix: 'releases/execution' },
    { oldPrefix: 'release-analysis', newPrefix: 'releases/delivery' }
  ];

  // Also migrate the unified audit log from old planning path
  const auditOld = 'release-planning/audit-log.json';
  const auditNew = 'releases/audit-log.json';
  const oldAudit = await readFromStorage(auditOld);
  const newAudit = await readFromStorage(auditNew);
  if (oldAudit && !newAudit) {
    await writeToStorage(auditNew, oldAudit);
    console.log('[releases] Migrated audit-log.json to releases/audit-log.json');
  }

  for (const { oldPrefix, newPrefix } of migrations) {
    let files;
    try {
      files = await listStorageFiles(oldPrefix);
    } catch {
      // Directory doesn't exist — nothing to migrate
      continue;
    }

    let migrated = 0;

    if (files && files.length > 0) {
    for (const fileName of files) {
      // Skip directories and non-JSON files
      if (!fileName.endsWith('.json')) continue;

      const oldPath = `${oldPrefix}/${fileName}`;
      const newPath = `${newPrefix}/${fileName}`;

      const oldData = await readFromStorage(oldPath);
      if (!oldData) continue;

      const existing = await readFromStorage(newPath);
      if (existing) continue;

      await writeToStorage(newPath, oldData);
      migrated++;
    }
    }

    // Also check for subdirectories (e.g., release-planning/releases/, feature-traffic/features/)
    const subdirs = ['releases', 'features', 'rfes'];
    for (const subdir of subdirs) {
      let subFiles;
      try {
        subFiles = await listStorageFiles(`${oldPrefix}/${subdir}`);
      } catch {
        continue;
      }
      if (!subFiles || subFiles.length === 0) continue;

      for (const fileName of subFiles) {
        if (!fileName.endsWith('.json')) continue;

        const oldPath = `${oldPrefix}/${subdir}/${fileName}`;
        const newPath = `${newPrefix}/${subdir}/${fileName}`;

        const oldData = await readFromStorage(oldPath);
        if (!oldData) continue;

        const existing = await readFromStorage(newPath);
        if (existing) continue;

        await writeToStorage(newPath, oldData);
        migrated++;
      }
    }

    if (migrated > 0) {
      console.log(`[releases] Migrated ${migrated} file(s) from ${oldPrefix}/ to ${newPrefix}/`);
    }
  }
}

module.exports = async function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireRole, requireScope, roleStore, secrets } = context;
  const requirePlanningManager = requireRole('planning-manager');

  // Create shared clients from context.secrets
  const { createJiraClient } = require('../../../shared/server/jira');
  const jira = createJiraClient({
    email: (secrets && secrets.JIRA_EMAIL) || '',
    token: (secrets && secrets.JIRA_TOKEN) || '',
    host: process.env.JIRA_HOST
  });
  const { createSmartsheetClient } = require('../../../shared/server/smartsheet');
  const smartsheet = createSmartsheetClient({
    apiToken: secrets && secrets.SMARTSHEET_API_TOKEN,
    sheetId: process.env.SMARTSHEET_SHEET_ID
  });

  // Register planning-manager role
  context.registerRole('planning-manager', {
    label: 'Planning Manager',
    description: 'Manage release planning, registry, and delivery configuration'
  });

  // Register module scopes
  context.registerScopes([
    { key: 'releases:read', label: 'Releases (Read)', description: 'Read release planning, execution, and delivery data', category: 'Releases' },
    { key: 'releases:write', label: 'Releases (Write)', description: 'Mutate release planning, execution, and delivery data', category: 'Releases' }
  ]);

  // ─── Role Migration: release-manager → planning-manager ───
  // Migrate existing role assignments from the old name to the new name.
  // Uses raw storage manipulation (not roleStore API) because the old role
  // is no longer registered and roleStore.revokeRole() would reject it.
  try {
    const rolesData = await storage.readFromStorage('roles.json');
    if (rolesData && rolesData.assignments) {
      let migrated = 0;
      for (const [, entry] of Object.entries(rolesData.assignments)) {
        if (entry.roles && entry.roles.includes('release-manager')) {
          migrated++;
        }
      }
      if (migrated > 0) {
        // Backup before overwriting, following migrateEmailDomains() pattern
        const backupKey = 'roles-backup-premigration.json';
        await storage.writeToStorage(backupKey, JSON.parse(JSON.stringify(rolesData)));
        console.log(`[releases] Backup saved to ${backupKey}`);

        for (const [, entry] of Object.entries(rolesData.assignments)) {
          if (entry.roles && entry.roles.includes('release-manager')) {
            entry.roles = entry.roles.filter(r => r !== 'release-manager');
            if (!entry.roles.includes('planning-manager')) {
              entry.roles.push('planning-manager');
            }
          }
        }
        await storage.writeToStorage('roles.json', rolesData);
        console.log(`[releases] Migrated ${migrated} user(s) from release-manager to planning-manager`);
      }
    }
  } catch (err) {
    console.error('[releases] Role migration failed:', err.message);
  }

  // Run storage path migration on module startup (skip if already done)
  const migrationMarker = await storage.readFromStorage('releases/.migration-complete');
  if (!migrationMarker) {
    try {
      await migrateStoragePaths(storage);
      await storage.writeToStorage('releases/.migration-complete', { completedAt: new Date().toISOString() });
    } catch (err) {
      console.error('[releases] Storage migration failed:', err.message);
    }
  }

  // Registry routes (top-level under /api/modules/releases/)
  registerRegistryRoutes(router, { storage, requireAuth, requirePlanningManager, requireScope, registerRefresh: context.registerRefresh || null, isRefreshRunning: context.isRefreshRunning || null });

  // Planning sub-router (mounted at /api/modules/releases/planning/)
  var planningRouter = express.Router();
  registerPlanningRoutes(planningRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requirePlanningManager,
    requireScope,
    roleStore,
    secrets,
    jira,
    smartsheet,
    registerDiagnostics: context.registerDiagnostics || null
  });
  router.use('/planning', planningRouter);

  // Execution sub-router (mounted at /api/modules/releases/execution/)
  var executionRouter = express.Router();
  registerExecutionRoutes(executionRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope,
    secrets,
    jira,
    registerDiagnostics: context.registerDiagnostics || null,
    registerRefresh: context.registerRefresh || null,
    isRefreshRunning: context.isRefreshRunning || null
  });
  registerFeatureTrackingRoutes(executionRouter, {
    storage,
    requireAuth,
    requireScope
  });
  router.use('/execution', executionRouter);

  // Delivery sub-router (mounted at /api/modules/releases/delivery/)
  var deliveryRouter = express.Router();
  registerDeliveryRoutes(deliveryRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireScope,
    secrets,
    jira,
    registerDiagnostics: context.registerDiagnostics || null,
    registerRefresh: context.registerRefresh || null,
    isRefreshRunning: context.isRefreshRunning || null
  });
  router.use('/delivery', deliveryRouter);

  // Hygiene sub-router (mounted at /api/modules/releases/hygiene/)
  var hygieneRouter = express.Router();
  registerHygieneRoutes(hygieneRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requirePlanningManager,
    requireScope,
    registerDiagnostics: context.registerDiagnostics || null,
    registerRefresh: context.registerRefresh || null,
    isRefreshRunning: context.isRefreshRunning || null
  });
  router.use('/hygiene', hygieneRouter);

  // TV/FV Delta sub-router (mounted at /api/modules/releases/tv-fv-delta/)
  const tvFvDeltaRouter = express.Router();
  registerTvFvDeltaRoutes(tvFvDeltaRouter, {
    storage,
    requireAuth,
    requireScope,
    registerDiagnostics: context.registerDiagnostics || null
  });
  router.use('/tv-fv-delta', tvFvDeltaRouter);

  // Feature Pressure sub-router (mounted at /api/modules/releases/feature-pressure/)
  const featurePressureRouter = express.Router();
  registerFeaturePressureRoutes(featurePressureRouter, {
    storage,
    requireAuth,
    requireScope,
    registerDiagnostics: context.registerDiagnostics || null
  });
  router.use('/feature-pressure', featurePressureRouter);

  // PM Hub sub-router (mounted at /api/modules/releases/pm-hub/)
  var pmHubRouter = express.Router();
  registerPmHubRoutes(pmHubRouter, {
    requireAuth,
    requireScope,
    jira,
    storage
  });
  router.use('/pm-hub', pmHubRouter);

  // Draft Plans sub-router (mounted at /api/modules/releases/draft-plans/)
  var draftPlansRouter = express.Router();
  registerDraftPlanRoutes(draftPlansRouter, {
    storage,
    requireAuth,
    requireScope,
    secrets,
    registerDiagnostics: context.registerDiagnostics || null,
    registerRefresh: context.registerRefresh || null,
    isRefreshRunning: context.isRefreshRunning || null
  });
  router.use('/draft-plans', draftPlansRouter);

  // Release Readiness sub-router (mounted at /api/modules/releases/release-readiness/)
  const releaseReadinessRouter = express.Router();
  registerReleaseReadinessRoutes(releaseReadinessRouter, {
    storage,
    requireAuth,
    requireScope
  });
  router.use('/release-readiness', releaseReadinessRouter);

  // CVE Sustaining sub-router (mounted at /api/modules/releases/cve-sustaining/)
  const cveSustainingRouter = express.Router();
  registerCveSustainingRoutes(cveSustainingRouter, {
    storage,
    requireAuth,
    requireScope,
    jira
  });
  router.use('/cve-sustaining', cveSustainingRouter);

  // ─── Unified Audit Routes ───

  /**
   * @openapi
   * /api/modules/releases/audit-log:
   *   get:
   *     tags: [Releases]
   *     summary: Get unified audit log across all release domains
   *     parameters:
   *       - in: query
   *         name: version
   *         schema: { type: string }
   *         description: Filter by release version
   *       - in: query
   *         name: action
   *         schema: { type: string }
   *         description: Filter by action type
   *       - in: query
   *         name: domain
   *         schema: { type: string, enum: [planning, execution, delivery, registry, hygiene] }
   *         description: Filter by domain
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 100 }
   *       - in: query
   *         name: offset
   *         schema: { type: integer, default: 0 }
   *     responses:
   *       200:
   *         description: Audit log entries
   */
  router.get('/audit-log', requireAuth, requireScope('releases:read'), async function(req, res) {
    const options = {};
    if (req.query.version) options.version = req.query.version;
    if (req.query.action) options.action = req.query.action;
    if (req.query.domain) options.domain = req.query.domain;
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10) || 100;
    if (req.query.offset) options.offset = parseInt(req.query.offset, 10) || 0;

    const result = await getAuditLog(storage.readFromStorage, options);
    res.json(result);
  });

  // ─── Admin: Migrate Storage Cleanup ───

  /**
   * @openapi
   * /api/modules/releases/admin/migrate-storage:
   *   post:
   *     tags: [Releases]
   *     summary: Clean up old storage paths after migration (admin only)
   *     description: Deletes old module-specific storage files after verifying new unified paths exist
   *     responses:
   *       200:
   *         description: Migration cleanup results
   */
  router.post('/admin/migrate-storage', requireAdmin, requireScope('releases:write'), async function(req, res) {
    const { readFromStorage, listStorageFiles, deleteFromStorage } = storage;

    const migrations = [
      { oldPrefix: 'release-planning', newPrefix: 'releases/planning' },
      { oldPrefix: 'feature-traffic', newPrefix: 'releases/execution' },
      { oldPrefix: 'release-analysis', newPrefix: 'releases/delivery' }
    ];

    const results = { deleted: 0, skipped: 0, errors: [] };

    for (const { oldPrefix, newPrefix } of migrations) {
      let files;
      try {
        files = await listStorageFiles(oldPrefix);
      } catch {
        continue;
      }
      if (files && files.length > 0) {
      for (const fileName of files) {
        if (!fileName.endsWith('.json')) continue;
        const oldPath = `${oldPrefix}/${fileName}`;
        const newPath = `${newPrefix}/${fileName}`;

        const newData = await readFromStorage(newPath);
        if (!newData) {
          results.skipped++;
          continue;
        }

        try {
          await deleteFromStorage(oldPath);
          results.deleted++;
        } catch (err) {
          results.errors.push({ path: oldPath, error: err.message });
        }
      }
      }

      // Check subdirectories
      const subdirs = ['releases', 'features', 'rfes'];
      for (const subdir of subdirs) {
        let subFiles;
        try {
          subFiles = await listStorageFiles(`${oldPrefix}/${subdir}`);
        } catch {
          continue;
        }
        if (!subFiles || subFiles.length === 0) continue;

        for (const fileName of subFiles) {
          if (!fileName.endsWith('.json')) continue;
          const oldPath = `${oldPrefix}/${subdir}/${fileName}`;
          const newPath = `${newPrefix}/${subdir}/${fileName}`;

          const newData = await readFromStorage(newPath);
          if (!newData) {
            results.skipped++;
            continue;
          }

          try {
            await deleteFromStorage(oldPath);
            results.deleted++;
          } catch (err) {
            results.errors.push({ path: oldPath, error: err.message });
          }
        }
      }
    }

    res.json({ status: 'completed', ...results });
  });

  // ─── Export Hook ───

  if (context.registerExport) {
    context.registerExport(require('./export'));
  }
};
