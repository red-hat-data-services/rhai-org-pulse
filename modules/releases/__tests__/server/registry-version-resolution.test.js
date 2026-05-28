import { describe, it, expect } from 'vitest';

const { normalizeVersionName, matchVersionsToReleases } = require('../../server/registry');
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
