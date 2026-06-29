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

function extractTerminalAt(changelog, pipelineState) {
  if (!changelog || !changelog.histories) return null;
  const targetLabel = 'jira-' + pipelineState;
  let latest = null;
  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field !== 'labels') continue;
      const after = item.toString || '';
      if (after.includes(targetLabel)) {
        const ts = new Date(history.created).getTime();
        if (latest === null || ts > latest) latest = ts;
      }
    }
  }
  return latest ? new Date(latest).toISOString() : null;
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

function issueInWindow(issue, windowStart, windowEnd, isLastWeek) {
  if (isLastWeek && TERMINAL_STATES.has(issue.pipelineState) && issue.terminalAt) {
    const t = new Date(issue.terminalAt).getTime();
    return t >= windowStart && t < windowEnd;
  }
  const c = new Date(issue.created).getTime();
  return c >= windowStart && c < windowEnd;
}

function computeAutofixMetrics(issues, timeWindow) {
  const isLastWeek = timeWindow === 'lastWeek';
  let windowStart, windowEnd;

  if (isLastWeek) {
    const bounds = getLastWeekBounds();
    windowStart = bounds.start;
    windowEnd = bounds.end;
  } else {
    const days = timeWindow === 'week' ? 7 : timeWindow === 'month' ? 30 : 90;
    windowEnd = Date.now();
    windowStart = windowEnd - days * 24 * 60 * 60 * 1000;
  }

  const counts = {};
  let windowTotal = 0;

  for (const issue of issues) {
    if (!issueInWindow(issue, windowStart, windowEnd, isLastWeek)) continue;
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
    ready: get('autofix-ready'),
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

  return {
    triageTotal,
    triageVerdicts,
    autofixStates,
    autofixTotal,
    terminalTotal,
    successRate,
    windowTotal,
    totalIssues: issues.length
  };
}

// Buckets issues by created date but uses current pipelineState. An issue
// created 3 weeks ago that later moved to autofix-merged appears as "merged"
// in the week it was created, not when it was merged. This is a known
// limitation — Jira labels don't carry timestamps for state transitions.
// The 'lastWeek' time window mitigates this for terminal states by using
// terminalAt (from the Jira changelog) instead of created.
function buildTrendData(issues, timeWindow) {
  const isLastWeek = timeWindow === 'lastWeek';
  const weekCounts = (timeWindow === 'week' || isLastWeek) ? 4 : timeWindow === 'month' ? 8 : 13;
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  const anchor = isLastWeek ? getLastWeekBounds().end : Date.now();

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
    const useTerminalAt = isLastWeek && TERMINAL_STATES.has(state) && issue.terminalAt;
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
        issue.terminalAt = extractTerminalAt(detail.changelog, issue.pipelineState);
      });
    }));
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[autofix] changelog fetch failed:', r.reason?.message || r.reason);
      }
    }
  }

  return processed;
}

module.exports = {
  fetchAutofixData,
  processIssue,
  classifyIssue,
  extractTerminalAt,
  getLastWeekBounds,
  computeAutofixMetrics,
  buildTrendData,
  ALL_PIPELINE_LABELS,
  TRIAGE_LABELS,
  AUTOFIX_LABELS,
  TERMINAL_LABELS,
  TERMINAL_STATES
};
