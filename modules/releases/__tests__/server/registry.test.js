import { describe, it, expect } from 'vitest';

const { readRegistry, writeRegistry, validateRelease, normalizeRelease, REGISTRY_FILE } = require('../../server/registry');

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null; },
    writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
    _store: store
  };
}

describe('readRegistry', () => {
  it('returns empty registry when no data exists', () => {
    const storage = createMockStorage();
    const result = readRegistry(storage.readFromStorage);
    expect(result).toEqual({ schemaVersion: 1, releases: [] });
  });

  it('returns stored registry data', () => {
    const data = {
      schemaVersion: 1,
      releases: [{ id: 'test-1.0', displayName: 'Test 1.0' }]
    };
    const storage = createMockStorage({ [REGISTRY_FILE]: data });
    const result = readRegistry(storage.readFromStorage);
    expect(result.releases).toHaveLength(1);
    expect(result.releases[0].id).toBe('test-1.0');
  });

  it('returns empty registry for malformed data', () => {
    const storage = createMockStorage({ [REGISTRY_FILE]: { foo: 'bar' } });
    const result = readRegistry(storage.readFromStorage);
    expect(result).toEqual({ schemaVersion: 1, releases: [] });
  });
});

describe('writeRegistry', () => {
  it('writes registry to storage', () => {
    const storage = createMockStorage();
    const registry = { schemaVersion: 1, releases: [{ id: 'v1' }] };
    writeRegistry(storage.writeToStorage, registry);
    expect(storage._store[REGISTRY_FILE]).toEqual(registry);
  });
});

describe('validateRelease', () => {
  it('returns null for a valid release', () => {
    expect(validateRelease({
      id: 'rhoai-2.14',
      displayName: 'RHOAI 2.14',
      fixVersions: ['RHOAI-2.14'],
      state: 'active'
    })).toBeNull();
  });

  it('requires a release object', () => {
    expect(validateRelease(null)).toBe('Release object is required');
    expect(validateRelease(undefined)).toBe('Release object is required');
  });

  it('requires id', () => {
    expect(validateRelease({ displayName: 'Test' })).toMatch(/id is required/);
  });

  it('validates id format', () => {
    expect(validateRelease({ id: 'UPPER', displayName: 'Test' })).toMatch(/id must be lowercase/);
    expect(validateRelease({ id: '-starts-dash', displayName: 'Test' })).toMatch(/id must be lowercase/);
    expect(validateRelease({ id: 'has spaces', displayName: 'Test' })).toMatch(/id must be lowercase/);
  });

  it('allows dots, hyphens, underscores in id', () => {
    expect(validateRelease({ id: 'rhoai-2.14_beta', displayName: 'Test' })).toBeNull();
  });

  it('requires displayName', () => {
    expect(validateRelease({ id: 'test' })).toMatch(/displayName is required/);
  });

  it('validates fixVersions is an array', () => {
    expect(validateRelease({ id: 'test', displayName: 'Test', fixVersions: 'not-array' })).toMatch(/fixVersions must be an array/);
  });

  it('validates milestones is an object', () => {
    expect(validateRelease({ id: 'test', displayName: 'Test', milestones: 'not-object' })).toMatch(/milestones must be an object/);
  });

  it('validates state values', () => {
    expect(validateRelease({ id: 'test', displayName: 'Test', state: 'invalid' })).toMatch(/state must be one of/);
  });

  it('accepts valid states', () => {
    expect(validateRelease({ id: 'test', displayName: 'Test', state: 'active' })).toBeNull();
    expect(validateRelease({ id: 'test', displayName: 'Test', state: 'archived' })).toBeNull();
  });
});

describe('normalizeRelease', () => {
  it('normalizes id to lowercase', () => {
    const result = normalizeRelease({ id: ' Test-1.0 ', displayName: 'Test' });
    expect(result.id).toBe('test-1.0');
  });

  it('trims displayName', () => {
    const result = normalizeRelease({ id: 'test', displayName: '  RHOAI 2.14  ' });
    expect(result.displayName).toBe('RHOAI 2.14');
  });

  it('defaults fixVersions to empty array', () => {
    const result = normalizeRelease({ id: 'test', displayName: 'Test' });
    expect(result.fixVersions).toEqual([]);
  });

  it('defaults state to active', () => {
    const result = normalizeRelease({ id: 'test', displayName: 'Test' });
    expect(result.state).toBe('active');
  });

  it('defaults nullable fields to null', () => {
    const result = normalizeRelease({ id: 'test', displayName: 'Test' });
    expect(result.productPagesShortname).toBeNull();
    expect(result.productPagesVersion).toBeNull();
  });

  it('sets createdAt and updatedAt', () => {
    const result = normalizeRelease({ id: 'test', displayName: 'Test' });
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('preserves provided createdAt', () => {
    const result = normalizeRelease({ id: 'test', displayName: 'Test', createdAt: '2025-01-01T00:00:00Z' });
    expect(result.createdAt).toBe('2025-01-01T00:00:00Z');
  });

  it('preserves milestones', () => {
    const result = normalizeRelease({
      id: 'test',
      displayName: 'Test',
      milestones: { ga: '2026-07-01', codeFreeze: '2026-06-01' }
    });
    expect(result.milestones.ga).toBe('2026-07-01');
    expect(result.milestones.codeFreeze).toBe('2026-06-01');
  });
});
