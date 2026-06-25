import { describe, it, expect } from 'vitest';

const { normalizeVersionName, matchVersionsToReleases, autoResolveFixVersions, REGISTRY_FILE } = require('../../server/registry');
const { loadRegistryConfig, saveRegistryConfig, STORAGE_KEY } = require('../../server/registry-config');

function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null; },
    writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
    _store: store
  };
}

describe('normalizeVersionName', () => {
  it('lowercases', () => {
    expect(normalizeVersionName('RHOAI-2.14')).toBe('rhoai 2 14');
  });

  it('strips terminal .z suffix', () => {
    expect(normalizeVersionName('rhoai-3.5.z')).toBe('rhoai 3 5');
  });

  it('strips .z before EA suffix', () => {
    expect(normalizeVersionName('rhoai-3.5.z.EA1')).toBe('rhoai 3 5 ea1');
  });

  it('normalizes dots and hyphens to spaces', () => {
    expect(normalizeVersionName('RHOAI-2.14')).toBe('rhoai 2 14');
    expect(normalizeVersionName('RHOAI 2.14')).toBe('rhoai 2 14');
    expect(normalizeVersionName('rhoai.2.14')).toBe('rhoai 2 14');
  });

  it('normalizes EA variants to same form', () => {
    // "RHAII-3.5.EA1" and "RHAII-3.5 EA1" should normalize identically
    expect(normalizeVersionName('RHAII-3.5.EA1')).toBe('rhaii 3 5 ea1');
    expect(normalizeVersionName('RHAII-3.5 EA1')).toBe('rhaii 3 5 ea1');
    expect(normalizeVersionName('RHAII 3.5 EA1')).toBe('rhaii 3 5 ea1');
  });

  it('handles underscores', () => {
    expect(normalizeVersionName('rhoai_3_5')).toBe('rhoai 3 5');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeVersionName('rhoai  3.5')).toBe('rhoai 3 5');
  });

  it('trims whitespace', () => {
    expect(normalizeVersionName('  rhoai-3.5  ')).toBe('rhoai 3 5');
  });

  it('normalizes RHAISTRAT GA format to canonical form', () => {
    expect(normalizeVersionName('3.5 GA RHOAI RELEASE')).toBe('rhoai 3 5');
    expect(normalizeVersionName('3.5 GA RHAII RELEASE')).toBe('rhaii 3 5');
    expect(normalizeVersionName('3.5 GA RHELAI RELEASE')).toBe('rhelai 3 5');
  });

  it('normalizes RHAISTRAT EA format to canonical form', () => {
    expect(normalizeVersionName('3.5 EA1 RHOAI RELEASE')).toBe('rhoai 3 5 ea1');
    expect(normalizeVersionName('3.5 EA2 RHOAI RELEASE')).toBe('rhoai 3 5 ea2');
    expect(normalizeVersionName('3.5 EA1 RHAII RELEASE')).toBe('rhaii 3 5 ea1');
  });

  it('RHAISTRAT and RHOAIENG normalize to same form', () => {
    expect(normalizeVersionName('3.5 GA RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.5'));
    expect(normalizeVersionName('3.5 EA1 RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.5.EA1'));
    expect(normalizeVersionName('3.5 EA2 RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.5.EA2'));
    expect(normalizeVersionName('3.6 EA1 RHOAI RELEASE')).toBe(normalizeVersionName('rhoai-3.6.EA1'));
    expect(normalizeVersionName('3.5 GA RHAII RELEASE')).toBe(normalizeVersionName('RHAII-3.5'));
  });

  it('does not rearrange non-RHAISTRAT patterns', () => {
    // z-stream versions with different format should NOT match
    expect(normalizeVersionName('RHOAI 3.3.5 GA')).toBe('rhoai 3 3 5 ga');
    expect(normalizeVersionName('RHAII 3.3.5 Release')).toBe('rhaii 3 3 5 release');
    expect(normalizeVersionName('rhai-3.5')).toBe('rhai 3 5');
  });
});

describe('matchVersionsToReleases', () => {
  const baseReleases = [
    { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: [], state: 'active' },
    { id: 'rhoai-3.5.z.ea1', displayName: 'rhoai-3.5.z.EA1', fixVersions: [], state: 'active' },
    { id: 'rhaii-3.5.ea1', displayName: 'RHAII-3.5.EA1', fixVersions: [], state: 'active' },
    { id: 'rhaii-3.6', displayName: 'RHAII-3.6', fixVersions: [], state: 'active' },
    { id: 'rhoai-3.4.z', displayName: 'rhoai-3.4.z', fixVersions: [], state: 'archived' }
  ];

  it('matches rhoai-3.5 to rhoai-3.5.z (strips .z)', () => {
    const jiraVersions = [{ name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' }];
    const result = matchVersionsToReleases(jiraVersions, baseReleases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].releaseId).toBe('rhoai-3.5.z');
    expect(result.matches[0].proposedFixVersions).toEqual(['rhoai-3.5']);
    expect(result.unmatched).toHaveLength(0);
  });

  it('matches rhoai-3.5.EA1 to rhoai-3.5.z.EA1 (strips .z)', () => {
    const jiraVersions = [{ name: 'rhoai-3.5.EA1', id: '2', project: 'RHOAIENG' }];
    const result = matchVersionsToReleases(jiraVersions, baseReleases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].releaseId).toBe('rhoai-3.5.z.ea1');
    expect(result.matches[0].proposedFixVersions).toEqual(['rhoai-3.5.EA1']);
  });

  it('matches RHAII-3.5 EA1 to RHAII-3.5.EA1 (dot vs space)', () => {
    const jiraVersions = [{ name: 'RHAII-3.5 EA1', id: '3', project: 'RHAISTRAT' }];
    const result = matchVersionsToReleases(jiraVersions, baseReleases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].releaseId).toBe('rhaii-3.5.ea1');
  });

  it('matches exact version strings', () => {
    const jiraVersions = [{ name: 'RHAII-3.6', id: '4', project: 'RHAISTRAT' }];
    const result = matchVersionsToReleases(jiraVersions, baseReleases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].releaseId).toBe('rhaii-3.6');
  });

  it('reports unmatched Jira versions', () => {
    const jiraVersions = [{ name: 'UNKNOWN-1.0', id: '5', project: 'RHOAIENG' }];
    const result = matchVersionsToReleases(jiraVersions, baseReleases);
    expect(result.matches).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].name).toBe('UNKNOWN-1.0');
  });

  it('skips archived releases', () => {
    const jiraVersions = [{ name: 'rhoai-3.4', id: '6', project: 'RHOAIENG' }];
    const result = matchVersionsToReleases(jiraVersions, baseReleases);
    expect(result.matches).toHaveLength(0);
    expect(result.unmatched).toHaveLength(1);
  });

  it('does not duplicate existing fixVersions in proposed', () => {
    const releases = [
      { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['rhoai-3.5'], state: 'active' }
    ];
    const jiraVersions = [{ name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' }];
    const result = matchVersionsToReleases(jiraVersions, releases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].proposedFixVersions).toEqual(['rhoai-3.5']);
  });

  it('adds new Jira versions to existing fixVersions', () => {
    const releases = [
      { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['existing-v'], state: 'active' }
    ];
    const jiraVersions = [{ name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' }];
    const result = matchVersionsToReleases(jiraVersions, releases);
    expect(result.matches[0].proposedFixVersions).toEqual(['existing-v', 'rhoai-3.5']);
  });

  it('matches via existing fixVersions on the release', () => {
    const releases = [
      { id: 'custom-release', displayName: 'Custom Release', fixVersions: ['rhoai-3.5'], state: 'active' }
    ];
    const jiraVersions = [{ name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' }];
    const result = matchVersionsToReleases(jiraVersions, releases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].releaseId).toBe('custom-release');
  });

  it('groups multiple Jira versions matching the same release', () => {
    const releases = [
      { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: [], state: 'active' }
    ];
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' },
      { name: 'rhoai-3.5', id: '2', project: 'RHAISTRAT' }
    ];
    const result = matchVersionsToReleases(jiraVersions, releases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].jiraMatches).toHaveLength(2);
    // Proposed should deduplicate by name
    expect(result.matches[0].proposedFixVersions).toEqual(['rhoai-3.5']);
  });

  it('does not produce false positives between similar versions', () => {
    const releases = [
      { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: [], state: 'active' },
      { id: 'rhoai-3.6.z', displayName: 'rhoai-3.6.z', fixVersions: [], state: 'active' }
    ];
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' },
      { name: 'rhoai-3.6', id: '2', project: 'RHOAIENG' }
    ];
    const result = matchVersionsToReleases(jiraVersions, releases);
    expect(result.matches).toHaveLength(2);

    const match35 = result.matches.find(m => m.releaseId === 'rhoai-3.5.z');
    const match36 = result.matches.find(m => m.releaseId === 'rhoai-3.6.z');
    expect(match35.proposedFixVersions).toEqual(['rhoai-3.5']);
    expect(match36.proposedFixVersions).toEqual(['rhoai-3.6']);
  });

  it('matches RHAISTRAT naming to registry releases', () => {
    const releases = [
      { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active' },
      { id: 'rhoai-3.5.ea1', displayName: 'rhoai-3.5.EA1', fixVersions: [], state: 'active' }
    ];
    const jiraVersions = [
      { name: '3.5 GA RHOAI RELEASE', id: '1', project: 'RHAISTRAT' },
      { name: '3.5 EA1 RHOAI RELEASE', id: '2', project: 'RHAISTRAT' }
    ];
    const result = matchVersionsToReleases(jiraVersions, releases);
    expect(result.matches).toHaveLength(2);
    expect(result.unmatched).toHaveLength(0);

    const gaMatch = result.matches.find(m => m.releaseId === 'rhoai-3.5');
    expect(gaMatch.proposedFixVersions).toContain('3.5 GA RHOAI RELEASE');

    const ea1Match = result.matches.find(m => m.releaseId === 'rhoai-3.5.ea1');
    expect(ea1Match.proposedFixVersions).toContain('3.5 EA1 RHOAI RELEASE');
  });

  it('matches RHAISTRAT and RHOAIENG versions to the same release', () => {
    const releases = [
      { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active' }
    ];
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' },
      { name: '3.5 GA RHOAI RELEASE', id: '2', project: 'RHAISTRAT' }
    ];
    const result = matchVersionsToReleases(jiraVersions, releases);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].jiraMatches).toHaveLength(2);
    expect(result.matches[0].proposedFixVersions).toContain('rhoai-3.5');
    expect(result.matches[0].proposedFixVersions).toContain('3.5 GA RHOAI RELEASE');
  });
});

describe('registry-config', () => {
  it('returns defaults when no config exists', () => {
    const storage = createMockStorage();
    const config = loadRegistryConfig(storage);
    expect(config.jiraProjects).toEqual(['RHAISTRAT', 'RHOAIENG']);
  });

  it('loads stored config', () => {
    const storage = createMockStorage({
      [STORAGE_KEY]: { jiraProjects: ['PROJ1', 'PROJ2'] }
    });
    const config = loadRegistryConfig(storage);
    expect(config.jiraProjects).toEqual(['PROJ1', 'PROJ2']);
  });

  it('falls back to defaults for malformed data', () => {
    const storage = createMockStorage({ [STORAGE_KEY]: 'not-object' });
    const config = loadRegistryConfig(storage);
    expect(config.jiraProjects).toEqual(['RHAISTRAT', 'RHOAIENG']);
  });

  it('saves config to storage', () => {
    const storage = createMockStorage();
    saveRegistryConfig(storage, { jiraProjects: ['A', 'B'] });
    expect(storage._store[STORAGE_KEY].jiraProjects).toEqual(['A', 'B']);
  });

  it('filters out non-string and empty project values', () => {
    const storage = createMockStorage();
    saveRegistryConfig(storage, { jiraProjects: ['A', '', null, 42, 'B'] });
    expect(storage._store[STORAGE_KEY].jiraProjects).toEqual(['A', 'B']);
  });

  it('throws on non-object config', () => {
    const storage = createMockStorage();
    expect(() => saveRegistryConfig(storage, null)).toThrow('Config must be an object');
  });
});

describe('autoResolveFixVersions', () => {
  function mockJira(jiraVersions) {
    return {
      fetchProjectVersions: async () => jiraVersions,
      jiraRequest: () => {}
    };
  }

  it('populates empty fixVersions from Jira version matches', async () => {
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' },
      { name: 'rhoai-3.5.EA1', id: '2', project: 'RHOAIENG' }
    ];

    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active' },
          { id: 'rhoai-3.5.ea1', displayName: 'rhoai-3.5.EA1', fixVersions: [], state: 'active' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG'] }
    });

    const result = await autoResolveFixVersions(storage, mockJira(jiraVersions));
    expect(result.status).toBe('ok');
    expect(result.resolved).toBe(2);

    const registry = storage._store[REGISTRY_FILE];
    const ga = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(ga.fixVersions).toContain('rhoai-3.5');

    const ea1 = registry.releases.find(r => r.id === 'rhoai-3.5.ea1');
    expect(ea1.fixVersions).toContain('rhoai-3.5.EA1');
  });

  it('adds new versions to releases that already have fixVersions', async () => {
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' },
      { name: '3.5 GA RHOAI RELEASE', id: '2', project: 'RHAISTRAT' },
      { name: 'rhoai-3.6', id: '3', project: 'RHOAIENG' }
    ];

    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: ['rhoai-3.5'], state: 'active' },
          { id: 'rhoai-3.6', displayName: 'rhoai-3.6', fixVersions: [], state: 'active' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG', 'RHAISTRAT'] }
    });

    const result = await autoResolveFixVersions(storage, mockJira(jiraVersions));
    expect(result.status).toBe('ok');
    expect(result.resolved).toBe(2);

    const registry = storage._store[REGISTRY_FILE];
    // rhoai-3.5 should now have BOTH the existing and newly-discovered RHAISTRAT version
    const ga = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(ga.fixVersions).toContain('rhoai-3.5');
    expect(ga.fixVersions).toContain('3.5 GA RHOAI RELEASE');
    // rhoai-3.6 should get its version populated
    expect(registry.releases.find(r => r.id === 'rhoai-3.6').fixVersions).toContain('rhoai-3.6');
  });

  it('does not duplicate existing fixVersions', async () => {
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' }
    ];

    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: ['rhoai-3.5'], state: 'active' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG'] }
    });

    const result = await autoResolveFixVersions(storage, mockJira(jiraVersions));
    expect(result.status).toBe('skipped');
    // fixVersions unchanged — rhoai-3.5 was already present
    const registry = storage._store[REGISTRY_FILE];
    expect(registry.releases[0].fixVersions).toEqual(['rhoai-3.5']);
  });

  it('returns skipped when Jira returns no versions', async () => {
    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG'] }
    });

    const result = await autoResolveFixVersions(storage, mockJira([]));
    expect(result.status).toBe('skipped');
    expect(result.message).toMatch(/No Jira versions found/);
  });

  it('ignores archived releases with empty fixVersions', async () => {
    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'archived' }
        ]
      }
    });

    const result = await autoResolveFixVersions(storage);
    expect(result.status).toBe('skipped');
  });

  it('writes audit log when versions are resolved', async () => {
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' }
    ];

    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG'] }
    });

    await autoResolveFixVersions(storage, mockJira(jiraVersions));

    // Verify audit log was written
    const auditKey = 'releases/audit-log.json';
    const audit = storage._store[auditKey];
    expect(audit).toBeDefined();
    const entry = audit.entries.find(e => e.action === 'registry_auto_resolve_versions');
    expect(entry).toBeDefined();
    expect(entry.summary).toMatch(/Auto-resolved/);
  });
});

describe('migration + auto-resolve pipeline (integration)', () => {
  const { migrateNormalizedIds } = require('../../server/registry');

  function mockJira(jiraVersions) {
    return {
      fetchProjectVersions: async () => jiraVersions,
      jiraRequest: () => {}
    };
  }

  it('migrates .z entries then auto-resolves fixVersions in one pass', async () => {
    // Simulate the exact production bug: PP sync created both .z (archived, with
    // fixVersions) and clean (active, empty fixVersions) entries.
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' },
      { name: 'rhoai-3.5.EA1', id: '2', project: 'RHOAIENG' },
      { name: 'rhoai-3.5.EA2', id: '3', project: 'RHOAIENG' }
    ];

    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          // .z entries (archived, have fixVersions from previous auto-resolve)
          { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['rhoai-3.5', 'rhoai-3.5.z'], state: 'archived', source: 'product-pages' },
          { id: 'rhoai-3.5.z.ea1', displayName: 'rhoai-3.5.z.EA1', fixVersions: ['rhoai-3.5.EA1'], state: 'archived', source: 'product-pages' },
          { id: 'rhoai-3.5.z.ea2', displayName: 'rhoai-3.5.z.EA2', fixVersions: ['rhoai-3.5.EA2'], state: 'archived', source: 'product-pages' },
          // Clean entries (active, empty fixVersions — the bug)
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active', source: 'product-pages' },
          { id: 'rhoai-3.5.ea1', displayName: 'rhoai-3.5.EA1', fixVersions: [], state: 'active', source: 'product-pages' },
          { id: 'rhoai-3.5.ea2', displayName: 'rhoai-3.5.EA2', fixVersions: [], state: 'active', source: 'product-pages' },
          // Unrelated entry — should be untouched
          { id: 'rhaii-3.6', displayName: 'RHAII-3.6', fixVersions: ['RHAII-3.6'], state: 'active', source: 'product-pages' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG'] }
    });

    // Step 1: Migration merges .z entries into clean entries, carrying fixVersions
    const registry = storage.readFromStorage(REGISTRY_FILE);
    const migrated = migrateNormalizedIds(registry);
    storage.writeToStorage(REGISTRY_FILE, registry);

    expect(migrated).toBe(3); // 3 groups merged
    expect(registry.releases).toHaveLength(4); // 7 → 4

    // After migration, the GA entry should have fixVersions from the .z entry (minus .z names)
    const gaAfterMigrate = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(gaAfterMigrate.state).toBe('active');
    expect(gaAfterMigrate.fixVersions).toContain('rhoai-3.5');
    expect(gaAfterMigrate.fixVersions).not.toContain('rhoai-3.5.z');

    // EA entries should also have fixVersions from their .z counterparts
    const ea1AfterMigrate = registry.releases.find(r => r.id === 'rhoai-3.5.ea1');
    expect(ea1AfterMigrate.fixVersions).toContain('rhoai-3.5.EA1');

    // Step 2: Auto-resolve should be a no-op since migration already carried fixVersions
    const result = await autoResolveFixVersions(storage, mockJira(jiraVersions));
    expect(result.status).toBe('skipped');
  });

  it('auto-resolves fixVersions for entries that migration could not populate', async () => {
    // Scenario: .z entries were deleted (not archived) before migration ran,
    // so clean entries have no fixVersions source to inherit from.
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' },
      { name: 'rhoai-3.5.EA1', id: '2', project: 'RHOAIENG' }
    ];

    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active', source: 'product-pages' },
          { id: 'rhoai-3.5.ea1', displayName: 'rhoai-3.5.EA1', fixVersions: [], state: 'active', source: 'product-pages' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG'] }
    });

    // Step 1: Migration is a no-op (IDs already clean)
    const registry = storage.readFromStorage(REGISTRY_FILE);
    const migrated = migrateNormalizedIds(registry);
    storage.writeToStorage(REGISTRY_FILE, registry);
    expect(migrated).toBe(0);

    // Step 2: Auto-resolve populates fixVersions from Jira
    const result = await autoResolveFixVersions(storage, mockJira(jiraVersions));
    expect(result.status).toBe('ok');
    expect(result.resolved).toBe(2);

    const final = storage.readFromStorage(REGISTRY_FILE);
    expect(final.releases.find(r => r.id === 'rhoai-3.5').fixVersions).toContain('rhoai-3.5');
    expect(final.releases.find(r => r.id === 'rhoai-3.5.ea1').fixVersions).toContain('rhoai-3.5.EA1');
  });

  it('preserves manually-curated fixVersions through the full pipeline', async () => {
    const jiraVersions = [
      { name: 'rhoai-3.5', id: '1', project: 'RHOAIENG' }
    ];

    const storage = createMockStorage({
      [REGISTRY_FILE]: {
        schemaVersion: 1,
        releases: [
          // .z entry has a manually-added fixVersion
          { id: 'rhoai-3.5.z', displayName: 'rhoai-3.5.z', fixVersions: ['manual-custom-fv', 'rhoai-3.5'], state: 'archived' },
          { id: 'rhoai-3.5', displayName: 'rhoai-3.5', fixVersions: [], state: 'active' }
        ]
      },
      [STORAGE_KEY]: { jiraProjects: ['RHOAIENG'] }
    });

    // Migration should carry the manual fixVersion
    const registry = storage.readFromStorage(REGISTRY_FILE);
    migrateNormalizedIds(registry);
    storage.writeToStorage(REGISTRY_FILE, registry);

    const merged = registry.releases.find(r => r.id === 'rhoai-3.5');
    expect(merged.fixVersions).toContain('manual-custom-fv');
    expect(merged.fixVersions).toContain('rhoai-3.5');

    // Auto-resolve should skip since fixVersions are populated
    const result = await autoResolveFixVersions(storage, mockJira(jiraVersions));
    expect(result.status).toBe('skipped');
  });
});
