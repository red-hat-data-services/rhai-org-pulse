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
function migrateStoragePaths(storage) {
  const { readFromStorage, writeToStorage, listStorageFiles } = storage;

  const migrations = [
    { oldPrefix: 'release-planning', newPrefix: 'releases/planning' },
    { oldPrefix: 'feature-traffic', newPrefix: 'releases/execution' },
    { oldPrefix: 'release-analysis', newPrefix: 'releases/delivery' }
  ];

  // Also migrate the unified audit log from old planning path
  const auditOld = 'release-planning/audit-log.json';
  const auditNew = 'releases/audit-log.json';
  const oldAudit = readFromStorage(auditOld);
  const newAudit = readFromStorage(auditNew);
  if (oldAudit && !newAudit) {
    writeToStorage(auditNew, oldAudit);
    console.log('[releases] Migrated audit-log.json to releases/audit-log.json');
  }

  for (const { oldPrefix, newPrefix } of migrations) {
    let files;
    try {
      files = listStorageFiles(oldPrefix);
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

      const oldData = readFromStorage(oldPath);
      if (!oldData) continue;

      const existing = readFromStorage(newPath);
      if (existing) continue;

      writeToStorage(newPath, oldData);
      migrated++;
    }
    }

    // Also check for subdirectories (e.g., release-planning/releases/, feature-traffic/features/)
    const subdirs = ['releases', 'features', 'rfes'];
    for (const subdir of subdirs) {
      let subFiles;
      try {
        subFiles = listStorageFiles(`${oldPrefix}/${subdir}`);
      } catch {
        continue;
      }
      if (!subFiles || subFiles.length === 0) continue;

      for (const fileName of subFiles) {
        if (!fileName.endsWith('.json')) continue;

        const oldPath = `${oldPrefix}/${subdir}/${fileName}`;
        const newPath = `${newPrefix}/${subdir}/${fileName}`;

        const oldData = readFromStorage(oldPath);
        if (!oldData) continue;

        const existing = readFromStorage(newPath);
        if (existing) continue;

        writeToStorage(newPath, oldData);
        migrated++;
      }
    }

    if (migrated > 0) {
      console.log(`[releases] Migrated ${migrated} file(s) from ${oldPrefix}/ to ${newPrefix}/`);
    }
  }
}

module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireReleaseManager, requireScope, roleStore } = context;

  // Run storage path migration on module startup (skip if already done)
  const migrationMarker = storage.readFromStorage('releases/.migration-complete');
  if (!migrationMarker) {
    try {
      migrateStoragePaths(storage);
      storage.writeToStorage('releases/.migration-complete', { completedAt: new Date().toISOString() });
    } catch (err) {
      console.error('[releases] Storage migration failed:', err.message);
    }
  }

  // Registry routes (top-level under /api/modules/releases/)
  registerRegistryRoutes(router, { storage, requireAuth, requireReleaseManager, requireScope });

  // Planning sub-router (mounted at /api/modules/releases/planning/)
  var planningRouter = express.Router();
  registerPlanningRoutes(planningRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireReleaseManager,
    requireScope,
    roleStore,
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
    registerDiagnostics: context.registerDiagnostics || null
  });
  registerFeatureTrackingRoutes(executionRouter, {
    storage,
    requireAuth,
    requireReleaseManager,
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
    registerDiagnostics: context.registerDiagnostics || null
  });
  router.use('/delivery', deliveryRouter);

  // Hygiene sub-router (mounted at /api/modules/releases/hygiene/)
  var hygieneRouter = express.Router();
  registerHygieneRoutes(hygieneRouter, {
    storage,
    requireAuth,
    requireAdmin,
    requireReleaseManager,
    requireScope,
    registerDiagnostics: context.registerDiagnostics || null
  });
  router.use('/hygiene', hygieneRouter);

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
  router.get('/audit-log', requireAuth, requireScope('releases:read'), function(req, res) {
    const options = {};
    if (req.query.version) options.version = req.query.version;
    if (req.query.action) options.action = req.query.action;
    if (req.query.domain) options.domain = req.query.domain;
    if (req.query.limit) options.limit = parseInt(req.query.limit, 10) || 100;
    if (req.query.offset) options.offset = parseInt(req.query.offset, 10) || 0;

    const result = getAuditLog(storage.readFromStorage, options);
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
  router.post('/admin/migrate-storage', requireAdmin, requireScope('releases:write'), function(req, res) {
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
        files = listStorageFiles(oldPrefix);
      } catch {
        continue;
      }
      if (files && files.length > 0) {
      for (const fileName of files) {
        if (!fileName.endsWith('.json')) continue;
        const oldPath = `${oldPrefix}/${fileName}`;
        const newPath = `${newPrefix}/${fileName}`;

        const newData = readFromStorage(newPath);
        if (!newData) {
          results.skipped++;
          continue;
        }

        try {
          deleteFromStorage(oldPath);
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
          subFiles = listStorageFiles(`${oldPrefix}/${subdir}`);
        } catch {
          continue;
        }
        if (!subFiles || subFiles.length === 0) continue;

        for (const fileName of subFiles) {
          if (!fileName.endsWith('.json')) continue;
          const oldPath = `${oldPrefix}/${subdir}/${fileName}`;
          const newPath = `${newPrefix}/${subdir}/${fileName}`;

          const newData = readFromStorage(newPath);
          if (!newData) {
            results.skipped++;
            continue;
          }

          try {
            deleteFromStorage(oldPath);
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
