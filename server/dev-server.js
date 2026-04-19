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
const { createAuthMiddleware, proxySecretGuard } = require('../shared/server/auth');
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
app.use(express.json());

// Enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
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
    next();
  });
}

// ─── Auth (from shared package) ───

const { authMiddleware, requireAdmin, seedAdminList } = createAuthMiddleware(readFromStorage, writeToStorage, {
  tokenValidator: apiTokens
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
  res.json({
    email: req.userEmail,
    displayName,
    isAdmin: req.isAdmin,
    authMethod: req.authMethod || (req.headers['x-forwarded-email'] ? 'proxy' : 'local-dev')
  });
});

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
 */
app.get('/api/site-config', function(req, res) {
  try {
    const config = readFromStorage('site-config.json') || { titlePrefix: '' };
    res.json({ titlePrefix: config.titlePrefix || '' });
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
 *     responses:
 *       200:
 *         description: Updated site configuration
 */
app.post('/api/site-config', requireAdmin, function(req, res) {
  try {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Configuration changes disabled in demo mode' });
    }
    const { titlePrefix } = req.body;
    if (typeof titlePrefix !== 'string' || titlePrefix.length > 100) {
      return res.status(400).json({ error: 'titlePrefix must be a string of 100 characters or fewer' });
    }
    const config = { titlePrefix };
    writeToStorage('site-config.json', config);
    res.json(config);
  } catch (error) {
    console.error('Save site-config error:', error);
    res.status(500).json({ error: error.message });
  }
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
app.get('/api/tokens', function(req, res) {
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
 *                 expiresAt:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
app.post('/api/tokens', async function(req, res) {
  try {
    const { name, expiresIn } = req.body;

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

    const result = await apiTokens.createToken(req.userEmail, name.trim(), expiresIn || null);
    res.status(201).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
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
app.delete('/api/tokens/:id', async function(req, res) {
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
app.get('/api/admin/tokens', requireAdmin, function(req, res) {
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
app.delete('/api/admin/tokens/:id', requireAdmin, async function(req, res) {
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
app.get('/api/allowlist', requireAdmin, function(req, res) {
  try {
    const data = readFromStorage('allowlist.json') || { emails: [] };
    res.json({ emails: data.emails });
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
app.post('/api/allowlist', requireAdmin, function(req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@') || normalized.indexOf('@') === 0 || normalized.indexOf('@') === normalized.length - 1) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const data = readFromStorage('allowlist.json') || { emails: [] };
    if (data.emails.includes(normalized)) {
      return res.status(409).json({ error: 'Email is already on the allowlist' });
    }

    data.emails.push(normalized);
    writeToStorage('allowlist.json', data);
    res.json({ emails: data.emails });
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
app.delete('/api/allowlist/:email', requireAdmin, function(req, res) {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const data = readFromStorage('allowlist.json') || { emails: [] };

    if (!data.emails.includes(email)) {
      return res.status(404).json({ error: 'Email not found on allowlist' });
    }

    if (data.emails.length <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last user from the allowlist' });
    }

    data.emails = data.emails.filter(e => e !== email);
    writeToStorage('allowlist.json', data);
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Remove from allowlist error:', error);
    res.status(500).json({ error: error.message });
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
const moduleContext = { storage: storageModule, requireAuth: authMiddleware, requireAdmin, registerDiagnostics: null };

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

const moduleRouters = createModuleRouters(builtInModules, moduleContext, enabledSlugs, diagnosticsRegistry);

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
  };

  for (const [legacyPath, modulePath] of Object.entries(LEGACY_FORWARDS)) {
    app.use(legacyPath, function(req, res, next) {
      req.url = modulePath + req.url;
      ttRouter(req, res, next);
    });
  }
}

mountModuleRouters(app, builtInModules, moduleRouters);

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
app.get('/api/admin/modules', requireAdmin, function(req, res) {
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
app.post('/api/admin/modules', requireAdmin, function(req, res) {
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
app.put('/api/admin/modules/:slug', requireAdmin, function(req, res) {
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
app.delete('/api/admin/modules/:slug', requireAdmin, function(req, res) {
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
app.post('/api/admin/modules/:slug/sync', requireAdmin, async function(req, res) {
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
app.post('/api/admin/modules/sync', requireAdmin, async function(req, res) {
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
app.get('/api/admin/modules/sync/status', requireAdmin, function(req, res) {
  try {
    res.json(gitSync.getSyncStatus(storageModule));
  } catch (error) {
    console.error('Module sync status error:', error);
    res.status(500).json({ error: error.message });
  }
});

const { handleExport } = require('./export');

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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.get('/api/export/test-data', requireAdmin, function(req, res) {
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
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
app.get('/api/must-gather', requireAdmin, async function(req, res) {
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
app.get('/api/admin/modules/state', requireAdmin, function(req, res) {
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
app.post('/api/admin/modules/:slug/enable', requireAdmin, function(req, res) {
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
app.post('/api/admin/modules/:slug/disable', requireAdmin, function(req, res) {
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

seedAdminList();
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
