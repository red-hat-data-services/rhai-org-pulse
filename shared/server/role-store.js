/**
 * Role storage and management for RBAC.
 * Manages roles.json with admin and team-admin role assignments.
 */

const auditLog = require('./audit-log');

const ROLES_FILE = 'roles.json';
const ALLOWLIST_FILE = 'allowlist.json';
const VALID_ROLES = ['admin', 'team-admin', 'usage-metrics-viewer'];
const DEMO_MODE = process.env.DEMO_MODE === 'true';

/** Guard against prototype pollution via user-controlled object keys. */
function isSafeKey(key) {
  return typeof key === 'string' && !['__proto__', 'constructor', 'prototype'].includes(key);
}

/**
 * Normalize an email to the configured auth domain.
 * If authDomain is set, replaces the domain portion of the email.
 * Exported for testing.
 */
function normalizeEmail(email, authDomain) {
  if (!email || !authDomain) return email ? email.trim().toLowerCase() : email;
  const normalized = email.trim().toLowerCase();
  const atIdx = normalized.indexOf('@');
  if (atIdx < 0) return normalized;
  return normalized.substring(0, atIdx + 1) + authDomain;
}

function createRoleStore(readFromStorage, writeToStorage, options = {}) {
  const getAuthDomain = typeof options.getAuthDomain === 'function'
    ? options.getAuthDomain
    : () => null;

  // Cache for getAuthDomain result (30s TTL)
  let _cachedDomain = undefined;
  let _cachedAt = 0;
  const CACHE_TTL_MS = 30_000;

  function getCachedAuthDomain() {
    const now = Date.now();
    if (_cachedDomain === undefined || now - _cachedAt > CACHE_TTL_MS) {
      _cachedDomain = getAuthDomain() || null;
      _cachedAt = now;
    }
    return _cachedDomain;
  }

  function invalidateCache() {
    _cachedDomain = undefined;
    _cachedAt = 0;
  }

  function readRoles() {
    return readFromStorage(ROLES_FILE) || { version: 1, assignments: {} };
  }

  function writeRoles(data) {
    writeToStorage(ROLES_FILE, data);
  }

  function getRoles(email) {
    if (!email) return [];
    const authDomain = getCachedAuthDomain();
    const key = normalizeEmail(email, authDomain);
    if (!isSafeKey(key)) return [];
    const data = readRoles();
    const entry = data.assignments[key];
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

    const authDomain = getCachedAuthDomain();
    const normalized = normalizeEmail(email, authDomain);
    if (!isSafeKey(normalized)) throw new Error('Invalid email');
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

    const authDomain = getCachedAuthDomain();
    const normalized = normalizeEmail(email, authDomain);
    if (!isSafeKey(normalized)) throw new Error('Invalid email');
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

    for (const email of allowlist.emails) {
      assignRole(email, 'admin', 'migration');
    }

    // Mark allowlist as migrated
    const now = new Date().toISOString();
    writeToStorage(ALLOWLIST_FILE, {
      _migrated: 'roles.json',
      _migratedAt: now,
      emails: allowlist.emails
    });

    console.log(`Roles: migrated ${allowlist.emails.length} admin(s) from allowlist.json to roles.json`);
    return true;
  }

  function migrateEmailDomains() {
    const authDomain = getAuthDomain();
    if (!authDomain) return 0;

    const data = readRoles();
    const oldKeys = Object.keys(data.assignments);
    const needsMigration = oldKeys.some(email => normalizeEmail(email, authDomain) !== email);

    if (!needsMigration) return 0;

    // Backup before migration
    const backupKey = `roles-backup-${Date.now()}.json`;
    writeToStorage(backupKey, JSON.parse(JSON.stringify(data)));
    console.log(`Roles: backup saved to ${backupKey}`);

    let migrated = 0;

    for (const oldEmail of oldKeys) {
      const newEmail = normalizeEmail(oldEmail, authDomain);
      if (newEmail === oldEmail) continue;

      const oldEntry = data.assignments[oldEmail];
      const existingEntry = data.assignments[newEmail];

      if (existingEntry) {
        // Merge roles from both entries
        const mergedRoles = [...new Set([...existingEntry.roles, ...oldEntry.roles])];
        existingEntry.roles = mergedRoles;
        // Keep the newer assignedAt
        if (oldEntry.assignedAt > existingEntry.assignedAt) {
          existingEntry.assignedBy = oldEntry.assignedBy;
          existingEntry.assignedAt = oldEntry.assignedAt;
        }
      } else {
        data.assignments[newEmail] = oldEntry;
      }

      delete data.assignments[oldEmail];
      migrated++;
    }

    if (migrated > 0) {
      writeRoles(data);
      console.log(`Roles: migrated ${migrated} email(s) to @${authDomain} (backup: ${backupKey})`);
    }

    return migrated;
  }

  return {
    getRoles,
    hasRole,
    assignRole,
    revokeRole,
    listAssignments,
    getAdminEmails,
    migrateFromAllowlist,
    migrateEmailDomains,
    invalidateCache
  };
}

module.exports = { createRoleStore, normalizeEmail, VALID_ROLES };
