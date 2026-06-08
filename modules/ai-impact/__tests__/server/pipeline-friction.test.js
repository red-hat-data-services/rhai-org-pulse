import { describe, it, expect } from 'vitest';
import { computePipelineFrictionMetrics, FRICTION_LABELS } from '../../server/metrics.js';

function makeIssue(daysAgo, aiInvolvement, labels = []) {
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  return {
    key: `RFE-${Math.random().toString(36).slice(2, 6)}`,
    summary: 'Test RFE',
    status: 'New',
    created: created.toISOString(),
    aiInvolvement,
    labels
  };
}

const CONFIG = { trendThresholdPp: 2 };

describe('computePipelineFrictionMetrics', () => {
  it('returns zeros when there are no issues', () => {
    const result = computePipelineFrictionMetrics([], 'month', CONFIG);
    expect(result.needsAttentionPct).toBe(0);
    expect(result.needsAttentionChange).toBe(0);
    expect(result.needsAttentionTrend).toBe('stable');
    expect(result.feasibilityBlockedPct).toBe(0);
    expect(result.feasibilityBlockedChange).toBe(0);
    expect(result.feasibilityBlockedTrend).toBe('stable');
  });

  it('returns zeros not NaN when denominator is 0', () => {
    const issues = [makeIssue(5, 'none', [])];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    expect(result.needsAttentionPct).toBe(0);
    expect(result.feasibilityBlockedPct).toBe(0);
  });

  it('excludes non-AI-touched RFEs from denominator', () => {
    const issues = [
      makeIssue(5, 'none', [FRICTION_LABELS.needsAttention]),
      makeIssue(5, 'created', [FRICTION_LABELS.needsAttention]),
    ];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    // Denominator = 1 (only the 'created' issue), 1 needs-attention → 100%
    expect(result.needsAttentionPct).toBe(100);
  });

  it('computes needs attention percentage correctly', () => {
    const issues = [
      makeIssue(5, 'created', [FRICTION_LABELS.needsAttention]),
      makeIssue(5, 'created', [FRICTION_LABELS.needsAttention]),
      makeIssue(5, 'both', []),
      makeIssue(5, 'revised', []),
    ];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    // 2 of 4 AI-touched = 50%
    expect(result.needsAttentionPct).toBe(50);
  });

  it('counts feasibility blocked when either fail or unknown label present', () => {
    const issues = [
      makeIssue(5, 'created', [FRICTION_LABELS.feasibilityFail]),
      makeIssue(5, 'created', [FRICTION_LABELS.feasibilityUnknown]),
      makeIssue(5, 'both', []),
      makeIssue(5, 'both', []),
    ];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    // 2 of 4 = 50%
    expect(result.feasibilityBlockedPct).toBe(50);
  });

  it('does not double-count an issue with both feasibility fail and unknown', () => {
    const issues = [
      makeIssue(5, 'created', [FRICTION_LABELS.feasibilityFail, FRICTION_LABELS.feasibilityUnknown]),
      makeIssue(5, 'created', []),
    ];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    // 1 of 2 = 50% (not 100%)
    expect(result.feasibilityBlockedPct).toBe(50);
  });

  it('computes prior-period delta and trends for needs attention', () => {
    const issues = [
      // Current period: 2 of 2 = 100%
      makeIssue(5, 'created', [FRICTION_LABELS.needsAttention]),
      makeIssue(5, 'created', [FRICTION_LABELS.needsAttention]),
      // Prior period: 0 of 2 = 0%
      makeIssue(35, 'created', []),
      makeIssue(35, 'both', []),
    ];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    expect(result.needsAttentionPct).toBe(100);
    expect(result.needsAttentionChange).toBe(100);
    expect(result.needsAttentionTrend).toBe('worsening');
  });

  it('computes improving trend when friction decreases', () => {
    const issues = [
      // Current: 0 of 2 = 0%
      makeIssue(5, 'created', []),
      makeIssue(5, 'both', []),
      // Prior: 2 of 2 = 100%
      makeIssue(35, 'created', [FRICTION_LABELS.needsAttention]),
      makeIssue(35, 'both', [FRICTION_LABELS.needsAttention]),
    ];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    expect(result.needsAttentionTrend).toBe('improving');
    expect(result.needsAttentionChange).toBe(-100);
  });

  it('classifies stable when change is within threshold', () => {
    const issues = [
      makeIssue(5, 'created', [FRICTION_LABELS.needsAttention]),
      makeIssue(5, 'created', []),
      makeIssue(35, 'created', [FRICTION_LABELS.needsAttention]),
      makeIssue(35, 'created', []),
    ];
    const result = computePipelineFrictionMetrics(issues, 'month', CONFIG);
    // Both 50% → change = 0 → stable
    expect(result.needsAttentionTrend).toBe('stable');
    expect(result.needsAttentionChange).toBe(0);
  });

  it('uses configurable threshold', () => {
    const issues = [
      makeIssue(5, 'created', [FRICTION_LABELS.needsAttention]),
      makeIssue(5, 'created', []),
      makeIssue(35, 'created', []),
      makeIssue(35, 'created', []),
    ];
    // Change = 50 - 0 = 50pp
    const highThreshold = computePipelineFrictionMetrics(issues, 'month', { trendThresholdPp: 60 });
    expect(highThreshold.needsAttentionTrend).toBe('stable');

    const lowThreshold = computePipelineFrictionMetrics(issues, 'month', { trendThresholdPp: 2 });
    expect(lowThreshold.needsAttentionTrend).toBe('worsening');
  });

  it('handles null config gracefully', () => {
    const result = computePipelineFrictionMetrics([], 'month', null);
    expect(result.needsAttentionTrend).toBe('stable');
  });

  it('works across all time windows', () => {
    const issues = [makeIssue(3, 'created', [FRICTION_LABELS.needsAttention])];
    expect(() => computePipelineFrictionMetrics(issues, 'week', CONFIG)).not.toThrow();
    expect(() => computePipelineFrictionMetrics(issues, 'month', CONFIG)).not.toThrow();
    expect(() => computePipelineFrictionMetrics(issues, '3months', CONFIG)).not.toThrow();
  });
});
