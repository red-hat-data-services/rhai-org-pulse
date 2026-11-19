/**
 * Read-only projection of the RHAI Outcome to Feature Prioritization Jira Plan.
 *
 * The Plan view is backed by open RHAISTRAT Outcomes sorted by Jira Rank.
 * RHAISTRAT-2921 is the in-plan marker between the ranked Outcomes we surface
 * and the backlog below the line. We deliberately stop before the marker so
 * this view never needs to reproduce Plan filtering or infer a cutoff.
 */

var { CUSTOM_FIELDS, serializeField } = require('../hygiene/jira-fetch')
var { OUTCOME_KEY_PATTERN } = require('./validation')

var JIRA_BROWSE_URL = 'https://redhat.atlassian.net/browse'

var PLAN = {
  id: '5187',
  scenarioId: '5190',
  viewId: '7542',
  name: 'RHAI Outcome to Feature Prioritization',
  url: 'https://redhat.atlassian.net/jira/plans/5187/scenarios/5190/timeline?vid=7542',
  project: 'RHAISTRAT',
  sentinelKey: 'RHAISTRAT-2921'
}

var OUTCOME_JQL = 'project = RHAISTRAT AND issuetype = Outcome AND status not in (Closed, Done, Resolved, Cancelled) ORDER BY Rank ASC'
var ISSUE_FIELDS = [
  'summary',
  'status',
  'issuetype',
  'priority',
  'assignee',
  'reporter',
  'project',
  'components',
  'fixVersions',
  'labels',
  'updated',
  'created',
  CUSTOM_FIELDS.targetVersion,
  CUSTOM_FIELDS.productManager,
  CUSTOM_FIELDS.releaseType,
  CUSTOM_FIELDS.team
].join(',')

function parseKey(issue) {
  return issue && typeof issue.key === 'string' ? issue.key : ''
}

function parseStatus(fields) {
  var status = fields.status
  if (!status) return { name: '', category: '' }
  if (typeof status === 'string') return { name: status, category: '' }
  return {
    name: status.name || '',
    category: status.statusCategory ? status.statusCategory.name || '' : ''
  }
}

function versionNames(field) {
  if (field == null) return []
  var values = Array.isArray(field) ? field : [field]
  var names = []
  var seen = {}
  for (var i = 0; i < values.length; i++) {
    var value = values[i]
    if (value == null) continue
    var name = ''
    if (typeof value === 'string') name = value
    else if (value.name) name = value.name
    else if (value.value) name = value.value
    name = String(name || '').trim()
    if (!name || seen[name]) continue
    seen[name] = true
    names.push(name)
  }
  return names
}

function displayName(field, fallback) {
  if (field == null) return fallback || null
  if (typeof field === 'string') return field
  return field.displayName || field.name || field.value || fallback || null
}

function normalizeIssue(issue, rank) {
  var fields = issue && issue.fields ? issue.fields : {}
  var status = parseStatus(fields)
  var project = fields.project && (fields.project.key || fields.project.name)
  return {
    key: parseKey(issue),
    rank: rank == null ? null : rank,
    summary: fields.summary || '',
    issueType: fields.issuetype ? (fields.issuetype.name || String(fields.issuetype)) : '',
    status: status.name,
    statusCategory: status.category,
    priority: fields.priority ? (fields.priority.name || String(fields.priority)) : null,
    assignee: displayName(fields.assignee, 'Unassigned'),
    reporter: displayName(fields.reporter, null),
    productManager: displayName(fields[CUSTOM_FIELDS.productManager], null),
    components: Array.isArray(fields.components)
      ? fields.components.map(function(component) { return component && component.name }).filter(Boolean)
      : [],
    targetVersions: versionNames(fields[CUSTOM_FIELDS.targetVersion]),
    fixVersions: Array.isArray(fields.fixVersions)
      ? fields.fixVersions.map(function(version) { return version && version.name }).filter(Boolean)
      : [],
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    project: project || (parseKey(issue).split('-')[0] || null),
    created: fields.created || null,
    updated: fields.updated || null,
    url: JIRA_BROWSE_URL + '/' + parseKey(issue)
  }
}

/**
 * Fetch the ranked Outcomes that appear above the in-plan sentinel.
 *
 * @param {{fetchAllJqlResults: Function}} jiraClient
 * @returns {Promise<{plan: object, sentinelKey: string, generatedAt: string, outcomes: object[]}>}
 */
async function fetchRankedOutcomes(jiraClient) {
  if (!jiraClient || typeof jiraClient.fetchAllJqlResults !== 'function') {
    throw new Error('Jira client is not configured')
  }

  var issues = await jiraClient.fetchAllJqlResults(OUTCOME_JQL, ISSUE_FIELDS, { maxResults: 100 })
  var outcomes = []
  var foundSentinel = false

  for (var i = 0; i < issues.length; i++) {
    var issue = issues[i]
    if (parseKey(issue) === PLAN.sentinelKey) {
      foundSentinel = true
      break
    }
    var normalized = normalizeIssue(issue, outcomes.length + 1)
    if (!normalized.key) continue
    outcomes.push(normalized)
  }

  if (!foundSentinel) {
    throw new Error('Ranked cutoff ' + PLAN.sentinelKey + ' was not found in the open RHAISTRAT Outcome query')
  }

  return {
    plan: PLAN,
    sentinelKey: PLAN.sentinelKey,
    generatedAt: new Date().toISOString(),
    outcomes: outcomes
  }
}

/**
 * Fetch direct child work items for one Outcome. The child query mirrors the
 * Plan hierarchy and its open-status filter; closed work is not shown.
 *
 * @param {{fetchAllJqlResults: Function}} jiraClient
 * @param {string} outcomeKey
 * @returns {Promise<{outcomeKey: string, generatedAt: string, children: object[]}>}
 */
async function fetchOutcomeChildren(jiraClient, outcomeKey) {
  if (!jiraClient || typeof jiraClient.fetchAllJqlResults !== 'function') {
    throw new Error('Jira client is not configured')
  }
  if (typeof outcomeKey !== 'string' || !OUTCOME_KEY_PATTERN.test(outcomeKey)) {
    throw new Error('Invalid Outcome key')
  }

  // One key is used here, but keeping the existing Plan hierarchy query shape
  // (parent + Epic Link fallback) matches how the Plan assembles child rows.
  var quoted = '"' + outcomeKey + '"'
  var jql = '(parent = ' + quoted + ' OR "Epic Link" = ' + quoted + ') AND status not in (Closed, Done, Resolved, Cancelled) ORDER BY Rank ASC'
  var issues = await jiraClient.fetchAllJqlResults(jql, ISSUE_FIELDS, { maxResults: 100 })
  var children = []
  var seen = {}

  for (var i = 0; i < issues.length; i++) {
    var child = normalizeIssue(issues[i], children.length + 1)
    if (!child.key || seen[child.key]) continue
    seen[child.key] = true
    children.push(child)
  }

  return {
    outcomeKey: outcomeKey,
    generatedAt: new Date().toISOString(),
    children: children
  }
}

module.exports = {
  PLAN: PLAN,
  OUTCOME_JQL: OUTCOME_JQL,
  ISSUE_FIELDS: ISSUE_FIELDS,
  normalizeIssue: normalizeIssue,
  fetchRankedOutcomes: fetchRankedOutcomes,
  fetchOutcomeChildren: fetchOutcomeChildren
}
