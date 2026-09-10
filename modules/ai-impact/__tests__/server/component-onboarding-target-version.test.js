const { describe, it, expect } = require('vitest');
const {
  isOdhBuildType,
  resolveTargetVersion,
  extractVersionNameFromJiraField,
  needsTargetVersionEnrichment
} = require('../../server/component-onboarding/target-version');
const { validateComponentOnboarding } = require('../../server/component-onboarding/validation');
const { enrichTargetVersionsFromJira } = require('../../server/component-onboarding/jira-sync');

describe('isOdhBuildType', () => {
  it('detects CI and Release build types', () => {
    expect(isOdhBuildType('CI')).toBe(true);
    expect(isOdhBuildType('release')).toBe(true);
    expect(isOdhBuildType('3.6 GA RHOAI RELEASE')).toBe(false);
  });
});

describe('resolveTargetVersion', () => {
  it('prefers jiraTargetVersion over legacy build_type targetVersion', () => {
    expect(resolveTargetVersion({
      targetVersion: 'CI',
      jiraTargetVersion: '3.6 GA RHOAI RELEASE'
    })).toBe('3.6 GA RHOAI RELEASE');
  });

  it('drops build_type-only targetVersion values', () => {
    expect(resolveTargetVersion({ targetVersion: 'Release' })).toBeNull();
  });

  it('keeps numeric Jira target versions', () => {
    expect(resolveTargetVersion({ targetVersion: 'rhoai-3.5' })).toBe('rhoai-3.5');
    expect(resolveTargetVersion({ targetVersion: '3.6 EA2 RHOAI RELEASE' })).toBe('3.6 EA2 RHOAI RELEASE');
  });
});

describe('validateComponentOnboarding targetVersion', () => {
  const base = {
    key: 'RHOAIENG-1',
    summary: 'Test onboarding',
    status: 'In Progress',
    completionStatus: 'in-progress',
    productContext: 'ODH',
    syncedAt: '2026-01-01T00:00:00.000Z'
  };

  it('stores null targetVersion when ingest sends build_type as targetVersion', () => {
    const result = validateComponentOnboarding({ ...base, targetVersion: 'CI' });
    expect(result.valid).toBe(true);
    expect(result.data.targetVersion).toBeNull();
  });

  it('stores Jira target version from jiraTargetVersion alias', () => {
    const result = validateComponentOnboarding({
      ...base,
      targetVersion: 'CI',
      jiraTargetVersion: '3.6 GA RHOAI RELEASE'
    });
    expect(result.valid).toBe(true);
    expect(result.data.targetVersion).toBe('3.6 GA RHOAI RELEASE');
  });
});

describe('extractVersionNameFromJiraField', () => {
  it('extracts version name from Jira field shapes', () => {
    expect(extractVersionNameFromJiraField({ name: '3.6 GA RHOAI RELEASE' }))
      .toBe('3.6 GA RHOAI RELEASE');
    expect(extractVersionNameFromJiraField([{ name: '3.5 EA1 RHOAI RELEASE' }]))
      .toBe('3.5 EA1 RHOAI RELEASE');
    expect(extractVersionNameFromJiraField('rhoai-3.6')).toBe('rhoai-3.6');
  });
});

describe('enrichTargetVersionsFromJira', () => {
  it('back-fills targetVersion from Jira for ODH build_type placeholders', async () => {
    const data = {
      components: {
        'RHOAIENG-93240': {
          latest: {
            key: 'RHOAIENG-93240',
            targetVersion: 'CI',
            productContext: 'ODH'
          },
          history: []
        }
      }
    };

    const fetchFn = async (_jiraRequest, _jql, _fields) => ([
      {
        key: 'RHOAIENG-93240',
        fields: { customfield_10855: { name: '3.6 GA RHOAI RELEASE' } }
      }
    ]);

    const result = await enrichTargetVersionsFromJira(data, () => {}, fetchFn);

    expect(result.updated).toBe(1);
    expect(data.components['RHOAIENG-93240'].latest.targetVersion)
      .toBe('3.6 GA RHOAI RELEASE');
    expect(needsTargetVersionEnrichment(data.components['RHOAIENG-93240'].latest)).toBe(false);
  });

  it('skips components that already have a release targetVersion', async () => {
    const data = {
      components: {
        'RHOAIENG-1': {
          latest: { key: 'RHOAIENG-1', targetVersion: 'rhoai-3.5' },
          history: []
        }
      }
    };

    const fetchFn = async () => { throw new Error('should not fetch'); };
    const result = await enrichTargetVersionsFromJira(data, () => {}, fetchFn);

    expect(result.synced).toBe(0);
    expect(result.updated).toBe(0);
  });
});
