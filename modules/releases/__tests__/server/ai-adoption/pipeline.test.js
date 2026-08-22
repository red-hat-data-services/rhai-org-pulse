import { describe, it, expect, vi } from 'vitest';

const {
  scanLabels,
  fetchAiAdoptionData,
  fetchChildRollups,
  resolveEffortSignal,
  applyEffortSignal,
  AI_PIPELINE_TAXONOMY,
  PIPELINE_KEYS,
  FIRST_PASS_RULES,
  FIRST_PASS_KEYS,
  RELEASE_GROUPS,
  PROJECTS
} = require('../../../server/ai-adoption/pipeline');

// ---------------------------------------------------------------------------
// scanLabels
// ---------------------------------------------------------------------------

describe('scanLabels', () => {
  it('returns touched=false for empty labels', () => {
    const result = scanLabels([]);
    expect(result.touched).toBe(false);
    for (const k of PIPELINE_KEYS) {
      expect(result.pipelines[k]).toBe(0);
    }
  });

  it('returns touched=false for unrelated labels', () => {
    const result = scanLabels(['bugfix', 'priority-high', 'team-green']);
    expect(result.touched).toBe(false);
  });

  it('detects a single stratCreator label', () => {
    const result = scanLabels(['strat-creator-auto-created']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.stratCreator).toBe(1);
    expect(result.pipelines.rfeCreator).toBe(0);
  });

  it('detects rfeCreator labels', () => {
    const result = scanLabels(['rfe-creator-auto-created', 'rfe-creator-feasibility-pass']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.rfeCreator).toBe(1);
  });

  it('detects testPlan labels', () => {
    const result = scanLabels(['test-plan-auto-created', 'test-plan-rubric-pass']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.testPlan).toBe(1);
  });

  it('detects qg1 labels', () => {
    const result = scanLabels(['rp-qg1-auto-rice']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.qg1).toBe(1);
  });

  it('detects aiDoc labels', () => {
    const result = scanLabels(['ai1st-doc-contributed']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.aiDoc).toBe(1);
  });

  it('detects uxdAgentic label', () => {
    const result = scanLabels(['uxd-agentic']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.uxdAgentic).toBe(1);
  });

  it('detects epicCreator labels', () => {
    const result = scanLabels(['epic-creator-auto-decomposed']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.epicCreator).toBe(1);
  });

  it('detects multiple pipelines simultaneously', () => {
    const result = scanLabels([
      'strat-creator-auto-created',
      'rfe-creator-auto-created',
      'test-plan-rubric-pass',
      'rp-qg1-pass',
      'ai1st-doc-invoked',
      'uxd-agentic',
      'epic-creator-auto-decomposed'
    ]);
    expect(result.touched).toBe(true);
    for (const k of PIPELINE_KEYS) {
      expect(result.pipelines[k]).toBe(1);
    }
  });

  it('handles mixed AI and non-AI labels', () => {
    const result = scanLabels(['team-green', 'strat-creator-rubric-pass', 'bugfix']);
    expect(result.touched).toBe(true);
    expect(result.pipelines.stratCreator).toBe(1);
    expect(result.pipelines.rfeCreator).toBe(0);
  });

  it('returns firstPass=1 for stratCreator with auto-created only', () => {
    const result = scanLabels(['strat-creator-auto-created']);
    expect(result.firstPass.stratCreator).toBe(1);
  });

  it('returns firstPass=0 for stratCreator with auto-created and auto-refined', () => {
    const result = scanLabels(['strat-creator-auto-created', 'strat-creator-auto-refined']);
    expect(result.firstPass.stratCreator).toBe(0);
  });

  it('returns firstPass=1 for qg1 with pass only', () => {
    const result = scanLabels(['rp-qg1-auto-rice', 'rp-qg1-pass']);
    expect(result.firstPass.qg1).toBe(1);
  });

  it('returns firstPass=0 for qg1 with pass and fail', () => {
    const result = scanLabels(['rp-qg1-auto-rice', 'rp-qg1-pass', 'rp-qg1-fail']);
    expect(result.firstPass.qg1).toBe(0);
  });

  it('returns firstPass=1 for rfeCreator accepted without autofix', () => {
    const result = scanLabels(['rfe-creator-auto-created', 'rfe-creator-feasibility-pass']);
    expect(result.firstPass.rfeCreator).toBe(1);
  });

  it('returns firstPass=0 for rfeCreator that needed autofix', () => {
    const result = scanLabels(['rfe-creator-auto-created', 'rfe-creator-autofix-rubric-pass']);
    expect(result.firstPass.rfeCreator).toBe(0);
  });

  it('returns firstPass=1 for testPlan created without revision', () => {
    const result = scanLabels(['test-plan-auto-created', 'test-plan-rubric-pass']);
    expect(result.firstPass.testPlan).toBe(1);
  });

  it('returns firstPass=0 for testPlan that was revised', () => {
    const result = scanLabels(['test-plan-auto-created', 'test-plan-auto-revised']);
    expect(result.firstPass.testPlan).toBe(0);
  });

  it('omits firstPass keys for pipelines not used by the issue', () => {
    const result = scanLabels(['strat-creator-auto-created']);
    expect(result.firstPass.stratCreator).toBe(1);
    expect(result.firstPass.rfeCreator).toBeUndefined();
    expect(result.firstPass.testPlan).toBeUndefined();
    expect(result.firstPass.qg1).toBeUndefined();
  });

  it('returns empty firstPass for no pipeline labels', () => {
    const result = scanLabels(['bugfix', 'team-green']);
    expect(Object.keys(result.firstPass)).toHaveLength(0);
  });

  it('does not set firstPass for pipelines without revision signals', () => {
    const result = scanLabels(['ai1st-doc-contributed', 'uxd-agentic', 'epic-creator-auto-decomposed']);
    expect(result.firstPass.aiDoc).toBeUndefined();
    expect(result.firstPass.uxdAgentic).toBeUndefined();
    expect(result.firstPass.epicCreator).toBeUndefined();
  });

  it('skips firstPass when pipeline is used but created label is absent', () => {
    const result = scanLabels(['rp-qg1-auto-rice']);
    expect(result.pipelines.qg1).toBe(1);
    expect(result.firstPass.qg1).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('exports expected pipeline keys', () => {
    expect(PIPELINE_KEYS).toEqual(
      expect.arrayContaining(['stratCreator', 'rfeCreator', 'testPlan', 'qg1', 'aiDoc', 'uxdAgentic', 'epicCreator'])
    );
    expect(PIPELINE_KEYS).toHaveLength(7);
  });

  it('exports expected release groups', () => {
    const names = RELEASE_GROUPS.map(g => g.name);
    expect(names).toEqual(['3.4 GA', '3.5 EA1', '3.5 EA2', '3.5 GA']);
  });

  it('exports expected projects', () => {
    expect(PROJECTS).toEqual(
      expect.arrayContaining(['AIPCC', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'RHAI', 'RHAISTRAT'])
    );
  });

  it('each pipeline has at least one prefix', () => {
    for (const key of PIPELINE_KEYS) {
      expect(AI_PIPELINE_TAXONOMY[key].prefixes.length).toBeGreaterThan(0);
    }
  });

  it('exports expected first-pass keys', () => {
    expect(FIRST_PASS_KEYS).toEqual(
      expect.arrayContaining(['stratCreator', 'rfeCreator', 'testPlan', 'qg1'])
    );
    expect(FIRST_PASS_KEYS).toHaveLength(4);
  });

  it('each first-pass rule has created and revised arrays', () => {
    for (const key of FIRST_PASS_KEYS) {
      expect(FIRST_PASS_RULES[key].created.length).toBeGreaterThan(0);
      expect(FIRST_PASS_RULES[key].revised.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// fetchAiAdoptionData
// ---------------------------------------------------------------------------

describe('fetchAiAdoptionData', () => {
  function makeMockJira(issuesByJql) {
    return {
      fetchAllJqlResults: vi.fn(async (jql) => issuesByJql[jql] || [])
    };
  }

  function makeIssue(key, labels, components) {
    return {
      key,
      fields: {
        summary: key,
        status: { name: 'New' },
        labels: labels || [],
        components: (components || []).map(name => ({ name })),
        fixVersions: []
      }
    };
  }

  it('returns empty results for no issues', async () => {
    const jira = makeMockJira({});
    const results = await fetchAiAdoptionData(jira);
    expect(results).toHaveLength(4);
    for (const r of results) {
      expect(r.totalFeatures).toBe(0);
      expect(r.aiTouchedFeatures).toBe(0);
      expect(r.components).toEqual([]);
    }
  });

  it('filters by releaseGroup option', async () => {
    const jira = makeMockJira({});
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA' });
    expect(results).toHaveLength(1);
    expect(results[0].releaseGroup).toBe('3.5 GA');
  });

  it('counts AI-touched features and component pipelines', async () => {
    const issues = [
      makeIssue('TEST-1', ['strat-creator-auto-created', 'rfe-creator-auto-created'], ['Dashboard']),
      makeIssue('TEST-2', ['test-plan-auto-created'], ['Dashboard']),
      makeIssue('TEST-3', [], ['Dashboard']),
      makeIssue('TEST-4', ['uxd-agentic'], ['Other Comp'])
    ];

    const jira = {
      fetchAllJqlResults: vi.fn(async () => issues)
    };

    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA' });
    expect(results).toHaveLength(1);

    const r = results[0];
    expect(r.totalFeatures).toBe(4);
    expect(r.aiTouchedFeatures).toBe(3);
    expect(r.components).toHaveLength(2);

    const dashboard = r.components.find(c => c.name === 'Dashboard');
    expect(dashboard.total).toBe(3);
    expect(dashboard.aiTouched).toBe(2);
    expect(dashboard.pipelines.stratCreator).toBe(1);
    expect(dashboard.pipelines.rfeCreator).toBe(1);
    expect(dashboard.pipelines.testPlan).toBe(1);

    const other = r.components.find(c => c.name === 'Other Comp');
    expect(other.total).toBe(1);
    expect(other.aiTouched).toBe(1);
    expect(other.pipelines.uxdAgentic).toBe(1);
  });

  it('deduplicates components across issues', async () => {
    const issues = [
      makeIssue('A-1', ['strat-creator-auto-created'], ['Shared']),
      makeIssue('B-1', ['rfe-creator-auto-created'], ['Shared'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA' });
    const shared = results[0].components.find(c => c.name === 'Shared');
    expect(shared.total).toBe(2);
    expect(shared.aiTouched).toBe(2);
    expect(shared.pipelines.stratCreator).toBe(1);
    expect(shared.pipelines.rfeCreator).toBe(1);
  });

  it('handles issues with no components', async () => {
    const issues = [makeIssue('X-1', ['uxd-agentic'], [])];
    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA' });
    const noComp = results[0].components.find(c => c.name === '(No Component)');
    expect(noComp).toBeDefined();
    expect(noComp.total).toBe(1);
    expect(noComp.aiTouched).toBe(1);
  });

  it('filters by component option', async () => {
    const issues = [
      makeIssue('A-1', ['strat-creator-auto-created'], ['Alpha']),
      makeIssue('B-1', ['rfe-creator-auto-created'], ['Beta'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA', component: 'Alpha' });
    expect(results[0].components).toHaveLength(1);
    expect(results[0].components[0].name).toBe('Alpha');
    expect(results[0].totalFeatures).toBe(1);
  });

  it('does not double-count multi-component issues when filtering', async () => {
    const issues = [
      makeIssue('A-1', ['strat-creator-auto-created'], ['Dashboard', 'UXD']),
      makeIssue('B-1', ['rfe-creator-auto-created'], ['Dashboard', 'UXD']),
      makeIssue('C-1', [], ['Dashboard']),
      makeIssue('D-1', ['uxd-agentic'], ['UXD'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA', component: 'Dashboard' });
    expect(results[0].totalFeatures).toBe(3);
    expect(results[0].aiTouchedFeatures).toBe(2);
    expect(results[0].components).toHaveLength(1);
    expect(results[0].components[0].name).toBe('Dashboard');
    expect(results[0].components[0].total).toBe(3);
  });

  it('sorts components by aiTouched descending', async () => {
    const issues = [
      makeIssue('A-1', [], ['Low']),
      makeIssue('B-1', ['strat-creator-auto-created'], ['High']),
      makeIssue('C-1', ['strat-creator-auto-created'], ['High']),
      makeIssue('D-1', ['rfe-creator-auto-created'], ['Mid'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA' });
    const names = results[0].components.map(c => c.name);
    expect(names[0]).toBe('High');
    expect(names[1]).toBe('Mid');
    expect(names[2]).toBe('Low');
  });

  it('handles Jira fetch failure gracefully', async () => {
    const jira = {
      fetchAllJqlResults: vi.fn(async () => { throw new Error('network error'); })
    };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 EA1' });
    expect(results).toHaveLength(1);
    expect(results[0].totalFeatures).toBe(0);
    expect(results[0].components).toEqual([]);
  });

  it('accumulates effort signals and resolves effort per group', async () => {
    const issues = [
      {
        key: 'E-1',
        fields: {
          summary: 'E-1', status: { name: 'Done' }, labels: ['strat-creator-auto-created'],
          components: [{ name: 'Alpha' }], fixVersions: [],
          customfield_10430: 5, customfield_10637: 3
        }
      },
      {
        key: 'E-2',
        fields: {
          summary: 'E-2', status: { name: 'Done' }, labels: [],
          components: [{ name: 'Alpha' }], fixVersions: [],
          customfield_10430: 3, customfield_10637: null
        }
      },
      {
        key: 'E-3',
        fields: {
          summary: 'E-3', status: { name: 'Done' }, labels: [],
          components: [{ name: 'Beta' }], fixVersions: [],
          customfield_10430: null, customfield_10637: null
        }
      }
    ];

    const childIssues = [
      { key: 'C-1', fields: { parent: { key: 'E-1' }, customfield_10016: 5, customfield_10637: null, timeoriginalestimate: null }},
      { key: 'C-2', fields: { parent: { key: 'E-1' }, customfield_10016: 3, customfield_10637: null, timeoriginalestimate: null }},
      { key: 'C-3', fields: { parent: { key: 'E-2' }, customfield_10016: 2, customfield_10637: null, timeoriginalestimate: null }}
    ];

    let callCount = 0;
    const jira = {
      fetchAllJqlResults: vi.fn(async () => {
        callCount++;
        if (callCount === 1) return issues;
        return childIssues;
      })
    };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA' });
    expect(results).toHaveLength(1);
    const g = results[0];

    expect(g.effortSignal).toBe('effort');
    expect(g.aggregateEffort).toBe(8);
    expect(g.avgEffort).toBe(2.7);

    const alpha = g.components.find(c => c.name === 'Alpha');
    expect(alpha.effortSum).toBe(8);
    expect(alpha.effortCount).toBe(2);
    expect(alpha.aggregateEffort).toBe(8);
    expect(alpha.avgEffort).toBe(4);
    expect(alpha.childSpSum).toBe(10);

    const beta = g.components.find(c => c.name === 'Beta');
    expect(beta.effortSum).toBe(0);
    expect(beta.aggregateEffort).toBe(0);
    expect(beta.childIssueSum).toBe(1);
  });

  it('falls back to childSp when custom fields are empty', async () => {
    const issues = [
      { key: 'F-1', fields: { summary: 'F-1', status: { name: 'Done' }, labels: [], components: [{ name: 'Comp' }], fixVersions: [], customfield_10430: null, customfield_10637: null }},
      { key: 'F-2', fields: { summary: 'F-2', status: { name: 'Done' }, labels: [], components: [{ name: 'Comp' }], fixVersions: [], customfield_10430: null, customfield_10637: null }},
      { key: 'F-3', fields: { summary: 'F-3', status: { name: 'Done' }, labels: [], components: [{ name: 'Comp' }], fixVersions: [], customfield_10430: null, customfield_10637: null }}
    ];

    const childIssues = [
      { key: 'C-1', fields: { parent: { key: 'F-1' }, customfield_10016: 3, customfield_10637: null, timeoriginalestimate: null }},
      { key: 'C-2', fields: { parent: { key: 'F-1' }, customfield_10016: 5, customfield_10637: null, timeoriginalestimate: null }},
      { key: 'C-3', fields: { parent: { key: 'F-2' }, customfield_10016: 2, customfield_10637: null, timeoriginalestimate: null }}
    ];

    let callCount = 0;
    const jira = {
      fetchAllJqlResults: vi.fn(async () => {
        callCount++;
        if (callCount === 1) return issues;
        return childIssues;
      })
    };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.4 GA' });
    const g = results[0];

    expect(g.effortSignal).toBe('childSp');
    expect(g.aggregateEffort).toBe(10);
    expect(g.avgEffort).toBe(3.3);
  });

  it('accumulates firstPass counts at group and component level', async () => {
    const issues = [
      makeIssue('FP-1', ['strat-creator-auto-created', 'rfe-creator-auto-created'], ['TeamA']),
      makeIssue('FP-2', ['strat-creator-auto-created', 'strat-creator-auto-refined'], ['TeamA']),
      makeIssue('FP-3', ['rfe-creator-auto-created', 'rfe-creator-autofix-rubric-pass'], ['TeamB']),
      makeIssue('FP-4', ['rp-qg1-auto-rice', 'rp-qg1-pass'], ['TeamB']),
      makeIssue('FP-5', ['test-plan-auto-created', 'test-plan-auto-revised'], ['TeamA'])
    ];

    const jira = { fetchAllJqlResults: vi.fn(async () => issues) };
    const results = await fetchAiAdoptionData(jira, { releaseGroup: '3.5 GA' });
    const g = results[0];

    expect(g.firstPass.stratCreator).toEqual({ accepted: 1, total: 2 });
    expect(g.firstPass.rfeCreator).toEqual({ accepted: 1, total: 2 });
    expect(g.firstPass.qg1).toEqual({ accepted: 1, total: 1 });
    expect(g.firstPass.testPlan).toEqual({ accepted: 0, total: 1 });

    const teamA = g.components.find(c => c.name === 'TeamA');
    expect(teamA.firstPass.stratCreator).toEqual({ accepted: 1, total: 2 });
    expect(teamA.firstPass.rfeCreator).toEqual({ accepted: 1, total: 1 });
    expect(teamA.firstPass.testPlan).toEqual({ accepted: 0, total: 1 });
    expect(teamA.firstPass.qg1).toEqual({ accepted: 0, total: 0 });

    const teamB = g.components.find(c => c.name === 'TeamB');
    expect(teamB.firstPass.rfeCreator).toEqual({ accepted: 0, total: 1 });
    expect(teamB.firstPass.qg1).toEqual({ accepted: 1, total: 1 });
    expect(teamB.firstPass.stratCreator).toEqual({ accepted: 0, total: 0 });
  });
});

// ---------------------------------------------------------------------------
// resolveEffortSignal
// ---------------------------------------------------------------------------
describe('resolveEffortSignal', () => {
  it('returns effort when customfield_10430 covers >= 50%', () => {
    expect(resolveEffortSignal({ effortCount: 5, riceEffortCount: 2, childSpCount: 3 }, 10)).toBe('effort');
    expect(resolveEffortSignal({ effortCount: 10, riceEffortCount: 0, childSpCount: 0 }, 10)).toBe('effort');
  });

  it('falls back to rice when effort is under 50% but rice is >= 50%', () => {
    expect(resolveEffortSignal({ effortCount: 2, riceEffortCount: 6, childSpCount: 4 }, 10)).toBe('rice');
  });

  it('falls back to childSp when effort and rice are under 50% but childSp >= 30%', () => {
    expect(resolveEffortSignal({ effortCount: 1, riceEffortCount: 1, childSpCount: 4 }, 10)).toBe('childSp');
  });

  it('falls back to children when no signal meets threshold', () => {
    expect(resolveEffortSignal({ effortCount: 1, riceEffortCount: 1, childSpCount: 2 }, 10)).toBe('children');
  });

  it('returns children when totalFeatures is 0', () => {
    expect(resolveEffortSignal({ effortCount: 0, riceEffortCount: 0, childSpCount: 0 }, 0)).toBe('children');
  });
});

// ---------------------------------------------------------------------------
// applyEffortSignal
// ---------------------------------------------------------------------------
describe('applyEffortSignal', () => {
  const entry = {
    total: 4,
    effortSum: 20,
    riceEffortSum: 12,
    childSpSum: 15,
    childIssueSum: 8
  };

  it('uses effortSum when signal is effort', () => {
    const result = applyEffortSignal(entry, 'effort');
    expect(result.aggregateEffort).toBe(20);
    expect(result.avgEffort).toBe(5);
  });

  it('uses riceEffortSum when signal is rice', () => {
    const result = applyEffortSignal(entry, 'rice');
    expect(result.aggregateEffort).toBe(12);
    expect(result.avgEffort).toBe(3);
  });

  it('uses childSpSum when signal is childSp', () => {
    const result = applyEffortSignal(entry, 'childSp');
    expect(result.aggregateEffort).toBe(15);
    expect(result.avgEffort).toBe(3.8);
  });

  it('uses childIssueSum when signal is children', () => {
    const result = applyEffortSignal(entry, 'children');
    expect(result.aggregateEffort).toBe(8);
    expect(result.avgEffort).toBe(2);
  });

  it('returns 0 avgEffort when total is 0', () => {
    const result = applyEffortSignal({ total: 0, effortSum: 0, riceEffortSum: 0, childSpSum: 0, childIssueSum: 0 }, 'effort');
    expect(result.avgEffort).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// fetchChildRollups
// ---------------------------------------------------------------------------
describe('fetchChildRollups', () => {
  it('returns empty map when no parent keys', async () => {
    const jira = { fetchAllJqlResults: vi.fn() };
    const result = await fetchChildRollups(jira, []);
    expect(result.size).toBe(0);
    expect(jira.fetchAllJqlResults).not.toHaveBeenCalled();
  });

  it('rolls up child count and story points per parent', async () => {
    const childIssues = [
      { key: 'C-1', fields: { parent: { key: 'P-1' }, customfield_10016: 3, customfield_10637: null, timeoriginalestimate: null }},
      { key: 'C-2', fields: { parent: { key: 'P-1' }, customfield_10016: 5, customfield_10637: null, timeoriginalestimate: null }},
      { key: 'C-3', fields: { parent: { key: 'P-2' }, customfield_10016: null, customfield_10637: 2, timeoriginalestimate: null }},
      { key: 'C-4', fields: { parent: { key: 'P-2' }, customfield_10016: null, customfield_10637: null, timeoriginalestimate: 7200 }}
    ];
    const jira = { fetchAllJqlResults: vi.fn(async () => childIssues) };
    const result = await fetchChildRollups(jira, ['P-1', 'P-2']);

    expect(result.get('P-1').childCount).toBe(2);
    expect(result.get('P-1').childSpSum).toBe(8);
    expect(result.get('P-2').childCount).toBe(2);
    expect(result.get('P-2').childSpSum).toBe(4);
  });

  it('handles fetch errors gracefully', async () => {
    const jira = { fetchAllJqlResults: vi.fn(async () => { throw new Error('timeout'); }) };
    const result = await fetchChildRollups(jira, ['X-1']);
    expect(result.size).toBe(0);
  });
});
