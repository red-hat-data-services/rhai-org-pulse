/**
 * Pure business logic for 40-40-20 issue classification and sprint summarization.
 * No I/O dependencies — safe to use in Lambda, dev server, or tests.
 */

/**
 * Staleness threshold: 90 days in milliseconds
 */
const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Classify an issue into a 40-40-20 bucket based on Activity Type custom field
 */
function classifyIssue(issue) {
  if (issue.issueType === 'Vulnerability' || issue.issueType === 'Weakness') {
    return 'tech-debt-quality';
  }

  switch (issue.activityType) {
    case 'Tech Debt & Quality':
      return 'tech-debt-quality';
    case 'New Features':
      return 'new-features';
    case 'Learning & Enablement':
      return 'learning-enablement';
    default:
      return 'uncategorized';
  }
}

/**
 * Build sprint summary from classified issues
 * @param {Array} issues - Classified issues
 * @param {string} calculationMode - 'points' (default) or 'counts'
 */
function buildSprintSummary(issues, calculationMode = 'points') {
  const buckets = {
    'tech-debt-quality': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 },
    'new-features': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 },
    'learning-enablement': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 },
    'uncategorized': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 }
  };

  let totalPoints = 0;
  let totalCount = 0;
  let estimatedIssueCount = 0;
  let unestimatedIssueCount = 0;

  issues.forEach(issue => {
    const bucket = buckets[issue.bucket];
    if (!bucket) return;

    bucket.issueCount++;
    bucket.count++;
    totalCount++;

    if (issue.completed) {
      bucket.completedCount++;
    }

    if (issue.storyPoints != null) {
      bucket.points += issue.storyPoints;
      totalPoints += issue.storyPoints;
      estimatedIssueCount++;

      if (issue.completed) {
        bucket.completedPoints += issue.storyPoints;
      }
    } else {
      unestimatedIssueCount++;
    }
  });

  return {
    calculationMode,
    totalPoints,
    totalCount,
    estimatedIssueCount,
    unestimatedIssueCount,
    buckets
  };
}

/**
 * Find the most recent end date among a list of sprints.
 */
function getLatestSprintEndDate(sprints) {
  let latest = null;

  for (const sprint of sprints) {
    const dateStr = sprint.completeDate || sprint.endDate;
    if (!dateStr) continue;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    if (!latest || date > new Date(latest)) {
      latest = dateStr;
    }
  }

  return latest;
}

/**
 * Determine whether a board is stale based on its sprints.
 */
function determineStaleness(sprints, now = new Date()) {
  if (!sprints || sprints.length === 0) {
    return { stale: true, lastSprintEndDate: null };
  }

  const hasActiveOrFuture = sprints.some(
    s => s.state === 'active' || s.state === 'future'
  );

  if (hasActiveOrFuture) {
    return { stale: false, lastSprintEndDate: getLatestSprintEndDate(sprints) };
  }

  const lastSprintEndDate = getLatestSprintEndDate(sprints);

  if (!lastSprintEndDate) {
    return { stale: true, lastSprintEndDate: null };
  }

  const elapsed = now.getTime() - new Date(lastSprintEndDate).getTime();
  return { stale: elapsed > STALE_THRESHOLD_MS, lastSprintEndDate };
}

/**
 * Create a zeroed buckets object.
 */
function emptyBuckets() {
  return {
    'tech-debt-quality': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 },
    'new-features': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 },
    'learning-enablement': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 },
    'uncategorized': { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 }
  };
}

/**
 * Aggregate bucket data from a source summary into a target buckets object (mutates target).
 */
function addBuckets(target, source) {
  for (const key of Object.keys(target)) {
    const s = source[key];
    if (!s) continue;
    target[key].points += s.points || 0;
    target[key].count += s.count || 0;
    target[key].issueCount += s.issueCount || 0;
    target[key].completedPoints += s.completedPoints || 0;
    target[key].completedCount += s.completedCount || 0;
  }
}

/**
 * Build a team-level summary by aggregating across board summaries.
 */
function buildTeamSummary(boardSummaries) {
  const buckets = emptyBuckets();
  let totalPoints = 0;
  let totalCount = 0;
  let estimatedIssueCount = 0;
  let unestimatedIssueCount = 0;

  for (const summary of boardSummaries) {
    totalPoints += summary.totalPoints || 0;
    totalCount += summary.totalCount || 0;
    estimatedIssueCount += summary.estimatedIssueCount || 0;
    unestimatedIssueCount += summary.unestimatedIssueCount || 0;
    if (summary.buckets) {
      addBuckets(buckets, summary.buckets);
    }
  }

  const percentages = {
    'tech-debt-quality': 0,
    'new-features': 0,
    'learning-enablement': 0,
    'uncategorized': 0
  };

  let totalWeight = 0;
  const bucketWeights = {
    'tech-debt-quality': 0,
    'new-features': 0,
    'learning-enablement': 0,
    'uncategorized': 0
  };

  for (const summary of boardSummaries) {
    const weight = (summary.calculationMode === 'counts')
      ? (summary.totalCount || 0)
      : (summary.totalPoints || 0);

    if (weight === 0) continue;

    totalWeight += weight;

    for (const bucketKey of Object.keys(bucketWeights)) {
      const bucket = summary.buckets?.[bucketKey];
      if (!bucket) continue;

      const value = (summary.calculationMode === 'counts')
        ? (bucket.count || 0)
        : (bucket.points || 0);

      bucketWeights[bucketKey] += value;
    }
  }

  if (totalWeight > 0) {
    for (const bucketKey of Object.keys(percentages)) {
      percentages[bucketKey] = (bucketWeights[bucketKey] / totalWeight) * 100;
    }
  }

  return {
    totalPoints,
    totalCount,
    boardCount: boardSummaries.length,
    estimatedIssueCount,
    unestimatedIssueCount,
    buckets,
    percentages
  };
}

/**
 * Build an org-level summary by aggregating across team summaries.
 */
function buildOrgSummary(teamSummaries) {
  const buckets = emptyBuckets();
  let totalPoints = 0;
  let totalCount = 0;
  let teamCount = 0;
  let boardCount = 0;
  let estimatedIssueCount = 0;
  let unestimatedIssueCount = 0;

  for (const summary of teamSummaries) {
    totalPoints += summary.totalPoints || 0;
    totalCount += summary.totalCount || 0;
    teamCount++;
    boardCount += summary.boardCount || 0;
    estimatedIssueCount += summary.estimatedIssueCount || 0;
    unestimatedIssueCount += summary.unestimatedIssueCount || 0;
    if (summary.buckets) {
      addBuckets(buckets, summary.buckets);
    }
  }

  const percentages = {
    'tech-debt-quality': 0,
    'new-features': 0,
    'learning-enablement': 0,
    'uncategorized': 0
  };

  // Use points for percentages when available; fall back to counts.
  if (totalPoints > 0) {
    for (const bucketKey of Object.keys(percentages)) {
      percentages[bucketKey] = (buckets[bucketKey].points / totalPoints) * 100;
    }
  } else if (totalCount > 0) {
    for (const bucketKey of Object.keys(percentages)) {
      percentages[bucketKey] = (buckets[bucketKey].count / totalCount) * 100;
    }
  }

  return {
    totalPoints,
    totalCount,
    teamCount,
    boardCount,
    estimatedIssueCount,
    unestimatedIssueCount,
    buckets,
    percentages
  };
}

module.exports = {
  STALE_THRESHOLD_MS,
  classifyIssue,
  buildSprintSummary,
  buildTeamSummary,
  buildOrgSummary,
  getLatestSprintEndDate,
  determineStaleness
};
