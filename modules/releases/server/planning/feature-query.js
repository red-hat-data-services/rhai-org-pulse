var { CUSTOM_FIELDS, serializeField } = require('../hygiene/jira-fetch')

var QUERY_FIELDS = [
  'summary', 'status', 'issuetype', 'assignee', 'fixVersions',
  'components', 'labels', 'priority', 'created', 'updated',
  CUSTOM_FIELDS.team,
  CUSTOM_FIELDS.targetVersion,
  CUSTOM_FIELDS.riceScore,
  CUSTOM_FIELDS.statusSummary,
  CUSTOM_FIELDS.colorStatus,
  CUSTOM_FIELDS.releaseType,
  CUSTOM_FIELDS.docsRequired,
  CUSTOM_FIELDS.targetEnd
].join(',')

var JQL = 'project = RHAISTRAT AND issuetype IN (Feature, Initiative) AND status NOT IN (Closed, Done, Resolved, Cancelled)'

function normalizeIssue(issue) {
  var fields = issue.fields || {}
  var assignee = fields.assignee
    ? (typeof fields.assignee === 'object' ? fields.assignee.displayName || null : fields.assignee)
    : null
  var components = Array.isArray(fields.components)
    ? fields.components.map(function(c) { return c.name || String(c) }).filter(Boolean)
    : []
  var fixVersions = Array.isArray(fields.fixVersions)
    ? fields.fixVersions.map(function(v) { return v.name || String(v) }).filter(Boolean)
    : []
  var labels = Array.isArray(fields.labels) ? fields.labels : []
  var targetVersionRaw = serializeField(fields[CUSTOM_FIELDS.targetVersion])
  var targetVersions = targetVersionRaw ? [targetVersionRaw] : []
  var status = fields.status
    ? (typeof fields.status === 'object' ? fields.status.name || null : fields.status)
    : null
  var priority = fields.priority
    ? (typeof fields.priority === 'object' ? fields.priority.name || null : fields.priority)
    : null
  var issueType = fields.issuetype
    ? (typeof fields.issuetype === 'object' ? fields.issuetype.name || null : fields.issuetype)
    : null

  return {
    key: issue.key,
    summary: fields.summary || '',
    status: status,
    issueType: issueType,
    assignee: assignee,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    components: components,
    labels: labels,
    fixVersions: fixVersions,
    targetVersions: targetVersions,
    priority: priority,
    riceScore: fields[CUSTOM_FIELDS.riceScore] || null,
    statusSummary: serializeField(fields[CUSTOM_FIELDS.statusSummary]),
    colorStatus: serializeField(fields[CUSTOM_FIELDS.colorStatus]),
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    docsRequired: serializeField(fields[CUSTOM_FIELDS.docsRequired]),
    targetEnd: serializeField(fields[CUSTOM_FIELDS.targetEnd])
  }
}

async function fetchFeatures(jiraClient) {
  if (!jiraClient || !jiraClient.fetchAllJqlResults) return new Map()

  var issues = await jiraClient.fetchAllJqlResults(JQL, QUERY_FIELDS, { maxResults: 100 })
  var map = new Map()
  for (var i = 0; i < issues.length; i++) {
    var normalized = normalizeIssue(issues[i])
    if (normalized.key) map.set(normalized.key, normalized)
  }
  return map
}

module.exports = { fetchFeatures: fetchFeatures, normalizeIssue: normalizeIssue, JQL: JQL, QUERY_FIELDS: QUERY_FIELDS }
