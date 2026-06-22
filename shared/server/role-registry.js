/**
 * Role registry — dynamic registration of platform and module roles.
 *
 * Modules register roles via context.registerRole() during startup.
 * The registry is frozen after construction; individual entries are
 * frozen on registration.
 *
 * @module shared/server/role-registry
 */

/**
 * @typedef {object} RoleConfig
 * @property {string} id          - Unique role identifier (e.g. 'planning-manager')
 * @property {string} label       - Human-readable label for Settings UI
 * @property {string} description - Short description for Settings UI
 * @property {string} module      - Module slug that registered this role (or 'platform')
 */

/**
 * Create a role registry instance.
 * @returns {{ register: Function, isValid: Function, getAll: Function, get: Function }}
 */
function createRoleRegistry() {
  const roles = new Map();

  function register(id, config) {
    if (roles.has(id)) {
      throw new Error(`Role "${id}" is already registered`);
    }
    roles.set(id, Object.freeze({ id, ...config }));
  }

  function isValid(id) {
    return roles.has(id);
  }

  function getAll() {
    return [...roles.values()];
  }

  function get(id) {
    return roles.get(id) || null;
  }

  return Object.freeze({ register, isValid, getAll, get });
}

module.exports = { createRoleRegistry };
