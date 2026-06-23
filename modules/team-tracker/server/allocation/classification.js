/**
 * Pure business logic for issue classification and sprint summarization.
 * Category-generic — works with any allocation strategy's categories.
 * No I/O dependencies — safe to use in Lambda, dev server, or tests.
 */

/**
 * Staleness threshold: 90 days in milliseconds
 */
const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Build sprint summary from classified issues.
 * @param {Array} issues - Classified issues (each has a .bucket key)
 * @param {string} calculationMode - 'points' (default) or 'counts'
 * @param {Array} categories - Strategy categories array
 */
function buildSprintSummary(issues, calculationMode = 'points', categories = []) {
  const buckets = emptyBuckets(categories);

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
 * Create a zeroed buckets object from strategy categories.
 * Always includes 'uncategorized' as a catch-all.
 * @param {Array} categories - Strategy categories array
 */
function emptyBuckets(categories = []) {
  const buckets = {};
  for (const cat of categories) {
    buckets[cat.key] = { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 };
  }
  buckets['uncategorized'] = { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 };
  return buckets;
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
 * @param {Array} boardSummaries - Array of sprint summaries
 * @param {Array} categories - Strategy categories array
 */
function buildTeamSummary(boardSummaries, categories = []) {
  const buckets = emptyBuckets(categories);
  const allKeys = Object.keys(buckets);
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

  const percentages = Object.fromEntries(allKeys.map(k => [k, 0]));

  let totalWeight = 0;
  const bucketWeights = Object.fromEntries(allKeys.map(k => [k, 0]));

  for (const summary of boardSummaries) {
    const weight = (summary.calculationMode === 'counts')
      ? (summary.totalCount || 0)
      : (summary.totalPoints || 0);

    if (weight === 0) continue;

    totalWeight += weight;

    for (const bucketKey of allKeys) {
      const bucket = summary.buckets?.[bucketKey];
      if (!bucket) continue;

      const value = (summary.calculationMode === 'counts')
        ? (bucket.count || 0)
        : (bucket.points || 0);

      bucketWeights[bucketKey] += value;
    }
  }

  if (totalWeight > 0) {
    for (const bucketKey of allKeys) {
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
 * @param {Array} teamSummaries - Array of team summaries
 * @param {Array} categories - Strategy categories array
 */
function buildOrgSummary(teamSummaries, categories = []) {
  const buckets = emptyBuckets(categories);
  const allKeys = Object.keys(buckets);
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

  const percentages = Object.fromEntries(allKeys.map(k => [k, 0]));

  if (totalPoints > 0) {
    for (const bucketKey of allKeys) {
      percentages[bucketKey] = (buckets[bucketKey].points / totalPoints) * 100;
    }
  } else if (totalCount > 0) {
    for (const bucketKey of allKeys) {
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
  buildSprintSummary,
  buildTeamSummary,
  buildOrgSummary,
  getLatestSprintEndDate,
  determineStaleness,
  emptyBuckets
};
