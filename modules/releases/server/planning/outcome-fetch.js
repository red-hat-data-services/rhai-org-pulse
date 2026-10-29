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
 * Fetch outcome summaries from Jira and merge with FALLBACK_OUTCOMES for ordering.
 *
 * Strategy:
 * 1. Use FALLBACK_OUTCOMES for correct View 7384 ordering (manually maintained)
 * 2. Fetch fresh summaries from Jira (query by keys in Rank order)
 * 3. Merge fresh Jira titles into FALLBACK_OUTCOMES structure
 * 4. Fall back to FALLBACK_OUTCOMES titles if Jira fetch fails
 *
 * This ensures:
 * - Ordering is always correct (View 7384 order from FALLBACK_OUTCOMES)
 * - Titles are fresh from Jira (if Jira is available)
 * - Graceful degradation (uses cached FALLBACK_OUTCOMES if Jira unavailable)
 *
 * @param {Function} jiraRequest - Bound jiraRequest function from jira client
 * @param {Array} fallbackOutcomes - FALLBACK_OUTCOMES array (for ordering and keys)
 * @returns {Promise<Array>} Outcomes with fresh Jira titles, in View 7384 order
 */
async function fetchOutcomesInPriorityOrder(jiraRequest, fallbackOutcomes) {
  if (!jiraRequest || !fallbackOutcomes || fallbackOutcomes.length === 0) {
    console.log('[release-planning] Jira credentials not available or no fallback outcomes, skipping fetch')
    return []
  }

  try {
    // Extract and validate outcome keys from FALLBACK_OUTCOMES
    var outcomeKeys = fallbackOutcomes
      .map(function(o) { return o.key })
      .filter(function(k) { return typeof k === 'string' && ISSUE_KEY_PATTERN.test(k) })
    if (outcomeKeys.length === 0) return []

    // Fetch fresh summaries from Jira
    var jql = 'key in (' + outcomeKeys.join(',') + ') ORDER BY Rank ASC'
    var params = new URLSearchParams({ jql: jql, fields: 'summary', maxResults: String(outcomeKeys.length) })
    var data = await jiraRequest('/rest/api/3/search/jql?' + params)

    // Build map of fresh Jira titles
    var jiraTitles = {}
    if (data && data.issues) {
      for (var i = 0; i < data.issues.length; i++) {
        var issue = data.issues[i]
        jiraTitles[issue.key] = (issue.fields && issue.fields.summary) || ''
      }
    }

    // Merge fresh titles with FALLBACK_OUTCOMES, preserving View 7384 order
    var outcomes = fallbackOutcomes.map(function(outcome) {
      return {
        key: outcome.key,
        title: jiraTitles[outcome.key] || outcome.title, // Use fresh Jira title if available
        orderNumber: outcome.orderNumber
      }
    })

    console.log('[release-planning] Fetched ' + Object.keys(jiraTitles).length + ' outcome titles from Jira, preserving View 7384 order')
    return outcomes
  } catch (err) {
    console.warn('[release-planning] Failed to fetch outcome titles from Jira:', err.message, '(will use FALLBACK_OUTCOMES)')
    return []
  }
}

/**
 * Load priority outcomes with fresh Jira titles while preserving View 7384 order.
 *
 * Implementation:
 * 1. Import FALLBACK_OUTCOMES for ordering reference
 * 2. Try to fetch fresh outcome titles from Jira (key-in query)
 * 3. If successful, merge fresh titles with FALLBACK_OUTCOMES structure
 * 4. If Jira fails, fall back to FALLBACK_OUTCOMES entirely
 *
 * The outcome of this function determines what goes into the 12h cache.
 *
 * @param {Function} jiraRequest - Bound jiraRequest function from jira client
 * @param {Function} readFromStorage - Storage read function
 * @param {Function} writeToStorage - Storage write function
 * @param {Array} fallbackOutcomes - FALLBACK_OUTCOMES array (for ordering and keys)
 * @returns {Promise<Array>} Outcomes in View 7384 order (fresh titles if available)
 */
async function getPriorityOutcomes(jiraRequest, readFromStorage, writeToStorage, fallbackOutcomes) {
  var cachePath = DATA_PREFIX + '/priority-outcomes.json'
  var TWELVE_HOURS = 12 * 60 * 60 * 1000

  // Try cached first
  var staleData = null
  try {
    var cached = await readFromStorage(cachePath)
    if (cached && cached.timestamp && Array.isArray(cached.data) && cached.data.length > 0) {
      var age = Date.now() - cached.timestamp
      if (age < TWELVE_HOURS) {
        console.log('[release-planning] Using cached priority outcomes (' + cached.data.length + ', age: ' + Math.round(age / 3600000) + 'h)')
        return cached.data
      }
      staleData = cached.data
      console.log('[release-planning] Priority outcomes cache expired (' + Math.round(age / 3600000) + 'h old), refreshing')
    }
  } catch {
    // Cache miss or error; fetch fresh
  }

  // Fetch fresh outcomes from Jira (with FALLBACK_OUTCOMES for ordering)
  var outcomes = await fetchOutcomesInPriorityOrder(jiraRequest, fallbackOutcomes)

  if (outcomes.length > 0) {
    try {
      await writeToStorage(cachePath, { data: outcomes, timestamp: Date.now() })
      console.log('[release-planning] Saved ' + outcomes.length + ' priority outcomes to cache')
    } catch (err) {
      console.error('[release-planning] Failed to cache outcomes:', err.message)
    }
    return outcomes
  }

  if (staleData) {
    console.log('[release-planning] Jira refresh returned empty, using stale cache (' + staleData.length + ' outcomes)')
    return staleData
  }

  // Final fallback: return empty array (routes.js will use FALLBACK_OUTCOMES)
  console.log('[release-planning] Could not fetch outcomes from Jira or cache, will use FALLBACK_OUTCOMES')
  return []
}

module.exports = {
  fetchOutcomeSummaries: fetchOutcomeSummaries,
  getOutcomeSummaries: getOutcomeSummaries,
  fetchOutcomesInPriorityOrder: fetchOutcomesInPriorityOrder,
  getPriorityOutcomes: getPriorityOutcomes
}
