/**
 * Throughput metrics endpoint handler
 */

const {
  generate2WeekPeriods,
  bucketIssuesByPeriod,
  computeBacklogHealth
} = require('./calculations');

/**
 * Compute throughput metrics for a team
 * @param {object} storage - Storage context
 * @param {object} roster - Full roster object
 * @param {string} teamKey - Team key (e.g., "orgKey::teamName")
 * @param {object} options - { periods: 12 }
 */
function computeTeamThroughput(storage, roster, teamKey, options = {}) {
  const { readFromStorage } = storage;
  const numPeriods = options.periods || 12;

  // Find team in roster
  const [orgKey, teamName] = teamKey.split('::');
  const org = roster.orgs.find(o => o.key === orgKey);
  if (!org || !org.teams[teamName]) {
    throw new Error(`Team "${teamKey}" not found in roster`);
  }

  const team = org.teams[teamName];
  const uniqueMembers = dedupeMembers(team.members);

  // Collect all resolved and in-progress issues from team members
  const allResolvedIssues = [];
  const allInProgressIssues = [];

  for (const member of uniqueMembers) {
    const key = sanitizeFilename(member.jiraDisplayName);
    const cached = readFromStorage(`people/${key}.json`);

    if (cached?.resolved?.issues) {
      // Tag issues with assignee for person-level drill-down
      for (const issue of cached.resolved.issues) {
        allResolvedIssues.push({ ...issue, assignee: member.jiraDisplayName });
      }
    }

    if (cached?.inProgress?.issues) {
      for (const issue of cached.inProgress.issues) {
        allInProgressIssues.push({ ...issue, assignee: member.jiraDisplayName });
      }
    }
  }

  // Generate 2-week periods
  const periods = generate2WeekPeriods(numPeriods);

  // Bucket issues into periods
  const buckets = bucketIssuesByPeriod(allResolvedIssues, periods);

  // Compute aggregates for each period
  const periodMetrics = [];
  for (const period of periods) {
    const bucket = buckets[period.key];
    periodMetrics.push({
      periodStart: bucket.periodStart,
      periodEnd: bucket.periodEnd,
      leadTimeDays: bucket.leadTimes.length > 0
        ? +(bucket.leadTimes.reduce((a, b) => a + b, 0) / bucket.leadTimes.length).toFixed(1)
        : null,
      cycleTimeDays: bucket.cycleTimes.length > 0
        ? +(bucket.cycleTimes.reduce((a, b) => a + b, 0) / bucket.cycleTimes.length).toFixed(1)
        : null,
      throughput: bucket.throughput
    });
  }

  // Current period (most recent)
  const currentPeriod = periodMetrics[periodMetrics.length - 1];
  const backlog = computeBacklogHealth(allInProgressIssues);

  return {
    teamKey,
    displayName: team.displayName,
    memberCount: uniqueMembers.length,
    generatedAt: new Date().toISOString(),
    current: {
      ...currentPeriod,
      backlogCount: backlog.count,
      backlogAvgAgeDays: backlog.avgAgeDays
    },
    periods: periodMetrics
  };
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function dedupeMembers(members) {
  const seen = new Set();
  return members.filter(m => {
    if (seen.has(m.jiraDisplayName)) return false;
    seen.add(m.jiraDisplayName);
    return true;
  });
}

module.exports = {
  computeTeamThroughput
};
