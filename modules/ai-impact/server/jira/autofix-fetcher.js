const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { validateJqlSafeString } = require('../config');

const TERMINAL_LABELS = [
  'jira-autofix-merged',
  'jira-autofix-rejected',
  'jira-autofix-max-retries'
];

const TERMINAL_STATES = new Set([
  'autofix-merged', 'autofix-rejected', 'autofix-max-retries'
]);

// All labels from the jira-autofix triage + autofix pipelines
const TRIAGE_LABELS = [
  'jira-triage-pending',
  'jira-triage-missing-info',
  'jira-triage-not-fixable',
  'jira-triage-stale',
  'jira-triage-external',
  'jira-triage-security-review'
];

const AUTOFIX_LABELS = [
  'jira-autofix',
  'jira-autofix-pending',
  'jira-autofix-review',
  'jira-autofix-ci-failing',
  'jira-autofix-merged',
  'jira-autofix-rejected',
  'jira-autofix-max-retries',
  'jira-autofix-blocked'
];

const ALL_PIPELINE_LABELS = [...TRIAGE_LABELS, ...AUTOFIX_LABELS];

function classifyIssue(labels) {
  const labelSet = new Set(labels);

  // Terminal autofix states (check first — most specific)
  if (labelSet.has('jira-autofix-merged')) return 'autofix-merged';
  if (labelSet.has('jira-autofix-rejected')) return 'autofix-rejected';
  if (labelSet.has('jira-autofix-max-retries')) return 'autofix-max-retries';
  // Active autofix states (blocked before pending — blocked is added when
  // the bot gets stuck after starting, but pending may not be removed)
  if (labelSet.has('jira-autofix-blocked')) return 'autofix-blocked';
  if (labelSet.has('jira-autofix-ci-failing')) return 'autofix-ci-failing';
  if (labelSet.has('jira-autofix-review')) return 'autofix-review';
  if (labelSet.has('jira-autofix-pending')) return 'autofix-pending';
  if (labelSet.has('jira-autofix')) return 'autofix-ready';
  // Triage states (security-review first: it's added alongside other verdicts
  // and should take precedence since it requires human review)
  if (labelSet.has('jira-triage-security-review')) return 'triage-security-review';
  if (labelSet.has('jira-triage-external')) return 'triage-external';
  if (labelSet.has('jira-triage-not-fixable')) return 'triage-not-fixable';
  if (labelSet.has('jira-triage-stale')) return 'triage-stale';
  if (labelSet.has('jira-triage-missing-info')) return 'triage-missing-info';
  if (labelSet.has('jira-triage-pending')) return 'triage-pending';

  return 'unknown';
}

function processIssue(issue) {
  const labels = issue.fields.labels || [];
  const components = (issue.fields.components || []).map(c => c.name);

  return {
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || 'Unknown',
    issueType: issue.fields.issuetype?.name || 'Unknown',
    priority: issue.fields.priority?.name || 'None',
    created: issue.fields.created,
    updated: issue.fields.updated,
    terminalAt: null,
    labels,
    components,
    assignee: issue.fields.assignee?.displayName || null,
    pipelineState: classifyIssue(labels)
  };
}

function extractPipelineHistory(changelog, pipelineState) {
  const result = {
    terminalAt: null,
    ciFailureCount: 0,
    reviewRoundCount: 0,
    wasBlocked: false
  };

  if (!changelog || !changelog.histories) return result;

  const targetLabel = 'jira-' + pipelineState;
  let latestTerminal = null;

  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field !== 'labels') continue;
      const after = item.toString || '';

      if (after.includes(targetLabel)) {
        const ts = new Date(history.created).getTime();
        if (latestTerminal === null || ts > latestTerminal) latestTerminal = ts;
      }
      if (after.includes('jira-autofix-ci-failing')) {
        result.ciFailureCount++;
      }
      if (after.includes('jira-autofix-review')) {
        result.reviewRoundCount++;
      }
      if (after.includes('jira-autofix-blocked')) {
        result.wasBlocked = true;
      }
    }
  }

  result.terminalAt = latestTerminal ? new Date(latestTerminal).toISOString() : null;
  return result;
}

function extractTerminalAt(changelog, pipelineState) {
  return extractPipelineHistory(changelog, pipelineState).terminalAt;
}

function computeEffortScore(issue) {
  if (issue.pipelineState !== 'autofix-merged') {
    return { effortScore: null, effortTier: null };
  }

  let score = 1;

  if ((issue.ciFailureCount || 0) > 0) score += 1;

  const reviewRounds = issue.reviewRoundCount || 0;
  if (reviewRounds > 1) score += (reviewRounds - 1);

  if (issue.wasBlocked) score += 2;

  if (issue.terminalAt && issue.created) {
    const days = (new Date(issue.terminalAt).getTime() - new Date(issue.created).getTime()) / (24 * 60 * 60 * 1000);
    if (days > 7) score += 1;
  }

  const priority = issue.priority || '';
  if (priority === 'Blocker' || priority === 'Critical') score += 2;

  let tier;
  if (score <= 2) tier = 'Quick Win';
  else if (score <= 4) tier = 'Standard Fix';
  else tier = 'Complex Fix';

  return { effortScore: score, effortTier: tier };
}

function computePriorityBreakdown(issues) {
  const breakdown = {};
  for (let i = 0; i < issues.length; i++) {
    const p = issues[i].priority || 'Undefined';
    breakdown[p] = (breakdown[p] || 0) + 1;
  }
  return breakdown;
}

function computeMedianTimeToFix(issues) {
  const days = [];
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    if (issue.pipelineState !== 'autofix-merged') continue;
    if (!issue.terminalAt || !issue.created) continue;
    const d = (new Date(issue.terminalAt).getTime() - new Date(issue.created).getTime()) / (24 * 60 * 60 * 1000);
    days.push(d);
  }
  if (days.length === 0) return null;
  days.sort(function(a, b) { return a - b; });
  const mid = Math.floor(days.length / 2);
  if (days.length % 2 === 0) {
    return Math.round(((days[mid - 1] + days[mid]) / 2) * 10) / 10;
  }
  return Math.round(days[mid] * 10) / 10;
}

function getLastWeekBounds() {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const thisMonday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday
  ));
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start: lastMonday.getTime(), end: thisMonday.getTime() };
}

function getWindowBounds(timeWindow) {
  const now = new Date();
  switch (timeWindow) {
    case 'week': {
      const day = now.getUTCDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
      return { start: thisMonday.getTime(), end: Date.now(), useTerminalDate: false };
    }
    case 'lastWeek': {
      const bounds = getLastWeekBounds();
      return { start: bounds.start, end: bounds.end, useTerminalDate: true };
    }
    case 'last7':
      return { start: Date.now() - 7 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
    case 'month': {
      const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { start: firstOfMonth.getTime(), end: Date.now(), useTerminalDate: false };
    }
    case 'lastMonth': {
      const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return { start: firstOfLastMonth.getTime(), end: firstOfThisMonth.getTime(), useTerminalDate: true };
    }
    case 'last30':
      return { start: Date.now() - 30 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
    case 'last90':
      return { start: Date.now() - 90 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
    default:
      return { start: Date.now() - 30 * 24 * 60 * 60 * 1000, end: Date.now(), useTerminalDate: false };
  }
}

function issueInWindow(issue, windowStart, windowEnd, useTerminalDate) {
  if (useTerminalDate && TERMINAL_STATES.has(issue.pipelineState) && issue.terminalAt) {
    const t = new Date(issue.terminalAt).getTime();
    return t >= windowStart && t < windowEnd;
  }
  const c = new Date(issue.created).getTime();
  return c >= windowStart && c < windowEnd;
}

function computeAutofixMetrics(issues, timeWindow) {
  const { start: windowStart, end: windowEnd, useTerminalDate } = getWindowBounds(timeWindow);

  const counts = {};
  let windowTotal = 0;

  for (const issue of issues) {
    if (!issueInWindow(issue, windowStart, windowEnd, useTerminalDate)) continue;
    windowTotal++;
    counts[issue.pipelineState] = (counts[issue.pipelineState] || 0) + 1;
  }

  function get(state) { return counts[state] || 0; }

  const autofixStates = {
    ready: get('autofix-ready'),
    pending: get('autofix-pending'),
    review: get('autofix-review'),
    ciFailing: get('autofix-ci-failing'),
    merged: get('autofix-merged'),
    rejected: get('autofix-rejected'),
    maxRetries: get('autofix-max-retries'),
    blocked: get('autofix-blocked')
  };

  const autofixTotal = Object.values(autofixStates).reduce(function(s, v) { return s + v; }, 0);

  const triageVerdicts = {
    ready: autofixTotal,
    missingInfo: get('triage-missing-info'),
    notFixable: get('triage-not-fixable'),
    stale: get('triage-stale'),
    pending: get('triage-pending'),
    external: get('triage-external'),
    securityReview: get('triage-security-review')
  };

  const triageTotal = autofixTotal + triageVerdicts.missingInfo +
    triageVerdicts.notFixable + triageVerdicts.stale + triageVerdicts.pending +
    triageVerdicts.external + triageVerdicts.securityReview;

  const terminalTotal = autofixStates.merged + autofixStates.rejected + autofixStates.maxRetries;
  const successRate = terminalTotal > 0
    ? Math.round((autofixStates.merged / terminalTotal) * 100)
    : 0;

  const priorityBreakdown = computePriorityBreakdown(
    issues.filter(function(issue) { return issueInWindow(issue, windowStart, windowEnd, useTerminalDate); })
  );

  const mergedWindowIssues = issues.filter(function(issue) {
    return issue.pipelineState === 'autofix-merged' && issueInWindow(issue, windowStart, windowEnd, useTerminalDate);
  });

  const medianTimeToFixDays = computeMedianTimeToFix(mergedWindowIssues);

  const effortBreakdown = { quickWin: 0, standardFix: 0, complexFix: 0 };
  let totalImpactScore = 0;
  for (let j = 0; j < mergedWindowIssues.length; j++) {
    const tier = mergedWindowIssues[j].effortTier;
    if (tier === 'Quick Win') effortBreakdown.quickWin++;
    else if (tier === 'Standard Fix') effortBreakdown.standardFix++;
    else if (tier === 'Complex Fix') effortBreakdown.complexFix++;
    totalImpactScore += (mergedWindowIssues[j].effortScore || 0);
  }

  return {
    triageTotal,
    triageVerdicts,
    autofixStates,
    autofixTotal,
    terminalTotal,
    successRate,
    windowTotal,
    totalIssues: issues.length,
    priorityBreakdown,
    medianTimeToFixDays,
    effortBreakdown,
    totalImpactScore
  };
}

// Buckets issues by created date but uses current pipelineState. An issue
// created 3 weeks ago that later moved to autofix-merged appears as "merged"
// in the week it was created, not when it was merged. This is a known
// limitation — Jira labels don't carry timestamps for state transitions.
// The 'lastWeek' time window mitigates this for terminal states by using
// terminalAt (from the Jira changelog) instead of created.
function getTrendWeekCount(timeWindow) {
  if (timeWindow === 'week' || timeWindow === 'lastWeek' || timeWindow === 'last7') return 4;
  if (timeWindow === 'month' || timeWindow === 'lastMonth' || timeWindow === 'last30') return 8;
  return 13;
}

function getTrendAnchor(timeWindow) {
  if (timeWindow === 'lastWeek') return getLastWeekBounds().end;
  if (timeWindow === 'lastMonth') {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime();
  }
  return Date.now();
}

function buildTrendData(issues, timeWindow) {
  const { useTerminalDate } = getWindowBounds(timeWindow);
  const weekCounts = getTrendWeekCount(timeWindow);
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  const anchor = getTrendAnchor(timeWindow);

  const buckets = [];
  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(anchor - w * MS_PER_WEEK);
    buckets.push({
      date: weekEnd.toISOString().slice(0, 10),
      weekStart: weekEnd.getTime() - MS_PER_WEEK,
      weekEnd: weekEnd.getTime(),
      triaged: 0, autofixed: 0, merged: 0, total: 0,
      review: 0, ciFailing: 0, blocked: 0, maxRetries: 0,
      missingInfo: 0, stale: 0, external: 0, securityReview: 0
    });
  }

  const earliest = buckets[0].weekStart;
  const latest = buckets[buckets.length - 1].weekEnd;

  for (const issue of issues) {
    const state = issue.pipelineState;
    const useTerminalAt = useTerminalDate && TERMINAL_STATES.has(state) && issue.terminalAt;
    const ts = useTerminalAt
      ? new Date(issue.terminalAt).getTime()
      : new Date(issue.created).getTime();

    if (ts < earliest || ts >= latest) continue;

    const bucketIdx = Math.floor((ts - earliest) / MS_PER_WEEK);
    if (bucketIdx < 0 || bucketIdx >= buckets.length) continue;
    const bucket = buckets[bucketIdx];

    bucket.total++;

    const isTriage = state.startsWith('triage-');
    const isAutofix = state.startsWith('autofix-');

    if (isTriage || isAutofix) bucket.triaged++;
    if (isAutofix) bucket.autofixed++;

    if (state === 'autofix-merged') bucket.merged++;
    else if (state === 'autofix-review') bucket.review++;
    else if (state === 'autofix-ci-failing') bucket.ciFailing++;
    else if (state === 'autofix-blocked') bucket.blocked++;
    else if (state === 'autofix-max-retries') bucket.maxRetries++;
    else if (state === 'triage-missing-info') bucket.missingInfo++;
    else if (state === 'triage-stale') bucket.stale++;
    else if (state === 'triage-external') bucket.external++;
    else if (state === 'triage-security-review') bucket.securityReview++;
  }

  return buckets.map(function(b) {
    return {
      date: b.date, triaged: b.triaged, autofixed: b.autofixed,
      merged: b.merged, total: b.total, review: b.review,
      ciFailing: b.ciFailing, blocked: b.blocked, maxRetries: b.maxRetries,
      missingInfo: b.missingInfo, stale: b.stale,
      external: b.external, securityReview: b.securityReview
    };
  });
}

async function fetchAutofixData(jiraRequest, config) {
  const { autofixProjects, autofixCreatedAfter } = config;

  for (const p of autofixProjects) {
    validateJqlSafeString(p, 'autofixProjects entry');
  }
  if (autofixCreatedAfter) {
    validateJqlSafeString(autofixCreatedAfter, 'autofixCreatedAfter');
  }

  const projectClause = autofixProjects.map(p => `"${p}"`).join(', ');
  const labelClause = ALL_PIPELINE_LABELS.map(l => `"${l}"`).join(', ');

  let jql = `project IN (${projectClause}) AND labels IN (${labelClause})`;
  if (autofixCreatedAfter) {
    jql += ` AND created >= "${autofixCreatedAfter}"`;
  }
  jql += ' ORDER BY created DESC';

  const fields = 'summary,status,issuetype,priority,created,updated,labels,components,assignee';
  const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields);

  const processed = rawIssues.map(processIssue);

  const terminalIssues = processed.filter(i => TERMINAL_STATES.has(i.pipelineState));
  const BATCH = 10;
  for (let i = 0; i < terminalIssues.length; i += BATCH) {
    const batch = terminalIssues.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(function(issue) {
      return jiraRequest(
        '/rest/api/3/issue/' + encodeURIComponent(issue.key) + '?expand=changelog&fields=labels'
      ).then(function(detail) {
        const history = extractPipelineHistory(detail.changelog, issue.pipelineState);
        issue.terminalAt = history.terminalAt;
        issue.ciFailureCount = history.ciFailureCount;
        issue.reviewRoundCount = history.reviewRoundCount;
        issue.wasBlocked = history.wasBlocked;
      });
    }));
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[autofix] changelog fetch failed:', r.reason?.message || r.reason);
      }
    }
  }

  for (let i = 0; i < processed.length; i++) {
    const scoring = computeEffortScore(processed[i]);
    processed[i].effortScore = scoring.effortScore;
    processed[i].effortTier = scoring.effortTier;
  }

  return processed;
}

module.exports = {
  fetchAutofixData,
  processIssue,
  classifyIssue,
  extractTerminalAt,
  extractPipelineHistory,
  computeEffortScore,
  computePriorityBreakdown,
  computeMedianTimeToFix,
  getLastWeekBounds,
  getWindowBounds,
  computeAutofixMetrics,
  buildTrendData,
  ALL_PIPELINE_LABELS,
  TRIAGE_LABELS,
  AUTOFIX_LABELS,
  TERMINAL_LABELS,
  TERMINAL_STATES
};
