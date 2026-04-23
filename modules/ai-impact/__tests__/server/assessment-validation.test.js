import { describe, it, expect } from 'vitest';
import { validateAssessment, CRITERIA } from '../../server/assessments/validation.js';

function makeValidAssessment(overrides = {}) {
  return {
    scores: { what: 2, why: 1, how: 2, task: 1, size: 2 },
    total: 8,
    passFail: 'PASS',
    antiPatterns: ['WHY Void'],
    criterionNotes: {
      what: 'Good', why: 'OK', how: 'Great', task: 'Fine', size: 'Right'
    },
    verdict: 'Summary.',
    feedback: 'Actionable feedback.',
    assessedAt: '2026-04-19T12:00:00Z',
    ...overrides
  };
}

describe('validateAssessment', () => {
  it('accepts a valid full assessment', () => {
    const result = validateAssessment(makeValidAssessment());
    expect(result.valid).toBe(true);
    expect(result.data.scores.what).toBe(2);
    expect(result.data.total).toBe(8);
    expect(result.data.passFail).toBe('PASS');
    expect(result.data.antiPatterns).toEqual(['WHY Void']);
    expect(result.data.assessedAt).toBe('2026-04-19T12:00:00Z');
  });

  it('accepts a minimal valid assessment (optional fields omitted)', () => {
    const result = validateAssessment({
      scores: { what: 0, why: 0, how: 0, task: 0, size: 0 },
      total: 0,
      passFail: 'FAIL',
      assessedAt: '2026-01-01T00:00:00Z'
    });
    expect(result.valid).toBe(true);
    expect(result.data.antiPatterns).toEqual([]);
    expect(result.data.criterionNotes).toEqual({});
    expect(result.data.verdict).toBe('');
    expect(result.data.feedback).toBe('');
  });

  it('rejects null body', () => {
    const result = validateAssessment(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Request body must be an object');
  });

  it('rejects non-object body', () => {
    const result = validateAssessment('string');
    expect(result.valid).toBe(false);
  });

  // Score validation
  it('rejects missing scores', () => {
    const result = validateAssessment(makeValidAssessment({ scores: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scores must be an object'))).toBe(true);
  });

  it('rejects non-integer scores', () => {
    const result = validateAssessment(makeValidAssessment({
      scores: { what: 1.5, why: 1, how: 2, task: 1, size: 2 },
      total: 7
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scores.what'))).toBe(true);
  });

  it('rejects scores out of range (> 2)', () => {
    const result = validateAssessment(makeValidAssessment({
      scores: { what: 3, why: 1, how: 2, task: 1, size: 2 },
      total: 9
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scores.what'))).toBe(true);
  });

  it('rejects negative scores', () => {
    const result = validateAssessment(makeValidAssessment({
      scores: { what: -1, why: 1, how: 2, task: 1, size: 2 },
      total: 5
    }));
    expect(result.valid).toBe(false);
  });

  // Total validation
  it('rejects total that does not equal sum of scores', () => {
    const result = validateAssessment(makeValidAssessment({ total: 7 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('total (7) must equal sum of scores (8)'))).toBe(true);
  });

  it('rejects non-integer total', () => {
    const result = validateAssessment(makeValidAssessment({ total: 8.5 }));
    expect(result.valid).toBe(false);
  });

  it('rejects total out of range', () => {
    const result = validateAssessment(makeValidAssessment({ total: 11 }));
    expect(result.valid).toBe(false);
  });

  // passFail validation
  it('rejects invalid passFail value', () => {
    const result = validateAssessment(makeValidAssessment({ passFail: 'MAYBE' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('passFail must be "PASS" or "FAIL"'))).toBe(true);
  });

  it('does NOT enforce threshold for passFail (trusts caller)', () => {
    // total=8 with FAIL should be valid (no threshold check)
    const result = validateAssessment(makeValidAssessment({ passFail: 'FAIL' }));
    expect(result.valid).toBe(true);
  });

  // assessedAt validation
  it('rejects invalid date string', () => {
    const result = validateAssessment(makeValidAssessment({ assessedAt: 'not-a-date' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('assessedAt'))).toBe(true);
  });

  it('rejects non-string assessedAt', () => {
    const result = validateAssessment(makeValidAssessment({ assessedAt: 12345 }));
    expect(result.valid).toBe(false);
  });

  // Optional field validation
  it('rejects non-array antiPatterns', () => {
    const result = validateAssessment(makeValidAssessment({ antiPatterns: 'WHY Void' }));
    expect(result.valid).toBe(false);
  });

  it('rejects antiPatterns with non-string elements', () => {
    const result = validateAssessment(makeValidAssessment({ antiPatterns: [123] }));
    expect(result.valid).toBe(false);
  });

  it('rejects non-object criterionNotes', () => {
    const result = validateAssessment(makeValidAssessment({ criterionNotes: 'string' }));
    expect(result.valid).toBe(false);
  });

  it('rejects criterionNotes with non-string values', () => {
    const result = validateAssessment(makeValidAssessment({
      criterionNotes: { what: 123, why: 'ok', how: 'ok', task: 'ok', size: 'ok' }
    }));
    expect(result.valid).toBe(false);
  });

  it('rejects non-string verdict', () => {
    const result = validateAssessment(makeValidAssessment({ verdict: 123 }));
    expect(result.valid).toBe(false);
  });

  it('rejects non-string feedback', () => {
    const result = validateAssessment(makeValidAssessment({ feedback: 123 }));
    expect(result.valid).toBe(false);
  });

  // Extra fields are ignored (not rejected)
  it('ignores extra fields', () => {
    const result = validateAssessment(makeValidAssessment({ extraField: 'ignored' }));
    expect(result.valid).toBe(true);
    expect(result.data.extraField).toBeUndefined();
  });

  it('exports CRITERIA constant', () => {
    expect(CRITERIA).toEqual(['what', 'why', 'how', 'task', 'size']);
  });
});
