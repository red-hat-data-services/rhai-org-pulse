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
 * Fetch outcomes in priority order from Jira (type = Outcome, project = RHAISTRAT).
 * Jira plan view 7384 (Racer Strat) determines priority order via issue ordering.
 * We query all outcomes and order by their appearance in the plan.
 *
 * @param {Function} jiraRequest - Bound jiraRequest function from jira client
 * @returns {Promise<Array>} Array of outcomes [{key, title, orderNumber}] in Jira plan order
 */
async function fetchOutcomesInPriorityOrder(jiraRequest) {
  if (!jiraRequest) {
    console.log('[release-planning] Jira credentials not configured, skipping outcomes fetch')
    return []
  }

  try {
    // Query outcomes from RHAISTRAT project, ordered by creation date as a proxy
    // for plan order. The Jira Plans API doesn't expose plan-view ordering via JQL.
    var jql = 'project = RHAISTRAT AND type = Outcome ORDER BY created ASC'
    var params = new URLSearchParams({
      jql: jql,
      fields: 'summary',
      maxResults: '100'
    })
    var data = await jiraRequest('/rest/api/3/search/jql?' + params)

    var outcomes = []
    if (data && data.issues) {
      for (var i = 0; i < data.issues.length; i++) {
        var issue = data.issues[i]
        outcomes.push({
          key: issue.key,
          title: (issue.fields && issue.fields.summary) || '',
          orderNumber: i + 1
        })
      }
    }

    console.log('[release-planning] Fetched ' + outcomes.length + ' outcomes from Jira')
    return outcomes
  } catch (err) {
    console.error('[release-planning] Failed to fetch outcomes from Jira:', err.message)
    return []
  }
}

/**
 * Load or fetch outcomes in priority order, cache in data/releases/planning/priority-outcomes.json
 *
 * @param {Function} jiraRequest - Bound jiraRequest function
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @returns {Promise<Array>} Array of outcomes in priority order
 */
async function getPriorityOutcomes(jiraRequest, readFromStorage, writeToStorage) {
  var cachePath = DATA_PREFIX + '/priority-outcomes.json'

  // Try cached first
  try {
    var cached = await readFromStorage(cachePath)
    if (cached && Array.isArray(cached) && cached.length > 0) {
      console.log('[release-planning] Using cached priority outcomes (' + cached.length + ')')
      return cached
    }
  } catch {
    // Cache miss or error; fetch fresh
  }

  // Fetch from Jira
  var outcomes = await fetchOutcomesInPriorityOrder(jiraRequest)

  if (outcomes.length > 0) {
    try {
      await writeToStorage(cachePath, outcomes)
      console.log('[release-planning] Saved ' + outcomes.length + ' priority outcomes to cache')
    } catch (err) {
      console.error('[release-planning] Failed to cache outcomes:', err.message)
    }
  }

  return outcomes
}

module.exports = {
  fetchOutcomeSummaries: fetchOutcomeSummaries,
  getOutcomeSummaries: getOutcomeSummaries,
  fetchOutcomesInPriorityOrder: fetchOutcomesInPriorityOrder,
  getPriorityOutcomes: getPriorityOutcomes
}
