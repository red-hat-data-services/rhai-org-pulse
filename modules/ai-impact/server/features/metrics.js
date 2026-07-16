const { getTimeWindowDates } = require('../metrics');

function computeReviewStatusMetrics(features, timeWindow, config) {
  const threshold = config?.trendThresholdPp || 2;
  const now = new Date();
  const { cutoff, priorCutoff } = getTimeWindowDates(now, timeWindow);

  const currentFeatures = features.filter(f =>
    new Date(f.reviewedAt) >= cutoff);
  const priorFeatures = features.filter(f => {
    const d = new Date(f.reviewedAt);
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

  const currentNeedsReview = currentFeatures.filter(f =>
    f.humanReviewStatus === 'needs-review').length;
  const priorNeedsReview = priorFeatures.filter(f =>
    f.humanReviewStatus === 'needs-review').length;

  const needsReviewPct = pct(currentNeedsReview, currentFeatures.length);
  const priorNeedsReviewPct = pct(priorNeedsReview, priorFeatures.length);
  const needsReviewChange = needsReviewPct - priorNeedsReviewPct;

  const currentAwaiting = currentFeatures.filter(f =>
    f.humanReviewStatus === 'awaiting-review').length;
  const priorAwaiting = priorFeatures.filter(f =>
    f.humanReviewStatus === 'awaiting-review').length;

  const awaitingSignoffPct = pct(currentAwaiting, currentFeatures.length);
  const priorAwaitingSignoffPct = pct(priorAwaiting, priorFeatures.length);
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

function computeMetrics(features, timeWindow, _config) {
  const now = new Date();
  const { cutoff, priorCutoff } = getTimeWindowDates(now, timeWindow);

  const currentFeatures = features.filter(f => new Date(f.reviewedAt) >= cutoff);
  const priorFeatures = features.filter(f => {
    const d = new Date(f.reviewedAt);
    return d >= priorCutoff && d < cutoff;
  });

  const currentApproved = currentFeatures.filter(f => f.recommendation === 'approve').length;
  const currentTotal = currentFeatures.length;
  const priorTotal = priorFeatures.length;

  const approvalRate = currentTotal > 0 ? Math.round((currentApproved / currentTotal) * 100) : 0;

  const volumeChange = currentTotal - priorTotal;
  const trend = volumeChange > 0 ? 'growing' : volumeChange < 0 ? 'declining' : 'stable';

  const needsAttentionCount = currentFeatures.filter(f => f.needsAttention).length;
  const priorNeedsAttentionCount = priorFeatures.filter(f => f.needsAttention).length;

  return {
    windowTotal: currentTotal,
    priorWindowTotal: priorTotal,
    volumeChange, trend,
    approvalRate,
    needsAttentionCount, priorNeedsAttentionCount,
    totalFeatures: features.length
  };
}

function buildTrendData(features, timeWindow) {
  const weekCounts = timeWindow === 'week' ? 4 : timeWindow === 'month' ? 8 : 13;
  const now = new Date();
  const points = [];

  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekFeatures = features.filter(f => {
      const d = new Date(f.reviewedAt);
      return d >= weekStart && d < weekEnd;
    });
    const total = weekFeatures.length;
    const needsAttention = weekFeatures.filter(f => f.needsAttention).length;

    points.push({
      date: weekEnd.toISOString().slice(0, 10),
      total,
      needsAttentionCount: needsAttention
    });
  }

  return points;
}

function buildBreakdownData(features) {
  return [
    { name: 'Approve', value: features.filter(f => f.recommendation === 'approve').length },
    { name: 'Revise', value: features.filter(f => f.recommendation === 'revise').length },
    { name: 'Reject', value: features.filter(f => f.recommendation === 'reject').length }
  ];
}

function computeFeatureMetrics(features, timeWindow, config) {
  const { cutoff } = getTimeWindowDates(new Date(), timeWindow);
  const windowFeatures = features.filter(f => new Date(f.reviewedAt) >= cutoff);
  return {
    metrics: computeMetrics(features, timeWindow, config),
    trendData: buildTrendData(features, timeWindow),
    breakdown: buildBreakdownData(windowFeatures),
    reviewStatus: computeReviewStatusMetrics(features, timeWindow, config)
  };
}

module.exports = { computeFeatureMetrics, computeMetrics, buildTrendData, buildBreakdownData, computeReviewStatusMetrics };
