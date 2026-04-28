/**
 * Role storage and management for RBAC.
 * Manages roles.json with admin and team-admin role assignments.
 */

const auditLog = require('./audit-log');

const ROLES_FILE = 'roles.json';
const ALLOWLIST_FILE = 'allowlist.json';
const VALID_ROLES = ['admin', 'team-admin'];
const DEMO_MODE = process.env.DEMO_MODE === 'true';

function createRoleStore(readFromStorage, writeToStorage) {
  function readRoles() {
    return readFromStorage(ROLES_FILE) || { version: 1, assignments: {} };
  }

  function writeRoles(data) {
    writeToStorage(ROLES_FILE, data);
  }

  function getRoles(email) {
    if (!email) return [];
    const data = readRoles();
    const entry = data.assignments[email.toLowerCase()];
    return entry ? entry.roles : [];
  }

  function hasRole(email, role) {
    return getRoles(email).includes(role);
  }

  function assignRole(email, role, actor) {
    if (!email || !role) throw new Error('email and role are required');
    if (!VALID_ROLES.includes(role)) throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);

    if (DEMO_MODE) {
      return { demo: true, message: 'Demo mode -- changes are not saved' };
    }

    const normalized = email.trim().toLowerCase();
    const data = readRoles();

    if (!data.assignments[normalized]) {
      data.assignments[normalized] = {
        roles: [],
        assignedBy: actor,
        assignedAt: new Date().toISOString()
      };
    }

    const entry = data.assignments[normalized];
    if (!entry.roles.includes(role)) {
      entry.roles.push(role);
      entry.assignedBy = actor;
      entry.assignedAt = new Date().toISOString();
      writeRoles(data);

      auditLog.appendAuditEntry({ readFromStorage, writeToStorage }, {
        action: 'role.assign',
        actor,
        entityType: 'user',
        entityId: normalized,
        newValue: role,
        detail: `Assigned role "${role}" to ${normalized}`
      });
    }

    return { email: normalized, roles: entry.roles };
  }

  function revokeRole(email, role, actor) {
    if (!email || !role) throw new Error('email and role are required');
    if (!VALID_ROLES.includes(role)) throw new Error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`);

    if (DEMO_MODE) {
      return { demo: true, message: 'Demo mode -- changes are not saved' };
    }

    const normalized = email.trim().toLowerCase();
    const data = readRoles();
    const entry = data.assignments[normalized];

    if (!entry || !entry.roles.includes(role)) {
      throw new Error(`User ${normalized} does not have role "${role}"`);
    }

    // Guard: cannot remove the last admin
    if (role === 'admin') {
      const adminEmails = getAdminEmails();
      if (adminEmails.length <= 1 && adminEmails.includes(normalized)) {
        throw new Error('Cannot remove the last admin');
      }
    }

    entry.roles = entry.roles.filter(r => r !== role);

    // Clean up entry if no roles remain
    if (entry.roles.length === 0) {
      delete data.assignments[normalized];
    }

    writeRoles(data);

    auditLog.appendAuditEntry({ readFromStorage, writeToStorage }, {
      action: 'role.revoke',
      actor,
      entityType: 'user',
      entityId: normalized,
      oldValue: role,
      detail: `Revoked role "${role}" from ${normalized}`
    });

    return { email: normalized, roles: entry.roles || [] };
  }

  function listAssignments() {
    const data = readRoles();
    return data.assignments;
  }

  function getAdminEmails() {
    const data = readRoles();
    return Object.entries(data.assignments)
      .filter(([, entry]) => entry.roles.includes('admin'))
      .map(([email]) => email);
  }

  function migrateFromAllowlist() {
    const rolesData = readRoles();
    if (Object.keys(rolesData.assignments).length > 0) {
      return false; // Already has data, skip migration
    }

    const allowlist = readFromStorage(ALLOWLIST_FILE);
    if (!allowlist || !allowlist.emails || allowlist.emails.length === 0) {
      return false; // Nothing to migrate
    }

    const now = new Date().toISOString();
    for (const email of allowlist.emails) {
      const normalized = email.trim().toLowerCase();
      rolesData.assignments[normalized] = {
        roles: ['admin'],
        assignedBy: 'migration',
        assignedAt: now
      };
    }

    writeRoles(rolesData);

    // Mark allowlist as migrated
    writeToStorage(ALLOWLIST_FILE, {
      _migrated: 'roles.json',
      _migratedAt: now,
      emails: allowlist.emails
    });

    console.log(`Roles: migrated ${allowlist.emails.length} admin(s) from allowlist.json to roles.json`);
    return true;
  }

  return {
    getRoles,
    hasRole,
    assignRole,
    revokeRole,
    listAssignments,
    getAdminEmails,
    migrateFromAllowlist
  };
}

module.exports = { createRoleStore, VALID_ROLES };
