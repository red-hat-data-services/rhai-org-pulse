/**
 * Live Jira fetch of Feature children under Big Rock outcome keys.
 *
 * Used by the planning pipeline so Tier-1 membership comes from Jira's
 * parent/Epic Link hierarchy (near real-time), then enriched from the
 * execution index when present.
 */

var { CUSTOM_FIELDS } = require('../hygiene/jira-fetch')
var { OUTCOME_KEY_PATTERN } = require('./validation')

var BATCH_SIZE = 40

var EPIC_LINK_FIELD = 'customfield_10014'

var CHILD_FIELDS = [
  'summary',
  'status',
  'issuetype',
  'priority',
  'assignee',
  'labels',
  'components',
  'fixVersions',
  'parent',
  EPIC_LINK_FIELD,
  CUSTOM_FIELDS.targetVersion,
  CUSTOM_FIELDS.productManager,
  CUSTOM_FIELDS.releaseType,
  CUSTOM_FIELDS.team
].join(',')

function versionNames(field) {
  if (!field) return []
  if (!Array.isArray(field)) {
    if (typeof field === 'string' && field) return [field]
    if (field && field.name) return [field.name]
    if (field && field.value) return [field.value]
    return []
  }
  var out = []
  for (var i = 0; i < field.length; i++) {
    var v = field[i]
    if (!v) continue
    if (typeof v === 'string') out.push(v)
    else if (v.name) out.push(v.name)
    else if (v.value) out.push(v.value)
  }
  return out
}

function resolveParentKey(fields) {
  if (fields.parent && fields.parent.key) return fields.parent.key
  var epicLink = fields[EPIC_LINK_FIELD]
  if (!epicLink) return ''
  if (typeof epicLink === 'string') return epicLink
  if (epicLink.key) return epicLink.key
  return ''
}

function normalizeChild(issue) {
  var fields = issue.fields || {}
  var parentKey = resolveParentKey(fields)
  var status = fields.status
    ? (typeof fields.status === 'object' ? fields.status.name || '' : String(fields.status))
    : ''
  var priority = fields.priority
    ? (typeof fields.priority === 'object' ? fields.priority.name || '' : String(fields.priority))
    : ''
  var issueType = fields.issuetype
    ? (typeof fields.issuetype === 'object' ? fields.issuetype.name || '' : String(fields.issuetype))
    : ''
  var components = Array.isArray(fields.components)
    ? fields.components.map(function (c) { return c && c.name }).filter(Boolean)
    : []
  var fixVersions = Array.isArray(fields.fixVersions)
    ? fields.fixVersions.map(function (v) { return v && v.name }).filter(Boolean)
    : []
  var assignee = fields.assignee
    ? { displayName: fields.assignee.displayName, accountId: fields.assignee.accountId }
    : null
  var pmField = fields[CUSTOM_FIELDS.productManager]
  var pm = pmField
    ? { displayName: pmField.displayName || null }
    : null

  return {
    key: issue.key,
    summary: fields.summary || '',
    status: status,
    issueType: issueType,
    priority: priority,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    components: components,
    fixVersions: fixVersions,
    targetVersions: versionNames(fields[CUSTOM_FIELDS.targetVersion]),
    assignee: assignee,
    pm: pm,
    releaseType: fields[CUSTOM_FIELDS.releaseType]
      ? (fields[CUSTOM_FIELDS.releaseType].value || fields[CUSTOM_FIELDS.releaseType].name || fields[CUSTOM_FIELDS.releaseType])
      : null,
    team: fields[CUSTOM_FIELDS.team]
      ? (fields[CUSTOM_FIELDS.team].value || fields[CUSTOM_FIELDS.team].name || null)
      : null,
    parentKey: parentKey,
    issueLinks: []
  }
}

/**
 * Fetch Feature/Initiative children for outcome keys from Jira.
 *
 * @param {object|null} jiraClient - { fetchAllJqlResults }
 * @param {string[]} outcomeKeys
 * @returns {Promise<Record<string, object[]>>} map of outcomeKey -> children
 */
async function fetchOutcomeChildren(jiraClient, outcomeKeys) {
  var byOutcome = {}
  if (!jiraClient || !jiraClient.fetchAllJqlResults) return byOutcome
  if (!outcomeKeys || !outcomeKeys.length) return byOutcome

  var safeKeys = []
  var seen = {}
  for (var i = 0; i < outcomeKeys.length; i++) {
    var key = outcomeKeys[i]
    if (typeof key !== 'string' || !OUTCOME_KEY_PATTERN.test(key) || seen[key]) continue
    seen[key] = true
    safeKeys.push(key)
    byOutcome[key] = []
  }
  if (!safeKeys.length) return byOutcome

  for (var start = 0; start < safeKeys.length; start += BATCH_SIZE) {
    var batch = safeKeys.slice(start, start + BATCH_SIZE)
    var keyList = batch.join(', ')
    var jql = '(parent in (' + keyList + ') OR "Epic Link" in (' + keyList + '))'
      + ' AND issuetype in (Feature, Initiative)'
      + ' AND status not in (Closed, Done, Resolved, Cancelled)'

    var issues = await jiraClient.fetchAllJqlResults(jql, CHILD_FIELDS, { maxResults: 100 })
    if (!Array.isArray(issues)) continue

    for (var ii = 0; ii < issues.length; ii++) {
      var child = normalizeChild(issues[ii])
      var parent = child.parentKey
      // Epic Link may not populate fields.parent — fall back by checking which batch key matches
      if (!parent || !byOutcome[parent]) {
        // Prefer explicit parent; otherwise skip if we can't attribute
        if (!parent) continue
        if (!byOutcome[parent]) byOutcome[parent] = []
      }
      byOutcome[parent].push(child)
    }
  }

  var total = 0
  var keys = Object.keys(byOutcome)
  for (var ki = 0; ki < keys.length; ki++) total += byOutcome[keys[ki]].length
  console.log('[release-planning] Fetched ' + total + ' Jira children for ' + safeKeys.length + ' outcome(s)')

  return byOutcome
}

module.exports = {
  fetchOutcomeChildren: fetchOutcomeChildren,
  normalizeChild: normalizeChild,
  versionNames: versionNames
}
