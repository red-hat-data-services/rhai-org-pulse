import { describe, it, expect, vi } from 'vitest';
import {
  readFeatures,
  upsertFeature,
  getLatestProjection,
  trimForHistory,
  countHistoryEntries,
  MAX_HISTORY
} from '../../server/features/storage.js';

function makeFeature(overrides = {}) {
  return {
    key: 'RHAISTRAT-1168',
    title: 'GPU-as-a-Service Observability',
    sourceRfe: 'RHAIRFE-262',
    priority: 'Major',
    status: 'Refined',
    size: 'L',
    recommendation: 'approve',
    needsAttention: false,
    humanReviewStatus: 'reviewed',
    scores: { feasibility: 1, testability: 1, scope: 2, architecture: 2, total: 6 },
    reviewers: { feasibility: 'approve', testability: 'revise', scope: 'approve', architecture: 'approve' },
    labels: ['strat-creator-auto-created'],
    runId: '20260419-013035',
    runTimestamp: '2026-04-19T01:30:35Z',
    reviewedAt: '2026-04-19T12:00:00Z',
    ...overrides
  };
}

function makeEmptyData() {
  return { lastSyncedAt: null, totalFeatures: 0, features: {} };
}

describe('readFeatures', () => {
  it('returns empty state when storage returns null', () => {
    const read = vi.fn().mockReturnValue(null);
    expect(readFeatures(read)).toEqual({ lastSyncedAt: null, totalFeatures: 0, features: {} });
  });

  it('returns empty state when storage returns undefined', () => {
    const read = vi.fn().mockReturnValue(undefined);
    expect(readFeatures(read)).toEqual({ lastSyncedAt: null, totalFeatures: 0, features: {} });
  });

  it('returns empty state when data is malformed (missing features key)', () => {
    const read = vi.fn().mockReturnValue({ lastSyncedAt: 'x' });
    expect(readFeatures(read)).toEqual({ lastSyncedAt: null, totalFeatures: 0, features: {} });
  });

  it('returns empty state when data is a non-object', () => {
    const read = vi.fn().mockReturnValue('null');
    expect(readFeatures(read)).toEqual({ lastSyncedAt: null, totalFeatures: 0, features: {} });
  });

  it('returns valid data unchanged', () => {
    const data = { lastSyncedAt: '2026-04-19T12:00:00Z', totalFeatures: 5, features: { A: {} } };
    const read = vi.fn().mockReturnValue(data);
    expect(readFeatures(read)).toBe(data);
  });
});

describe('trimForHistory', () => {
  it('keeps only scores, recommendation, needsAttention, humanReviewStatus, reviewedAt', () => {
    const full = makeFeature();
    const trimmed = trimForHistory(full);
    expect(trimmed).toEqual({
      scores: full.scores,
      recommendation: full.recommendation,
      needsAttention: full.needsAttention,
      humanReviewStatus: full.humanReviewStatus,
      reviewedAt: full.reviewedAt
    });
    expect(trimmed.key).toBeUndefined();
    expect(trimmed.title).toBeUndefined();
    expect(trimmed.labels).toBeUndefined();
    expect(trimmed.reviewers).toBeUndefined();
  });
});

describe('upsertFeature', () => {
  it('creates a new entry', () => {
    const data = makeEmptyData();
    const status = upsertFeature(data, 'RHAISTRAT-1', makeFeature());
    expect(status).toBe('created');
    expect(data.features['RHAISTRAT-1']).toBeDefined();
    expect(data.features['RHAISTRAT-1'].latest.scores.total).toBe(6);
    expect(data.features['RHAISTRAT-1'].history).toEqual([]);
  });

  it('returns unchanged for same reviewedAt (idempotent)', () => {
    const data = makeEmptyData();
    upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-19T12:00:00Z' }));
    const status = upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-19T12:00:00Z' }));
    expect(status).toBe('unchanged');
  });

  it('updates with newer feature, rotating old latest to history', () => {
    const data = makeEmptyData();
    upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-10T00:00:00Z' }));
    const status = upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-20T00:00:00Z' }));
    expect(status).toBe('updated');
    expect(data.features['A'].latest.reviewedAt).toBe('2026-04-20T00:00:00Z');
    expect(data.features['A'].history).toHaveLength(1);
    expect(data.features['A'].history[0].reviewedAt).toBe('2026-04-10T00:00:00Z');
    // History entry should be trimmed
    expect(data.features['A'].history[0].key).toBeUndefined();
    expect(data.features['A'].history[0].title).toBeUndefined();
  });

  it('inserts older feature into history at correct position', () => {
    const data = makeEmptyData();
    upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-20T00:00:00Z' }));
    const status = upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-15T00:00:00Z' }));
    expect(status).toBe('updated');
    expect(data.features['A'].latest.reviewedAt).toBe('2026-04-20T00:00:00Z');
    expect(data.features['A'].history).toHaveLength(1);
    expect(data.features['A'].history[0].reviewedAt).toBe('2026-04-15T00:00:00Z');
  });

  it('returns unchanged for duplicate history entry', () => {
    const data = makeEmptyData();
    upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-20T00:00:00Z' }));
    upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-15T00:00:00Z' }));
    const status = upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-04-15T00:00:00Z' }));
    expect(status).toBe('unchanged');
  });

  it('caps history at MAX_HISTORY entries', () => {
    const data = makeEmptyData();
    upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-12-01T00:00:00Z' }));
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      upsertFeature(data, 'A', makeFeature({
        reviewedAt: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`
      }));
    }
    expect(data.features['A'].history.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it('discards old feature when history is at cap and incoming is older than oldest', () => {
    const data = makeEmptyData();
    upsertFeature(data, 'A', makeFeature({ reviewedAt: '2026-12-01T00:00:00Z' }));
    for (let i = 0; i < MAX_HISTORY; i++) {
      upsertFeature(data, 'A', makeFeature({
        reviewedAt: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z`
      }));
    }
    expect(data.features['A'].history).toHaveLength(MAX_HISTORY);

    const status = upsertFeature(data, 'A', makeFeature({ reviewedAt: '2025-01-01T00:00:00Z' }));
    expect(status).toBe('unchanged');
    expect(data.features['A'].history).toHaveLength(MAX_HISTORY);
  });
});

describe('getLatestProjection', () => {
  it('returns slim projection without labels, runId, runTimestamp', () => {
    const data = {
      lastSyncedAt: '2026-04-19T12:00:00Z',
      totalFeatures: 1,
      features: {
        'A': {
          latest: makeFeature(),
          history: [{ scores: {}, recommendation: 'revise', needsAttention: false, humanReviewStatus: 'pending', reviewedAt: '2026-04-10T00:00:00Z' }]
        }
      }
    };
    const proj = getLatestProjection(data);
    expect(proj.lastSyncedAt).toBe('2026-04-19T12:00:00Z');
    expect(proj.totalFeatures).toBe(1);
    expect(proj.features['A'].key).toBeDefined();
    expect(proj.features['A'].title).toBeDefined();
    expect(proj.features['A'].scores).toBeDefined();
    expect(proj.features['A'].reviewers).toBeDefined();
    expect(proj.features['A'].reviewedAt).toBeDefined();
    // Should NOT have these fields
    expect(proj.features['A'].labels).toBeUndefined();
    expect(proj.features['A'].runId).toBeUndefined();
    expect(proj.features['A'].runTimestamp).toBeUndefined();
    expect(proj.features['A'].history).toBeUndefined();
  });
});

describe('countHistoryEntries', () => {
  it('counts all history entries across features', () => {
    const data = {
      features: {
        A: { history: [1, 2, 3] },
        B: { history: [1] },
        C: { history: [] }
      }
    };
    expect(countHistoryEntries(data)).toBe(4);
  });

  it('handles missing history arrays', () => {
    const data = { features: { A: {} } };
    expect(countHistoryEntries(data)).toBe(0);
  });
});
