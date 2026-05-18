import { describe, it, expect } from 'vitest';

const { createRoleStore, VALID_ROLES } = require('../../../../shared/server/role-store');
const { createAuthMiddleware } = require('../../../../shared/server/auth');

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null; },
    writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
    _store: store
  };
}

function createMockRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) { res._status = code; return res; },
    json(data) { res._json = data; return res; }
  };
  return res;
}

describe('release-manager role in VALID_ROLES', () => {
  it('includes release-manager as a valid role', () => {
    expect(VALID_ROLES).toContain('release-manager');
  });
});

describe('role store: release-manager assignment and revocation', () => {
  it('assigns release-manager role to a user', () => {
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage);

    const result = roleStore.assignRole('manager@redhat.com', 'release-manager', 'admin@redhat.com');
    expect(result.email).toBe('manager@redhat.com');
    expect(result.roles).toContain('release-manager');
  });

  it('confirms hasRole returns true after assignment', () => {
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage);

    roleStore.assignRole('manager@redhat.com', 'release-manager', 'admin@redhat.com');
    expect(roleStore.hasRole('manager@redhat.com', 'release-manager')).toBe(true);
  });

  it('revokes release-manager role from a user', () => {
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage);

    roleStore.assignRole('manager@redhat.com', 'release-manager', 'admin@redhat.com');
    const result = roleStore.revokeRole('manager@redhat.com', 'release-manager', 'admin@redhat.com');
    expect(result.roles).not.toContain('release-manager');
    expect(roleStore.hasRole('manager@redhat.com', 'release-manager')).toBe(false);
  });

  it('throws when revoking a role the user does not have', () => {
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage);

    expect(() => {
      roleStore.revokeRole('nobody@redhat.com', 'release-manager', 'admin@redhat.com');
    }).toThrow(/does not have role/);
  });

  it('does not affect other roles when assigning release-manager', () => {
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage);

    roleStore.assignRole('user@redhat.com', 'admin', 'system');
    roleStore.assignRole('user@redhat.com', 'release-manager', 'system');
    expect(roleStore.hasRole('user@redhat.com', 'admin')).toBe(true);
    expect(roleStore.hasRole('user@redhat.com', 'release-manager')).toBe(true);
  });
});

describe('requireReleaseManager middleware', () => {
  function createMiddleware() {
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage);
    const { requireReleaseManager } = createAuthMiddleware(
      storage.readFromStorage,
      storage.writeToStorage,
      { roleStore }
    );
    return { requireReleaseManager, roleStore, storage };
  }

  it('allows admins through', () => {
    const { requireReleaseManager } = createMiddleware();
    const req = { isAdmin: true, isReleaseManager: false };
    const res = createMockRes();
    let nextCalled = false;

    requireReleaseManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._status).toBeNull();
  });

  it('allows release managers through', () => {
    const { requireReleaseManager } = createMiddleware();
    const req = { isAdmin: false, isReleaseManager: true };
    const res = createMockRes();
    let nextCalled = false;

    requireReleaseManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._status).toBeNull();
  });

  it('blocks regular users with 403', () => {
    const { requireReleaseManager } = createMiddleware();
    const req = { isAdmin: false, isReleaseManager: false };
    const res = createMockRes();
    let nextCalled = false;

    requireReleaseManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/release manager/i);
  });
});
