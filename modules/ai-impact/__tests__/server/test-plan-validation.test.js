import { describe, it, expect } from 'vitest';
import { validateTestPlan, deriveHumanReviewStatus, CRITERIA, VERDICTS, HUMAN_REVIEW_STATUSES } from '../../server/test-plans/validation.js';

function makeValid(overrides = {}) {
  return {
    feature: 'GPU Observability',
    sourceKey: 'RHAISTRAT-1168',
    score: 8,
    verdict: 'Ready',
    scores: { specificity: 2, grounding: 2, scope_fidelity: 2, actionability: 1, consistency: 1 },
    autoRevised: false,
    reviewedAt: '2026-05-10T12:00:00Z',
    ...overrides
  };
}

describe('validateTestPlan', () => {
  it('accepts a valid full test plan', () => {
    const result = validateTestPlan(makeValid());
    expect(result.valid).toBe(true);
    expect(result.data.score).toBe(8);
    expect(result.data.verdict).toBe('Ready');
    expect(result.data.sourceKey).toBe('RHAISTRAT-1168');
  });

  it('accepts a minimal valid test plan (optional fields omitted)', () => {
    const result = validateTestPlan(makeValid());
    expect(result.valid).toBe(true);
    expect(result.data.beforeScore).toBeNull();
    expect(result.data.beforeScores).toBeNull();
    expect(result.data.criterionNotes).toEqual({});
    expect(result.data.feedback).toBe('');
    expect(result.data.components).toEqual([]);
    expect(result.data.testCaseCount).toBeNull();
  });

  it('rejects null body', () => {
    expect(validateTestPlan(null).valid).toBe(false);
  });

  it('rejects non-object body', () => {
    expect(validateTestPlan('string').valid).toBe(false);
  });

  it('rejects missing scores', () => {
    const result = validateTestPlan(makeValid({ scores: undefined }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scores must be an object'))).toBe(true);
  });

  it('rejects non-integer scores', () => {
    const result = validateTestPlan(makeValid({
      scores: { specificity: 1.5, grounding: 1, scope_fidelity: 2, actionability: 1, consistency: 1 },
      score: 6
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('scores.specificity'))).toBe(true);
  });

  it('rejects scores out of range', () => {
    const result = validateTestPlan(makeValid({
      scores: { specificity: 3, grounding: 1, scope_fidelity: 2, actionability: 1, consistency: 1 },
      score: 8
    }));
    expect(result.valid).toBe(false);
  });

  it('rejects score that does not equal sum', () => {
    const result = validateTestPlan(makeValid({ score: 7 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('score (7) must equal sum of scores (8)'))).toBe(true);
  });

  it('rejects invalid verdict', () => {
    const result = validateTestPlan(makeValid({ verdict: 'PASS' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('verdict'))).toBe(true);
  });

  it('accepts all valid verdicts', () => {
    for (const verdict of ['Ready', 'Revise', 'Rework']) {
      expect(validateTestPlan(makeValid({ verdict })).valid).toBe(true);
    }
  });

  it('rejects invalid reviewedAt', () => {
    expect(validateTestPlan(makeValid({ reviewedAt: 'not-a-date' })).valid).toBe(false);
  });

  it('rejects missing feature', () => {
    expect(validateTestPlan(makeValid({ feature: '' })).valid).toBe(false);
  });

  it('rejects invalid sourceKey pattern', () => {
    expect(validateTestPlan(makeValid({ sourceKey: 'BADKEY-1' })).valid).toBe(false);
  });

  it('accepts RHOAIENG sourceKey', () => {
    expect(validateTestPlan(makeValid({ sourceKey: 'RHOAIENG-12345' })).valid).toBe(true);
  });

  it('accepts RHAIRFE sourceKey', () => {
    expect(validateTestPlan(makeValid({ sourceKey: 'RHAIRFE-999' })).valid).toBe(true);
  });

  it('rejects beforeScore without beforeScores', () => {
    const result = validateTestPlan(makeValid({ beforeScore: 5, beforeScores: null }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('both be set or both be null'))).toBe(true);
  });

  it('accepts matching beforeScore and beforeScores', () => {
    const result = validateTestPlan(makeValid({
      beforeScore: 5,
      beforeScores: { specificity: 1, grounding: 1, scope_fidelity: 1, actionability: 1, consistency: 1 }
    }));
    expect(result.valid).toBe(true);
  });

  it('rejects beforeScore != sum of beforeScores', () => {
    const result = validateTestPlan(makeValid({
      beforeScore: 99,
      beforeScores: { specificity: 1, grounding: 1, scope_fidelity: 1, actionability: 1, consistency: 1 }
    }));
    expect(result.valid).toBe(false);
  });

  it('normalizes snake_case to camelCase', () => {
    const result = validateTestPlan({
      feature: 'Test',
      source_key: 'RHAISTRAT-100',
      score: 5,
      verdict: 'Revise',
      scores: { specificity: 1, grounding: 1, scope_fidelity: 1, actionability: 1, consistency: 1 },
      auto_revised: true,
      test_case_count: 7,
      reviewed_at: '2026-05-11T00:00:00Z'
    });
    expect(result.valid).toBe(true);
    expect(result.data.sourceKey).toBe('RHAISTRAT-100');
    expect(result.data.autoRevised).toBe(true);
    expect(result.data.testCaseCount).toBe(7);
  });

  it('ignores extra fields', () => {
    const result = validateTestPlan(makeValid({ extraField: 'ignored' }));
    expect(result.valid).toBe(true);
    expect(result.data.extraField).toBeUndefined();
  });

  it('rejects non-array components', () => {
    expect(validateTestPlan(makeValid({ components: 'dashboard' })).valid).toBe(false);
  });

  it('rejects negative testCaseCount', () => {
    expect(validateTestPlan(makeValid({ testCaseCount: -1 })).valid).toBe(false);
  });

  it('exports CRITERIA, VERDICTS, and HUMAN_REVIEW_STATUSES constants', () => {
    expect(CRITERIA).toEqual(['specificity', 'grounding', 'scope_fidelity', 'actionability', 'consistency']);
    expect(VERDICTS).toEqual(['Ready', 'Revise', 'Rework']);
    expect(HUMAN_REVIEW_STATUSES).toEqual(['approved', 'needs-review', 'awaiting-review']);
  });

  it('accepts optional Jira-enriched fields', () => {
    const result = validateTestPlan(makeValid({
      jiraTitle: 'GPU Observability Dashboard',
      jiraStatus: 'In Progress',
      jiraPriority: 'Critical',
      labels: ['test-plan-auto-created', 'test-plan-rubric-pass'],
      humanReviewStatus: 'awaiting-review',
      approvedBy: 'Alice',
      approvedAt: '2026-05-10T14:00:00Z'
    }));
    expect(result.valid).toBe(true);
    expect(result.data.jiraTitle).toBe('GPU Observability Dashboard');
    expect(result.data.jiraStatus).toBe('In Progress');
    expect(result.data.jiraPriority).toBe('Critical');
    expect(result.data.labels).toEqual(['test-plan-auto-created', 'test-plan-rubric-pass']);
    expect(result.data.humanReviewStatus).toBe('awaiting-review');
    expect(result.data.approvedBy).toBe('Alice');
    expect(result.data.approvedAt).toBe('2026-05-10T14:00:00Z');
  });

  it('rejects invalid humanReviewStatus', () => {
    const result = validateTestPlan(makeValid({ humanReviewStatus: 'invalid' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('humanReviewStatus'))).toBe(true);
  });

  it('rejects non-array labels', () => {
    const result = validateTestPlan(makeValid({ labels: 'bad' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('labels must be an array'))).toBe(true);
  });

  it('rejects invalid approvedAt', () => {
    const result = validateTestPlan(makeValid({ approvedAt: 'not-a-date' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('approvedAt'))).toBe(true);
  });

  it('derives humanReviewStatus from labels when not explicitly set', () => {
    const result = validateTestPlan(makeValid({
      labels: ['test-plan-auto-created', 'test-plan-human-sign-off']
    }));
    expect(result.valid).toBe(true);
    expect(result.data.humanReviewStatus).toBe('approved');
  });

  it('derives needs-review from rubric-fail label', () => {
    const result = validateTestPlan(makeValid({
      labels: ['test-plan-auto-created', 'test-plan-rubric-fail']
    }));
    expect(result.valid).toBe(true);
    expect(result.data.humanReviewStatus).toBe('needs-review');
  });

  describe('gitlabPath', () => {
    it('accepts valid gitlabPath string', () => {
      const result = validateTestPlan(makeValid({
        gitlabPath: 'RHAISTRAT/20260510-120000-RHAISTRAT-1168/gpu_observability_dashboard'
      }));
      expect(result.valid).toBe(true);
      expect(result.data.gitlabPath).toBe('RHAISTRAT/20260510-120000-RHAISTRAT-1168/gpu_observability_dashboard');
    });

    it('accepts omitted gitlabPath (optional field)', () => {
      const result = validateTestPlan(makeValid());
      expect(result.valid).toBe(true);
      expect(result.data.gitlabPath).toBeUndefined();
    });

    it('rejects non-string gitlabPath', () => {
      const result = validateTestPlan(makeValid({ gitlabPath: 123 }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('gitlabPath must be a string'))).toBe(true);
    });

    it('accepts null gitlabPath', () => {
      const result = validateTestPlan(makeValid({ gitlabPath: null }));
      expect(result.valid).toBe(true);
      expect(result.data.gitlabPath).toBeUndefined();
    });
  });
});

describe('deriveHumanReviewStatus', () => {
  it('returns approved when sign-off label present', () => {
    expect(deriveHumanReviewStatus(['test-plan-human-sign-off'])).toBe('approved');
  });

  it('returns needs-review when rubric-fail label present', () => {
    expect(deriveHumanReviewStatus(['test-plan-rubric-fail'])).toBe('needs-review');
  });

  it('returns awaiting-review by default', () => {
    expect(deriveHumanReviewStatus(['test-plan-auto-created'])).toBe('awaiting-review');
  });

  it('sign-off takes precedence over rubric-fail', () => {
    expect(deriveHumanReviewStatus(['test-plan-human-sign-off', 'test-plan-rubric-fail'])).toBe('approved');
  });
});
