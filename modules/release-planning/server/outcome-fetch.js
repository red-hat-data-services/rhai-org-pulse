/**
 * Fallback fetcher for outcome summaries not found in the feature-traffic index.
 *
 * When outcome keys (RHAISTRAT-* issues) are not present in the feature-traffic
 * pipeline data, this module fetches their summaries directly from the Jira API.
 * Results are cached to data/release-planning/outcome-summaries-cache-{version}.json.
 */

const { jiraRequest } = require('../../../shared/server/jira')

const DATA_PREFIX = 'release-planning'

/**
 * Check whether Jira credentials are configured.
 * @returns {boolean}
 */
function hasJiraCredentials() {
  return !!(process.env.JIRA_TOKEN && process.env.JIRA_EMAIL)
}

/**
 * Fetch summaries for the given issue keys from Jira.
 * Uses a single JQL query: key in (KEY-1, KEY-2, ...) with fields=summary.
 *
 * @param {string[]} keys - Issue keys to look up
 * @returns {Promise<Object>} Map of key -> summary string
 */
const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/

async function fetchOutcomeSummaries(keys) {
  if (!keys || keys.length === 0) return {}
  if (!hasJiraCredentials()) {
    console.log('[release-planning] Jira credentials not configured, skipping outcome summary fetch')
    return {}
  }

  var safeKeys = keys.filter(function(k) { return typeof k === 'string' && ISSUE_KEY_PATTERN.test(k) })
  if (safeKeys.length === 0) return {}

  var jql = 'key in (' + safeKeys.join(',') + ')'
  var params = new URLSearchParams({ jql: jql, fields: 'summary', maxResults: String(safeKeys.length) })
  var data = await jiraRequest('/rest/api/3/search/jql?' + params)

  var summaries = {}
  if (data && data.issues) {
    for (var i = 0; i < data.issues.length; i++) {
      var issue = data.issues[i]
      summaries[issue.key] = issue.fields && issue.fields.summary || ''
    }
  }

  return summaries
}

/**
 * Load cached outcome summaries for a version, or fetch from Jira if not cached.
 *
 * @param {string[]} keys - Missing outcome keys
 * @param {string} version - Release version (for cache scoping)
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @returns {Promise<Object>} Map of key -> summary string
 */
async function getOutcomeSummaries(keys, version, readFromStorage, writeToStorage) {
  if (!keys || keys.length === 0) return {}

  var cachePath = DATA_PREFIX + '/outcome-summaries-cache-' + version + '.json'
  var cached = readFromStorage(cachePath)

  // Check if all keys are already cached
  if (cached) {
    var allCached = true
    for (var i = 0; i < keys.length; i++) {
      if (cached[keys[i]] === undefined) {
        allCached = false
        break
      }
    }
    if (allCached) {
      var result = {}
      for (var j = 0; j < keys.length; j++) {
        result[keys[j]] = cached[keys[j]]
      }
      return result
    }
  }

  // Fetch from Jira
  var fetched = await fetchOutcomeSummaries(keys)

  if (Object.keys(fetched).length > 0) {
    // Merge into cache
    var merged = cached || {}
    for (var key in fetched) {
      merged[key] = fetched[key]
    }
    writeToStorage(cachePath, merged)
    console.log('[release-planning] Fetched ' + Object.keys(fetched).length + ' outcome summaries from Jira')
  }

  return fetched
}

module.exports = { fetchOutcomeSummaries: fetchOutcomeSummaries, getOutcomeSummaries: getOutcomeSummaries, hasJiraCredentials: hasJiraCredentials }
