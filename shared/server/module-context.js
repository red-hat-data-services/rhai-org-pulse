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
 * @property {Function} requireReleaseManager - Express middleware — requires release-manager role
 * @property {Function} requireScope   - Factory returning Express middleware for API token scope check
 * @property {object} roleStore        - Role store instance (getRole, setRole, etc.)
 */

/**
 * Refresh handler configuration.
 *
 * @typedef {object} RefreshConfig
 * @property {Function} handler - Async function to execute the refresh
 * @property {Function} [status] - Async function returning current status
 * @property {number} [order=100] - Execution order (lower runs first)
 */

/**
 * The context object provided to each module's server entry function.
 *
 * @typedef {object} ModuleContext
 * @property {object} storage          - Storage module (readFromStorage, writeToStorage, etc.)
 * @property {Function} requireAuth    - Express middleware — requires authenticated user
 * @property {Function} requireAdmin   - Express middleware — requires admin role
 * @property {Function} requireTeamAdmin - Express middleware — requires team-admin or admin role
 * @property {Function} requireReleaseManager - Express middleware — requires release-manager role
 * @property {Function} requireScope   - Factory returning Express middleware for API token scope check
 * @property {object} roleStore        - Role store instance
 * @property {Function} registerDiagnostics - Register a diagnostics function for admin health checks
 * @property {Function} registerMessageProvider - Register a message provider (id, fn)
 * @property {Function} registerRefresh - Register a refresh handler (id, config)
 * @property {Function} registerExport - Register a data export hook (fn)
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

  const ctx = {
    storage: coreServices.storage,
    requireAuth: coreServices.requireAuth,
    requireAdmin: coreServices.requireAdmin,
    requireTeamAdmin: coreServices.requireTeamAdmin,
    requireReleaseManager: coreServices.requireReleaseManager,
    requireScope: coreServices.requireScope,
    roleStore: coreServices.roleStore,

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
    requireReleaseManager: noopMiddleware,
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
    registerExport: noop
  }

  return { ...defaults, ...overrides }
}

module.exports = { buildModuleContext, createTestContext }
