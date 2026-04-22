const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { validateJqlSafeString } = require('../config');

// All labels from the jira-autofix triage + autofix pipelines
const TRIAGE_LABELS = [
  'jira-triage-pending',
  'jira-triage-missing-info',
  'jira-triage-not-fixable',
  'jira-triage-stale'
];

const AUTOFIX_LABELS = [
  'jira-autofix',
  'jira-autofix-pending',
  'jira-autofix-review',
  'jira-autofix-ci-failing',
  'jira-autofix-merged',
  'jira-autofix-rejected',
  'jira-autofix-max-retries',
  'jira-autofix-researched',
  'jira-autofix-blocked'
];

const ALL_PIPELINE_LABELS = [...TRIAGE_LABELS, ...AUTOFIX_LABELS];

function classifyIssue(labels) {
  const labelSet = new Set(labels);

  // Terminal autofix states (check first — most specific)
  if (labelSet.has('jira-autofix-merged')) return 'autofix-merged';
  if (labelSet.has('jira-autofix-rejected')) return 'autofix-rejected';
  if (labelSet.has('jira-autofix-max-retries')) return 'autofix-max-retries';
  if (labelSet.has('jira-autofix-researched')) return 'autofix-researched';
  // Active autofix states (blocked before pending — blocked is added when
  // the bot gets stuck after starting, but pending may not be removed)
  if (labelSet.has('jira-autofix-blocked')) return 'autofix-blocked';
  if (labelSet.has('jira-autofix-ci-failing')) return 'autofix-ci-failing';
  if (labelSet.has('jira-autofix-review')) return 'autofix-review';
  if (labelSet.has('jira-autofix-pending')) return 'autofix-pending';
  if (labelSet.has('jira-autofix')) return 'autofix-ready';
  // Triage states
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
    labels,
    components,
    assignee: issue.fields.assignee?.displayName || null,
    pipelineState: classifyIssue(labels)
  };
}

function computeAutofixMetrics(issues, timeWindow) {
  const days = timeWindow === 'week' ? 7 : timeWindow === 'month' ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const windowIssues = issues.filter(i => new Date(i.created) >= cutoff);

  const triageTotal = windowIssues.filter(i =>
    i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')
  ).length;

  const triageVerdicts = {
    ready: windowIssues.filter(i => i.pipelineState.startsWith('autofix-')).length,
    missingInfo: windowIssues.filter(i => i.pipelineState === 'triage-missing-info').length,
    notFixable: windowIssues.filter(i => i.pipelineState === 'triage-not-fixable').length,
    stale: windowIssues.filter(i => i.pipelineState === 'triage-stale').length,
    pending: windowIssues.filter(i => i.pipelineState === 'triage-pending').length
  };

  const autofixStates = {
    ready: windowIssues.filter(i => i.pipelineState === 'autofix-ready').length,
    pending: windowIssues.filter(i => i.pipelineState === 'autofix-pending').length,
    review: windowIssues.filter(i => i.pipelineState === 'autofix-review').length,
    ciFailing: windowIssues.filter(i => i.pipelineState === 'autofix-ci-failing').length,
    merged: windowIssues.filter(i => i.pipelineState === 'autofix-merged').length,
    rejected: windowIssues.filter(i => i.pipelineState === 'autofix-rejected').length,
    maxRetries: windowIssues.filter(i => i.pipelineState === 'autofix-max-retries').length,
    researched: windowIssues.filter(i => i.pipelineState === 'autofix-researched').length,
    blocked: windowIssues.filter(i => i.pipelineState === 'autofix-blocked').length
  };

  const autofixTotal = Object.values(autofixStates).reduce((s, v) => s + v, 0);
  const terminalTotal = autofixStates.merged + autofixStates.rejected + autofixStates.maxRetries;
  const successRate = terminalTotal > 0
    ? Math.round((autofixStates.merged / terminalTotal) * 100)
    : 0;

  return {
    triageTotal,
    triageVerdicts,
    autofixStates,
    autofixTotal,
    successRate,
    windowTotal: windowIssues.length,
    totalIssues: issues.length
  };
}

// Buckets issues by created date but uses current pipelineState. An issue
// created 3 weeks ago that later moved to autofix-merged appears as "merged"
// in the week it was created, not when it was merged. This is a known
// limitation — Jira labels don't carry timestamps for state transitions.
function buildTrendData(issues, timeWindow) {
  const weekCounts = timeWindow === 'week' ? 4 : timeWindow === 'month' ? 8 : 13;
  const now = new Date();
  const points = [];

  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekIssues = issues.filter(i => {
      const d = new Date(i.created);
      return d >= weekStart && d < weekEnd;
    });

    const triaged = weekIssues.filter(i =>
      i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')
    ).length;

    const autofixed = weekIssues.filter(i =>
      i.pipelineState.startsWith('autofix-')
    ).length;

    const merged = weekIssues.filter(i => i.pipelineState === 'autofix-merged').length;

    points.push({
      date: weekEnd.toISOString().slice(0, 10),
      triaged,
      autofixed,
      merged,
      total: weekIssues.length
    });
  }

  return points;
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

  return rawIssues.map(processIssue);
}

module.exports = {
  fetchAutofixData,
  processIssue,
  classifyIssue,
  computeAutofixMetrics,
  buildTrendData,
  ALL_PIPELINE_LABELS,
  TRIAGE_LABELS,
  AUTOFIX_LABELS
};
