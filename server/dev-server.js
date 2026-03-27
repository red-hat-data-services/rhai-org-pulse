/**
 * Team Tracker API server
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
const { createAuthMiddleware } = require('../shared/server/auth');

const modulesConfig = require('./modules/config');
const gitSync = require('./modules/git-sync');
const { createModuleStaticMiddleware, invalidateCache: invalidateStaticCache } = require('./modules/static-serve');

if (DEMO_MODE) {
  console.log('Running in DEMO MODE - using fixture data, Jira/GitHub APIs disabled');
}

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

// Demo mode: block refresh routes that would call external APIs
if (DEMO_MODE) {
  app.use(function(req, res, next) {
    if (req.method === 'POST' && req.path.includes('refresh')) {
      return res.json({
        status: 'skipped',
        message: 'Refresh disabled in demo mode - using fixture data'
      });
    }
    next();
  });
}

// ─── Auth (from shared package) ───

const { authMiddleware, requireAdmin, isAdmin, seedAdminList } = createAuthMiddleware(readFromStorage, writeToStorage);

// ─── Health check (before auth) ───

app.get('/healthz', function(req, res) {
  res.json({ status: 'ok' });
});
app.get('/api/healthz', function(req, res) {
  res.json({ status: 'ok' });
});

// Whoami endpoint — returns current user info
app.get('/api/whoami', function(req, res) {
  const email = req.headers['x-forwarded-email'];
  const user = req.headers['x-forwarded-user'];
  const preferred = req.headers['x-forwarded-preferred-username'];
  const displayName = preferred || user || email;
  console.log(`[auth] /api/whoami headers: x-forwarded-email="${email}" x-forwarded-user="${user}" x-forwarded-preferred-username="${preferred}"`);
  if (email) {
    res.json({ email, displayName, isAdmin: isAdmin(email.toLowerCase()) });
  } else {
    // Local dev fallback
    const devEmail = (process.env.ADMIN_EMAILS || 'local-dev@redhat.com').split(',')[0].trim();
    res.json({ email: devEmail, displayName: devEmail.split('@')[0], isAdmin: isAdmin(devEmail.toLowerCase()) });
  }
});

app.use(authMiddleware);

// ─── Routes: Allowlist ───

app.get('/api/allowlist', requireAdmin, function(req, res) {
  try {
    const data = readFromStorage('allowlist.json') || { emails: [] };
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Read allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

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

// Admin: get sync status
app.get('/api/admin/modules/sync/status', requireAdmin, function(req, res) {
  try {
    res.json(gitSync.getSyncStatus(storageModule));
  } catch (error) {
    console.error('Module sync status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Export: Anonymized test data ───

const { handleExport } = require('./export');

// ─── Built-in Module Discovery ───

const {
  discoverModules, createModuleRouters, mountModuleRouters, collectModuleDiagnostics,
  loadModuleState, saveModuleState, getEffectiveState, reconcileStartupState,
  resolveEnableOrder, checkDisableAllowed, computeRequiredBy, wasMountedAtStartup
} = require('./module-loader');
const builtInModules = discoverModules();
const diagnosticsRegistry = {};
const moduleContext = { storage: storageModule, requireAuth: authMiddleware, requireAdmin, registerDiagnostics: null };

// Compute effective enabled state and reconcile dependencies at startup
const persistedState = loadModuleState(storageModule);
const effectiveState = getEffectiveState(builtInModules, persistedState);
reconcileStartupState(builtInModules, effectiveState, storageModule);
const enabledSlugs = new Set(Object.entries(effectiveState).filter(([, v]) => v).map(([k]) => k));

// Step 1: Create module routers only for enabled modules
const moduleRouters = createModuleRouters(builtInModules, moduleContext, enabledSlugs, diagnosticsRegistry);

// Step 2: Register legacy API route forwards BEFORE mounting module routers
// Only register if team-tracker is enabled at startup
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

// Step 3: Mount module routers at /api/modules/<slug>/
mountModuleRouters(app, builtInModules, moduleRouters);

// ─── Export: Anonymized test data download ───

app.get('/api/export/test-data', function(req, res) {
  handleExport(req, res, storageModule, builtInModules);
});

// ─── Must-Gather: Diagnostic data download ───

const mustGather = require('./must-gather');

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

// Admin: get all built-in modules with state
app.get('/api/admin/modules/state', requireAdmin, function(req, res) {
  try {
    const currentState = loadModuleState(storageModule);
    const effective = getEffectiveState(builtInModules, currentState);
    const requiredBy = computeRequiredBy(builtInModules);

    const modules = builtInModules.map(function(mod) {
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

// Admin: enable a built-in module
app.post('/api/admin/modules/:slug/enable', requireAdmin, function(req, res) {
  try {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Module state changes disabled in demo mode' });
    }

    const slug = req.params.slug;
    const mod = builtInModules.find(function(m) { return m.slug === slug; });
    if (!mod) {
      return res.status(404).json({ error: `Module "${slug}" not found` });
    }

    const currentState = loadModuleState(storageModule);
    const effective = getEffectiveState(builtInModules, currentState);

    if (effective[slug]) {
      return res.json({ enabled: [slug], autoEnabled: [], restartRequired: false });
    }

    const result = resolveEnableOrder(slug, builtInModules, effective);
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

// Admin: disable a built-in module
app.post('/api/admin/modules/:slug/disable', requireAdmin, function(req, res) {
  try {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Module state changes disabled in demo mode' });
    }

    const slug = req.params.slug;
    const mod = builtInModules.find(function(m) { return m.slug === slug; });
    if (!mod) {
      return res.status(404).json({ error: `Module "${slug}" not found` });
    }

    const currentState = loadModuleState(storageModule);
    const effective = getEffectiveState(builtInModules, currentState);

    if (!effective[slug]) {
      return res.json({ disabled: slug });
    }

    const check = checkDisableAllowed(slug, builtInModules, effective);
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
  console.log(`\nTeam Tracker dev server running at http://localhost:${PORT}`);
  console.log(`Jira host: ${process.env.JIRA_HOST || 'https://redhat.atlassian.net'}`);
  console.log(`Local storage: ./data/`);
  console.log(`JIRA_TOKEN: ${process.env.JIRA_TOKEN ? 'set' : 'NOT SET (refresh will fail)'}`);
  console.log(`JIRA_EMAIL: ${process.env.JIRA_EMAIL ? 'set' : 'NOT SET (refresh will fail)'}\n`);
});
