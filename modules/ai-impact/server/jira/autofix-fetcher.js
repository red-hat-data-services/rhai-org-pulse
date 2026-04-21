const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { validateJqlSafeString } = require('../config');

// All labels from the jira-autofix triage + autofix pipelines
const TRIAGE_LABELS = [
  'jira-triage-pending',
  'jira-triage-needs-info',
  'jira-triage-not-fixable',
  'jira-triage-stale'
];

const AUTOFIX_LABELS = [
  'jira-autofix',
  'jira-autofix-pending',
  'jira-autofix-review',
  'jira-autofix-done',
  'jira-autofix-needs-info'
];

const ALL_PIPELINE_LABELS = [...TRIAGE_LABELS, ...AUTOFIX_LABELS];

function classifyIssue(labels) {
  const labelSet = new Set(labels);

  if (labelSet.has('jira-autofix-done')) return 'autofix-done';
  if (labelSet.has('jira-autofix-review')) return 'autofix-review';
  if (labelSet.has('jira-autofix-pending')) return 'autofix-pending';
  if (labelSet.has('jira-autofix-needs-info')) return 'autofix-needs-info';
  if (labelSet.has('jira-autofix')) return 'autofix-ready';
  if (labelSet.has('jira-triage-not-fixable')) return 'triage-not-fixable';
  if (labelSet.has('jira-triage-stale')) return 'triage-stale';
  if (labelSet.has('jira-triage-needs-info')) return 'triage-needs-info';
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
    ready: windowIssues.filter(i =>
      i.pipelineState === 'autofix-ready' ||
      i.pipelineState === 'autofix-pending' ||
      i.pipelineState === 'autofix-review' ||
      i.pipelineState === 'autofix-done' ||
      i.pipelineState === 'autofix-needs-info'
    ).length,
    needsInfo: windowIssues.filter(i => i.pipelineState === 'triage-needs-info').length,
    notFixable: windowIssues.filter(i => i.pipelineState === 'triage-not-fixable').length,
    stale: windowIssues.filter(i => i.pipelineState === 'triage-stale').length,
    pending: windowIssues.filter(i => i.pipelineState === 'triage-pending').length
  };

  const autofixStates = {
    ready: windowIssues.filter(i => i.pipelineState === 'autofix-ready').length,
    pending: windowIssues.filter(i => i.pipelineState === 'autofix-pending').length,
    review: windowIssues.filter(i => i.pipelineState === 'autofix-review').length,
    done: windowIssues.filter(i => i.pipelineState === 'autofix-done').length,
    needsInfo: windowIssues.filter(i => i.pipelineState === 'autofix-needs-info').length
  };

  const autofixTotal = autofixStates.ready + autofixStates.pending +
    autofixStates.review + autofixStates.done + autofixStates.needsInfo;
  const terminalTotal = autofixStates.done + autofixStates.needsInfo;
  const successRate = terminalTotal > 0
    ? Math.round((autofixStates.done / terminalTotal) * 100)
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
// created 3 weeks ago that later moved to autofix-done appears as "done"
// in the week it was created, not when it completed. This is a known
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

    const done = weekIssues.filter(i => i.pipelineState === 'autofix-done').length;

    points.push({
      date: weekEnd.toISOString().slice(0, 10),
      triaged,
      autofixed,
      done,
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
