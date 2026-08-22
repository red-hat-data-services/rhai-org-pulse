import { describe, it, expect } from 'vitest';
import { computeFeatureMetrics, computeMetrics, buildTrendData, buildBreakdownData } from '../../server/features/metrics.js';

function makeFeature(daysAgo, recommendation = 'approve', { needsAttention = false, humanReviewStatus = 'awaiting-review' } = {}) {
  const reviewedAt = new Date();
  reviewedAt.setDate(reviewedAt.getDate() - daysAgo);
  return {
    key: `RHAISTRAT-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Test Feature',
    recommendation,
    needsAttention,
    humanReviewStatus,
    scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2, total: 8 },
    reviewedAt: reviewedAt.toISOString()
  };
}

describe('computeMetrics', () => {
  it('computes volume and approval rate for "month" window', () => {
    const features = [
      makeFeature(5, 'approve'),
      makeFeature(10, 'approve'),
      makeFeature(15, 'revise'),
      makeFeature(45, 'approve'),
      makeFeature(50, 'reject'),
    ];

    const result = computeMetrics(features, 'month', { trendThresholdPp: 2 });

    expect(result.approvalRate).toBe(67);
    expect(result.windowTotal).toBe(3);
    expect(result.priorWindowTotal).toBe(2);
    expect(result.totalFeatures).toBe(5);
  });

  it('classifies trend as growing when current volume > prior', () => {
    const features = [
      makeFeature(5, 'approve'),
      makeFeature(10, 'approve'),
    ];

    const result = computeMetrics(features, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('growing');
    expect(result.volumeChange).toBe(2);
  });

  it('classifies trend as declining when current volume < prior', () => {
    const features = [
      makeFeature(35, 'approve'),
      makeFeature(40, 'approve'),
    ];

    const result = computeMetrics(features, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('declining');
  });

  it('classifies trend as stable when volume unchanged', () => {
    const features = [
      makeFeature(5, 'approve'),
      makeFeature(35, 'approve'),
    ];

    const result = computeMetrics(features, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('stable');
  });

  it('counts needs-attention features', () => {
    const features = [
      makeFeature(5, 'revise', { needsAttention: true }),
      makeFeature(10, 'approve', { needsAttention: false }),
      makeFeature(35, 'revise', { needsAttention: true }),
      makeFeature(40, 'revise', { needsAttention: true }),
    ];

    const result = computeMetrics(features, 'month', { trendThresholdPp: 2 });

    expect(result.needsAttentionCount).toBe(1);
    expect(result.priorNeedsAttentionCount).toBe(2);
  });

  it('handles empty features', () => {
    const result = computeMetrics([], 'month', { trendThresholdPp: 2 });

    expect(result.approvalRate).toBe(0);
    expect(result.windowTotal).toBe(0);
    expect(result.totalFeatures).toBe(0);
    expect(result.trend).toBe('stable');
  });
});

describe('buildTrendData', () => {
  it('returns correct number of weeks for each window', () => {
    expect(buildTrendData([], 'week')).toHaveLength(4);
    expect(buildTrendData([], 'month')).toHaveLength(8);
    expect(buildTrendData([], '3months')).toHaveLength(13);
  });

  it('buckets features by week using reviewedAt', () => {
    const features = [
      makeFeature(1, 'approve'),
      makeFeature(2, 'revise', { needsAttention: true }),
    ];

    const points = buildTrendData(features, 'month');
    const lastPoint = points[points.length - 1];
    expect(lastPoint.total).toBe(2);
    expect(lastPoint.needsAttentionCount).toBe(1);
  });

  it('returns 0 for weeks with no features', () => {
    const points = buildTrendData([], 'week');
    for (const p of points) {
      expect(p.total).toBe(0);
      expect(p.needsAttentionCount).toBe(0);
    }
  });
});

describe('buildBreakdownData', () => {
  it('counts by recommendation', () => {
    const features = [
      makeFeature(1, 'approve'),
      makeFeature(2, 'approve'),
      makeFeature(3, 'revise'),
      makeFeature(4, 'reject'),
    ];

    const result = buildBreakdownData(features);

    expect(result).toEqual([
      { name: 'Approve', value: 2 },
      { name: 'Revise', value: 1 },
      { name: 'Reject', value: 1 },
    ]);
  });

  it('handles empty features', () => {
    expect(buildBreakdownData([])).toEqual([
      { name: 'Approve', value: 0 },
      { name: 'Revise', value: 0 },
      { name: 'Reject', value: 0 },
    ]);
  });
});

describe('computeFeatureMetrics', () => {
  it('returns metrics, trendData, breakdown, and reviewStatus', () => {
    const features = [makeFeature(5, 'approve')];
    const result = computeFeatureMetrics(features, 'month', { trendThresholdPp: 2 });

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('trendData');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('reviewStatus');
    expect(result.trendData).toHaveLength(8);
  });
});
