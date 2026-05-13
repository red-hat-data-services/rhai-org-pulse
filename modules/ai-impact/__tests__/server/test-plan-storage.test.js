import { describe, it, expect, vi } from 'vitest';
import {
  readTestPlans,
  upsertTestPlan,
  getLatestProjection,
  trimForHistory,
  countHistoryEntries,
  MAX_HISTORY
} from '../../server/test-plans/storage.js';

function makeTestPlan(overrides = {}) {
  return {
    key: 'RHAISTRAT-1168',
    feature: 'GPU Observability',
    sourceKey: 'RHAISTRAT-1168',
    score: 8,
    verdict: 'Ready',
    scores: { specificity: 2, grounding: 2, scope_fidelity: 2, actionability: 1, consistency: 1 },
    autoRevised: false,
    beforeScore: null,
    beforeScores: null,
    criterionNotes: { specificity: 'Good', grounding: 'Solid' },
    feedback: 'Fix priorities.',
    error: null,
    components: ['dashboard'],
    testCaseCount: 24,
    reviewedAt: '2026-05-10T12:00:00Z',
    ...overrides
  };
}

function makeEmptyData() {
  return { lastSyncedAt: null, totalTestPlans: 0, testPlans: {} };
}

describe('readTestPlans', () => {
  it('returns empty state when storage returns null', () => {
    const read = vi.fn().mockReturnValue(null);
    expect(readTestPlans(read)).toEqual({ lastSyncedAt: null, lastJiraSyncAt: null, totalTestPlans: 0, testPlans: {} });
  });

  it('returns empty state when storage returns undefined', () => {
    const read = vi.fn().mockReturnValue(undefined);
    expect(readTestPlans(read)).toEqual({ lastSyncedAt: null, lastJiraSyncAt: null, totalTestPlans: 0, testPlans: {} });
  });

  it('returns empty state when data is malformed', () => {
    const read = vi.fn().mockReturnValue({ lastSyncedAt: 'x' });
    expect(readTestPlans(read)).toEqual({ lastSyncedAt: null, lastJiraSyncAt: null, totalTestPlans: 0, testPlans: {} });
  });

  it('returns valid data unchanged', () => {
    const data = { lastSyncedAt: '2026-05-10T12:00:00Z', totalTestPlans: 1, testPlans: { A: {} } };
    const read = vi.fn().mockReturnValue(data);
    expect(readTestPlans(read)).toBe(data);
  });
});

describe('trimForHistory', () => {
  it('keeps only scores, score, verdict, autoRevised, reviewedAt', () => {
    const trimmed = trimForHistory(makeTestPlan());
    expect(trimmed).toEqual({
      scores: makeTestPlan().scores,
      score: 8,
      verdict: 'Ready',
      autoRevised: false,
      reviewedAt: '2026-05-10T12:00:00Z'
    });
    expect(trimmed.criterionNotes).toBeUndefined();
    expect(trimmed.feedback).toBeUndefined();
    expect(trimmed.components).toBeUndefined();
    expect(trimmed.feature).toBeUndefined();
  });
});

describe('upsertTestPlan', () => {
  it('creates a new entry', () => {
    const data = makeEmptyData();
    const status = upsertTestPlan(data, 'A', makeTestPlan());
    expect(status).toBe('created');
    expect(data.testPlans['A']).toBeDefined();
    expect(data.testPlans['A'].latest.score).toBe(8);
    expect(data.testPlans['A'].history).toEqual([]);
  });

  it('returns unchanged for same reviewedAt', () => {
    const data = makeEmptyData();
    upsertTestPlan(data, 'A', makeTestPlan());
    expect(upsertTestPlan(data, 'A', makeTestPlan())).toBe('unchanged');
  });

  it('updates with newer entry, rotating old to history', () => {
    const data = makeEmptyData();
    upsertTestPlan(data, 'A', makeTestPlan({ reviewedAt: '2026-05-10T00:00:00Z', score: 5, scores: { specificity: 1, grounding: 1, scope_fidelity: 1, actionability: 1, consistency: 1 } }));
    const status = upsertTestPlan(data, 'A', makeTestPlan({ reviewedAt: '2026-05-11T00:00:00Z' }));
    expect(status).toBe('updated');
    expect(data.testPlans['A'].latest.reviewedAt).toBe('2026-05-11T00:00:00Z');
    expect(data.testPlans['A'].history).toHaveLength(1);
    expect(data.testPlans['A'].history[0].criterionNotes).toBeUndefined();
  });

  it('inserts older entry into history at correct position', () => {
    const data = makeEmptyData();
    upsertTestPlan(data, 'A', makeTestPlan({ reviewedAt: '2026-05-20T00:00:00Z' }));
    const status = upsertTestPlan(data, 'A', makeTestPlan({ reviewedAt: '2026-05-15T00:00:00Z' }));
    expect(status).toBe('updated');
    expect(data.testPlans['A'].latest.reviewedAt).toBe('2026-05-20T00:00:00Z');
    expect(data.testPlans['A'].history[0].reviewedAt).toBe('2026-05-15T00:00:00Z');
  });

  it('caps history at MAX_HISTORY', () => {
    const data = makeEmptyData();
    upsertTestPlan(data, 'A', makeTestPlan({ reviewedAt: '2026-12-01T00:00:00Z' }));
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      upsertTestPlan(data, 'A', makeTestPlan({
        reviewedAt: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`
      }));
    }
    expect(data.testPlans['A'].history.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it('discards entry older than oldest when at cap', () => {
    const data = makeEmptyData();
    upsertTestPlan(data, 'A', makeTestPlan({ reviewedAt: '2026-12-01T00:00:00Z' }));
    for (let i = 0; i < MAX_HISTORY; i++) {
      upsertTestPlan(data, 'A', makeTestPlan({
        reviewedAt: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`
      }));
    }
    const status = upsertTestPlan(data, 'A', makeTestPlan({ reviewedAt: '2025-01-01T00:00:00Z' }));
    expect(status).toBe('unchanged');
  });
});

describe('getLatestProjection', () => {
  it('returns slim projection without verbose fields', () => {
    const data = {
      lastSyncedAt: '2026-05-10T12:00:00Z',
      totalTestPlans: 1,
      testPlans: {
        A: { latest: makeTestPlan(), history: [{ score: 5 }] }
      }
    };
    const proj = getLatestProjection(data);
    expect(proj.totalTestPlans).toBe(1);
    expect(proj.testPlans['A'].score).toBe(8);
    expect(proj.testPlans['A'].components).toEqual(['dashboard']);
    expect(proj.testPlans['A'].testCaseCount).toBe(24);
    expect(proj.testPlans['A'].criterionNotes).toBeUndefined();
    expect(proj.testPlans['A'].feedback).toBeUndefined();
    expect(proj.testPlans['A'].beforeScore).toBeUndefined();
    expect(proj.testPlans['A'].error).toBeUndefined();
  });

  it('includes Jira-enriched fields in projection', () => {
    const data = {
      lastSyncedAt: '2026-05-10T12:00:00Z',
      lastJiraSyncAt: '2026-05-10T18:05:00Z',
      totalTestPlans: 1,
      testPlans: {
        A: {
          latest: makeTestPlan({
            jiraStatus: 'In Progress',
            jiraPriority: 'Critical',
            labels: ['test-plan-auto-created', 'test-plan-human-sign-off'],
            humanReviewStatus: 'approved'
          }),
          history: []
        }
      }
    };
    const proj = getLatestProjection(data);
    expect(proj.lastJiraSyncAt).toBe('2026-05-10T18:05:00Z');
    expect(proj.testPlans['A'].jiraStatus).toBe('In Progress');
    expect(proj.testPlans['A'].jiraPriority).toBe('Critical');
    expect(proj.testPlans['A'].labels).toEqual(['test-plan-auto-created', 'test-plan-human-sign-off']);
    expect(proj.testPlans['A'].humanReviewStatus).toBe('approved');
  });

  it('returns null for missing Jira fields', () => {
    const data = {
      lastSyncedAt: '2026-05-10T12:00:00Z',
      totalTestPlans: 1,
      testPlans: {
        A: { latest: makeTestPlan(), history: [] }
      }
    };
    const proj = getLatestProjection(data);
    expect(proj.lastJiraSyncAt).toBeNull();
    expect(proj.testPlans['A'].jiraStatus).toBeNull();
    expect(proj.testPlans['A'].jiraPriority).toBeNull();
    expect(proj.testPlans['A'].labels).toBeNull();
    expect(proj.testPlans['A'].humanReviewStatus).toBeNull();
  });
});

describe('countHistoryEntries', () => {
  it('counts all history entries', () => {
    const data = {
      testPlans: {
        A: { history: [1, 2, 3] },
        B: { history: [1] },
        C: { history: [] }
      }
    };
    expect(countHistoryEntries(data)).toBe(4);
  });

  it('handles missing history arrays', () => {
    expect(countHistoryEntries({ testPlans: { A: {} } })).toBe(0);
  });
});
