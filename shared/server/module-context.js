/**
 * Module context — single source of truth for the server-side module contract.
 *
 * @module shared/server/module-context
 */

/**
 * Core platform services passed to every module.
 *
 * @typedef {object} CoreServices
 * @property {object} storage          - Storage module (readFromStorage, writeToStorage, etc.)
 * @property {Function} requireAuth    - Express middleware — requires authenticated user
 * @property {Function} requireAdmin   - Express middleware — requires admin role
 * @property {Function} requireTeamAdmin - Express middleware — requires team-admin or admin role
 * @property {Function} requireRole    - Factory: requireRole(role) returns Express middleware
 * @property {Function} requireScope   - Factory returning Express middleware for API token scope check
 * @property {object} roleStore        - Role store instance (getRole, setRole, etc.)
 * @property {object} [roleRegistry]   - Role registry for registerRole
 * @property {object} [scopeRegistry]  - Scope registry for registerScopes
 * @property {object} [secretRegistry] - Secret registry for module secrets
 */

/**
 * Refresh handler configuration.
 *
 * @typedef {object} RefreshConfig
 * @property {Function} handler - Async function to execute the refresh
 * @property {Function} [status] - Async function returning current status
 * @property {number} [order=100] - Execution order (lower runs first)
 * @property {number} [timeout] - Per-handler timeout in ms (overrides global runAll timeout)
 * @property {string} [cadence='24h'] - How often the handler should run (e.g. '15m', '12h', '1d'). Parsed by parseCadence(). Default '24h'.
 */

/**
 * The context object provided to each module's server entry function.
 *
 * @typedef {object} ModuleContext
 * @property {object} storage          - Storage module (readFromStorage, writeToStorage, etc.)
 * @property {Function} requireAuth    - Express middleware — requires authenticated user
 * @property {Function} requireAdmin   - Express middleware — requires admin role
 * @property {Function} requireTeamAdmin - Express middleware — requires team-admin or admin role
 * @property {Function} requireRole    - Factory: requireRole(role) returns Express middleware
 * @property {Function} requireScope   - Factory returning Express middleware for API token scope check
 * @property {object} roleStore        - Role store instance
 * @property {Function} registerDiagnostics - Register a diagnostics function for admin health checks
 * @property {Function} registerMessageProvider - Register a message provider (id, fn)
 * @property {Function} registerRefresh - Register a refresh handler (id, config)
 * @property {Function} registerExport - Register a data export hook (fn)
 * @property {Function} registerRole - Register a module role (id, config)
 * @property {Function} registerScopes - Register module scopes (configs[])
 * @property {Function} isRefreshRunning - Check if a global refresh-all is in progress
 * @property {object} secrets - Frozen object of resolved secret values for this module
 * @property {Function} resolveSecret - Dynamic secret lookup: resolveSecret(envVarName) => string|undefined. Warning: v1 does not enforce module isolation — any module can resolve any env var. Logs a warning for undeclared access.
 * @property {Function} registerSecretValidator - Register an async validator for a secret key
 */

/**
 * Registries object passed to buildModuleContext.
 *
 * @typedef {object} Registries
 * @property {object} [diagnostics]  - Map of slug → array of diagnostics functions
 * @property {object} [messages]     - Message registry with registerProvider method
 * @property {object} [refresh]      - Refresh registry with register method
 * @property {object} [exports]      - Export registry with register method
 */

/**
 * Build a frozen per-module context object.
 *
 * @param {CoreServices} coreServices - Platform services
 * @param {string} slug - Module slug
 * @param {Registries} [registries={}] - Optional registries for hook registration
 * @returns {ModuleContext}
 */
function buildModuleContext(coreServices, slug, registries = {}) {
  const { diagnostics, messages, refresh, exports: exportRegistry } = registries
  const roleRegistry = coreServices.roleRegistry || null
  const scopeRegistry = coreServices.scopeRegistry || null
  const secretRegistry = coreServices.secretRegistry || null

  const ctx = {
    storage: coreServices.storage,
    requireAuth: coreServices.requireAuth,
    requireAdmin: coreServices.requireAdmin,
    requireTeamAdmin: coreServices.requireTeamAdmin,
    requireRole: coreServices.requireRole,
    requireScope: coreServices.requireScope,
    roleStore: coreServices.roleStore,

    registerRole: roleRegistry
      ? function (id, config) {
        roleRegistry.register(id, { ...config, module: slug })
      }
      : function () {},

    registerScopes: scopeRegistry
      ? function (scopeConfigs) {
        for (const config of scopeConfigs) {
          scopeRegistry.register(config.key, { ...config, module: slug })
        }
      }
      : function () {},

    registerDiagnostics: diagnostics
      ? function (fn) {
        if (!diagnostics[slug]) diagnostics[slug] = []
        diagnostics[slug].push(fn)
      }
      : function () {},

    registerMessageProvider: messages
      ? function (id, fn) { messages.registerProvider(id, fn) }
      : function () {},

    registerRefresh: refresh
      ? function (id, config) { refresh.register(slug + ':' + id, config) }
      : function () {},

    registerExport: exportRegistry
      ? function (fn) { exportRegistry.register(slug, fn) }
      : function () {},

    isRefreshRunning: refresh
      ? function () { return refresh.isRunning() }
      : function () { return false },

    secrets: secretRegistry
      ? secretRegistry.getModuleSecrets(slug)
      : Object.freeze({}),

    /**
     * Dynamic secret lookup. Reads process.env at call time.
     * Logs a warning if the key is outside this module's declarations (v1 limitation:
     * does not block access, only warns — Phase 2 will add pattern-based enforcement).
     */
    resolveSecret: secretRegistry
      ? function (envVarName) { return secretRegistry.resolveSecret(envVarName, slug) }
      : function () { return undefined },

    registerSecretValidator: secretRegistry
      ? function (key, fn) { secretRegistry.registerValidator(key, fn) }
      : function () {}
  }

  return Object.freeze(ctx)
}

/**
 * Create a test context with sensible defaults and optional overrides.
 * Useful for module unit tests.
 *
 * @param {Partial<ModuleContext>} [overrides={}]
 * @returns {ModuleContext}
 */
function createTestContext(overrides = {}) {
  const noop = function () {}
  const noopMiddleware = function (_req, _res, next) { next() }

  const defaults = {
    storage: {
      readFromStorage: function () { return null },
      writeToStorage: noop,
      deleteFromStorage: noop
    },
    requireAuth: noopMiddleware,
    requireAdmin: noopMiddleware,
    requireTeamAdmin: noopMiddleware,
    requireRole: function () { return noopMiddleware },
    requireScope: function () { return noopMiddleware },
    roleStore: {
      getRole: function () { return null },
      setRole: noop,
      removeRole: noop,
      getAllRoles: function () { return {} }
    },
    registerDiagnostics: noop,
    registerMessageProvider: noop,
    registerRefresh: noop,
    registerExport: noop,
    registerRole: noop,
    registerScopes: noop,
    isRefreshRunning: function () { return false },
    secrets: {},
    resolveSecret: function () { return undefined },
    registerSecretValidator: noop
  }

  return { ...defaults, ...overrides }
}

module.exports = { buildModuleContext, createTestContext }
