import { describe, it, expect, vi } from 'vitest';

const { createRoleStore, normalizeEmail } = require('../role-store');

// Suppress console.log output in tests
vi.spyOn(console, 'log').mockImplementation(() => {});

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    read(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null; },
    write(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
    raw: store
  };
}

function makeStore(opts = {}) {
  const { authDomain = null, rolesData = null, allowlistData = null } = opts;
  const initial = {};
  if (rolesData) initial['roles.json'] = rolesData;
  if (allowlistData) initial['allowlist.json'] = allowlistData;

  const storage = createMockStorage(initial);
  const roleStore = createRoleStore(
    (key) => storage.read(key),
    (key, data) => storage.write(key, data),
    { getAuthDomain: () => authDomain }
  );
  return { roleStore, storage };
}

// ── normalizeEmail ──

describe('normalizeEmail', () => {
  it('returns null/undefined for falsy email', () => {
    expect(normalizeEmail(null, 'cluster.local')).toBeNull();
    expect(normalizeEmail(undefined, 'cluster.local')).toBeUndefined();
    expect(normalizeEmail('', 'cluster.local')).toBe('');
  });

  it('lowercases and trims when no authDomain', () => {
    expect(normalizeEmail('  User@RedHat.COM  ', null)).toBe('user@redhat.com');
    expect(normalizeEmail('  User@RedHat.COM  ', '')).toBe('user@redhat.com');
  });

  it('replaces domain when authDomain is set', () => {
    expect(normalizeEmail('user@redhat.com', 'cluster.local')).toBe('user@cluster.local');
  });

  it('handles email without @ sign', () => {
    expect(normalizeEmail('admin', 'cluster.local')).toBe('admin');
  });
});

// ── assignRole normalization ──

describe('assignRole normalization', () => {
  it('normalizes email when authDomain is set', () => {
    const { roleStore, storage } = makeStore({ authDomain: 'cluster.local' });
    roleStore.assignRole('user@redhat.com', 'admin', 'test');
    const data = storage.read('roles.json');
    expect(data.assignments['user@cluster.local']).toBeDefined();
    expect(data.assignments['user@redhat.com']).toBeUndefined();
  });

  it('preserves email when no authDomain', () => {
    const { roleStore, storage } = makeStore({ authDomain: null });
    roleStore.assignRole('user@redhat.com', 'admin', 'test');
    const data = storage.read('roles.json');
    expect(data.assignments['user@redhat.com']).toBeDefined();
  });
});

// ── revokeRole normalization ──

describe('revokeRole normalization', () => {
  it('normalizes email for revocation', () => {
    const { roleStore } = makeStore({ authDomain: 'cluster.local' });
    // Assign a second admin so we can revoke the first
    roleStore.assignRole('user@redhat.com', 'admin', 'test');
    roleStore.assignRole('other@redhat.com', 'admin', 'test');
    // Revoke using the original (non-auth) domain
    const result = roleStore.revokeRole('user@redhat.com', 'admin', 'test');
    expect(result.email).toBe('user@cluster.local');
  });
});

// ── getRoles normalization ──

describe('getRoles normalization', () => {
  it('normalizes email before lookup', () => {
    const { roleStore } = makeStore({
      authDomain: 'cluster.local',
      rolesData: {
        version: 1,
        assignments: {
          'user@cluster.local': { roles: ['admin'], assignedBy: 'test', assignedAt: '2024-01-01' }
        }
      }
    });
    const roles = roleStore.getRoles('user@redhat.com');
    expect(roles).toEqual(['admin']);
  });
});

// ── hasRole normalization ──

describe('hasRole normalization', () => {
  it('normalizes email via getRoles delegation', () => {
    const { roleStore } = makeStore({
      authDomain: 'cluster.local',
      rolesData: {
        version: 1,
        assignments: {
          'user@cluster.local': { roles: ['admin'], assignedBy: 'test', assignedAt: '2024-01-01' }
        }
      }
    });
    expect(roleStore.hasRole('user@redhat.com', 'admin')).toBe(true);
  });
});

// ── Last-admin guard with normalization ──

describe('last-admin guard', () => {
  it('works with normalized emails', () => {
    const { roleStore } = makeStore({ authDomain: 'cluster.local' });
    roleStore.assignRole('solo@redhat.com', 'admin', 'test');
    expect(() => roleStore.revokeRole('solo@redhat.com', 'admin', 'test'))
      .toThrow('Cannot remove the last admin');
  });
});

// ── migrateEmailDomains ──

describe('migrateEmailDomains', () => {
  it('rewrites existing keys to auth domain', () => {
    const { roleStore, storage } = makeStore({
      authDomain: 'cluster.local',
      rolesData: {
        version: 1,
        assignments: {
          'user@redhat.com': { roles: ['admin'], assignedBy: 'test', assignedAt: '2024-01-01' }
        }
      }
    });
    const count = roleStore.migrateEmailDomains();
    expect(count).toBe(1);
    const data = storage.read('roles.json');
    expect(data.assignments['user@cluster.local']).toBeDefined();
    expect(data.assignments['user@redhat.com']).toBeUndefined();
  });

  it('is idempotent — running twice produces same result', () => {
    const { roleStore, storage } = makeStore({
      authDomain: 'cluster.local',
      rolesData: {
        version: 1,
        assignments: {
          'user@redhat.com': { roles: ['admin'], assignedBy: 'test', assignedAt: '2024-01-01' }
        }
      }
    });
    roleStore.migrateEmailDomains();
    const count2 = roleStore.migrateEmailDomains();
    expect(count2).toBe(0);
    const data = storage.read('roles.json');
    expect(data.assignments['user@cluster.local']).toBeDefined();
  });

  it('no-ops when authDomain is empty', () => {
    const { roleStore } = makeStore({
      authDomain: null,
      rolesData: {
        version: 1,
        assignments: {
          'user@redhat.com': { roles: ['admin'], assignedBy: 'test', assignedAt: '2024-01-01' }
        }
      }
    });
    const count = roleStore.migrateEmailDomains();
    expect(count).toBe(0);
  });

  it('merges roles when both domain variants exist', () => {
    const { roleStore, storage } = makeStore({
      authDomain: 'cluster.local',
      rolesData: {
        version: 1,
        assignments: {
          'user@redhat.com': { roles: ['admin'], assignedBy: 'ldap', assignedAt: '2024-01-01' },
          'user@cluster.local': { roles: ['team-admin'], assignedBy: 'seed', assignedAt: '2024-01-02' }
        }
      }
    });
    const count = roleStore.migrateEmailDomains();
    expect(count).toBe(1);
    const data = storage.read('roles.json');
    expect(data.assignments['user@cluster.local'].roles).toEqual(
      expect.arrayContaining(['admin', 'team-admin'])
    );
    expect(data.assignments['user@redhat.com']).toBeUndefined();
  });

  it('creates backup before rewriting', () => {
    const { roleStore, storage } = makeStore({
      authDomain: 'cluster.local',
      rolesData: {
        version: 1,
        assignments: {
          'user@redhat.com': { roles: ['admin'], assignedBy: 'test', assignedAt: '2024-01-01' }
        }
      }
    });
    roleStore.migrateEmailDomains();
    const backupKeys = Object.keys(storage.raw).filter(k => k.startsWith('roles-backup-'));
    expect(backupKeys.length).toBe(1);
    const backup = storage.read(backupKeys[0]);
    expect(backup.assignments['user@redhat.com']).toBeDefined();
  });
});

// ── migrateFromAllowlist ──

describe('migrateFromAllowlist', () => {
  it('normalizes emails via assignRole', () => {
    const { roleStore, storage } = makeStore({
      authDomain: 'cluster.local',
      allowlistData: { emails: ['admin@redhat.com'] }
    });
    roleStore.migrateFromAllowlist();
    const data = storage.read('roles.json');
    expect(data.assignments['admin@cluster.local']).toBeDefined();
    expect(data.assignments['admin@cluster.local'].roles).toContain('admin');
    expect(data.assignments['admin@redhat.com']).toBeUndefined();
  });
});

// ── seedRoles interaction ──

describe('seedRoles interaction', () => {
  it('assignRole normalizes ADMIN_EMAILS entries', () => {
    const { roleStore } = makeStore({ authDomain: 'cluster.local' });
    // Simulates what seedRoles does: calls assignRole for each ADMIN_EMAILS entry
    roleStore.assignRole('user@redhat.com', 'admin', 'system-seed');
    const roles = roleStore.getRoles('user@cluster.local');
    expect(roles).toContain('admin');
  });
});

// ── Cache invalidation ──

describe('invalidateCache', () => {
  it('causes fresh authDomain lookup after invalidation', () => {
    let currentDomain = 'old.local';
    const storage = createMockStorage({});
    const roleStore = createRoleStore(
      (key) => storage.read(key),
      (key, data) => storage.write(key, data),
      { getAuthDomain: () => currentDomain }
    );

    roleStore.assignRole('user@redhat.com', 'admin', 'test');
    let data = storage.read('roles.json');
    expect(data.assignments['user@old.local']).toBeDefined();

    // Change domain and invalidate cache
    currentDomain = 'new.local';
    roleStore.invalidateCache();

    roleStore.assignRole('user2@redhat.com', 'admin', 'test');
    data = storage.read('roles.json');
    expect(data.assignments['user2@new.local']).toBeDefined();
  });
});
