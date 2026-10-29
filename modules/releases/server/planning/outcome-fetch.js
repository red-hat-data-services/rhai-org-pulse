/**
 * Fallback fetcher for outcome summaries not found in the feature-traffic index.
 *
 * When outcome keys (RHAISTRAT-* issues) are not present in the execution
 * pipeline data, this module fetches their summaries directly from the Jira API.
 * Results are cached to data/releases/planning/outcome-summaries-cache-{version}.json.
 */

const DATA_PREFIX = 'releases/planning'

/**
 * Fetch summaries for the given issue keys from Jira.
 * Uses a single JQL query: key in (KEY-1, KEY-2, ...) with fields=summary.
 *
 * @param {Function} jiraRequest - Bound jiraRequest function from jira client
 * @param {string[]} keys - Issue keys to look up
 * @returns {Promise<Object>} Map of key -> summary string
 */
const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/

async function fetchOutcomeSummaries(jiraRequest, keys) {
  if (!keys || keys.length === 0) return {}
  if (!jiraRequest) {
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
 * @param {Function} jiraRequest - Bound jiraRequest function from jira client
 * @param {string[]} keys - Missing outcome keys
 * @param {string} version - Release version (for cache scoping)
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @returns {Promise<Object>} Map of key -> summary string
 */
async function getOutcomeSummaries(jiraRequest, keys, version, readFromStorage, writeToStorage) {
  if (!keys || keys.length === 0) return {}

  var cachePath = DATA_PREFIX + '/outcome-summaries-cache-' + version + '.json'
  var cached = await readFromStorage(cachePath)

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
  var fetched = await fetchOutcomeSummaries(jiraRequest, keys)

  if (Object.keys(fetched).length > 0) {
    // Merge into cache
    var merged = cached || {}
    for (var key in fetched) {
      merged[key] = fetched[key]
    }
    await writeToStorage(cachePath, merged)
    console.log('[release-planning] Fetched ' + Object.keys(fetched).length + ' outcome summaries from Jira')
  }

  return fetched
}

/**
 * Fetch outcomes in priority order from Jira plan view 7384 (Racer Strat).
 *
 * IMPORTANT: The Jira Plans API doesn't expose plan-view ordering via JQL/API.
 * We cannot reliably fetch outcomes in plan view 7384 order from Jira alone.
 * Instead, we rely on FALLBACK_OUTCOMES which is manually maintained in plan view order.
 *
 * This function is kept for future integration if Jira Plans API becomes available,
 * but currently returns empty to force fallback to FALLBACK_OUTCOMES.
 *
 * @param {Function} jiraRequest - Bound jiraRequest function from jira client
 * @returns {Promise<Array>} Empty array (forces fallback to FALLBACK_OUTCOMES)
 */
async function fetchOutcomesInPriorityOrder(jiraRequest) {
  if (!jiraRequest) {
    console.log('[release-planning] Jira credentials not configured, skipping outcomes fetch')
    return []
  }

  // Return empty to force fallback to FALLBACK_OUTCOMES
  // The Jira Plans API does not expose plan-view ordering, so we cannot guarantee
  // outcomes are in plan view 7384 order if fetched from Jira.
  // FALLBACK_OUTCOMES is manually maintained in correct order.
  console.log('[release-planning] Skipping live Jira fetch (plan view ordering not available via API), using FALLBACK_OUTCOMES')
  return []
}

/**
 * Load priority outcomes, preferring FALLBACK_OUTCOMES for plan view 7384 ordering.
 *
 * NOTE: We do NOT fetch from Jira because the Jira Plans API does not expose
 * plan-view ordering via JQL or REST API. Instead, FALLBACK_OUTCOMES is manually
 * maintained in the correct order (Jira plan view 7384, rows 1-12).
 *
 * @param {Function} _jiraRequest - Bound jiraRequest function (not used, kept for compatibility)
 * @param {Function} _readFromStorage
 * @param {Function} _writeToStorage
 * @returns {Promise<Array>} Empty array (forces fallback to FALLBACK_OUTCOMES in routes.js)
 */
async function getPriorityOutcomes(_jiraRequest, _readFromStorage, _writeToStorage) {
  // Always return empty array to force use of FALLBACK_OUTCOMES
  // This ensures outcomes are always in correct plan view 7384 order
  return []
}

module.exports = {
  fetchOutcomeSummaries: fetchOutcomeSummaries,
  getOutcomeSummaries: getOutcomeSummaries,
  fetchOutcomesInPriorityOrder: fetchOutcomesInPriorityOrder,
  getPriorityOutcomes: getPriorityOutcomes
}
