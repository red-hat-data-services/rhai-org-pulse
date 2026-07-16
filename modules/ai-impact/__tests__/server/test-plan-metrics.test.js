import { describe, it, expect } from 'vitest';
import { computeTestPlanMetrics, computeMetrics, buildTrendData, buildBreakdownData, computeReviewStatusMetrics } from '../../server/test-plans/metrics.js';

function makePlan(daysAgo, verdict = 'Ready', { autoRevised = false, humanReviewStatus = 'awaiting-review' } = {}) {
  const reviewedAt = new Date();
  reviewedAt.setDate(reviewedAt.getDate() - daysAgo);
  return {
    key: `RHAISTRAT-${Math.random().toString(36).slice(2, 6)}`,
    feature: 'Test Feature',
    verdict,
    score: verdict === 'Ready' ? 9 : verdict === 'Revise' ? 6 : 3,
    autoRevised,
    humanReviewStatus,
    reviewedAt: reviewedAt.toISOString()
  };
}

describe('computeMetrics', () => {
  it('computes pass rate for "month" time window', () => {
    const plans = [
      makePlan(5, 'Ready'),
      makePlan(10, 'Ready'),
      makePlan(15, 'Revise'),
      makePlan(45, 'Ready'),
      makePlan(50, 'Rework'),
    ];

    const result = computeMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.passRate).toBe(67);
    expect(result.windowTotal).toBe(3);
    expect(result.totalPlans).toBe(5);
  });

  it('computes "week" time window', () => {
    const plans = [
      makePlan(2, 'Ready'),
      makePlan(3, 'Revise'),
      makePlan(5, 'Rework'),
    ];

    const result = computeMetrics(plans, 'week', { trendThresholdPp: 2 });

    expect(result.windowTotal).toBe(3);
    expect(result.passRate).toBe(33);
  });

  it('computes "3months" time window', () => {
    const plans = [
      makePlan(10, 'Ready'),
      makePlan(30, 'Ready'),
      makePlan(60, 'Revise'),
      makePlan(85, 'Rework'),
    ];

    const result = computeMetrics(plans, '3months', { trendThresholdPp: 2 });

    expect(result.windowTotal).toBe(4);
  });

  it('classifies trend as growing when current volume > prior', () => {
    const plans = [
      makePlan(5, 'Ready'),
      makePlan(10, 'Ready'),
    ];

    const result = computeMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('growing');
    expect(result.volumeChange).toBe(2);
  });

  it('classifies trend as declining when current volume < prior', () => {
    const plans = [
      makePlan(35, 'Ready'),
      makePlan(40, 'Ready'),
    ];

    const result = computeMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('declining');
    expect(result.volumeChange).toBe(-2);
  });

  it('classifies trend as stable when volume unchanged', () => {
    const plans = [
      makePlan(5, 'Ready'),
      makePlan(35, 'Ready'),
    ];

    const result = computeMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.trend).toBe('stable');
    expect(result.volumeChange).toBe(0);
  });

  it('counts auto-revised plans in current and prior windows', () => {
    const plans = [
      makePlan(5, 'Ready', { autoRevised: true }),
      makePlan(10, 'Ready', { autoRevised: false }),
      makePlan(35, 'Ready', { autoRevised: true }),
      makePlan(40, 'Ready', { autoRevised: true }),
    ];

    const result = computeMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.autoRevisedCount).toBe(1);
    expect(result.priorAutoRevisedCount).toBe(2);
  });

  it('handles empty plans', () => {
    const result = computeMetrics([], 'month', { trendThresholdPp: 2 });

    expect(result.passRate).toBe(0);
    expect(result.autoRevisedCount).toBe(0);
    expect(result.windowTotal).toBe(0);
    expect(result.totalPlans).toBe(0);
    expect(result.trend).toBe('stable');
  });

  it('handles all same verdict', () => {
    const plans = [
      makePlan(5, 'Ready'),
      makePlan(10, 'Ready'),
    ];

    const result = computeMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.passRate).toBe(100);
    expect(result.priorWindowTotal).toBe(0);
  });

  it('uses default threshold of 2 when config is null', () => {
    const result = computeMetrics([], 'month', null);
    expect(result.trend).toBe('stable');
  });
});

describe('computeReviewStatusMetrics', () => {
  it('computes needs-review percentage', () => {
    const plans = [
      makePlan(5, 'Ready', { humanReviewStatus: 'needs-review' }),
      makePlan(10, 'Ready', { humanReviewStatus: 'approved' }),
      makePlan(15, 'Ready', { humanReviewStatus: 'awaiting-review' }),
    ];

    const result = computeReviewStatusMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.needsReviewPct).toBe(33);
  });

  it('computes awaiting sign-off percentage', () => {
    const plans = [
      makePlan(5, 'Ready', { humanReviewStatus: 'awaiting-review' }),
      makePlan(10, 'Ready', { humanReviewStatus: 'awaiting-review' }),
      makePlan(15, 'Ready', { humanReviewStatus: 'approved' }),
    ];

    const result = computeReviewStatusMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.awaitingSignoffPct).toBe(67);
  });

  it('computes period-over-period change', () => {
    const plans = [
      makePlan(5, 'Ready', { humanReviewStatus: 'needs-review' }),
      makePlan(10, 'Ready', { humanReviewStatus: 'approved' }),
      makePlan(35, 'Ready', { humanReviewStatus: 'approved' }),
      makePlan(40, 'Ready', { humanReviewStatus: 'approved' }),
    ];

    const result = computeReviewStatusMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.needsReviewPct).toBe(50);
    expect(result.needsReviewChange).toBe(50);
    expect(result.needsReviewTrend).toBe('worsening');
  });

  it('classifies improving trend', () => {
    const plans = [
      makePlan(5, 'Ready', { humanReviewStatus: 'approved' }),
      makePlan(35, 'Ready', { humanReviewStatus: 'needs-review' }),
    ];

    const result = computeReviewStatusMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result.needsReviewTrend).toBe('improving');
  });

  it('handles empty plans', () => {
    const result = computeReviewStatusMetrics([], 'month', { trendThresholdPp: 2 });

    expect(result.needsReviewPct).toBe(0);
    expect(result.needsReviewChange).toBe(0);
    expect(result.needsReviewTrend).toBe('stable');
    expect(result.awaitingSignoffPct).toBe(0);
    expect(result.awaitingSignoffChange).toBe(0);
    expect(result.awaitingSignoffTrend).toBe('stable');
  });
});

describe('buildTrendData', () => {
  it('returns correct number of weeks for each window', () => {
    expect(buildTrendData([], 'week')).toHaveLength(4);
    expect(buildTrendData([], 'month')).toHaveLength(8);
    expect(buildTrendData([], '3months')).toHaveLength(13);
  });

  it('buckets plans by week using reviewedAt', () => {
    const plans = [
      makePlan(1, 'Ready'),
      makePlan(2, 'Revise'),
      makePlan(10, 'Rework'),
    ];

    const points = buildTrendData(plans, 'month');

    const lastPoint = points[points.length - 1];
    expect(lastPoint.total).toBeGreaterThan(0);
    expect(lastPoint.date).toBeTruthy();
  });

  it('computes per-week pass rate correctly', () => {
    const plans = [
      makePlan(1, 'Ready'),
      makePlan(2, 'Ready'),
      makePlan(3, 'Revise'),
      makePlan(3, 'Rework'),
    ];

    const points = buildTrendData(plans, 'week');

    const withData = points.find(p => p.total === 4);
    if (withData) {
      expect(withData.passRate).toBe(50);
    }
  });

  it('returns 0 for weeks with no plans', () => {
    const points = buildTrendData([], 'week');
    for (const p of points) {
      expect(p.passRate).toBe(0);
      expect(p.autoRevisedCount).toBe(0);
      expect(p.total).toBe(0);
    }
  });

  it('counts auto-revised per week', () => {
    const plans = [
      makePlan(1, 'Ready', { autoRevised: true }),
      makePlan(2, 'Ready', { autoRevised: false }),
    ];

    const points = buildTrendData(plans, 'week');
    const lastPoint = points[points.length - 1];
    expect(lastPoint.autoRevisedCount).toBe(1);
  });
});

describe('buildBreakdownData', () => {
  it('counts by verdict', () => {
    const plans = [
      makePlan(1, 'Ready'),
      makePlan(2, 'Ready'),
      makePlan(3, 'Revise'),
      makePlan(4, 'Rework'),
      makePlan(5, 'Rework'),
      makePlan(6, 'Rework'),
    ];

    const result = buildBreakdownData(plans);

    expect(result).toEqual([
      { name: 'Ready', value: 2 },
      { name: 'Revise', value: 1 },
      { name: 'Rework', value: 3 },
    ]);
  });

  it('handles empty plans', () => {
    const result = buildBreakdownData([]);
    expect(result).toEqual([
      { name: 'Ready', value: 0 },
      { name: 'Revise', value: 0 },
      { name: 'Rework', value: 0 },
    ]);
  });
});

describe('computeTestPlanMetrics', () => {
  it('returns metrics, trendData, breakdown, and reviewStatus', () => {
    const plans = [makePlan(5, 'Ready')];
    const result = computeTestPlanMetrics(plans, 'month', { trendThresholdPp: 2 });

    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('trendData');
    expect(result).toHaveProperty('breakdown');
    expect(result).toHaveProperty('reviewStatus');
    expect(result.trendData).toHaveLength(8);
    expect(result.reviewStatus).toHaveProperty('needsReviewPct');
    expect(result.reviewStatus).toHaveProperty('awaitingSignoffPct');
  });

  it('breakdown uses only window plans', () => {
    const plans = [
      makePlan(5, 'Ready'),
      makePlan(100, 'Rework'),
    ];

    const result = computeTestPlanMetrics(plans, 'month', { trendThresholdPp: 2 });

    const readyCount = result.breakdown.find(b => b.name === 'Ready').value;
    const reworkCount = result.breakdown.find(b => b.name === 'Rework').value;
    expect(readyCount).toBe(1);
    expect(reworkCount).toBe(0);
  });
});
