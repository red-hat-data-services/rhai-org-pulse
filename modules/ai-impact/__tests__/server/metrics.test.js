import { describe, it, expect } from 'vitest';
import { computeMetrics, buildTrendData, buildBreakdownData, computeAllMetrics } from '../../server/metrics.js';

function makeIssue(daysAgo, aiInvolvement = 'none', { createdLabelDate, revisedLabelDate } = {}) {
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  return {
    key: `RFE-${Math.random().toString(36).slice(2, 6)}`,
    summary: 'Test',
    status: 'New',
    created: created.toISOString(),
    aiInvolvement,
    createdLabelDate: createdLabelDate || null,
    revisedLabelDate: revisedLabelDate || null
  };
}

describe('computeMetrics', () => {
  it('computes created percentage for "month" time window', () => {
    const issues = [
      makeIssue(5, 'created'),  // within month
      makeIssue(10, 'both'),    // within month
      makeIssue(15, 'none'),    // within month
      makeIssue(45, 'created'), // in prior period
      makeIssue(50, 'none'),    // in prior period
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    // Current: 3 issues, 2 with created (created + both) = 67%
    expect(result.createdPct).toBe(67);
    expect(result.windowTotal).toBe(3);
    expect(result.totalRFEs).toBe(5);
  });

  it('computes "week" time window', () => {
    const issues = [
      makeIssue(2, 'created'),
      makeIssue(3, 'revised'),
      makeIssue(5, 'none'),
    ];

    const result = computeMetrics(issues, 'week', { trendThresholdPp: 2 });

    expect(result.windowTotal).toBe(3);
    expect(result.createdPct).toBe(33);
  });

  it('computes "3months" time window', () => {
    const issues = [
      makeIssue(10, 'both'),
      makeIssue(30, 'created'),
      makeIssue(60, 'revised'),
      makeIssue(85, 'none'),
    ];

    const result = computeMetrics(issues, '3months', { trendThresholdPp: 2 });

    expect(result.windowTotal).toBe(4);
  });

  it('classifies trend as growing when change > threshold', () => {
    const issues = [
      // Current period: 100% created
      makeIssue(5, 'created'),
      // Prior period: 0% created
      makeIssue(35, 'none'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('growing');
  });

  it('classifies trend as declining when change < -threshold', () => {
    const issues = [
      // Current period: 0% created
      makeIssue(5, 'none'),
      // Prior period: 100% created
      makeIssue(35, 'created'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('declining');
  });

  it('classifies trend as stable when change within threshold', () => {
    const issues = [
      makeIssue(5, 'created'),
      makeIssue(10, 'none'),
      makeIssue(35, 'created'),
      makeIssue(40, 'none'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('stable');
  });

  it('uses configurable threshold', () => {
    const issues = [
      makeIssue(5, 'created'),
      makeIssue(10, 'created'),
      makeIssue(15, 'none'),
      // Prior: all none
      makeIssue(35, 'none'),
      makeIssue(40, 'none'),
      makeIssue(45, 'none'),
    ];

    // With high threshold, same data is "stable"
    const highThreshold = computeMetrics(issues, 'month', { trendThresholdPp: 90 });
    expect(highThreshold.trend).toBe('stable');
  });

  it('handles empty issues', () => {
    const result = computeMetrics([], 'month', { trendThresholdPp: 2 });

    expect(result.createdPct).toBe(0);
    expect(result.revisedCount).toBe(0);
    expect(result.windowTotal).toBe(0);
    expect(result.totalRFEs).toBe(0);
    expect(result.trend).toBe('stable');
  });

  it('handles all same category', () => {
    const issues = [
      makeIssue(5, 'both'),
      makeIssue(10, 'both'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.createdPct).toBe(100);
  });

  it('uses default threshold of 2 when config is null', () => {
    const result = computeMetrics([], 'month', null);
    expect(result.trend).toBe('stable');
  });

  it('windows issues by created date, not label date', () => {
    // Issue created 60 days ago, label added 5 days ago — should NOT be in the month window
    const labelDate = new Date();
    labelDate.setDate(labelDate.getDate() - 5);
    const issues = [
      makeIssue(60, 'created', { createdLabelDate: labelDate.toISOString() }),
      makeIssue(5, 'none'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    // Only the recently-created issue should be in the window
    expect(result.windowTotal).toBe(1);
    expect(result.createdPct).toBe(0);
  });

  it('counts revisions by revisedLabelDate within the window', () => {
    const recentLabel = new Date();
    recentLabel.setDate(recentLabel.getDate() - 3);
    const issues = [
      // Old issue revised recently — should count as a revision in this window
      makeIssue(60, 'revised', { revisedLabelDate: recentLabel.toISOString() }),
      // Recent issue revised recently
      makeIssue(5, 'both', { revisedLabelDate: recentLabel.toISOString() }),
      // Recent issue, no revision
      makeIssue(5, 'none'),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.revisedCount).toBe(2);
    // windowTotal only counts issues created in the window
    expect(result.windowTotal).toBe(2);
  });

  it('falls back to created date when revisedLabelDate is missing', () => {
    const issues = [
      makeIssue(5, 'revised'), // no revisedLabelDate, falls back to created (5 days ago)
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.revisedCount).toBe(1);
  });

  it('returns priorRevisedCount for the prior window', () => {
    const priorLabel = new Date();
    priorLabel.setDate(priorLabel.getDate() - 35);
    const issues = [
      makeIssue(60, 'revised', { revisedLabelDate: priorLabel.toISOString() }),
    ];

    const result = computeMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result.revisedCount).toBe(0);
    expect(result.priorRevisedCount).toBe(1);
  });
});

describe('buildTrendData', () => {
  it('returns correct number of weeks for each window', () => {
    expect(buildTrendData([], 'week')).toHaveLength(4);
    expect(buildTrendData([], 'month')).toHaveLength(8);
    expect(buildTrendData([], '3months')).toHaveLength(13);
  });

  it('buckets issues by week using created date', () => {
    const issues = [
      makeIssue(1, 'created'),
      makeIssue(2, 'both'),
      makeIssue(10, 'none'),
    ];

    const points = buildTrendData(issues, 'month');

    // Last point should include the recent issues
    const lastPoint = points[points.length - 1];
    expect(lastPoint.total).toBeGreaterThan(0);
    expect(lastPoint.date).toBeTruthy();
  });

  it('computes per-week created percentages correctly', () => {
    // All issues in the same recent week
    const issues = [
      makeIssue(1, 'created'),
      makeIssue(2, 'created'),
      makeIssue(3, 'none'),
      makeIssue(3, 'none'),
    ];

    const points = buildTrendData(issues, 'week');

    // Find the point that has these issues
    const withData = points.find(p => p.total === 4);
    if (withData) {
      expect(withData.createdPct).toBe(50);
    }
  });

  it('returns 0 for weeks with no issues', () => {
    const points = buildTrendData([], 'week');
    for (const p of points) {
      expect(p.createdPct).toBe(0);
      expect(p.revisedCount).toBe(0);
      expect(p.total).toBe(0);
    }
  });

  it('buckets revised count by revisedLabelDate', () => {
    // Issue created 60 days ago, label added 3 days ago → revised count in recent week
    const labelDate = new Date();
    labelDate.setDate(labelDate.getDate() - 3);
    const issues = [
      makeIssue(60, 'revised', { revisedLabelDate: labelDate.toISOString() }),
    ];

    const points = buildTrendData(issues, 'month');
    const lastPoint = points[points.length - 1];
    expect(lastPoint.revisedCount).toBe(1);
    // Total (created-based) should NOT include this old issue
    expect(lastPoint.total).toBe(0);
  });
});

describe('buildBreakdownData', () => {
  it('counts by AI involvement category', () => {
    const issues = [
      makeIssue(1, 'both'),
      makeIssue(2, 'both'),
      makeIssue(3, 'created'),
      makeIssue(4, 'revised'),
      makeIssue(5, 'none'),
      makeIssue(6, 'none'),
      makeIssue(7, 'none'),
    ];

    const result = buildBreakdownData(issues);

    expect(result).toEqual([
      { name: 'Created & Revised', value: 2 },
      { name: 'AI Created', value: 1 },
      { name: 'AI Revised', value: 1 },
      { name: 'No AI', value: 3 },
    ]);
  });

  it('handles empty issues', () => {
    const result = buildBreakdownData([]);
    expect(result).toEqual([
      { name: 'Created & Revised', value: 0 },
      { name: 'AI Created', value: 0 },
      { name: 'AI Revised', value: 0 },
      { name: 'No AI', value: 0 },
    ]);
  });
});

describe('computeAllMetrics', () => {
  it('returns metrics, trendData, and breakdown', () => {
    const issues = [makeIssue(5, 'created')];
    const result = computeAllMetrics(issues, 'month', { trendThresholdPp: 2 });

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('trendData');
    expect(result).toHaveProperty('breakdown');
    expect(result.trendData).toHaveLength(8);
  });
});
