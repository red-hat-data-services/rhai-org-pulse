/**
 * People & Teams API server
 *
 * Combines fetcher and reader Express routes into a single
 * server, using local file storage.
 *
 * Usage:
 *   JIRA_EMAIL=you@redhat.com JIRA_TOKEN=your-token node server/dev-server.js
 *
 * Or with a .env file:
 *   node -r dotenv/config server/dev-server.js
 */

const express = require('express');
const errorBuffer = require('./error-buffer');
const requestTracker = require('./request-tracker');

// Install error buffer early to capture startup errors
errorBuffer.install();

// Demo mode: use fixtures instead of data directory
const DEMO_MODE = process.env.DEMO_MODE === 'true';
const storageModule = DEMO_MODE ? require('../shared/server/demo-storage') : require('../shared/server/storage');
const { readFromStorage, writeToStorage } = storageModule;
const { createAuthMiddleware, proxySecretGuard, blockDuringImpersonation } = require('../shared/server/auth');
const { createRoleStore } = require('../shared/server/role-store');
const auditLog = require('../shared/server/audit-log');
const apiTokens = require('./api-tokens');

const modulesConfig = require('./modules/config');
const gitSync = require('./modules/git-sync');
const { createModuleStaticMiddleware, invalidateCache: invalidateStaticCache } = require('./modules/static-serve');
const {
  getDiscoveredModules,
  createModuleRouters,
  mountModuleRouters,
  collectModuleDiagnostics,
  loadModuleState,
  saveModuleState,
  getEffectiveState,
  reconcileStartupState,
  resolveEnableOrder,
  checkDisableAllowed,
  computeRequiredBy,
  wasMountedAtStartup
} = require('./module-loader');

const builtInModules = getDiscoveredModules();

if (DEMO_MODE) {
  console.log('Running in DEMO MODE - using fixture data, Jira/GitHub APIs disabled');
}

// Initialize API token store
apiTokens.init(storageModule);

const PORT = process.env.API_PORT || 3001;

const app = express();
app.use(express.json({ limit: '10mb' }));

// Enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  next();
});

// Request tracker middleware
app.use(requestTracker.createMiddleware());

// Proxy secret guard — validates X-Proxy-Secret header when PROXY_AUTH_SECRET is set
// Inject tokenValidator for inline Bearer token validation (defense in depth)
app.use(function(req, res, next) {
  proxySecretGuard(req, res, next, { tokenValidator: apiTokens });
});

// Demo mode: block refresh routes that would call external APIs
if (DEMO_MODE) {
  app.use(function(req, res, next) {
    if (req.method === 'POST' && req.path.includes('refresh')) {
      return res.json({
        status: 'skipped',
        message: 'Refresh disabled in demo mode - using fixture data'
      });
    }
    // Demo mode: block token creation with explicit error
    if (req.method === 'POST' && req.path === '/api/tokens') {
      return res.status(403).json({
        status: 'skipped',
        message: 'Token creation disabled in demo mode'
      });
    }
    // Demo mode: block token scope editing
    if (req.method === 'PATCH' && req.path.match(/^\/api\/(admin\/)?tokens\/[^/]+\/scopes$/)) {
      return res.status(403).json({
        status: 'skipped',
        message: 'Token scope editing disabled in demo mode'
      });
    }
    next();
  });
}

// ─── Auth (from shared package) ───

const roleStore = createRoleStore(readFromStorage, writeToStorage, {
  getAuthDomain: () => {
    // Env var takes precedence (solves bootstrap: can be set in ConfigMap
    // before first deployment, so migration runs on first startup)
    if (process.env.AUTH_EMAIL_DOMAIN) {
      return process.env.AUTH_EMAIL_DOMAIN.trim().toLowerCase();
    }
    const config = readFromStorage('site-config.json');
    return config?.authEmailDomain || null;
  }
});
const { authMiddleware, requireAdmin, requireTeamAdmin, requireReleaseManager, requireScope, seedRoles } = createAuthMiddleware(readFromStorage, writeToStorage, {
  tokenValidator: apiTokens,
  roleStore
});

// ─── Swagger UI (before auth) ───

const { createOpenApiSpec } = require('./openapi-config');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = createOpenApiSpec();

app.get('/api/docs/openapi.json', function(req, res) { res.json(openapiSpec); });
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Org Pulse API Docs'
}));

// ─── Health check (before auth) ───

// Root-level health check — not in Swagger docs because nginx handles /healthz
// directly in production and it's not reachable through the /api/ proxy.
// Use /api/healthz instead.
app.get('/healthz', function(req, res) {
  res.json({ status: 'ok' });
});

/**
 * @openapi
 * /api/healthz:
 *   get:
 *     tags: [Health]
 *     summary: Health check (API prefix)
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
app.get('/api/healthz', function(req, res) {
  res.json({ status: 'ok' });
});

/**
 * Built-in module manifests — intentionally public (no auth, no proxy secret).
 * Payload is low-sensitivity (names, icons, slugs, client entry paths); same class of info as bundled import.meta.glob.
 * Registered before authMiddleware so the shell can list modules on first paint without a session.
 */
app.get('/api/built-in-modules/manifests', function(req, res) {
  try {
    const modules = builtInModules.map(function(mod) {
      return {
        slug: mod.slug,
        name: mod.name,
        description: mod.description,
        icon: mod.icon,
        order: mod.order,
        client: mod.client,
        requires: mod.requires || [],
        defaultEnabled: mod.defaultEnabled
      };
    });
    res.json({ modules });
  } catch (error) {
    console.error('Get built-in module manifests error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use(authMiddleware);

// ─── Routes: Whoami (after authMiddleware so token auth works) ───

/**
 * @openapi
 * /api/whoami:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user info
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   type: string
 *                   format: email
 *                 displayName:
 *                   type: string
 *                 isAdmin:
 *                   type: boolean
 *                 authMethod:
 *                   type: string
 *                   enum: [token, proxy, local-dev]
 *                 permissionTier:
 *                   type: string
 *                   enum: [admin, manager, user]
 *                 impersonating:
 *                   type: boolean
 *                   description: Present and true when X-Impersonate-Uid header is active
 *                 realAdmin:
 *                   type: string
 *                   format: email
 *                   description: The real admin's email (only present during impersonation)
 */
app.get('/api/whoami', function(req, res) {
  // For proxy-authenticated users, try to get display name from headers
  let displayName = req.userEmail;
  if (req.authMethod !== 'token') {
    const preferred = req.headers['x-forwarded-preferred-username'];
    const user = req.headers['x-forwarded-user'];
    const email = req.headers['x-forwarded-email'];
    displayName = preferred || user || email || req.userEmail;
  }

  const response = {
    email: req.userEmail,
    displayName,
    isAdmin: req.isAdmin,
    isTeamAdmin: req.isTeamAdmin || false,
    roles: roleStore.getRoles(req.userEmail),
    permissionTier: req.permissionTier || (req.isAdmin ? 'admin' : 'user'),
    authMethod: req.authMethod || (req.headers['x-forwarded-email'] ? 'proxy' : 'local-dev')
  };

  if (req.isImpersonating) {
    response.impersonating = true;
    response.realAdmin = req.realAdminEmail;
    if (req.impersonatedDisplayName) response.displayName = req.impersonatedDisplayName;
  }

  res.json(response);
});

// ─── Helpers ───

/** Validate a domain name per RFC 1123: labels separated by dots, each 1-63 chars, alphanumeric + hyphen. */
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > 253) return false;
  if (domain.includes('@') || /\s/.test(domain)) return false;
  const labels = domain.split('.');
  if (labels.length < 1) return false;
  return labels.every(label =>
    label.length >= 1 && label.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

// ─── Routes: Site Config ───

/**
 * @openapi
 * /api/site-config:
 *   get:
 *     tags: [Config]
 *     summary: Get site configuration
 *     responses:
 *       200:
 *         description: Site configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 titlePrefix:
 *                   type: string
 *                 authEmailDomain:
 *                   type: string
 *                   description: Auth email domain for role matching (e.g. cluster.local)
 */
app.get('/api/site-config', function(req, res) {
  try {
    const config = readFromStorage('site-config.json') || {};
    res.json({
      titlePrefix: config.titlePrefix || '',
      authEmailDomain: config.authEmailDomain || ''
    });
  } catch (error) {
    console.error('Get site-config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/site-config:
 *   post:
 *     tags: [Config]
 *     summary: Update site configuration (admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titlePrefix:
 *                 type: string
 *                 maxLength: 100
 *               authEmailDomain:
 *                 type: string
 *                 maxLength: 253
 *                 description: Auth email domain for role matching (e.g. cluster.local)
 *     responses:
 *       200:
 *         description: Updated site configuration
 */
app.post('/api/site-config', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Configuration changes disabled in demo mode' });
    }
    const existing = readFromStorage('site-config.json') || {};
    const updates = {};

    // titlePrefix
    if (req.body.titlePrefix !== undefined) {
      if (typeof req.body.titlePrefix !== 'string' || req.body.titlePrefix.length > 100) {
        return res.status(400).json({ error: 'titlePrefix must be a string of 100 characters or fewer' });
      }
      updates.titlePrefix = req.body.titlePrefix;
    }

    // authEmailDomain
    if (req.body.authEmailDomain !== undefined) {
      const domain = req.body.authEmailDomain.trim().toLowerCase();
      if (domain && !isValidDomain(domain)) {
        return res.status(400).json({ error: 'authEmailDomain must be a valid domain name (no @ or whitespace, max 253 chars)' });
      }
      updates.authEmailDomain = domain;
    }

    const config = { ...existing, ...updates };
    writeToStorage('site-config.json', config);

    // Trigger role migration when authEmailDomain changes
    if (updates.authEmailDomain !== undefined && updates.authEmailDomain !== existing.authEmailDomain) {
      auditLog.appendAuditEntry({ readFromStorage, writeToStorage }, {
        action: 'config.authEmailDomain.change',
        actor: req.userEmail || 'unknown',
        entityType: 'config',
        entityId: 'site-config',
        field: 'authEmailDomain',
        oldValue: existing.authEmailDomain || '',
        newValue: updates.authEmailDomain,
        detail: `Auth email domain changed from "${existing.authEmailDomain || ''}" to "${updates.authEmailDomain}"`
      });

      roleStore.invalidateCache();
      const count = roleStore.migrateEmailDomains();
      if (count > 0) {
        console.log(`site-config: authEmailDomain changed, migrated ${count} role(s)`);
      }
    }

    res.json(config);
  } catch (error) {
    console.error('Save site-config error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: App-wide Messages ───

app.get('/api/messages', async function(req, res) {
  const userContext = {
    email: req.userEmail,
    uid: req.userUid,
    isAdmin: req.isAdmin,
    isTeamAdmin: req.isTeamAdmin,
    permissionTier: req.permissionTier
  };

  try {
    const computed = await messageRegistry.getMessages(userContext);

    // Merge stored messages
    const stored = readFromStorage('messages.json') || [];
    const all = [...computed, ...stored];

    res.json({ messages: all });
  } catch (err) {
    console.error('[messages] Aggregation failed:', err.message);
    res.json({ messages: [] });
  }
});

app.post('/api/admin/messages', requireAdmin, requireScope('admin:manage'), function(req, res) {
  const { type, text, link } = req.body || {};

  // Validate required fields
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required and must be a non-empty string' });
  }

  const allowedTypes = ['warning', 'info', 'error'];
  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${allowedTypes.join(', ')}` });
  }

  // Validate link shape if present
  if (link != null) {
    if (typeof link !== 'object' || typeof link.label !== 'string' || !link.label.trim()
        || typeof link.href !== 'string' || !link.href.trim()) {
      return res.status(400).json({ error: 'link must have non-empty string "label" and "href" properties' });
    }
    const SAFE_HREF = /^(https?:\/\/|#)/i;
    if (!SAFE_HREF.test(link.href.trim())) {
      return res.status(400).json({ error: 'link.href must be an http(s) or hash URL' });
    }
  }

  const id = `admin:${Date.now()}`;
  const message = {
    id,
    type,
    text: text.trim(),
    link: link ? { label: link.label.trim(), href: link.href.trim() } : null
  };

  const stored = readFromStorage('messages.json') || [];
  stored.push(message);
  writeToStorage('messages.json', stored);

  res.status(201).json(message);
});

app.delete('/api/admin/messages/:id', requireAdmin, requireScope('admin:manage'), function(req, res) {
  const stored = readFromStorage('messages.json') || [];
  const index = stored.findIndex(m => m.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }

  stored.splice(index, 1);
  writeToStorage('messages.json', stored);

  res.status(204).end();
});

// ─── Routes: Backups ───

const backup = require('../shared/server/backup');

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

// ─── Routes: Token Scopes Catalog ───

/**
 * @openapi
 * /api/token-scopes:
 *   get:
 *     tags: [Auth]
 *     summary: Get available token scope catalog
 *     description: Returns available scopes and presets for the UI. Requires authentication but no specific scope.
 *     responses:
 *       200:
 *         description: Scope catalog with presets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 scopes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       label:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                 presets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       label:
 *                         type: string
 *                       description:
 *                         type: string
 *                       scopes:
 *                         type: array
 *                         items:
 *                           type: string
 */
app.get('/api/token-scopes', function(req, res) {
  res.json({
    scopes: [
      { key: 'roster:read', label: 'Roster (Read)', description: 'Read roster and org data', category: 'Roster' },
      { key: 'roster:write', label: 'Roster (Write)', description: 'Trigger roster sync and refresh', category: 'Roster' },
      { key: 'metrics:read', label: 'Metrics (Read)', description: 'Read person/team metrics and trends', category: 'Metrics' },
      { key: 'metrics:write', label: 'Metrics (Write)', description: 'Refresh metrics', category: 'Metrics' },
      { key: 'github:read', label: 'GitHub (Read)', description: 'Read GitHub contribution data', category: 'GitHub' },
      { key: 'github:write', label: 'GitHub (Write)', description: 'Refresh GitHub data', category: 'GitHub' },
      { key: 'gitlab:read', label: 'GitLab (Read)', description: 'Read GitLab contribution data', category: 'GitLab' },
      { key: 'gitlab:write', label: 'GitLab (Write)', description: 'Refresh GitLab data', category: 'GitLab' },
      { key: 'team-tracker:read', label: 'Team Tracker (Read)', description: 'Read team structure, fields, snapshots', category: 'Team Tracker' },
      { key: 'team-tracker:write', label: 'Team Tracker (Write)', description: 'Mutate team structure, fields, snapshots', category: 'Team Tracker' },
      { key: 'releases:read', label: 'Releases (Read)', description: 'Read release planning, execution, and delivery data', category: 'Releases' },
      { key: 'releases:write', label: 'Releases (Write)', description: 'Mutate release planning, execution, and delivery data', category: 'Releases' },
      { key: 'ai-impact:read', label: 'AI Impact (Read)', description: 'Read AI impact data', category: 'AI Impact' },
      { key: 'ai-impact:write', label: 'AI Impact (Write)', description: 'Push/clear AI impact data', category: 'AI Impact' },
      { key: 'upstream-pulse:read', label: 'Upstream Pulse (Read)', description: 'Read upstream pulse data', category: 'Upstream Pulse' },
      { key: 'upstream-pulse:write', label: 'Upstream Pulse (Write)', description: 'Mutate upstream pulse data', category: 'Upstream Pulse' },
      { key: 'health-metrics:read', label: 'Health Metrics (Read)', description: 'Read health metrics data', category: 'Health Metrics' },
      { key: 'health-metrics:write', label: 'Health Metrics (Write)', description: 'Mutate health metrics data', category: 'Health Metrics' },
      { key: 'admin:manage', label: 'Admin', description: 'Admin-only shell operations', category: 'Admin' },
      { key: 'tokens:manage', label: 'Tokens', description: 'Manage own tokens (always implicitly granted)', category: 'Admin' }
    ],
    presets: [
      {
        key: 'read-only',
        label: 'Read Only',
        description: 'Read access to all data, no mutations',
        scopes: ['roster:read', 'metrics:read', 'github:read', 'gitlab:read',
                 'team-tracker:read', 'releases:read', 'ai-impact:read',
                 'upstream-pulse:read', 'health-metrics:read']
      },
      {
        key: 'full-access',
        label: 'Full Access',
        description: 'All scopes (same as no restrictions)',
        scopes: ['*']
      }
    ]
  });
});

// ─── Routes: API Tokens ───

/**
 * @openapi
 * /api/tokens:
 *   get:
 *     tags: [Auth]
 *     summary: List current user's API tokens
 *     responses:
 *       200:
 *         description: List of tokens (metadata only)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiToken'
 */
app.get('/api/tokens', blockDuringImpersonation, requireScope('tokens:manage'), function(req, res) {
  try {
    const tokens = apiTokens.listUserTokens(req.userEmail);
    res.json({ tokens });
  } catch (error) {
    console.error('List tokens error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/tokens:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new API token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               expiresIn:
 *                 type: string
 *                 enum: [30d, 90d, 1y]
 *                 nullable: true
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *                 description: Scope restrictions. Null or omitted for full access.
 *     responses:
 *       201:
 *         description: Token created (raw token shown only once)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 scopes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   nullable: true
 *                 expiresAt:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Scope escalation attempt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/tokens', blockDuringImpersonation, requireScope('tokens:manage'), async function(req, res) {
  try {
    const { name, expiresIn, scopes } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Token name is required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'Token name must be 100 characters or fewer' });
    }

    // Validate expiresIn
    if (expiresIn !== undefined && expiresIn !== null && !['30d', '90d', '1y'].includes(expiresIn)) {
      return res.status(400).json({ error: 'expiresIn must be one of: 30d, 90d, 1y, or null' });
    }

    // Scope escalation guard for token-authenticated requests
    if (req.authMethod === 'token') {
      const validated = scopes != null ? apiTokens.validateScopes(scopes) : null;
      const escalation = apiTokens.enforceTokenScopeCeiling(req.tokenScopes, validated);
      if (escalation) {
        return res.status(403).json({ error: escalation });
      }
    }

    const result = await apiTokens.createToken(req.userEmail, name.trim(), expiresIn || null, scopes !== undefined ? scopes : null);
    res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error.message && (error.message.includes('Invalid scopes') || error.message.includes('scopes must be'))) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Create token error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/tokens/{id}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke own API token
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token revoked
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.delete('/api/tokens/:id', blockDuringImpersonation, requireScope('tokens:manage'), async function(req, res) {
  try {
    const revoked = await apiTokens.revokeToken(req.params.id, req.userEmail);
    if (!revoked) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke token error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/tokens/{id}/scopes:
 *   patch:
 *     tags: [Auth]
 *     summary: Update scopes on own API token
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scopes]
 *             properties:
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated token record
 *       400:
 *         description: Invalid scopes
 *       403:
 *         description: Scope escalation or impersonation blocked
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.patch('/api/tokens/:id/scopes', blockDuringImpersonation, requireScope('tokens:manage'), async function(req, res) {
  try {
    const { scopes } = req.body;

    // Scope escalation guard for token-authenticated requests
    if (req.authMethod === 'token') {
      const validated = scopes != null ? apiTokens.validateScopes(scopes) : null;
      const escalation = apiTokens.enforceTokenScopeCeiling(req.tokenScopes, validated);
      if (escalation) {
        return res.status(403).json({ error: escalation });
      }
    }

    const updated = await apiTokens.updateTokenScopes(req.params.id, req.userEmail, scopes);
    if (!updated) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json(updated);
  } catch (error) {
    if (error.message && (error.message.includes('Invalid scopes') || error.message.includes('scopes must be'))) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Update token scopes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/tokens:
 *   get:
 *     tags: [Auth]
 *     summary: List all API tokens (admin)
 *     responses:
 *       200:
 *         description: All tokens (metadata only)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiToken'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
app.get('/api/admin/tokens', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    const tokens = apiTokens.listAllTokens();
    res.json({ tokens });
  } catch (error) {
    console.error('Admin list tokens error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/tokens/{id}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke any API token (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token revoked
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.delete('/api/admin/tokens/:id', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, async function(req, res) {
  try {
    const revoked = await apiTokens.adminRevokeToken(req.params.id);
    if (!revoked) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Admin revoke token error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/tokens/{id}/scopes:
 *   patch:
 *     tags: [Auth]
 *     summary: Update scopes on any API token (admin)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scopes]
 *             properties:
 *               scopes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Updated token record
 *       400:
 *         description: Invalid scopes
 *       403:
 *         description: Admin access required or scope escalation
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
app.patch('/api/admin/tokens/:id/scopes', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, async function(req, res) {
  try {
    const { scopes } = req.body;

    // Scope escalation guard for token-authenticated requests
    if (req.authMethod === 'token') {
      const validated = scopes != null ? apiTokens.validateScopes(scopes) : null;
      const escalation = apiTokens.enforceTokenScopeCeiling(req.tokenScopes, validated);
      if (escalation) {
        return res.status(403).json({ error: escalation });
      }
    }

    const updated = await apiTokens.updateTokenScopes(req.params.id, null, scopes);
    if (!updated) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json(updated);
  } catch (error) {
    if (error.message && (error.message.includes('Invalid scopes') || error.message.includes('scopes must be'))) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Admin update token scopes error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Allowlist ───

/**
 * @openapi
 * /api/allowlist:
 *   get:
 *     tags: [Allowlist]
 *     summary: Get the email allowlist
 *     responses:
 *       200:
 *         description: List of allowed emails
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AllowlistResponse'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.get('/api/allowlist', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    res.json({ emails: roleStore.getAdminEmails() });
  } catch (error) {
    console.error('Read allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/allowlist:
 *   post:
 *     tags: [Allowlist]
 *     summary: Add an email to the allowlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Updated allowlist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AllowlistResponse'
 *       400:
 *         description: Invalid email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Email already on allowlist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.post('/api/allowlist', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@') || normalized.indexOf('@') === 0 || normalized.indexOf('@') === normalized.length - 1) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (roleStore.hasRole(normalized, 'admin')) {
      return res.status(409).json({ error: 'Email is already on the allowlist' });
    }

    const result = roleStore.assignRole(normalized, 'admin', req.auditActor || req.userEmail);
    if (result.demo) return res.json(result);
    res.json({ emails: roleStore.getAdminEmails() });
  } catch (error) {
    console.error('Add to allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/allowlist/{email}:
 *   delete:
 *     tags: [Allowlist]
 *     summary: Remove an email from the allowlist
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Updated allowlist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AllowlistResponse'
 *       400:
 *         description: Cannot remove the last user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.delete('/api/allowlist/:email', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();

    if (!roleStore.hasRole(email, 'admin')) {
      return res.status(404).json({ error: 'Email not found on allowlist' });
    }

    const result = roleStore.revokeRole(email, 'admin', req.auditActor || req.userEmail);
    if (result.demo) return res.json(result);
    res.json({ emails: roleStore.getAdminEmails() });
  } catch (error) {
    if (error.message === 'Cannot remove the last admin') {
      return res.status(400).json({ error: 'Cannot remove the last user from the allowlist' });
    }
    console.error('Remove from allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Role Management ───

app.get('/api/roles/me', function(req, res) {
  res.json({ roles: roleStore.getRoles(req.userEmail) });
});

app.get('/api/roles', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    res.json({ assignments: roleStore.listAssignments() });
  } catch (error) {
    console.error('List roles error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/roles/assign', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
  try {
    const { email, role } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'role is required' });
    }
    const result = roleStore.assignRole(email, role, req.auditActor || req.userEmail);
    if (result.demo) return res.json(result);
    res.json(result);
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/roles/revoke', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
  try {
    const { email, role } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'role is required' });
    }
    const result = roleStore.revokeRole(email, role, req.auditActor || req.userEmail);
    if (result.demo) return res.json(result);
    res.json(result);
  } catch (error) {
    if (error.message === 'Cannot remove the last admin') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Revoke role error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ─── Routes: Git-Static Modules ───

/**
 * @openapi
 * /api/modules:
 *   get:
 *     tags: [Git-Static Modules]
 *     summary: List all git-static modules (public fields)
 *     responses:
 *       200:
 *         description: List of modules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 modules:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Public: list modules (display fields only)
app.get('/api/modules', function(req, res) {
  try {
    const config = modulesConfig.loadModulesConfig(storageModule) || { modules: [] };
    res.json({ modules: config.modules.map(modulesConfig.sanitizeForPublic) });
  } catch (error) {
    console.error('List modules error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Built-in Module Discovery ───
// Mount before GET /api/modules/:slug so nested module paths are handled by the module router.
// builtInModules is populated once via getDiscoveredModules() (see top of file).

const diagnosticsRegistry = {};
const messageRegistry = require('../shared/server/message-registry');

// Register backup staleness message provider (admin-only warning when latest backup > 48h old)
const BACKUP_STALE_HOURS = 48;
messageRegistry.registerProvider('backup-staleness', async function(userContext) {
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
const moduleContext = { storage: storageModule, requireAuth: authMiddleware, requireAdmin, requireTeamAdmin, requireReleaseManager, requireScope, roleStore, registerDiagnostics: null };

const persistedState = loadModuleState(storageModule);
// Persist defaults for any newly discovered modules at startup (not in GET handlers).
const startupState = Object.assign({}, persistedState);
let startupStateChanged = false;
for (const mod of builtInModules) {
  if (!Object.prototype.hasOwnProperty.call(startupState, mod.slug)) {
    startupState[mod.slug] = mod.defaultEnabled !== false;
    startupStateChanged = true;
  }
}
if (startupStateChanged) {
  saveModuleState(storageModule, startupState);
}
const effectiveState = getEffectiveState(builtInModules, startupState);
reconcileStartupState(builtInModules, effectiveState, storageModule);
const enabledSlugs = new Set(Object.entries(effectiveState).filter(([, v]) => v).map(([k]) => k));

const moduleRouters = createModuleRouters(builtInModules, moduleContext, enabledSlugs, diagnosticsRegistry, messageRegistry);

const ttRouter = moduleRouters['team-tracker'];
if (ttRouter && enabledSlugs.has('team-tracker')) {
  const LEGACY_FORWARDS = {
    '/api/roster': '/roster',
    '/api/roster-sync': '/roster-sync',
    '/api/person': '/person',
    '/api/people': '/people',
    '/api/team': '/team',
    '/api/github': '/github',
    '/api/gitlab': '/gitlab',
    '/api/trends': '/trends',
    '/api/sprints': '/sprints',
    '/api/boards': '/boards',
    '/api/dashboard-summary': '/dashboard-summary',
    '/api/last-refreshed': '/last-refreshed',
    '/api/refresh': '/refresh',
    '/api/jira-name-cache': '/jira-name-cache',
    '/api/teams': '/teams',
    '/api/trend': '/trend',
    '/api/admin/roster-sync': '/admin/roster-sync',
    '/api/admin/jira-sync': '/admin/jira-sync',
    '/api/modules/allocation-tracker/refresh': '/allocation/refresh',
    '/api/modules/allocation-tracker/refresh/status': '/allocation/refresh/status',
    '/api/modules/allocation-tracker/classify': '/allocation/classify',
  };

  for (const [legacyPath, modulePath] of Object.entries(LEGACY_FORWARDS)) {
    app.use(legacyPath, function(req, res, next) {
      req.url = modulePath + req.url;
      ttRouter(req, res, next);
    });
  }
}

mountModuleRouters(app, builtInModules, moduleRouters);

// ─── Health Metrics (core feature, not a module) ───
const { createHealthMetricsRouter } = require('./health-metrics/routes');
app.use('/api/health-metrics', createHealthMetricsRouter(moduleContext));

/**
 * @openapi
 * /api/modules/{slug}:
 *   get:
 *     tags: [Git-Static Modules]
 *     summary: Get a single git-static module (public fields)
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Public: get single module (display fields only)
app.get('/api/modules/:slug', function(req, res) {
  try {
    const mod = modulesConfig.getModule(storageModule, req.params.slug);
    if (!mod) {
      return res.status(404).json({ error: `Module "${req.params.slug}" not found` });
    }
    res.json(modulesConfig.sanitizeForPublic(mod));
  } catch (error) {
    console.error('Get module error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules:
 *   get:
 *     tags: [Git-Static Modules]
 *     summary: List all git-static modules (admin, includes git fields)
 *     responses:
 *       200:
 *         description: List of modules with admin details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 modules:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: list modules (with git fields, masked tokens)
app.get('/api/admin/modules', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    const config = modulesConfig.loadModulesConfig(storageModule) || { modules: [] };
    res.json({ modules: config.modules.map(modulesConfig.sanitizeForAdmin) });
  } catch (error) {
    console.error('Admin list modules error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules:
 *   post:
 *     tags: [Git-Static Modules]
 *     summary: Register a new git-static module
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Module created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: register new module
app.post('/api/admin/modules', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    const result = modulesConfig.addModule(storageModule, req.body);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    invalidateStaticCache(result.module.slug);
    res.status(201).json(modulesConfig.sanitizeForAdmin(result.module));
  } catch (error) {
    console.error('Add module error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules/{slug}:
 *   put:
 *     tags: [Git-Static Modules]
 *     summary: Update a git-static module
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated module
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: update module
app.put('/api/admin/modules/:slug', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    const result = modulesConfig.updateModule(storageModule, req.params.slug, req.body);
    if (result.error) {
      const status = result.error.includes('not found') ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    invalidateStaticCache(req.params.slug);
    res.json(modulesConfig.sanitizeForAdmin(result.module));
  } catch (error) {
    console.error('Update module error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules/{slug}:
 *   delete:
 *     tags: [Git-Static Modules]
 *     summary: Remove a git-static module
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: remove module
app.delete('/api/admin/modules/:slug', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    const result = modulesConfig.removeModule(storageModule, req.params.slug);
    if (result.error) {
      const status = result.error.includes('not found') ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    invalidateStaticCache(req.params.slug);
    res.json({ success: true });
  } catch (error) {
    console.error('Remove module error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules/{slug}/sync:
 *   post:
 *     tags: [Git-Static Modules]
 *     summary: Trigger sync for a single git-static module
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sync started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: started
 *                 slug:
 *                   type: string
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Sync already in progress
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: sync one module
app.post('/api/admin/modules/:slug/sync', requireAdmin, requireScope('admin:manage'), async function(req, res) {
  try {
    const mod = modulesConfig.getModule(storageModule, req.params.slug);
    if (!mod) {
      return res.status(404).json({ error: `Module "${req.params.slug}" not found` });
    }
    if (gitSync.isSyncing(req.params.slug)) {
      return res.status(409).json({ error: 'Sync already in progress for this module' });
    }
    // Start sync in background
    gitSync.syncModule(storageModule, mod).then(function(result) {
      invalidateStaticCache(req.params.slug);
      console.log(`[module-sync] On-demand sync for ${req.params.slug}:`, result.status);
    }).catch(function(err) {
      console.error(`[module-sync] On-demand sync error for ${req.params.slug}:`, err.message);
    });
    res.json({ status: 'started', slug: req.params.slug });
  } catch (error) {
    console.error('Sync module error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules/sync:
 *   post:
 *     tags: [Git-Static Modules]
 *     summary: Trigger sync for all git-static modules
 *     responses:
 *       200:
 *         description: Sync started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: started
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: sync all git-static modules
app.post('/api/admin/modules/sync', requireAdmin, requireScope('admin:manage'), async function(req, res) {
  try {
    // Start sync in background
    gitSync.syncAllModules(storageModule).then(function(result) {
      for (const r of result.results) {
        invalidateStaticCache(r.slug);
      }
      console.log(`[module-sync] Sync all complete: ${result.results.length} modules`);
    }).catch(function(err) {
      console.error('[module-sync] Sync all error:', err.message);
    });
    res.json({ status: 'started' });
  } catch (error) {
    console.error('Sync all modules error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules/sync/status:
 *   get:
 *     tags: [Git-Static Modules]
 *     summary: Get sync status for all git-static modules
 *     responses:
 *       200:
 *         description: Sync status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: get sync status
app.get('/api/admin/modules/sync/status', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    res.json(gitSync.getSyncStatus(storageModule));
  } catch (error) {
    console.error('Module sync status error:', error);
    res.status(500).json({ error: error.message });
  }
});

const { handleExport } = require('./export');

// Rate limiter for expensive export endpoints (per-user, 5 requests per 10 minutes)
const EXPORT_RATE_MAX = 5;
const EXPORT_RATE_WINDOW_MS = 10 * 60_000;
const exportRateCounts = new Map();

function exportRateLimit(req, res, next) {
  const email = req.userEmail;
  const now = Date.now();
  const entry = exportRateCounts.get(email);
  if (!entry || now - entry.windowStart >= EXPORT_RATE_WINDOW_MS) {
    exportRateCounts.set(email, { windowStart: now, count: 1 });
    return next();
  }
  entry.count++;
  if (entry.count > EXPORT_RATE_MAX) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }
  return next();
}

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
app.get('/api/export/test-data', requireAdmin, requireScope('admin:manage'), exportRateLimit, function(req, res) {
  handleExport(req, res, storageModule, builtInModules);
});

// ─── Must-Gather: Diagnostic data download ───

const mustGather = require('./must-gather');

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
app.get('/api/must-gather', requireAdmin, requireScope('admin:manage'), exportRateLimit, async function(req, res) {
  try {
    const redact = req.query.redact === 'aggressive' ? 'aggressive' : 'minimal';
    const bundle = await mustGather.collect({
      storageModule,
      builtInModules,
      enabledSlugs,
      collectModuleDiagnostics,
      diagnosticsRegistry,
      gitSync,
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

// ─── Built-in Module Admin Endpoints ───

/**
 * @openapi
 * /api/admin/modules/state:
 *   get:
 *     tags: [Built-in Modules]
 *     summary: Get all built-in modules with enable/disable state
 *     responses:
 *       200:
 *         description: Built-in module states
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 modules:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       slug:
 *                         type: string
 *                       name:
 *                         type: string
 *                       enabled:
 *                         type: boolean
 *                       requiredBy:
 *                         type: array
 *                         items:
 *                           type: string
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: get all built-in modules with state
app.get('/api/admin/modules/state', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    const discovered = builtInModules;
    const currentState = loadModuleState(storageModule);
    const effective = getEffectiveState(discovered, currentState);
    const requiredBy = computeRequiredBy(discovered);

    const modules = discovered.map(function(mod) {
      return {
        slug: mod.slug,
        name: mod.name,
        description: mod.description,
        icon: mod.icon,
        order: mod.order,
        requires: mod.requires,
        defaultEnabled: mod.defaultEnabled,
        enabled: effective[mod.slug],
        requiredBy: requiredBy[mod.slug] || []
      };
    });

    res.json({ modules });
  } catch (error) {
    console.error('Get built-in module state error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules/{slug}/enable:
 *   post:
 *     tags: [Built-in Modules]
 *     summary: Enable a built-in module
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module enabled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabled:
 *                   type: array
 *                   items:
 *                     type: string
 *                 autoEnabled:
 *                   type: array
 *                   items:
 *                     type: string
 *                 restartRequired:
 *                   type: boolean
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: enable a built-in module
app.post('/api/admin/modules/:slug/enable', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Module state changes disabled in demo mode' });
    }

    const slug = req.params.slug;
    const discovered = builtInModules;
    const mod = discovered.find(function(m) { return m.slug === slug; });
    if (!mod) {
      return res.status(404).json({ error: `Module "${slug}" not found` });
    }

    const currentState = loadModuleState(storageModule);
    const effective = getEffectiveState(discovered, currentState);

    if (effective[slug]) {
      return res.json({ enabled: [slug], autoEnabled: [], restartRequired: false });
    }

    const result = resolveEnableOrder(slug, discovered, effective);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Enable all required modules
    for (const s of result.toEnable) {
      currentState[s] = true;
    }
    saveModuleState(storageModule, currentState);

    const restartRequired = result.toEnable.some(function(s) { return !wasMountedAtStartup(s); });

    res.json({
      enabled: result.toEnable,
      autoEnabled: result.autoEnabled,
      restartRequired: restartRequired
    });
  } catch (error) {
    console.error('Enable module error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/admin/modules/{slug}/disable:
 *   post:
 *     tags: [Built-in Modules]
 *     summary: Disable a built-in module
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module disabled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disabled:
 *                   type: string
 *       400:
 *         description: Cannot disable - required by other modules
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Admin: disable a built-in module
app.post('/api/admin/modules/:slug/disable', requireAdmin, requireScope('admin:manage'), function(req, res) {
  try {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Module state changes disabled in demo mode' });
    }

    const slug = req.params.slug;
    const discovered = builtInModules;
    const mod = discovered.find(function(m) { return m.slug === slug; });
    if (!mod) {
      return res.status(404).json({ error: `Module "${slug}" not found` });
    }

    const currentState = loadModuleState(storageModule);
    const effective = getEffectiveState(discovered, currentState);

    if (!effective[slug]) {
      return res.json({ disabled: slug });
    }

    const check = checkDisableAllowed(slug, discovered, effective);
    if (!check.allowed) {
      return res.status(400).json({
        error: `Cannot disable "${slug}": required by ${check.blockedBy.join(', ')}`,
        blockedBy: check.blockedBy
      });
    }

    currentState[slug] = false;
    saveModuleState(storageModule, currentState);

    res.json({ disabled: slug });
  } catch (error) {
    console.error('Disable module error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @openapi
 * /api/built-in-modules/state:
 *   get:
 *     tags: [Built-in Modules]
 *     summary: Get enabled built-in module slugs (public)
 *     responses:
 *       200:
 *         description: List of enabled module slugs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 enabledSlugs:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// Public (auth required): get enabled built-in module slugs
app.get('/api/built-in-modules/state', function(req, res) {
  try {
    const currentState = loadModuleState(storageModule);
    const effective = getEffectiveState(builtInModules, currentState);
    const enabledList = Object.entries(effective)
      .filter(function(entry) { return entry[1]; })
      .map(function(entry) { return entry[0]; });

    res.json({ enabledSlugs: enabledList });
  } catch (error) {
    console.error('Get enabled built-in modules error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Static Module Content Serving ───

app.use('/modules', createModuleStaticMiddleware(storageModule));

// CORS preflight
app.options('/api/{*path}', function(req, res) { res.status(200).end(); });

// ─── Start ───

// Warn if AUTH_EMAIL_DOMAIN is set but invalid
if (process.env.AUTH_EMAIL_DOMAIN) {
  const envDomain = process.env.AUTH_EMAIL_DOMAIN.trim().toLowerCase();
  if (!isValidDomain(envDomain)) {
    console.warn(`WARNING: AUTH_EMAIL_DOMAIN="${process.env.AUTH_EMAIL_DOMAIN}" is not a valid domain name. Role email normalization may not work correctly.`);
  }
}

seedRoles();
roleStore.migrateEmailDomains();
modulesConfig.seedIfMissing(storageModule);

// Start daily module sync
if (!DEMO_MODE) {
  gitSync.scheduleDaily(storageModule);
}

app.listen(PORT, function() {
  console.log(`\nPeople & Teams dev server running at http://localhost:${PORT}`);
  console.log(`Jira host: ${process.env.JIRA_HOST || 'https://redhat.atlassian.net'}`);
  console.log(`Local storage: ./data/`);
  console.log(`JIRA_TOKEN: ${process.env.JIRA_TOKEN ? 'set' : 'NOT SET (refresh will fail)'}`);
  console.log(`JIRA_EMAIL: ${process.env.JIRA_EMAIL ? 'set' : 'NOT SET (refresh will fail)'}\n`);
});
