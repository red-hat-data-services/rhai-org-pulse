import { describe, it, expect } from 'vitest';

const { readRegistry, writeRegistry, validateRelease, normalizeRelease, migrateNormalizedIds, REGISTRY_FILE } = require('../../server/registry');

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

describe('migrateNormalizedIds', () => {
  it('normalises a single .z-suffixed entry ID in place', () => {
    const registry = {
      releases: [
        { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['rhoai-3.5'], state: 'active' }
      ]
    };
    const count = migrateNormalizedIds(registry);
    expect(count).toBe(1);
    expect(registry.releases).toHaveLength(1);
    expect(registry.releases[0].id).toBe('rhoai-3.5');
    expect(registry.releases[0].fixVersions).toEqual(['rhoai-3.5']);
  });

  it('merges .z and clean entries, preserving fixVersions union (excluding .z)', () => {
    const registry = {
      releases: [
        { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['rhoai-3.5', 'rhoai-3.5.z'], state: 'archived' },
        { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active' }
      ]
    };
    const count = migrateNormalizedIds(registry);
    expect(count).toBe(1);
    expect(registry.releases).toHaveLength(1);
    expect(registry.releases[0].id).toBe('rhoai-3.5');
    expect(registry.releases[0].state).toBe('active');
    // fixVersions merged but .z-suffixed names stripped
    expect(registry.releases[0].fixVersions).toContain('rhoai-3.5');
    expect(registry.releases[0].fixVersions).not.toContain('rhoai-3.5.z');
  });

  it('prefers active entry over archived when merging', () => {
    const registry = {
      releases: [
        { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['v1'], state: 'archived' },
        { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: ['v2'], state: 'active' }
      ]
    };
    migrateNormalizedIds(registry);
    expect(registry.releases).toHaveLength(1);
    expect(registry.releases[0].state).toBe('active');
    expect(registry.releases[0].fixVersions).toContain('v1');
    expect(registry.releases[0].fixVersions).toContain('v2');
  });

  it('handles EA variant merges (rhoai-3.5.z.ea1 → rhoai-3.5.ea1)', () => {
    const registry = {
      releases: [
        { id: 'rhoai-3.5.z.ea1', displayName: 'rhoai-3.5.z.EA1', fixVersions: ['rhoai-3.5.EA1'], state: 'archived' },
        { id: 'rhoai-3.5.ea1', displayName: 'rhoai-3.5.EA1', fixVersions: [], state: 'active' }
      ]
    };
    migrateNormalizedIds(registry);
    expect(registry.releases).toHaveLength(1);
    expect(registry.releases[0].id).toBe('rhoai-3.5.ea1');
    expect(registry.releases[0].fixVersions).toEqual(['rhoai-3.5.EA1']);
  });

  it('is idempotent — no-op when IDs are already clean', () => {
    const registry = {
      releases: [
        { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: ['v1'], state: 'active' },
        { id: 'rhoai-3.6', displayName: 'rhoai-3.6', fixVersions: ['v2'], state: 'active' }
      ]
    };
    const count = migrateNormalizedIds(registry);
    expect(count).toBe(0);
    expect(registry.releases).toHaveLength(2);
  });

  it('handles multiple duplicate groups in one pass', () => {
    const registry = {
      releases: [
        { id: 'rhoai-3.5.z', displayName: 'X', fixVersions: ['fv-a'], state: 'archived' },
        { id: 'rhoai-3.5', displayName: 'X', fixVersions: [], state: 'active' },
        { id: 'rhoai-3.6.z', displayName: 'Y', fixVersions: ['fv-b'], state: 'archived' },
        { id: 'rhoai-3.6', displayName: 'Y', fixVersions: [], state: 'active' },
        { id: 'rhaii-3.5', displayName: 'Z', fixVersions: ['fv-c'], state: 'active' } // no .z counterpart
      ]
    };
    const count = migrateNormalizedIds(registry);
    expect(count).toBe(2); // two groups merged
    expect(registry.releases).toHaveLength(3); // 5 → 3
    const ids = registry.releases.map(r => r.id).sort();
    expect(ids).toEqual(['rhaii-3.5', 'rhoai-3.5', 'rhoai-3.6']);
    expect(registry.releases.find(r => r.id === 'rhoai-3.5').fixVersions).toContain('fv-a');
    expect(registry.releases.find(r => r.id === 'rhoai-3.6').fixVersions).toContain('fv-b');
  });

  it('does not lose fixVersions when both entries have them', () => {
    const registry = {
      releases: [
        { id: 'rhoai-3.5.z', displayName: 'X', fixVersions: ['a', 'b'], state: 'active' },
        { id: 'rhoai-3.5', displayName: 'X', fixVersions: ['b', 'c'], state: 'active' }
      ]
    };
    migrateNormalizedIds(registry);
    expect(registry.releases).toHaveLength(1);
    const fvs = registry.releases[0].fixVersions.sort();
    expect(fvs).toEqual(['a', 'b', 'c']); // union, no duplicates
  });

  it('preserves non-PP entries that happen to have .z in their ID', () => {
    const registry = {
      releases: [
        { id: 'custom.z-release', displayName: 'Custom', fixVersions: [], state: 'active' }
      ]
    };
    // stripZStream removes ".z" word boundary — "custom.z-release" → "custom-release"
    migrateNormalizedIds(registry);
    expect(registry.releases).toHaveLength(1);
    expect(registry.releases[0].id).toBe('custom-release');
  });

  it('reproduces the exact production bug scenario', () => {
    // This is the state observed in production: 6 .z entries (archived, with fixVersions)
    // and 6 clean entries (active, empty fixVersions)
    const registry = {
      releases: [
        { id: 'rhoai-3.5.z.ea1', displayName: 'rhoai-3.5.z.EA1', fixVersions: ['rhoai-3.5.EA1'], state: 'archived', source: 'product-pages' },
        { id: 'rhoai-3.5.z.ea2', displayName: 'rhoai-3.5.z.EA2', fixVersions: ['rhoai-3.5.EA2'], state: 'archived', source: 'product-pages' },
        { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['rhoai-3.5', 'rhoai-3.5.z'], state: 'archived', source: 'product-pages' },
        { id: 'rhoai-3.5.ea1', displayName: 'rhoai-3.5.EA1', fixVersions: [], state: 'active', source: 'product-pages' },
        { id: 'rhoai-3.5.ea2', displayName: 'rhoai-3.5.EA2', fixVersions: [], state: 'active', source: 'product-pages' },
        { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active', source: 'product-pages' },
        // Non-duplicate entry — should be untouched
        { id: 'rhaii-3.5.ea1', displayName: 'RHAII-3.5.EA1', fixVersions: ['RHAII-3.5 EA1'], state: 'active', source: 'product-pages' }
      ]
    };

    migrateNormalizedIds(registry);

    // Should be down to 4 entries (3 merged pairs + 1 untouched)
    expect(registry.releases).toHaveLength(4);

    const ea1 = registry.releases.find(r => r.id === 'rhoai-3.5.ea1');
    expect(ea1).toBeDefined();
    expect(ea1.state).toBe('active');
    expect(ea1.fixVersions).toEqual(['rhoai-3.5.EA1']);

    const ea2 = registry.releases.find(r => r.id === 'rhoai-3.5.ea2');
    expect(ea2).toBeDefined();
    expect(ea2.fixVersions).toEqual(['rhoai-3.5.EA2']);

    const ga = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(ga).toBeDefined();
    expect(ga.fixVersions).toContain('rhoai-3.5');
    expect(ga.fixVersions).not.toContain('rhoai-3.5.z');

    const rhaii = registry.releases.find(r => r.id === 'rhaii-3.5.ea1');
    expect(rhaii).toBeDefined();
    expect(rhaii.fixVersions).toEqual(['RHAII-3.5 EA1']);
  });
});
