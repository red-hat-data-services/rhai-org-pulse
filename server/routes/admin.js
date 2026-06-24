/**
 * Admin routes: backup, refresh, secrets, must-gather, export, diagnostics.
 *
 * @param {import('express').Express} app
 * @param {object} context - Core services context
 */

const auditLog = require('../../shared/server/audit-log');

function registerAdminRoutes(app, context) {
  const {
    storage, requireAuth, requireAdmin, requireScope, blockDuringImpersonation,
    secretRegistry, refreshRegistry, builtInModules, enabledSlugs,
    collectModuleDiagnostics, diagnosticsRegistry, gitSync, exportRegistry
  } = context;
  const backup = require('../../shared/server/backup');

  let backupRunning = false;

  /**
   * @openapi
   * /api/admin/backup:
   *   post:
   *     tags: [Backup]
   *     summary: Trigger a data backup to S3 (admin only)
   *     responses:
   *       200:
   *         description: Backup created successfully
   *       409:
   *         description: Backup already in progress
   */
  app.post('/api/admin/backup', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    if (backupRunning) {
      return res.status(409).json({ error: 'Backup already in progress' });
    }
    backupRunning = true;
    try {
      const result = await backup.createBackup();
      const retention = await backup.applyRetention();
      res.json({ ...result, deleted: retention.deleted });
    } catch (error) {
      console.error('[backup] Backup failed:', error);
      res.status(500).json({ error: error.message });
    } finally {
      backupRunning = false;
    }
  });

  /**
   * @openapi
   * /api/admin/backup:
   *   get:
   *     tags: [Backup]
   *     summary: List available backups (admin only)
   *     responses:
   *       200:
   *         description: List of backups
   */
  app.get('/api/admin/backup', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    try {
      const backups = await backup.listBackups();
      res.json({ backups });
    } catch (error) {
      console.error('[backup] List failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/backup/restore:
   *   post:
   *     tags: [Backup]
   *     summary: Restore data from an S3 backup (admin only)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [key]
   *             properties:
   *               key:
   *                 type: string
   *     responses:
   *       200:
   *         description: Restore completed
   *       400:
   *         description: Invalid or missing key
   */
  app.post('/api/admin/backup/restore', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, async function(req, res) {
    const { key } = req.body || {};
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key is required' });
    }
    if (!key.startsWith('team-tracker/backup-')) {
      return res.status(400).json({ error: 'Invalid backup key format' });
    }
    try {
      const result = await backup.restoreBackup(key);
      res.json(result);
    } catch (error) {
      console.error('[backup] Restore failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Register platform:backup as a refresh handler
  refreshRegistry.register('platform:backup', {
    order: 200,
    cadence: '24h',
    timeout: 120000,
    description: 'Creates a backup of all data files to S3 and applies retention policy.',
    handler: async function() {
      if (!process.env.AWS_BACKUP_BUCKET) {
        return { status: 'skipped', reason: 'AWS_BACKUP_BUCKET not configured' };
      }
      if (backupRunning) {
        return { status: 'skipped', reason: 'backup already in progress' };
      }
      backupRunning = true;
      try {
        const result = await backup.createBackup();
        const retention = await backup.applyRetention();
        return { status: 'success', ...result, deleted: retention.deleted };
      } catch (err) {
        console.error('[platform:backup] Backup failed:', err.message);
        throw err;
      } finally {
        backupRunning = false;
      }
    }
  });

  // Register backup staleness message provider
  const BACKUP_STALE_HOURS = 48;
  context.messageRegistry.registerProvider('backup-staleness', async function(userContext) {
    if (!userContext.isAdmin) return [];
    if (!process.env.AWS_BACKUP_BUCKET) return [];
    try {
      const backups = await backup.listBackups();
      if (backups.length === 0) {
        return [{
          id: 'backup:no-backups',
          type: 'warning',
          text: 'No data backups found. Trigger a backup from About > Backups to protect against data loss.',
          link: { label: 'Go to Backups', href: '#/about?tab=backups' }
        }];
      }
      const latest = backups[0];
      const ageMs = Date.now() - new Date(latest.lastModified).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      if (ageHours > BACKUP_STALE_HOURS) {
        const ageDays = Math.floor(ageHours / 24);
        const ageLabel = ageDays >= 1 ? `${ageDays} day${ageDays === 1 ? '' : 's'}` : `${Math.floor(ageHours)} hours`;
        return [{
          id: 'backup:stale',
          type: 'warning',
          text: `Data backup is overdue — last backup was ${ageLabel} ago.`,
          link: { label: 'Go to Backups', href: '#/about?tab=backups' }
        }];
      }
      return [];
    } catch {
      return [];
    }
  });

  /**
   * @openapi
   * /api/admin/refresh-all:
   *   post:
   *     tags: [Admin]
   *     summary: Trigger a full refresh of all registered handlers (admin only)
   *     parameters:
   *       - name: force
   *         in: query
   *         schema:
   *           type: string
   *         description: When "true", bypasses cadence filtering and runs all handlers
   *     responses:
   *       202:
   *         description: Refresh started
   *       409:
   *         description: Refresh already in progress
   */
  app.post('/api/admin/refresh-all', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    if (refreshRegistry.isRunning()) {
      return res.status(409).json({ error: 'Refresh is already running' });
    }
    var force = req.query.force === 'true';
    try {
      var result = await refreshRegistry.runAll({ skipCooldown: true, force: force });
      if (result.execution) {
        result.execution.catch(function(err) {
          console.error('[refresh-all] runAll error:', err.message);
        });
      }
      res.status(202).json({
        status: 'started',
        totalHandlers: result.counts.total,
        handlersSkipped: result.counts.skipped,
        handlersDue: result.counts.due
      });
    } catch (err) {
      console.error('[refresh-all] runAll error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/admin/refresh-cadence:
   *   get:
   *     tags: [Admin]
   *     summary: Get cadence info for all handlers (admin only)
   *     responses:
   *       200:
   *         description: Cadence info per handler
   */
  app.get('/api/admin/refresh-cadence', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    try {
      var status = await refreshRegistry.getStatus();
      var overrides = refreshRegistry.getCadenceOverrides();
      res.json({ handlers: status.handlers, overrides: overrides });
    } catch (error) {
      console.error('[refresh-cadence] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/refresh-cadence:
   *   post:
   *     tags: [Admin]
   *     summary: Set cadence override for a handler (admin only)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [handlerId]
   *             properties:
   *               handlerId:
   *                 type: string
   *               cadence:
   *                 type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Override set successfully
   *       400:
   *         description: Invalid cadence value
   */
  app.post('/api/admin/refresh-cadence', requireAdmin, requireScope('admin:manage'), function(req, res) {
    var handlerId = req.body && req.body.handlerId;
    var cadence = req.body && req.body.cadence;
    if (!handlerId || typeof handlerId !== 'string') {
      return res.status(400).json({ error: 'handlerId is required' });
    }
    try {
      refreshRegistry.setCadenceOverride(handlerId, cadence === undefined ? null : cadence);
      res.json({ status: 'ok', overrides: refreshRegistry.getCadenceOverrides() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/admin/refresh/{module}:
   *   post:
   *     tags: [Admin]
   *     summary: Trigger refresh for a single module's handlers (admin only)
   *     parameters:
   *       - name: module
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       202:
   *         description: Refresh started
   *       404:
   *         description: No handlers registered for module
   *       409:
   *         description: Refresh already in progress
   */
  app.post('/api/admin/refresh/:module', requireAdmin, requireScope('admin:manage'), function(req, res) {
    if (refreshRegistry.isRunning()) {
      return res.status(409).json({ error: 'Refresh is already running' });
    }
    const slug = req.params.module;
    const allHandlers = refreshRegistry.getAll();
    const prefix = slug + ':';
    const hasHandlers = Object.keys(allHandlers).some(function(id) { return id.startsWith(prefix); });
    if (!hasHandlers) {
      return res.status(404).json({ error: 'No handlers registered for module "' + slug + '"' });
    }
    refreshRegistry.runModule(slug, { skipCooldown: true }).catch(function(err) {
      console.error('[refresh-module] runModule error for %s:', slug, err.message);
    });
    res.status(202).json({ status: 'started', module: slug });
  });

  /**
   * @openapi
   * /api/admin/refresh/handler/{handlerId}:
   *   post:
   *     tags: [Admin]
   *     summary: Run a single refresh handler by ID (admin only)
   *     parameters:
   *       - in: path
   *         name: handlerId
   *         required: true
   *         schema:
   *           type: string
   *         description: Full handler ID (e.g. "team-tracker:roster-sync")
   *     responses:
   *       202:
   *         description: Handler started
   *       404:
   *         description: Handler not found
   *       409:
   *         description: Refresh already in progress
   */
  app.post('/api/admin/refresh/handler/:handlerId', requireAdmin, requireScope('admin:manage'), function(req, res) {
    if (refreshRegistry.isRunning()) {
      return res.status(409).json({ error: 'Refresh is already running' });
    }
    const handlerId = req.params.handlerId;
    const handler = refreshRegistry.get(handlerId);
    if (!handler) {
      return res.status(404).json({ error: 'No handler registered with id "' + handlerId + '"' });
    }
    refreshRegistry.runOne(handlerId, { skipCooldown: true }).catch(function(err) {
      console.error('[refresh-handler] runOne error for %s:', handlerId, err.message);
    });
    res.status(202).json({ status: 'started', handler: handlerId });
  });

  /**
   * @openapi
   * /api/admin/refresh/status:
   *   get:
   *     tags: [Admin]
   *     summary: Get refresh registry status (admin only)
   *     responses:
   *       200:
   *         description: Current refresh status
   */
  app.get('/api/admin/refresh/status', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    try {
      const status = await refreshRegistry.getStatus();
      res.json(status);
    } catch (error) {
      console.error('[refresh-status] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/secrets/status:
   *   get:
   *     tags: [Admin]
   *     summary: Get secrets configuration status across all modules
   *     responses:
   *       200:
   *         description: Secrets status (never includes actual values)
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  app.get('/api/admin/secrets/status', requireAdmin, requireScope('admin:manage'), function(_req, res) {
    res.json(secretRegistry.getStatus());
  });

  /**
   * @openapi
   * /api/admin/secrets/validate:
   *   post:
   *     tags: [Admin]
   *     summary: Run registered secret validators
   *     description: Runs all validators, or a subset if keys are specified in the request body.
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               keys:
   *                 type: array
   *                 items: { type: string }
   *                 description: Optional list of secret keys to validate. Omit to run all validators.
   *     responses:
   *       200:
   *         description: Validation results (never includes actual values)
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  app.post('/api/admin/secrets/validate', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    try {
      const keys = req.body && Array.isArray(req.body.keys) ? req.body.keys : null;
      const results = keys && keys.length > 0
        ? await secretRegistry.validateKeys(keys)
        : await secretRegistry.validateAll();
      res.json({ results });
    } catch (err) {
      res.status(500).json({ error: 'Validation failed: ' + err.message });
    }
  });

  /**
   * @openapi
   * /api/admin/secrets/update:
   *   post:
   *     tags: [Admin]
   *     summary: Update secret values
   *     security:
   *       - BearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - secrets
   *             properties:
   *               secrets:
   *                 type: object
   *                 additionalProperties:
   *                   type: string
   *                 description: Map of secret keys to new values
   *     responses:
   *       200:
   *         description: Secrets updated successfully
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  app.post('/api/admin/secrets/update', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    try {
      const { secrets } = req.body;

      if (!secrets || typeof secrets !== 'object') {
        return res.status(400).json({ error: 'Invalid request: secrets object required' });
      }

      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '..', '..', '.env');

      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      const envVars = {};
      envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          envVars[match[1]] = match[2];
        }
      });

      const ALLOWED_ENV_VARS = [
        'JIRA_EMAIL',
        'JIRA_TOKEN',
        'GITHUB_TOKEN',
        'GITLAB_TOKEN',
        'GITLAB_BASE_URL',
        'GOOGLE_SERVICE_ACCOUNT_KEY_FILE',
        'GOOGLE_OAUTH_CLIENT_ID',
        'GOOGLE_OAUTH_CLIENT_SECRET',
        'GOOGLE_PICKER_API_KEY',
        'VITE_GOOGLE_PICKER_API_KEY',
        'PRODUCT_PAGES_CLIENT_ID',
        'PRODUCT_PAGES_CLIENT_SECRET',
        'PRODUCT_PAGES_TOKEN',
        'FEATURE_TRAFFIC_GITLAB_TOKEN',
        'PRODUCT_BUILDS_API_URL',
        'MODELS_CORP_API_KEY',
        'MODELS_CORP_BASE_URL',
        'SESSION_SECRET'
      ];

      for (const [key, value] of Object.entries(secrets)) {
        if (!ALLOWED_ENV_VARS.includes(key)) {
          console.warn(`Ignoring attempt to set non-allowlisted env var: ${key}`);
          continue;
        }
        if (value) {
          envVars[key] = value;
          process.env[key] = value;
        }
      }

      const newEnvContent = Object.entries(envVars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      fs.writeFileSync(envPath, newEnvContent + '\n', 'utf8');

      auditLog.log({
        actor: req.user?.email || 'unknown',
        action: 'secrets.update',
        resource: Object.keys(secrets).join(', '),
        outcome: 'success'
      });

      res.json({
        success: true,
        message: `Updated ${Object.keys(secrets).length} secret(s)`,
        updated: Object.keys(secrets)
      });
    } catch (err) {
      console.error('Failed to update secrets:', err);
      auditLog.log({
        actor: req.user?.email || 'unknown',
        action: 'secrets.update',
        outcome: 'failure',
        error: err.message
      });
      res.status(500).json({ error: 'Failed to update secrets: ' + err.message });
    }
  });

  // Must-gather
  const mustGather = require('../must-gather');

  /**
   * @openapi
   * /api/must-gather:
   *   get:
   *     tags: [Export]
   *     summary: Download diagnostic must-gather bundle
   *     parameters:
   *       - in: query
   *         name: redact
   *         schema:
   *           type: string
   *           enum: [minimal, aggressive]
   *           default: minimal
   *         description: Redaction level for sensitive data
   *     responses:
   *       200:
   *         description: JSON diagnostic bundle
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       429:
   *         description: Rate limit exceeded
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/must-gather', requireAdmin, requireScope('admin:manage'), context.exportRateLimit, async function(req, res) {
    try {
      const redact = req.query.redact === 'aggressive' ? 'aggressive' : 'minimal';
      const bundle = await mustGather.collect({
        storageModule: storage,
        builtInModules,
        enabledSlugs,
        collectModuleDiagnostics,
        diagnosticsRegistry,
        gitSync,
        secretRegistry,
        redact
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=must-gather-' + timestamp + '.json');
      res.json(bundle);
    } catch (err) {
      console.error('[must-gather] Collection failed:', err);
      res.status(500).json({ error: 'Must-gather collection failed: ' + err.message });
    }
  });

  // Export
  const { handleExport } = require('../export');

  /**
   * @openapi
   * /api/export/test-data:
   *   get:
   *     tags: [Export]
   *     summary: Download anonymized test data as a tarball
   *     responses:
   *       200:
   *         description: Tarball of anonymized fixture data
   *         content:
   *           application/gzip:
   *             schema:
   *               type: string
   *               format: binary
   *       429:
   *         description: Rate limit exceeded
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/export/test-data', requireAuth, context.exportRateLimit, function(req, res) {
    handleExport(req, res, storage, exportRegistry);
  });
}

module.exports = registerAdminRoutes;
