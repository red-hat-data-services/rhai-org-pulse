/**
 * Fail-soft delivered-in-version fetch for PM Hub.
 *
 * Closed/Done/Resolved with Fix Version in the selected releases — execution
 * fact, not planning load. Requires version names. Times out on its own so a
 * slow Jira search cannot 504 the open Component Release Load request.
 */

var { FEATURES_LIST_PROJECTS } = require('../planning/constants')

var DELIVERED_STATUSES = ['Closed', 'Done', 'Resolved']
var DELIVERED_FIELDS = 'summary,status,fixVersions,components'
var DELIVERED_TIMEOUT_MS = 8000

function quoteJql(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

/**
 * @param {string[]} versions
 * @param {string[]} [components]
 * @returns {string|null}
 */
function buildDeliveredJql(versions, components) {
  if (!Array.isArray(versions) || versions.length === 0) return null
  var parts = [
    'project IN (' + FEATURES_LIST_PROJECTS.join(', ') + ')',
    'issuetype IN (Feature, Initiative)',
    'status IN (' + DELIVERED_STATUSES.join(', ') + ')',
    'fixVersion IN (' + versions.map(quoteJql).join(', ') + ')'
  ]
  if (Array.isArray(components) && components.length > 0) {
    parts.push('component IN (' + components.map(quoteJql).join(', ') + ')')
  }
  return parts.join(' AND ')
}

function emptyResult(extra) {
  return Object.assign({
    issues: [],
    skipped: null,
    timedOut: false
  }, extra || {})
}

function normalizeIssues(rawIssues) {
  var seen = {}
  var issues = []
  var list = Array.isArray(rawIssues) ? rawIssues : []
  for (var i = 0; i < list.length; i++) {
    var raw = list[i]
    if (!raw || !raw.key || seen[raw.key]) continue
    seen[raw.key] = true
    var fields = raw.fields || {}
    var fvs = []
    if (Array.isArray(fields.fixVersions)) {
      for (var vi = 0; vi < fields.fixVersions.length; vi++) {
        var name = fields.fixVersions[vi] && fields.fixVersions[vi].name
        if (name) fvs.push(name)
      }
    }
    var comps = []
    if (Array.isArray(fields.components)) {
      for (var ci = 0; ci < fields.components.length; ci++) {
        var cName = fields.components[ci] && fields.components[ci].name
        if (cName) comps.push(cName)
      }
    }
    issues.push({ key: raw.key, fixVersions: fvs, components: comps })
  }
  return issues
}

/**
 * @param {object} jiraClient
 * @param {{ versions: string[], components?: string[], timeoutMs?: number }} options
 * @returns {Promise<{ issues: object[], skipped: string|null, timedOut: boolean, error?: string }>}
 */
async function fetchDeliveredInVersion(jiraClient, options) {
  var versions = (options && options.versions) || []
  var components = (options && options.components) || []
  var timeoutMs = options && options.timeoutMs != null ? options.timeoutMs : DELIVERED_TIMEOUT_MS

  if (!versions.length) return emptyResult({ skipped: 'no-versions' })
  if (!jiraClient || !jiraClient.fetchAllJqlResults) {
    return emptyResult({ error: 'no-client' })
  }

  var jql = buildDeliveredJql(versions, components)
  var timedOut = false
  var timer = null
  var timeout = new Promise(function(resolve) {
    timer = setTimeout(function() {
      timedOut = true
      resolve(null)
    }, timeoutMs)
  })

  try {
    var result = await Promise.race([
      jiraClient.fetchAllJqlResults(jql, DELIVERED_FIELDS, { maxResults: 100 }),
      timeout
    ])
    if (timedOut || result == null) {
      console.warn('[releases/pm-hub] Delivered-in-version fetch exceeded ' + timeoutMs + 'ms')
      return emptyResult({ timedOut: true })
    }
    return emptyResult({ issues: normalizeIssues(result) })
  } catch (err) {
    console.warn('[releases/pm-hub] Delivered-in-version fetch failed:', err && err.message)
    return emptyResult({ error: 'fetch-failed' })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

module.exports = {
  DELIVERED_STATUSES: DELIVERED_STATUSES,
  DELIVERED_TIMEOUT_MS: DELIVERED_TIMEOUT_MS,
  quoteJql: quoteJql,
  buildDeliveredJql: buildDeliveredJql,
  fetchDeliveredInVersion: fetchDeliveredInVersion,
  normalizeIssues: normalizeIssues
}
