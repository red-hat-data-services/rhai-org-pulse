import { describe, it, expect, vi } from 'vitest';
import {
  readAssessments,
  upsertAssessment,
  getLatestProjection,
  trimForHistory,
  countHistoryEntries,
  MAX_HISTORY
} from '../../server/assessments/storage.js';

function makeAssessment(overrides = {}) {
  return {
    scores: { what: 2, why: 1, how: 2, task: 1, size: 2 },
    total: 8,
    passFail: 'PASS',
    antiPatterns: [],
    criterionNotes: { what: 'a', why: 'b', how: 'c', task: 'd', size: 'e' },
    verdict: 'Good.',
    feedback: 'Details.',
    assessedAt: '2026-04-19T12:00:00Z',
    ...overrides
  };
}

function makeEmptyData() {
  return { lastSyncedAt: null, totalAssessed: 0, assessments: {} };
}

describe('readAssessments', () => {
  it('returns empty state when storage returns null', () => {
    const read = vi.fn().mockReturnValue(null);
    const result = readAssessments(read);
    expect(result).toEqual({ lastSyncedAt: null, totalAssessed: 0, assessments: {} });
  });

  it('returns empty state when storage returns undefined', () => {
    const read = vi.fn().mockReturnValue(undefined);
    expect(readAssessments(read)).toEqual({ lastSyncedAt: null, totalAssessed: 0, assessments: {} });
  });

  it('returns empty state when data is malformed (missing assessments key)', () => {
    const read = vi.fn().mockReturnValue({ lastSyncedAt: 'x' });
    expect(readAssessments(read)).toEqual({ lastSyncedAt: null, totalAssessed: 0, assessments: {} });
  });

  it('returns empty state when data is a non-object', () => {
    const read = vi.fn().mockReturnValue('null');
    expect(readAssessments(read)).toEqual({ lastSyncedAt: null, totalAssessed: 0, assessments: {} });
  });

  it('returns valid data unchanged', () => {
    const data = { lastSyncedAt: '2026-04-19T12:00:00Z', totalAssessed: 5, assessments: { A: {} } };
    const read = vi.fn().mockReturnValue(data);
    expect(readAssessments(read)).toBe(data);
  });
});

describe('trimForHistory', () => {
  it('strips full-payload fields, keeping only scores/total/passFail/assessedAt', () => {
    const full = makeAssessment();
    const trimmed = trimForHistory(full);
    expect(trimmed).toEqual({
      scores: full.scores,
      total: full.total,
      passFail: full.passFail,
      assessedAt: full.assessedAt
    });
    expect(trimmed.criterionNotes).toBeUndefined();
    expect(trimmed.verdict).toBeUndefined();
    expect(trimmed.feedback).toBeUndefined();
    expect(trimmed.antiPatterns).toBeUndefined();
  });
});

describe('upsertAssessment', () => {
  it('creates a new entry', () => {
    const data = makeEmptyData();
    const status = upsertAssessment(data, 'RHAIRFE-1', makeAssessment());
    expect(status).toBe('created');
    expect(data.assessments['RHAIRFE-1']).toBeDefined();
    expect(data.assessments['RHAIRFE-1'].latest.total).toBe(8);
    expect(data.assessments['RHAIRFE-1'].history).toEqual([]);
  });

  it('returns unchanged for same assessedAt (idempotent)', () => {
    const data = makeEmptyData();
    upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-19T12:00:00Z' }));
    const status = upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-19T12:00:00Z' }));
    expect(status).toBe('unchanged');
  });

  it('updates with newer assessment, rotating old latest to history', () => {
    const data = makeEmptyData();
    upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-10T00:00:00Z', total: 5, scores: { what: 1, why: 1, how: 1, task: 1, size: 1 } }));
    const status = upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-20T00:00:00Z' }));
    expect(status).toBe('updated');
    expect(data.assessments['A'].latest.assessedAt).toBe('2026-04-20T00:00:00Z');
    expect(data.assessments['A'].history).toHaveLength(1);
    expect(data.assessments['A'].history[0].assessedAt).toBe('2026-04-10T00:00:00Z');
    // History entry should be trimmed
    expect(data.assessments['A'].history[0].criterionNotes).toBeUndefined();
  });

  it('inserts older assessment into history at correct position', () => {
    const data = makeEmptyData();
    upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-20T00:00:00Z' }));
    const status = upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-15T00:00:00Z' }));
    expect(status).toBe('updated');
    expect(data.assessments['A'].latest.assessedAt).toBe('2026-04-20T00:00:00Z');
    expect(data.assessments['A'].history).toHaveLength(1);
    expect(data.assessments['A'].history[0].assessedAt).toBe('2026-04-15T00:00:00Z');
  });

  it('returns unchanged for duplicate history entry', () => {
    const data = makeEmptyData();
    upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-20T00:00:00Z' }));
    upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-15T00:00:00Z' }));
    const status = upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-04-15T00:00:00Z' }));
    expect(status).toBe('unchanged');
  });

  it('caps history at MAX_HISTORY entries', () => {
    const data = makeEmptyData();
    // Create an entry with latest at a far future date
    upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-12-01T00:00:00Z' }));
    // Add MAX_HISTORY + 5 older entries
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      upsertAssessment(data, 'A', makeAssessment({ assessedAt: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z` }));
    }
    expect(data.assessments['A'].history.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it('discards old assessment when history is at cap and incoming is older than oldest', () => {
    const data = makeEmptyData();
    upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2026-12-01T00:00:00Z' }));
    // Fill history to cap
    for (let i = 0; i < MAX_HISTORY; i++) {
      upsertAssessment(data, 'A', makeAssessment({ assessedAt: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z` }));
    }
    expect(data.assessments['A'].history).toHaveLength(MAX_HISTORY);

    // Try to insert something older than everything in history
    const status = upsertAssessment(data, 'A', makeAssessment({ assessedAt: '2025-01-01T00:00:00Z' }));
    expect(status).toBe('unchanged');
    expect(data.assessments['A'].history).toHaveLength(MAX_HISTORY);
  });
});

describe('getLatestProjection', () => {
  it('returns slim projection without criterionNotes, verdict, feedback, history', () => {
    const data = {
      lastSyncedAt: '2026-04-19T12:00:00Z',
      totalAssessed: 1,
      assessments: {
        'A': {
          latest: makeAssessment(),
          history: [{ scores: {}, total: 3, passFail: 'FAIL', assessedAt: '2026-04-10T00:00:00Z' }]
        }
      }
    };
    const proj = getLatestProjection(data);
    expect(proj.lastSyncedAt).toBe('2026-04-19T12:00:00Z');
    expect(proj.totalAssessed).toBe(1);
    expect(proj.assessments['A'].scores).toBeDefined();
    expect(proj.assessments['A'].total).toBe(8);
    expect(proj.assessments['A'].passFail).toBe('PASS');
    expect(proj.assessments['A'].antiPatterns).toEqual([]);
    expect(proj.assessments['A'].assessedAt).toBeDefined();
    // Should NOT have these fields
    expect(proj.assessments['A'].criterionNotes).toBeUndefined();
    expect(proj.assessments['A'].verdict).toBeUndefined();
    expect(proj.assessments['A'].feedback).toBeUndefined();
    expect(proj.assessments['A'].history).toBeUndefined();
  });
});

describe('countHistoryEntries', () => {
  it('counts all history entries across assessments', () => {
    const data = {
      assessments: {
        A: { history: [1, 2, 3] },
        B: { history: [1] },
        C: { history: [] }
      }
    };
    expect(countHistoryEntries(data)).toBe(4);
  });

  it('handles missing history arrays', () => {
    const data = { assessments: { A: {} } };
    expect(countHistoryEntries(data)).toBe(0);
  });
});
