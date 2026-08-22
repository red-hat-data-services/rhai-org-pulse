import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const registryMod = require('../../server/registry');
const { runRegistrySync, normalizeRelease, REGISTRY_FILE } = registryMod;

const ppMod = require('../../server/delivery/product-pages');
const configMod = require('../../server/delivery/config');

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    async readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null; },
    async writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
    _store: store
  };
}

describe('runRegistrySync — planningFreeze', () => {
  let origFetch, origGetAuth, origGetConfig;

  beforeEach(() => {
    origFetch = ppMod.fetchProductsByShortname;
    origGetAuth = ppMod.getAuthStatus;
    origGetConfig = configMod.getConfig;

    ppMod.getAuthStatus = vi.fn().mockReturnValue('configured');
    ppMod.fetchProductsByShortname = vi.fn().mockResolvedValue([]);
    configMod.getConfig = vi.fn().mockReturnValue({
      productPagesProductShortnames: ['rhoai']
    });
  });

  afterEach(() => {
    ppMod.fetchProductsByShortname = origFetch;
    ppMod.getAuthStatus = origGetAuth;
    configMod.getConfig = origGetConfig;
  });

  it('creates new release with planningFreeze from PP data', async () => {
    ppMod.fetchProductsByShortname.mockResolvedValue([
      {
        releaseNumber: 'RHOAI-3.5',
        productName: 'RHOAI',
        dueDate: '2026-09-15',
        codeFreezeDate: '2026-08-20',
        planningFreezeDate: '2026-07-10'
      }
    ]);

    const storage = createMockStorage();
    const result = await runRegistrySync(storage, {});

    expect(result.created).toBe(1);
    const registry = storage._store[REGISTRY_FILE];
    const release = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(release).toBeDefined();
    expect(release.milestones.ga).toBe('2026-09-15');
    expect(release.milestones.codeFreeze).toBe('2026-08-20');
    expect(release.milestones.planningFreeze).toBe('2026-07-10');
  });

  it('updates existing release with planningFreeze from PP data', async () => {
    const existingRelease = normalizeRelease({
      id: 'rhoai-3.5',
      displayName: 'RHOAI-3.5',
      productPagesShortname: 'rhoai',
      productPagesVersion: 'RHOAI-3.5',
      milestones: { ga: '2026-09-01', codeFreeze: '2026-08-15', planningFreeze: null },
      source: 'product-pages',
      state: 'active'
    });

    const storage = createMockStorage({
      [REGISTRY_FILE]: { schemaVersion: 1, releases: [existingRelease] }
    });

    ppMod.fetchProductsByShortname.mockResolvedValue([
      {
        releaseNumber: 'RHOAI-3.5',
        productName: 'RHOAI',
        dueDate: '2026-09-15',
        codeFreezeDate: '2026-08-20',
        planningFreezeDate: '2026-07-10'
      }
    ]);

    const result = await runRegistrySync(storage, {});

    expect(result.updated).toBe(1);
    const registry = storage._store[REGISTRY_FILE];
    const release = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(release.milestones.planningFreeze).toBe('2026-07-10');
    expect(release.milestones.ga).toBe('2026-09-15');
    expect(release.milestones.codeFreeze).toBe('2026-08-20');
  });

  it('preserves existing planningFreeze when PP data is missing it', async () => {
    const existingRelease = normalizeRelease({
      id: 'rhoai-3.5',
      displayName: 'RHOAI-3.5',
      productPagesShortname: 'rhoai',
      productPagesVersion: 'RHOAI-3.5',
      milestones: { ga: '2026-09-01', codeFreeze: '2026-08-15', planningFreeze: '2026-07-01' },
      source: 'product-pages',
      state: 'active'
    });

    const storage = createMockStorage({
      [REGISTRY_FILE]: { schemaVersion: 1, releases: [existingRelease] }
    });

    ppMod.fetchProductsByShortname.mockResolvedValue([
      {
        releaseNumber: 'RHOAI-3.5',
        productName: 'RHOAI',
        dueDate: '2026-09-15',
        codeFreezeDate: '2026-08-20',
        planningFreezeDate: undefined
      }
    ]);

    const result = await runRegistrySync(storage, {});

    expect(result.updated).toBe(1);
    const registry = storage._store[REGISTRY_FILE];
    const release = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(release.milestones.planningFreeze).toBe('2026-07-01');
  });

  it('creates release with null planningFreeze when PP data omits it', async () => {
    ppMod.fetchProductsByShortname.mockResolvedValue([
      {
        releaseNumber: 'RHOAI-3.6',
        productName: 'RHOAI',
        dueDate: '2026-12-01',
        codeFreezeDate: '2026-11-15'
      }
    ]);

    const storage = createMockStorage();
    const result = await runRegistrySync(storage, {});

    expect(result.created).toBe(1);
    const registry = storage._store[REGISTRY_FILE];
    const release = registry.releases.find(r => r.id === 'rhoai-3.6');
    expect(release.milestones.planningFreeze).toBeNull();
  });

  it('skips sync when auth is not configured', async () => {
    ppMod.getAuthStatus.mockReturnValue('none');
    const storage = createMockStorage();
    const result = await runRegistrySync(storage, {});
    expect(result.status).toBe('skipped');
    expect(ppMod.fetchProductsByShortname).not.toHaveBeenCalled();
  });

  it('archives releases no longer discovered from PP', async () => {
    const existingRelease = normalizeRelease({
      id: 'rhoai-3.4',
      displayName: 'RHOAI-3.4',
      productPagesShortname: 'rhoai',
      productPagesVersion: 'RHOAI-3.4',
      milestones: { ga: '2026-06-01', codeFreeze: '2026-05-15', planningFreeze: '2026-04-01' },
      source: 'product-pages',
      state: 'active'
    });

    const storage = createMockStorage({
      [REGISTRY_FILE]: { schemaVersion: 1, releases: [existingRelease] }
    });

    ppMod.fetchProductsByShortname.mockResolvedValue([
      {
        releaseNumber: 'RHOAI-3.5',
        productName: 'RHOAI',
        dueDate: '2026-09-15',
        codeFreezeDate: '2026-08-20',
        planningFreezeDate: '2026-07-10'
      }
    ]);

    const result = await runRegistrySync(storage, {});

    expect(result.archived).toBe(1);
    const registry = storage._store[REGISTRY_FILE];
    const archived = registry.releases.find(r => r.id === 'rhoai-3.4');
    expect(archived.state).toBe('archived');
  });

  it('does not update non-product-pages sourced releases', async () => {
    const manualRelease = normalizeRelease({
      id: 'rhoai-3.5',
      displayName: 'RHOAI-3.5',
      milestones: { ga: '2026-09-01', codeFreeze: null, planningFreeze: null },
      source: 'manual',
      state: 'active'
    });

    const storage = createMockStorage({
      [REGISTRY_FILE]: { schemaVersion: 1, releases: [manualRelease] }
    });

    ppMod.fetchProductsByShortname.mockResolvedValue([
      {
        releaseNumber: 'RHOAI-3.5',
        productName: 'RHOAI',
        dueDate: '2026-09-15',
        codeFreezeDate: '2026-08-20',
        planningFreezeDate: '2026-07-10'
      }
    ]);

    const result = await runRegistrySync(storage, {});

    expect(result.updated).toBe(0);
    const registry = storage._store[REGISTRY_FILE];
    const release = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(release.milestones.planningFreeze).toBeNull();
  });
});
