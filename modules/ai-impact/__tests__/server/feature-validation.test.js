import { describe, it, expect } from 'vitest';
import { validateFeature, DIMENSIONS, PRIORITIES, RECOMMENDATIONS } from '../../server/features/validation.js';

function makeValidFeature(overrides = {}) {
  return {
    key: 'RHAISTRAT-1168',
    title: 'GPU-as-a-Service Observability',
    sourceRfe: 'RHAIRFE-262',
    priority: 'Major',
    status: 'Refined',
    size: 'L',
    recommendation: 'approve',
    needsAttention: false,
    scores: { feasibility: 1, testability: 1, scope: 2, architecture: 2, total: 6 },
    reviewers: { feasibility: 'approve', testability: 'revise', scope: 'approve', architecture: 'approve' },
    labels: ['strat-creator-auto-created', 'strat-creator-rubric-pass'],
    runId: '20260419-013035',
    runTimestamp: '2026-04-19T01:30:35Z',
    reviewedAt: '2026-04-19T01:30:35Z',
    ...overrides
  };
}

describe('validateFeature', () => {
  it('accepts a valid full feature', () => {
    const result = validateFeature(makeValidFeature());
    expect(result.valid).toBe(true);
    expect(result.data.key).toBe('RHAISTRAT-1168');
    expect(result.data.scores.total).toBe(6);
    expect(result.data.recommendation).toBe('approve');
    expect(result.data.reviewedAt).toBe('2026-04-19T01:30:35Z');
  });

  it('derives humanReviewStatus "reviewed" from tech-reviewed label', () => {
    const result = validateFeature(makeValidFeature({ labels: ['tech-reviewed'] }));
    expect(result.valid).toBe(true);
    expect(result.data.humanReviewStatus).toBe('reviewed');
  });

  it('derives humanReviewStatus "pending" from needs-tech-review label', () => {
    const result = validateFeature(makeValidFeature({ labels: ['needs-tech-review'] }));
    expect(result.valid).toBe(true);
    expect(result.data.humanReviewStatus).toBe('pending');
  });

  it('derives humanReviewStatus "not-required" when neither label present', () => {
    const result = validateFeature(makeValidFeature({ labels: ['other-label'] }));
    expect(result.valid).toBe(true);
    expect(result.data.humanReviewStatus).toBe('not-required');
  });

  it('accepts size as null', () => {
    const result = validateFeature(makeValidFeature({ size: null }));
    expect(result.valid).toBe(true);
    expect(result.data.size).toBeNull();
  });

  it('accepts size as undefined (defaults to null)', () => {
    const f = makeValidFeature();
    delete f.size;
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.size).toBeNull();
  });

  it('rejects null body', () => {
    const result = validateFeature(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Request body must be an object');
  });

  it('rejects non-object body', () => {
    expect(validateFeature('string').valid).toBe(false);
  });

  // Key validation
  it('rejects missing key', () => {
    const result = validateFeature(makeValidFeature({ key: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('key'))).toBe(true);
  });

  it('rejects empty key', () => {
    const result = validateFeature(makeValidFeature({ key: '' }));
    expect(result.valid).toBe(false);
  });

  it('accepts non-RHAISTRAT key prefixes', () => {
    const result = validateFeature(makeValidFeature({ key: 'STRAT-123' }));
    expect(result.valid).toBe(true);
    expect(result.data.key).toBe('STRAT-123');
  });

  // Title validation
  it('rejects empty title', () => {
    const result = validateFeature(makeValidFeature({ title: '' }));
    expect(result.valid).toBe(false);
  });

  // sourceRfe validation
  it('rejects sourceRfe not starting with RHAIRFE-', () => {
    const result = validateFeature(makeValidFeature({ sourceRfe: 'RHAISTRAT-123' }));
    expect(result.valid).toBe(false);
  });

  // Priority validation
  it('rejects invalid priority', () => {
    const result = validateFeature(makeValidFeature({ priority: 'High' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('priority'))).toBe(true);
  });

  // Status validation
  it('rejects empty status', () => {
    expect(validateFeature(makeValidFeature({ status: '' })).valid).toBe(false);
  });

  // Size validation
  it('rejects invalid size', () => {
    expect(validateFeature(makeValidFeature({ size: 'XXL' })).valid).toBe(false);
  });

  // Recommendation validation
  it('rejects invalid recommendation', () => {
    expect(validateFeature(makeValidFeature({ recommendation: 'maybe' })).valid).toBe(false);
  });

  // needsAttention validation
  it('rejects non-boolean needsAttention', () => {
    expect(validateFeature(makeValidFeature({ needsAttention: 'yes' })).valid).toBe(false);
  });

  // Scores validation
  it('rejects missing scores', () => {
    const result = validateFeature(makeValidFeature({ scores: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scores must be an object'))).toBe(true);
  });

  it('rejects non-integer dimension scores', () => {
    const result = validateFeature(makeValidFeature({
      scores: { feasibility: 1.5, testability: 1, scope: 2, architecture: 2, total: 6 }
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scores.feasibility'))).toBe(true);
  });

  it('rejects dimension scores out of range', () => {
    const result = validateFeature(makeValidFeature({
      scores: { feasibility: 3, testability: 1, scope: 2, architecture: 2, total: 8 }
    }));
    expect(result.valid).toBe(false);
  });

  it('rejects total that does not equal sum of dimension scores', () => {
    const result = validateFeature(makeValidFeature({
      scores: { feasibility: 1, testability: 1, scope: 2, architecture: 2, total: 7 }
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('total (7) must equal sum of dimension scores (6)'))).toBe(true);
  });

  it('rejects total out of range', () => {
    const result = validateFeature(makeValidFeature({
      scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2, total: 9 }
    }));
    expect(result.valid).toBe(false);
  });

  // Reviewers validation
  it('rejects missing reviewers', () => {
    const result = validateFeature(makeValidFeature({ reviewers: undefined }));
    expect(result.valid).toBe(false);
  });

  it('rejects invalid reviewer verdict', () => {
    const result = validateFeature(makeValidFeature({
      reviewers: { feasibility: 'pass', testability: 'revise', scope: 'approve', architecture: 'approve' }
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('reviewers.feasibility'))).toBe(true);
  });

  // Labels validation
  it('rejects non-array labels', () => {
    expect(validateFeature(makeValidFeature({ labels: 'label' })).valid).toBe(false);
  });

  it('rejects labels with non-string elements', () => {
    expect(validateFeature(makeValidFeature({ labels: [123] })).valid).toBe(false);
  });

  it('rejects labels exceeding 50 items', () => {
    const labels = Array.from({ length: 51 }, (_, i) => `label-${i}`);
    expect(validateFeature(makeValidFeature({ labels })).valid).toBe(false);
  });

  // runId validation
  it('rejects non-string runId', () => {
    expect(validateFeature(makeValidFeature({ runId: 123 })).valid).toBe(false);
  });

  // runTimestamp validation
  it('rejects invalid runTimestamp', () => {
    expect(validateFeature(makeValidFeature({ runTimestamp: 'not-a-date' })).valid).toBe(false);
  });

  // reviewedAt validation
  it('rejects invalid reviewedAt', () => {
    expect(validateFeature(makeValidFeature({ reviewedAt: 'not-a-date' })).valid).toBe(false);
  });

  it('rejects non-string reviewedAt', () => {
    expect(validateFeature(makeValidFeature({ reviewedAt: 12345 })).valid).toBe(false);
  });

  // snake_case normalization
  it('normalizes strat_id → key', () => {
    const f = makeValidFeature();
    delete f.key;
    f.strat_id = 'RHAISTRAT-999';
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.key).toBe('RHAISTRAT-999');
  });

  it('normalizes source_rfe → sourceRfe', () => {
    const f = makeValidFeature();
    delete f.sourceRfe;
    f.source_rfe = 'RHAIRFE-100';
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.sourceRfe).toBe('RHAIRFE-100');
  });

  it('normalizes needs_attention → needsAttention', () => {
    const f = makeValidFeature();
    delete f.needsAttention;
    f.needs_attention = true;
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.needsAttention).toBe(true);
  });

  it('normalizes run_id → runId', () => {
    const f = makeValidFeature();
    delete f.runId;
    f.run_id = 'run-123';
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.runId).toBe('run-123');
  });

  it('normalizes run_timestamp → runTimestamp', () => {
    const f = makeValidFeature();
    delete f.runTimestamp;
    f.run_timestamp = '2026-04-19T01:30:35Z';
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.runTimestamp).toBe('2026-04-19T01:30:35Z');
  });

  it('synthesizes reviewedAt from runTimestamp when reviewedAt is absent', () => {
    const f = makeValidFeature();
    delete f.reviewedAt;
    f.runTimestamp = '2026-04-19T01:30:35Z';
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.reviewedAt).toBe('2026-04-19T01:30:35Z');
  });

  it('synthesizes reviewedAt from run_timestamp when both reviewedAt and runTimestamp are absent', () => {
    const f = makeValidFeature();
    delete f.reviewedAt;
    delete f.runTimestamp;
    f.run_timestamp = '2026-04-19T01:30:35Z';
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.reviewedAt).toBe('2026-04-19T01:30:35Z');
  });

  it('prefers camelCase over snake_case when both present', () => {
    const f = makeValidFeature({ key: 'RHAISTRAT-1', strat_id: 'RHAISTRAT-2' });
    const result = validateFeature(f);
    expect(result.valid).toBe(true);
    expect(result.data.key).toBe('RHAISTRAT-1');
  });

  // Extra fields are ignored
  it('ignores extra fields', () => {
    const result = validateFeature(makeValidFeature({ extraField: 'ignored' }));
    expect(result.valid).toBe(true);
    expect(result.data.extraField).toBeUndefined();
  });

  it('exports constants', () => {
    expect(DIMENSIONS).toEqual(['feasibility', 'testability', 'scope', 'architecture']);
    expect(PRIORITIES).toContain('Major');
    expect(RECOMMENDATIONS).toEqual(['approve', 'revise', 'reject']);
  });
});
