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
 *
 * Can also be consumed as a library:
 *   const { startServer } = require('./dev-server');
 *   startServer({ dataDir: '/path/to/data', modulePaths: [...] });
 */

const path = require('path');
const express = require('express');
const compression = require('compression');
const errorBuffer = require('./error-buffer');
const requestTracker = require('./request-tracker');

// Route registrars
const { registerPreAuthRoutes, registerPostAuthRoutes, isValidDomain } = require('./routes/health');
const registerAdminRoutes = require('./routes/admin');
const registerTokenRoutes = require('./routes/tokens');
const registerRoleRoutes = require('./routes/roles');
const registerModuleManagementRoutes = require('./routes/module-management');

// Install error buffer early to capture startup errors
errorBuffer.install();

async function startServer(options = {}) {
  const {
    dataDir = path.join(__dirname, '..', 'data'),
    fixturesDirs = [path.join(__dirname, '..', 'fixtures')],
    modulePaths = [path.join(__dirname, '..', 'modules')],
    platformPaths = [path.join(__dirname, '..', 'platform')],
    port = process.env.API_PORT || 3001,
  } = options;

  // Demo mode: use fixtures instead of data directory
  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  // Initialize storage with configured paths BEFORE loading any consumer modules
  const storageModule = DEMO_MODE ? require('../shared/server/demo-storage') : require('../shared/server/storage');

  if (DEMO_MODE) {
    storageModule.initDemoStorage({ fixturesDirs });
  } else {
    storageModule.initStorage({ dataDir });
  }

  const { readFromStorage, writeToStorage } = storageModule;
  const { createAuthMiddleware, proxySecretGuard, blockDuringImpersonation } = require('../shared/server/auth');
  const { createRoleStore } = require('../shared/server/role-store');
  const { createRoleRegistry } = require('../shared/server/role-registry');
  const { createScopeRegistry } = require('../shared/server/scope-registry');
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

  const { SecretRegistry } = require('../shared/server/secret-registry');
  const platformSecretGroups = require('../shared/server/platform-secrets');
  const { loadAllocationStrategy } = require('./platform-loader');

  // ─── Module Discovery ───

  const builtInModules = getDiscoveredModules(modulePaths);

  // ─── Secret Registry ───

  const secretRegistry = new SecretRegistry(platformSecretGroups);
  for (const mod of builtInModules) {
    if (mod.secrets) {
      secretRegistry.registerModuleSecrets(mod.slug, mod.secrets);
    }
  }
  secretRegistry.resolve();

  // ─── Platform Secret Validators ───

  secretRegistry.registerValidator('JIRA_TOKEN', async () => {
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_TOKEN;
    if (!email || !token) return { valid: false, message: 'JIRA_EMAIL or JIRA_TOKEN not configured' };
    const host = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    const res = await fetch(`${host}/rest/api/2/myself`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' }
    });
    if (!res.ok) return { valid: false, message: `Jira auth failed (${res.status})` };
    const data = await res.json();
    return { valid: true, message: `Authenticated as ${data.displayName || data.emailAddress}` };
  });

  const githubAppToken = require('../shared/server/github-app-token');
  githubAppToken.init().catch(function(err) {
    console.error('[github-app-token] Startup init error:', err.message);
  });

  secretRegistry.registerValidator('GITHUB_TOKEN', async () => {
    if (githubAppToken.isAppMode()) {
      const token = githubAppToken.getTokenSync();
      if (!token) return { valid: false, message: 'GitHub App token not generated' };
      const res = await fetch('https://api.github.com/rate_limit', {
        headers: { Authorization: `token ${token}`, Accept: 'application/json' }
      });
      if (!res.ok) return { valid: false, message: `GitHub App auth failed (${res.status})` };
      return { valid: true, message: 'GitHub App installation token active' };
    }
    const token = process.env.GITHUB_TOKEN;
    if (!token) return { valid: false, message: 'GITHUB_TOKEN not configured' };
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, Accept: 'application/json' }
    });
    if (!res.ok) return { valid: false, message: `GitHub auth failed (${res.status})` };
    const data = await res.json();
    return { valid: true, message: `Authenticated as ${data.login}` };
  });

  secretRegistry.registerValidator('GITLAB_TOKEN', async () => {
    const token = process.env.GITLAB_TOKEN;
    if (!token) return { valid: false, message: 'GITLAB_TOKEN not configured' };
    const host = process.env.GITLAB_BASE_URL || 'https://gitlab.com';
    const res = await fetch(`${host}/api/v4/user`, {
      headers: { 'PRIVATE-TOKEN': token, Accept: 'application/json' }
    });
    if (!res.ok) return { valid: false, message: `GitLab auth failed (${res.status})` };
    const data = await res.json();
    return { valid: true, message: `Authenticated as ${data.username}` };
  });

  secretRegistry.registerValidator('IPA_BIND_DN', async () => {
    const bindDn = process.env.IPA_BIND_DN;
    const bindPassword = process.env.IPA_BIND_PASSWORD;
    if (!bindDn || !bindPassword) return { valid: false, message: 'IPA_BIND_DN or IPA_BIND_PASSWORD not configured' };
    const { createIpaClient } = require('../shared/server/roster-sync/ipa-client');
    const ipa = createIpaClient({ bindDn, bindPassword });
    const result = await ipa.testConnection();
    return { valid: result.ok, message: result.message };
  });

  secretRegistry.registerValidator('GOOGLE_SERVICE_ACCOUNT_KEY_FILE', async () => {
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '/etc/secrets/google-sa-key.json';
    const fs = require('fs');
    if (!fs.existsSync(keyFile)) return { valid: false, message: `Key file not found at ${keyFile}` };
    try {
      const { createGoogleSheetsClient } = require('../shared/server/google-sheets');
      createGoogleSheetsClient({ keyFile });
      return { valid: true, message: `Key file found at ${keyFile}` };
    } catch (err) {
      return { valid: false, message: err.message };
    }
  });

  if (DEMO_MODE) {
    console.log('Running in DEMO MODE - using fixture data, Jira/GitHub APIs disabled');
  }

  // ─── Registries ───

  const roleRegistry = createRoleRegistry();
  const scopeRegistry = createScopeRegistry();

  // Platform roles
  roleRegistry.register('admin', { label: 'Admin', description: 'Full platform access', module: 'platform' });
  roleRegistry.register('team-admin', { label: 'Team Admin', description: 'Team structure management', module: 'platform' });

  // Platform scopes
  const platformScopes = [
    { key: 'roster:read', label: 'Roster (Read)', description: 'Read roster and org data', category: 'Roster' },
    { key: 'roster:write', label: 'Roster (Write)', description: 'Trigger roster sync and refresh', category: 'Roster' },
    { key: 'metrics:read', label: 'Metrics (Read)', description: 'Read person/team metrics and trends', category: 'Metrics' },
    { key: 'metrics:write', label: 'Metrics (Write)', description: 'Refresh metrics', category: 'Metrics' },
    { key: 'github:read', label: 'GitHub (Read)', description: 'Read GitHub contribution data', category: 'GitHub' },
    { key: 'github:write', label: 'GitHub (Write)', description: 'Refresh GitHub data', category: 'GitHub' },
    { key: 'gitlab:read', label: 'GitLab (Read)', description: 'Read GitLab contribution data', category: 'GitLab' },
    { key: 'gitlab:write', label: 'GitLab (Write)', description: 'Refresh GitLab data', category: 'GitLab' },
    { key: 'admin:manage', label: 'Admin', description: 'Admin-only shell operations', category: 'Admin' },
    { key: 'tokens:manage', label: 'Tokens', description: 'Manage own tokens (always implicitly granted)', category: 'Admin' }
  ];
  for (const s of platformScopes) {
    scopeRegistry.register(s.key, { ...s, module: 'platform' });
  }

  // Health-metrics platform registrations
  roleRegistry.register('usage-metrics-viewer', {
    label: 'Usage Metrics Viewer',
    description: 'Can view health/usage metrics dashboards',
    module: 'health-metrics'
  });
  scopeRegistry.register('health-metrics:read', { label: 'Health Metrics (Read)', description: 'Read health metrics data', category: 'Health Metrics', module: 'health-metrics' });
  scopeRegistry.register('health-metrics:write', { label: 'Health Metrics (Write)', description: 'Mutate health metrics data', category: 'Health Metrics', module: 'health-metrics' });

  // Initialize API token store with scope registry
  // Scope migration map for renaming old module scopes to new unified names.
  // These are module-specific and will move to the consuming repo post-split.
  const scopeMigrationMap = {
    'feature-traffic:read': 'releases:read',
    'feature-traffic:write': 'releases:write',
    'release-analysis:read': 'releases:read',
    'release-analysis:write': 'releases:write',
    'release-planning:read': 'releases:read',
    'release-planning:write': 'releases:write',
  };
  apiTokens.init(storageModule, { scopeRegistry, scopeMigrationMap });

  const PORT = port;

  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // Session middleware
  const session = require('express-session');
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production-' + Date.now(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 90 * 24 * 60 * 60 * 1000
    }
  }));

  // Enable CORS
  app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    next();
  });

  // Request tracker middleware
  app.use(requestTracker.createMiddleware());

  // Proxy secret guard
  app.use(function(req, res, next) {
    proxySecretGuard(req, res, next, { tokenValidator: apiTokens });
  });

  // Demo mode: block refresh and token routes
  if (DEMO_MODE) {
    app.use(function(req, res, next) {
      if (req.method === 'POST' && req.path.includes('refresh')) {
        return res.json({
          status: 'skipped',
          message: 'Refresh disabled in demo mode - using fixture data'
        });
      }
      if (req.method === 'POST' && req.path === '/api/tokens') {
        return res.status(403).json({
          status: 'skipped',
          message: 'Token creation disabled in demo mode'
        });
      }
      if (req.method === 'PATCH' && req.path.match(/^\/api\/(admin\/)?tokens\/[^/]+\/scopes$/)) {
        return res.status(403).json({
          status: 'skipped',
          message: 'Token scope editing disabled in demo mode'
        });
      }
      next();
    });
  }

  // ─── Auth ───

  const roleStore = createRoleStore(readFromStorage, writeToStorage, {
    getAuthDomain: () => {
      if (process.env.AUTH_EMAIL_DOMAIN) {
        return process.env.AUTH_EMAIL_DOMAIN.trim().toLowerCase();
      }
      const config = readFromStorage('site-config.json');
      return config?.authEmailDomain || null;
    },
    roleRegistry
  });
  const { authMiddleware, requireAuth, requireAdmin, requireTeamAdmin, requireRole, requireScope, seedRoles } = createAuthMiddleware(readFromStorage, writeToStorage, {
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

  // ─── Registries for module system ───

  const diagnosticsRegistry = {};
  const messageRegistry = require('../shared/server/message-registry');
  const { createRefreshRegistry } = require('../shared/server/refresh-registry');
  const { createExportRegistry } = require('../shared/server/export-registry');
  const refreshRegistry = createRefreshRegistry(storageModule);
  const exportRegistry = createExportRegistry();

  // Rate limiter for expensive export endpoints
  const EXPORT_RATE_MAX = 5;
  const EXPORT_RATE_WINDOW_MS = 10 * 60_000;
  const exportRateCounts = new Map();

  setInterval(function() {
    const now = Date.now();
    for (const [key, value] of exportRateCounts.entries()) {
      if (now - value.windowStart >= EXPORT_RATE_WINDOW_MS) {
        exportRateCounts.delete(key);
      }
    }
  }, 60_000).unref();

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

  // ─── Route context (shared by all route registrars) ───

  const routeContext = {
    storage: storageModule,
    requireAuth,
    requireAdmin,
    requireTeamAdmin,
    requireRole,
    requireScope,
    blockDuringImpersonation,
    roleStore,
    roleRegistry,
    scopeRegistry,
    secretRegistry,
    refreshRegistry,
    diagnosticsRegistry,
    exportRegistry,
    messageRegistry,
    apiTokens,
    builtInModules,
    enabledSlugs: null, // set after module state resolution
    modulesConfig,
    gitSync,
    invalidateStaticCache,
    collectModuleDiagnostics,
    exportRateLimit,
    DEMO_MODE,
    // Module loader functions
    loadModuleState,
    saveModuleState,
    getEffectiveState,
    resolveEnableOrder,
    checkDisableAllowed,
    computeRequiredBy,
    wasMountedAtStartup,
  };

  // Pre-auth routes (healthz, manifests)
  registerPreAuthRoutes(app, routeContext);

  // Auth middleware
  app.use(authMiddleware);

  // Post-auth routes
  registerPostAuthRoutes(app, routeContext);
  registerTokenRoutes(app, routeContext);
  registerRoleRoutes(app, routeContext);

  // ─── Platform extension loading ───

  const allocationStrategy = loadAllocationStrategy(platformPaths);
  if (allocationStrategy) {
    console.log(`[platform] Loaded allocation strategy: ${allocationStrategy.name} (${allocationStrategy.id})`);
  } else {
    console.log('[platform] No allocation strategy found — allocation features will be hidden');
  }

  // ─── Module State ───

  const coreServices = { storage: storageModule, requireAuth: authMiddleware, requireAdmin, requireTeamAdmin, requireRole, requireScope, roleStore, roleRegistry, scopeRegistry, secretRegistry, allocationStrategy };
  const registries = { diagnostics: diagnosticsRegistry, messages: messageRegistry, refresh: refreshRegistry, exports: exportRegistry };

  const persistedState = loadModuleState(storageModule);
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

  // Update route context with resolved enabledSlugs
  routeContext.enabledSlugs = enabledSlugs;

  // ─── One-time migration: AI Impact features → unified releases store ───
  // Runs BEFORE module routers. Wrapped in try/catch so core can run standalone
  // even without the releases module installed.
  (function migrateAiFeaturesToUnifiedStore() {
    const FLAG_KEY = 'migrations/ai-features-unified';
    if (storageModule.readFromStorage(FLAG_KEY)) return;

    const legacyData = storageModule.readFromStorage('ai-impact/features.json');
    if (!legacyData || !legacyData.features || Object.keys(legacyData.features).length === 0) {
      storageModule.writeToStorage(FLAG_KEY, { migratedAt: new Date().toISOString(), count: 0 });
      return;
    }

    console.log('[migration] Migrating AI Impact features to unified releases store...');
    const keys = Object.keys(legacyData.features);
    let migrated = 0;

    for (const key of keys) {
      const entry = legacyData.features[key];
      if (!entry || !entry.latest) continue;

      const featurePath = 'releases/execution/features/' + key + '.json';
      const existing = storageModule.readFromStorage(featurePath);

      if (existing && existing.aiReview) continue;

      const aiReview = {
        ...entry.latest,
        history: entry.history || []
      };
      delete aiReview.key;

      if (existing) {
        existing.aiReview = aiReview;
        storageModule.writeToStorage(featurePath, existing);
      } else {
        storageModule.writeToStorage(featurePath, {
          key,
          summary: entry.latest.title || '',
          aiReview,
          _sources: { aiReview: new Date().toISOString() }
        });
      }
      migrated++;
    }

    if (migrated > 0) {
      try {
        const { rebuildIndex } = require('../modules/releases/server/execution/feature-store');
        rebuildIndex(storageModule);
        console.log(`[migration] Migrated ${migrated} AI Impact features, index rebuilt.`);
      } catch (err) {
        console.log(`[migration] Migrated ${migrated} AI Impact features (index rebuild deferred to next refresh): ${err.message}`);
      }
    }

    storageModule.writeToStorage(FLAG_KEY, {
      migratedAt: new Date().toISOString(),
      count: migrated,
      totalLegacy: keys.length
    });
  })();

  // ─── Module Routers ───

  const moduleRouters = createModuleRouters(builtInModules, coreServices, enabledSlugs, registries);

  // Legacy forwards for team-tracker
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
  const hmDataRoot = storageModule.DATA_DIR || storageModule.FIXTURES_DIR;
  const eventsDir = path.join(hmDataRoot, 'health-metrics', 'events');
  app.use('/api/health-metrics', createHealthMetricsRouter(coreServices, { eventsDir }));

  // ─── Admin & Module Management routes (after module routers to avoid conflicts) ───

  registerAdminRoutes(app, routeContext);
  registerModuleManagementRoutes(app, routeContext);

  // ─── Static Module Content Serving ───

  app.use('/modules', createModuleStaticMiddleware(storageModule));

  // CORS preflight
  app.options('/api/{*path}', function(req, res) { res.status(200).end(); });

  // ─── Start ───

  if (process.env.AUTH_EMAIL_DOMAIN) {
    const envDomain = process.env.AUTH_EMAIL_DOMAIN.trim().toLowerCase();
    if (!isValidDomain(envDomain)) {
      console.warn(`WARNING: AUTH_EMAIL_DOMAIN="${process.env.AUTH_EMAIL_DOMAIN}" is not a valid domain name. Role email normalization may not work correctly.`);
    }
  }

  seedRoles();
  roleStore.migrateEmailDomains();
  modulesConfig.seedIfMissing(storageModule);

  if (!DEMO_MODE) {
    gitSync.scheduleDaily(storageModule);
  }

  return new Promise(function(resolve) {
    const server = app.listen(PORT, function() {
      console.log(`\nPeople & Teams dev server running at http://localhost:${PORT}`);
      console.log(`Jira host: ${process.env.JIRA_HOST || 'https://redhat.atlassian.net'}`);
      console.log(`Local storage: ${dataDir}\n`);
      resolve(server);
    });
  });
}

module.exports = { startServer };

// When run directly (core standalone):
if (require.main === module) {
  startServer();
}
