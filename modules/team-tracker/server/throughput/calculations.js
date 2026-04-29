/**
 * Throughput metric calculations (lead time, throughput bucketing)
 */

/**
 * Generate 2-week period buckets going back N periods from today
 * Returns: [{ start: Date, end: Date, key: "YYYY-MM-DD" }]
 */
function generate2WeekPeriods(numPeriods = 12) {
  const periods = [];
  const now = new Date();

  // Start from most recent Monday
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - cursor.getDay() + 1); // Monday
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < numPeriods; i++) {
    const end = new Date(cursor);
    const start = new Date(end);
    start.setDate(start.getDate() - 14);

    periods.unshift({
      start,
      end,
      key: start.toISOString().slice(0, 10)
    });

    cursor.setDate(cursor.getDate() - 14);
  }

  return periods;
}

/**
 * Compute lead time for an issue (created → resolved)
 */
function computeLeadTimeDays(issue) {
  if (!issue.resolutionDate || !issue.created) return null;
  const ms = new Date(issue.resolutionDate).getTime() - new Date(issue.created).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Bucket resolved issues into 2-week periods
 * Returns: { periodKey: { issues: [], leadTimes: [], cycleTimes: [], throughput: N } }
 */
function bucketIssuesByPeriod(resolvedIssues, periods) {
  const buckets = {};

  for (const period of periods) {
    buckets[period.key] = {
      periodStart: period.start.toISOString().slice(0, 10),
      periodEnd: period.end.toISOString().slice(0, 10),
      issues: [],
      leadTimes: [],
      cycleTimes: [],
      throughput: 0
    };
  }

  for (const issue of resolvedIssues) {
    if (!issue.resolutionDate) continue;
    const resDate = new Date(issue.resolutionDate);

    for (const period of periods) {
      if (resDate >= period.start && resDate < period.end) {
        const bucket = buckets[period.key];
        bucket.issues.push(issue);
        bucket.throughput++;

        const leadTime = computeLeadTimeDays(issue);
        if (leadTime != null && leadTime >= 0) {
          bucket.leadTimes.push(leadTime);
        }

        if (issue.cycleTimeDays != null && issue.cycleTimeDays >= 0) {
          bucket.cycleTimes.push(issue.cycleTimeDays);
        }

        break;
      }
    }
  }

  return buckets;
}

/**
 * Compute backlog health from current in-progress issues
 */
function computeBacklogHealth(inProgressIssues) {
  if (!inProgressIssues || inProgressIssues.length === 0) {
    return { count: 0, avgAgeDays: null };
  }

  const now = new Date();
  let totalAgeDays = 0;

  for (const issue of inProgressIssues) {
    if (!issue.created) continue;
    const ageMs = now.getTime() - new Date(issue.created).getTime();
    totalAgeDays += ageMs / (1000 * 60 * 60 * 24);
  }

  return {
    count: inProgressIssues.length,
    avgAgeDays: inProgressIssues.length > 0
      ? +(totalAgeDays / inProgressIssues.length).toFixed(1)
      : null
  };
}

module.exports = {
  generate2WeekPeriods,
  computeLeadTimeDays,
  bucketIssuesByPeriod,
  computeBacklogHealth
};
