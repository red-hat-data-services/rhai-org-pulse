const { getTimeWindowDates } = require('../metrics');

function computeReviewStatusMetrics(plans, timeWindow, config) {
  const threshold = config?.trendThresholdPp || 2;
  const now = new Date();
  const { cutoff, priorCutoff } = getTimeWindowDates(now, timeWindow);

  const currentPlans = plans.filter(p =>
    new Date(p.reviewedAt) >= cutoff);
  const priorPlans = plans.filter(p => {
    const d = new Date(p.reviewedAt);
    return d >= priorCutoff && d < cutoff;
  });

  function pct(subset, total) {
    return total > 0 ? Math.round((subset / total) * 100) : 0;
  }

  function reviewTrend(change) {
    if (change > threshold) return 'worsening';
    if (change < -threshold) return 'improving';
    return 'stable';
  }

  const currentNeedsReview = currentPlans.filter(p =>
    p.humanReviewStatus === 'needs-review').length;
  const priorNeedsReview = priorPlans.filter(p =>
    p.humanReviewStatus === 'needs-review').length;

  const needsReviewPct = pct(currentNeedsReview, currentPlans.length);
  const priorNeedsReviewPct = pct(priorNeedsReview, priorPlans.length);
  const needsReviewChange = needsReviewPct - priorNeedsReviewPct;

  const currentAwaiting = currentPlans.filter(p =>
    p.humanReviewStatus === 'awaiting-review').length;
  const priorAwaiting = priorPlans.filter(p =>
    p.humanReviewStatus === 'awaiting-review').length;

  const awaitingSignoffPct = pct(currentAwaiting, currentPlans.length);
  const priorAwaitingSignoffPct = pct(priorAwaiting, priorPlans.length);
  const awaitingSignoffChange = awaitingSignoffPct - priorAwaitingSignoffPct;

  return {
    needsReviewPct,
    needsReviewChange,
    needsReviewTrend: reviewTrend(needsReviewChange),
    awaitingSignoffPct,
    awaitingSignoffChange,
    awaitingSignoffTrend: reviewTrend(awaitingSignoffChange)
  };
}

function computeMetrics(plans, timeWindow, _config) {
  const now = new Date();
  const { cutoff, priorCutoff } = getTimeWindowDates(now, timeWindow);

  const currentPlans = plans.filter(p => new Date(p.reviewedAt) >= cutoff);
  const priorPlans = plans.filter(p => {
    const d = new Date(p.reviewedAt);
    return d >= priorCutoff && d < cutoff;
  });

  const currentReady = currentPlans.filter(p => p.verdict === 'Ready').length;
  const currentTotal = currentPlans.length;
  const priorTotal = priorPlans.length;

  const passRate = currentTotal > 0 ? Math.round((currentReady / currentTotal) * 100) : 0;

  const volumeChange = currentTotal - priorTotal;
  const trend = volumeChange > 0 ? 'growing' : volumeChange < 0 ? 'declining' : 'stable';

  const autoRevisedCount = currentPlans.filter(p => p.autoRevised).length;
  const priorAutoRevisedCount = priorPlans.filter(p => p.autoRevised).length;

  return {
    windowTotal: currentTotal,
    priorWindowTotal: priorTotal,
    volumeChange, trend,
    passRate,
    autoRevisedCount, priorAutoRevisedCount,
    totalPlans: plans.length
  };
}

function buildTrendData(plans, timeWindow) {
  const weekCounts = timeWindow === 'week' ? 4 : timeWindow === 'month' ? 8 : 13;
  const now = new Date();
  const points = [];

  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekPlans = plans.filter(p => {
      const d = new Date(p.reviewedAt);
      return d >= weekStart && d < weekEnd;
    });
    const total = weekPlans.length;
    const ready = weekPlans.filter(p => p.verdict === 'Ready').length;
    const autoRevised = weekPlans.filter(p => p.autoRevised).length;

    points.push({
      date: weekEnd.toISOString().slice(0, 10),
      passRate: total > 0 ? Math.round((ready / total) * 100) : 0,
      autoRevisedCount: autoRevised,
      total
    });
  }

  return points;
}

function buildBreakdownData(plans) {
  return [
    { name: 'Ready', value: plans.filter(p => p.verdict === 'Ready').length },
    { name: 'Revise', value: plans.filter(p => p.verdict === 'Revise').length },
    { name: 'Rework', value: plans.filter(p => p.verdict === 'Rework').length }
  ];
}

function computeTestPlanMetrics(plans, timeWindow, config) {
  const { cutoff } = getTimeWindowDates(new Date(), timeWindow);
  const windowPlans = plans.filter(p => new Date(p.reviewedAt) >= cutoff);
  return {
    metrics: computeMetrics(plans, timeWindow, config),
    trendData: buildTrendData(plans, timeWindow),
    breakdown: buildBreakdownData(windowPlans),
    reviewStatus: computeReviewStatusMetrics(plans, timeWindow, config)
  };
}

module.exports = { computeTestPlanMetrics, computeMetrics, buildTrendData, buildBreakdownData, computeReviewStatusMetrics };
