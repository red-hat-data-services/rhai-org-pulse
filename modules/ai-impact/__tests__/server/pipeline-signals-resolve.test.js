import { describe, it, expect, vi } from 'vitest';

vi.mock('../../server/component-onboarding/storage', () => ({
  readComponentOnboarding: vi.fn(),
  projectComponent: vi.fn((entry) => ({
    ...entry.latest,
    completionStatus: entry.latest.completionStatus || 'in-progress'
  }))
}));

vi.mock('../../server/features/storage', () => ({
  readFeatures: vi.fn()
}));

vi.mock('../../server/test-plans/storage', () => ({
  readTestPlans: vi.fn()
}));

vi.mock('../../server/decomposer/storage', () => ({
  readDecomposer: vi.fn()
}));

import {
  resolveRfeSignal,
  resolveFeatureSignal,
  resolveDecomposerSignal,
  resolveTestPlanSignal,
  resolveDocSignal,
  resolveBuildReleaseSignal
} from '../../server/pipeline-signals/resolve.js';

// --- Fixtures ---

function makeRfeData(issueOverrides = {}) {
  return {
    issues: [
      {
        key: 'RHAIRFE-100',
        aiInvolvement: 'both',
        linkedFeature: { key: 'RHAISTRAT-1', status: 'In Progress', fixVersions: ['1.2'] },
        ...issueOverrides
      }
    ]
  };
}

function makeFeaturesData(latestOverrides = {}) {
  return {
    features: {
      'RHAISTRAT-1': {
        latest: {
          key: 'RHAISTRAT-1',
          recommendation: 'approve',
          humanReviewStatus: 'approved',
          labels: ['strat-creator-auto-created'],
          scores: { total: 7, feasibility: 2, testability: 2, scope: 2, architecture: 1 },
          ...latestOverrides
        },
        history: []
      }
    }
  };
}

function makeDecomposerData(stratOverrides = {}) {
  return {
    strategies: [
      {
        strat_id: 'RHAISTRAT-1',
        title: 'Test Strategy',
        epic_count: 5,
        critical_path_length: 3,
        review: { score: 85, pass: true, recommendation: 'accept' },
        epics: [],
        ...stratOverrides
      }
    ]
  };
}

function makeTestPlansData(planOverrides = {}) {
  return {
    testPlans: {
      tp1: {
        latest: {
          key: 'tp1',
          sourceKey: 'RHAISTRAT-1',
          verdict: 'Ready',
          score: 9,
          humanReviewStatus: 'approved',
          labels: ['test-plan-auto-created'],
          ...planOverrides
        },
        history: []
      }
    }
  };
}

function makeDocData(issueOverrides = {}) {
  return {
    issues: [
      {
        key: 'RHAISTRAT-1',
        hasDocContributed: true,
        docContributedDate: '2026-06-01',
        ...issueOverrides
      }
    ]
  };
}

function makeCoData(latestOverrides = {}) {
  return {
    components: {
      comp1: {
        latest: {
          key: 'comp1',
          summary: 'Component One',
          status: 'Resolved',
          linkedFeatures: ['RHAISTRAT-1'],
          completionStatus: 'completed',
          targetVersion: '1.2',
          onboardingSteps: { step1: true, step2: true, step3: false },
          ...latestOverrides
        },
        history: []
      }
    }
  };
}

// --- RFE ---

describe('resolveRfeSignal', () => {
  it('returns completed with linkedKey for matched RFE', () => {
    const result = resolveRfeSignal(makeRfeData(), 'RHAISTRAT-1');
    expect(result.completed).toBe(true);
    expect(result.current).toBe(false);
    expect(result.aiUsed).toBe(true);
    expect(result.linkedKey).toBe('RHAIRFE-100');
    expect(result.detail).toBe('AI created & revised');
  });

  it('returns no linked RFE for unknown feature key', () => {
    const result = resolveRfeSignal(makeRfeData(), 'RHAISTRAT-999');
    expect(result.completed).toBe(false);
    expect(result.aiUsed).toBeNull();
    expect(result.detail).toBe('No linked RFE');
    expect(result).not.toHaveProperty('linkedKey');
  });

  it('handles null rfeData', () => {
    const result = resolveRfeSignal(null, 'RHAISTRAT-1');
    expect(result.completed).toBe(false);
    expect(result.detail).toBe('No data');
  });

  it('handles missing issues array', () => {
    const result = resolveRfeSignal({ issues: 'not-array' }, 'RHAISTRAT-1');
    expect(result.detail).toBe('No data');
  });

  it('detects AI created involvement', () => {
    const result = resolveRfeSignal(makeRfeData({ aiInvolvement: 'created' }), 'RHAISTRAT-1');
    expect(result.aiUsed).toBe(true);
    expect(result.detail).toBe('AI created');
  });

  it('detects AI revised involvement', () => {
    const result = resolveRfeSignal(makeRfeData({ aiInvolvement: 'revised' }), 'RHAISTRAT-1');
    expect(result.aiUsed).toBe(true);
    expect(result.detail).toBe('AI revised');
  });

  it('detects no AI involvement', () => {
    const result = resolveRfeSignal(makeRfeData({ aiInvolvement: 'none' }), 'RHAISTRAT-1');
    expect(result.aiUsed).toBe(false);
    expect(result.detail).toBe('No AI involvement');
  });
});

// --- Feature Review ---

describe('resolveFeatureSignal', () => {
  it('returns completed when approved', () => {
    const result = resolveFeatureSignal(makeFeaturesData(), 'RHAISTRAT-1');
    expect(result.completed).toBe(true);
    expect(result.current).toBe(false);
    expect(result.aiUsed).toBe(true);
    expect(result.linkedKey).toBe('RHAISTRAT-1');
    expect(result.detail).toBe('approve — 7/8');
    expect(result.scores).toEqual({ total: 7, feasibility: 2, testability: 2, scope: 2, architecture: 1 });
    expect(result.recommendation).toBe('approve');
  });

  it('returns current when not approved', () => {
    const result = resolveFeatureSignal(
      makeFeaturesData({ humanReviewStatus: 'needs-review' }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(false);
    expect(result.current).toBe(true);
  });

  it('returns aiUsed false when no AI labels', () => {
    const result = resolveFeatureSignal(
      makeFeaturesData({ labels: [] }),
      'RHAISTRAT-1'
    );
    expect(result.aiUsed).toBe(false);
  });

  it('returns no data for unknown feature', () => {
    const result = resolveFeatureSignal(makeFeaturesData(), 'RHAISTRAT-999');
    expect(result.completed).toBe(false);
    expect(result.current).toBe(false);
    expect(result.aiUsed).toBeNull();
    expect(result.detail).toBe('No feature data');
  });

  it('handles missing scores gracefully', () => {
    const result = resolveFeatureSignal(
      makeFeaturesData({ scores: null }),
      'RHAISTRAT-1'
    );
    expect(result.detail).toBe('approve — 0/8');
  });
});

// --- Decomposer ---

describe('resolveDecomposerSignal', () => {
  it('returns completed when review passes', () => {
    const result = resolveDecomposerSignal(makeDecomposerData(), 'RHAISTRAT-1');
    expect(result.completed).toBe(true);
    expect(result.current).toBe(false);
    expect(result.aiUsed).toBe(true);
    expect(result.linkedKey).toBe('RHAISTRAT-1');
    expect(result.detail).toBe('5 epics · pass (85)');
    expect(result.epicCount).toBe(5);
    expect(result.score).toBe(85);
    expect(result.pass).toBe(true);
  });

  it('returns current when review fails', () => {
    const result = resolveDecomposerSignal(
      makeDecomposerData({ review: { score: 40, pass: false, recommendation: 'revise' } }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(false);
    expect(result.current).toBe(true);
    expect(result.detail).toBe('5 epics · fail (40)');
    expect(result.pass).toBe(false);
  });

  it('handles null decomposer data', () => {
    const result = resolveDecomposerSignal(null, 'RHAISTRAT-1');
    expect(result.completed).toBe(false);
    expect(result.detail).toBe('No data');
  });

  it('handles non-array strategies', () => {
    const result = resolveDecomposerSignal({ strategies: 'nope' }, 'RHAISTRAT-1');
    expect(result.detail).toBe('No data');
  });

  it('handles missing strategy', () => {
    const result = resolveDecomposerSignal(makeDecomposerData(), 'RHAISTRAT-999');
    expect(result.completed).toBe(false);
    expect(result.detail).toBe('Not decomposed');
  });

  it('handles strategy with no review', () => {
    const result = resolveDecomposerSignal(
      makeDecomposerData({ review: undefined }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(false);
    expect(result.pass).toBe(false);
  });
});

// --- Test Plan ---

describe('resolveTestPlanSignal', () => {
  it('returns completed when approved', () => {
    const result = resolveTestPlanSignal(makeTestPlansData(), 'RHAISTRAT-1');
    expect(result.completed).toBe(true);
    expect(result.current).toBe(false);
    expect(result.aiUsed).toBe(true);
    expect(result.detail).toBe('Ready — 9/10');
    expect(result.linkedKey).toBe('RHAISTRAT-1');
  });

  it('returns current when not approved but has verdict', () => {
    const result = resolveTestPlanSignal(
      makeTestPlansData({ humanReviewStatus: 'needs-review' }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(false);
    expect(result.current).toBe(true);
  });

  it('returns aiUsed false when no AI labels', () => {
    const result = resolveTestPlanSignal(
      makeTestPlansData({ labels: ['manual'] }),
      'RHAISTRAT-1'
    );
    expect(result.aiUsed).toBe(false);
  });

  it('handles missing test plan for feature', () => {
    const result = resolveTestPlanSignal(makeTestPlansData(), 'RHAISTRAT-999');
    expect(result.completed).toBe(false);
    expect(result.detail).toBe('No test plan');
  });

  it('handles null test plan data', () => {
    const result = resolveTestPlanSignal(null, 'RHAISTRAT-1');
    expect(result.detail).toBe('No data');
  });
});

// --- Documentation ---

describe('resolveDocSignal', () => {
  it('returns completed when docs contributed', () => {
    const result = resolveDocSignal(makeDocData(), 'RHAISTRAT-1');
    expect(result.completed).toBe(true);
    expect(result.aiUsed).toBe(true);
    expect(result.detail).toBe('Docs contributed');
    expect(result.hasDocContributed).toBe(true);
    expect(result.docContributedDate).toBe('2026-06-01');
    expect(result.linkedKey).toBe('RHAISTRAT-1');
  });

  it('returns completed when docs skipped', () => {
    const result = resolveDocSignal(
      makeDocData({ hasDocContributed: false, hasDocSkipped: true }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(true);
    expect(result.aiUsed).toBe(false);
    expect(result.detail).toBe('Docs skipped');
    expect(result.hasDocSkipped).toBe(true);
  });

  it('returns current when doc tool invoked but not contributed', () => {
    const result = resolveDocSignal(
      makeDocData({ hasDocContributed: false, hasDocInvoked: true }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(false);
    expect(result.current).toBe(true);
    expect(result.aiUsed).toBe(true);
    expect(result.detail).toBe('Doc tool invoked');
  });

  it('returns not started when no doc flags', () => {
    const result = resolveDocSignal(
      makeDocData({ hasDocContributed: false }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(false);
    expect(result.current).toBe(false);
    expect(result.aiUsed).toBeNull();
    expect(result.detail).toBe('Docs not started');
  });

  it('handles missing doc issue', () => {
    const result = resolveDocSignal(makeDocData(), 'RHAISTRAT-999');
    expect(result.detail).toBe('No doc issue');
  });

  it('handles null doc data', () => {
    const result = resolveDocSignal(null, 'RHAISTRAT-1');
    expect(result.detail).toBe('No data');
  });

  it('handles non-array issues', () => {
    const result = resolveDocSignal({ issues: {} }, 'RHAISTRAT-1');
    expect(result.detail).toBe('No data');
  });
});

// --- Build & Release ---

describe('resolveBuildReleaseSignal', () => {
  it('returns completed for completed components', () => {
    const result = resolveBuildReleaseSignal(makeCoData(), 'RHAISTRAT-1');
    expect(result.completed).toBe(true);
    expect(result.detail).toContain('2/3 steps');
    expect(result.detail).toContain('1.2');
    expect(result.linkedKey).toBe('comp1');
  });

  it('returns current for in-progress components', () => {
    const result = resolveBuildReleaseSignal(
      makeCoData({ completionStatus: 'in-progress', status: 'In Progress' }),
      'RHAISTRAT-1'
    );
    expect(result.completed).toBe(false);
    expect(result.current).toBe(true);
  });

  it('handles missing component for feature', () => {
    const result = resolveBuildReleaseSignal(makeCoData(), 'RHAISTRAT-999');
    expect(result.completed).toBe(false);
    expect(result.detail).toBe('No onboarding data');
  });

  it('handles null coData', () => {
    const result = resolveBuildReleaseSignal(null, 'RHAISTRAT-1');
    expect(result.completed).toBe(false);
    expect(result.detail).toBe('No data');
  });

  it('handles missing components property', () => {
    const result = resolveBuildReleaseSignal({}, 'RHAISTRAT-1');
    expect(result.detail).toBe('No data');
  });

  it('omits version from detail when no targetVersion', () => {
    const result = resolveBuildReleaseSignal(
      makeCoData({ targetVersion: null }),
      'RHAISTRAT-1'
    );
    expect(result.detail).toBe('2/3 steps');
    expect(result.detail).not.toContain('·');
  });
});
