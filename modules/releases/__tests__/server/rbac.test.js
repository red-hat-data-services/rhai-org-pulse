import { describe, it, expect } from 'vitest';

const { createRoleRegistry } = require('../../../../shared/server/role-registry');
const { createRoleStore } = require('../../../../shared/server/role-store');
const { createAuthMiddleware } = require('../../../../shared/server/auth');

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    async readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null; },
    async writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
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
  it('assigns planning-manager role to a user', async () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    const result = await roleStore.assignRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    expect(result.email).toBe('manager@redhat.com');
    expect(result.roles).toContain('planning-manager');
  });

  it('confirms hasRole returns true after assignment', async () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    await roleStore.assignRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    expect(await roleStore.hasRole('manager@redhat.com', 'planning-manager')).toBe(true);
  });

  it('revokes planning-manager role from a user', async () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    await roleStore.assignRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    const result = await roleStore.revokeRole('manager@redhat.com', 'planning-manager', 'admin@redhat.com');
    expect(result.roles).not.toContain('planning-manager');
    expect(await roleStore.hasRole('manager@redhat.com', 'planning-manager')).toBe(false);
  });

  it('throws when revoking a role the user does not have', async () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    await expect(
      roleStore.revokeRole('nobody@redhat.com', 'planning-manager', 'admin@redhat.com')
    ).rejects.toThrow(/does not have role/);
  });

  it('does not affect other roles when assigning planning-manager', async () => {
    const registry = createTestRoleRegistry();
    const storage = createMockStorage();
    const roleStore = createRoleStore(storage.readFromStorage, storage.writeToStorage, { roleRegistry: registry });

    await roleStore.assignRole('user@redhat.com', 'admin', 'system');
    await roleStore.assignRole('user@redhat.com', 'planning-manager', 'system');
    expect(await roleStore.hasRole('user@redhat.com', 'admin')).toBe(true);
    expect(await roleStore.hasRole('user@redhat.com', 'planning-manager')).toBe(true);
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

  it('allows admins through', async () => {
    const { requirePlanningManager } = createMiddleware();
    const req = { isAdmin: true, isPlanningManager: false, userEmail: 'admin@test.com' };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlanningManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._status).toBeNull();
  });

  it('allows planning managers through', async () => {
    const { requirePlanningManager, roleStore } = createMiddleware();
    await roleStore.assignRole('pm@test.com', 'planning-manager', 'admin');
    const req = { isAdmin: false, isPlanningManager: true, userEmail: 'pm@test.com' };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlanningManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._status).toBeNull();
  });

  it('blocks regular users with 403', async () => {
    const { requirePlanningManager } = createMiddleware();
    const req = { isAdmin: false, isPlanningManager: false, userEmail: 'user@test.com' };
    const res = createMockRes();
    let nextCalled = false;

    await requirePlanningManager(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res._status).toBe(403);
    expect(res._json.error).toMatch(/planning-manager/);
  });
});
