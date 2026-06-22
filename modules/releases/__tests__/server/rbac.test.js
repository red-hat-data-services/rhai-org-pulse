import { describe, it, expect } from 'vitest';

const { createRoleRegistry } = require('../../../../shared/server/role-registry');
const { createRoleStore } = require('../../../../shared/server/role-store');
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

function createTestRoleRegistry() {
  const registry = createRoleRegistry();
  registry.register('admin', { label: 'Admin', description: 'Full access', module: 'platform' });
  registry.register('team-admin', { label: 'Team Admin', description: 'Team mgmt', module: 'platform' });
  registry.register('planning-manager', { label: 'Planning Manager', description: 'Manage releases', module: 'releases' });
  return registry;
}

describe('planning-manager role in role registry', () => {
  it('recognizes planning-manager as a valid role', () => {
    const registry = createTestRoleRegistry();
    expect(registry.isValid('planning-manager')).toBe(true);
  });
});

describe('role store: planning-manager assignment and revocation', () => {
  it('assigns planning-manager role to a user', () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    const result = roleStore.assignRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    expect(result.email).toBe('manager@redhat.com');
    expect(result.roles).toContain('planning-manager');
  });

  it('confirms hasRole returns true after assignment', () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    roleStore.assignRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    expect(roleStore.hasRole('manager@redhat.com', 'planning-manager')).toBe(true);
  });

  it('revokes planning-manager role from a user', () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    roleStore.assignRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    const result = roleStore.revokeRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    expect(result.roles).not.toContain('planning-manager');
    expect(roleStore.hasRole('manager@redhat.com', 'planning-manager')).toBe(false);
  });

  it('throws when revoking a role the user does not have', () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    expect(() => {
      roleStore.revokeRole('nobody@redhat.com', 'planning-manager', 'admin@redhat.com');
    }).toThrow(/does not have role/);
  });

  it('does not affect other roles when assigning planning-manager', () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    roleStore.assignRole('user@redhat.com', 'admin', 'system');
    roleStore.assignRole('user@redhat.com', 'planning-manager', 'system');
    expect(roleStore.hasRole('user@redhat.com', 'admin')).toBe(true);
    expect(roleStore.hasRole('user@redhat.com', 'planning-manager')).toBe(true);
  });
});

describe('requireRole("planning-manager") middleware', () => {
  function createMiddleware() {
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage);
    const { requireRole } = createAuthMiddleware(
      storage.readFromStorage,
      storage.writeToStorage,
      { roleStore }
    );
    const requirePlanningManager = requireRole('planning-manager');
    return { requirePlanningManager, roleStore, storage };
  }

  it('allows admins through', () => {
    const { requirePlanningManager } = createMiddleware();
    const req = { isAdmin: true, isPlanningManager: false, userEmail: 'admin@test.com' };
    const res = createMockRes();
    let nextCalled = false;

    requirePlanningManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._status).toBeNull();
  });

  it('allows planning managers through', () => {
    const { requirePlanningManager, roleStore } = createMiddleware();
    roleStore.assignRole('pm@test.com', 'planning-manager', 'admin');
    const req = { isAdmin: false, isPlanningManager: true, userEmail: 'pm@test.com' };
    const res = createMockRes();
    let nextCalled = false;

    requirePlanningManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._status).toBeNull();
  });

  it('blocks regular users with 403', () => {
    const { requirePlanningManager } = createMiddleware();
    const req = { isAdmin: false, isPlanningManager: false, userEmail: 'user@test.com' };
    const res = createMockRes();
    let nextCalled = false;

    requirePlanningManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/planning-manager/);
  });
});
