/**
 * Jira enrichment for the release health pipeline.
 *
 * Two-pass strategy:
 *   Pass 1 (lightweight, all features): description, story points, issuelinks
 *   Pass 2 (targeted): changelog for at-risk features only
 *
 * Optionally fetches RICE fields from parent (RHAISTRAT outcome) issues.
 *
 * Uses shared/server/jira.js for API calls, with batching and throttling
 * to respect Jira Cloud rate limits.
 */

const { ENRICHMENT_FIELDS, CHANGELOG_FIELDS, EARLY_STATUSES } = require('../constants')
const { parseTshirtSize } = require('./tshirt-parser')

/**
 * Check whether Jira credentials are configured.
 * @returns {boolean}
 */
function hasJiraCredentials() {
  return !!(process.env.JIRA_TOKEN && process.env.JIRA_EMAIL)
}

/**
 * Split an array into batches of a given size.
 * @param {Array} arr
 * @param {number} size
 * @returns {Array<Array>}
 */
function batch(arr, size) {
  const batches = []
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size))
  }
  return batches
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms) })
}

/**
 * Parse issue links from the Jira issuelinks field into a normalized format.
 * @param {Array} issuelinks - Raw issuelinks array from Jira API
 * @returns {Array<{ type: string, direction: string, linkedKey: string, linkedStatus: string }>}
 */
function parseIssueLinks(issuelinks) {
  if (!Array.isArray(issuelinks)) return []

  var links = []
  for (var i = 0; i < issuelinks.length; i++) {
    var link = issuelinks[i]
    var typeName = link.type ? link.type.name : ''

    if (link.inwardIssue) {
      links.push({
        type: typeName,
        direction: 'inward',
        linkedKey: link.inwardIssue.key,
        linkedStatus: link.inwardIssue.fields && link.inwardIssue.fields.status
          ? link.inwardIssue.fields.status.name || ''
          : ''
      })
    }
    if (link.outwardIssue) {
      links.push({
        type: typeName,
        direction: 'outward',
        linkedKey: link.outwardIssue.key,
        linkedStatus: link.outwardIssue.fields && link.outwardIssue.fields.status
          ? link.outwardIssue.fields.status.name || ''
          : ''
      })
    }
  }
  return links
}

/**
 * Check whether a Jira description field has content.
 * The v3 API returns ADF (Atlassian Document Format) as an object.
 * A non-empty description has content nodes beyond the empty doc wrapper.
 * @param {*} description - The description field value from Jira
 * @returns {boolean}
 */
function hasDescriptionContent(description) {
  if (!description) return false
  if (typeof description === 'string') return description.trim().length > 0
  // ADF format: { type: 'doc', content: [...] }
  if (description.type === 'doc' && Array.isArray(description.content)) {
    return description.content.length > 0
  }
  return true
}

/**
 * Parse changelog entries to extract refinement history.
 * Looks for Target Version changes in the changelog.
 * @param {object} issue - Jira issue with changelog expansion
 * @returns {Array<{ field: string, from: string|null, to: string|null, date: string }>}
 */
function parseChangelog(issue) {
  if (!issue.changelog || !Array.isArray(issue.changelog.histories)) return []

  var history = []
  var histories = issue.changelog.histories
  for (var i = 0; i < histories.length; i++) {
    var items = histories[i].items || []
    var created = histories[i].created || ''
    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      if (item.field === 'Target Version' || item.fieldId === 'customfield_10855') {
        history.push({
          field: 'Target Version',
          from: item.fromString || null,
          to: item.toString || null,
          date: created
        })
      }
    }
  }
  return history
}

/**
 * Determine which features need changelog enrichment (Pass 2).
 * Targets features that lack a Target Version, are in early workflow states,
 * or have no story points.
 * @param {Array<string>} featureKeys - All feature keys
 * @param {Map<string, object>} enrichmentMap - Pass 1 enrichment data
 * @param {Array<object>} features - Feature data from index/detail
 * @returns {Array<string>} Keys needing changelog
 */
function identifyChangelogTargets(featureKeys, enrichmentMap, features) {
  var featureByKey = {}
  for (var i = 0; i < features.length; i++) {
    featureByKey[features[i].key] = features[i]
  }

  var targets = []
  for (var k = 0; k < featureKeys.length; k++) {
    var key = featureKeys[k]
    var feature = featureByKey[key]
    var enrichment = enrichmentMap.get(key)

    if (!feature) continue

    var status = feature.status || ''
    var targetVersions = feature.targetVersions || []
    var needsChangelog = false

    // No target version
    if (!targetVersions.length) needsChangelog = true
    // Early workflow state
    if (EARLY_STATUSES.indexOf(status) !== -1) needsChangelog = true
    // No story points from enrichment
    if (enrichment && !enrichment.storyPoints) needsChangelog = true

    if (needsChangelog) targets.push(key)
  }
  return targets
}

/**
 * Run Pass 1 enrichment: fetch description, story points, and issuelinks
 * for all features in batches.
 *
 * @param {Function} jiraRequest - The shared jiraRequest function
 * @param {Function} fetchAllJqlResults - The shared fetchAllJqlResults function
 * @param {Array<string>} featureKeys - Jira issue keys to enrich
 * @param {object} opts - Options: { batchSize, throttleMs }
 * @returns {Promise<Map<string, object>>} Map of key -> enrichment data
 */
async function runPass1(jiraRequest, fetchAllJqlResults, featureKeys, opts) {
  var batchSize = (opts && opts.batchSize) || 40
  var throttleMs = (opts && opts.throttleMs) || 1000
  var enrichmentMap = new Map()

  if (!featureKeys.length) return enrichmentMap

  var batches = batch(featureKeys, batchSize)

  for (var bi = 0; bi < batches.length; bi++) {
    if (bi > 0) await sleep(throttleMs)

    var keys = batches[bi]
    var jql = 'key in (' + keys.join(', ') + ')'

    try {
      var issues = await fetchAllJqlResults(jiraRequest, jql, ENRICHMENT_FIELDS)

      for (var ii = 0; ii < issues.length; ii++) {
        var issue = issues[ii]
        var fields = issue.fields || {}

        enrichmentMap.set(issue.key, {
          hasDescription: hasDescriptionContent(fields.description),
          storyPoints: fields.customfield_10028 || null,
          dependencyLinks: parseIssueLinks(fields.issuelinks),
          refinementHistory: null,
          rice: null,
          tshirtSize: parseTshirtSize(fields.description)
        })
      }
    } catch (err) {
      console.warn('[health] Pass 1 batch ' + (bi + 1) + '/' + batches.length + ' failed:', err.message)
      // Mark missing keys with empty enrichment so the pipeline can continue
      for (var ei = 0; ei < keys.length; ei++) {
        if (!enrichmentMap.has(keys[ei])) {
          enrichmentMap.set(keys[ei], {
            hasDescription: false,
            storyPoints: null,
            dependencyLinks: [],
            refinementHistory: null,
            rice: null,
            tshirtSize: null,
            _error: true
          })
        }
      }
    }
  }

  return enrichmentMap
}

/**
 * Run Pass 2 enrichment: fetch changelog for targeted features.
 *
 * @param {Function} jiraRequest - The shared jiraRequest function
 * @param {Function} fetchAllJqlResults - The shared fetchAllJqlResults function
 * @param {Array<string>} targetKeys - Keys needing changelog enrichment
 * @param {Map<string, object>} enrichmentMap - Existing enrichment map to update
 * @param {object} opts - Options: { batchSize, throttleMs }
 * @returns {Promise<void>} Updates enrichmentMap in place
 */
async function runPass2(jiraRequest, fetchAllJqlResults, targetKeys, enrichmentMap, opts) {
  var batchSize = (opts && opts.batchSize) || 40
  var throttleMs = (opts && opts.throttleMs) || 1000

  if (!targetKeys.length) return

  var batches = batch(targetKeys, batchSize)

  for (var bi = 0; bi < batches.length; bi++) {
    if (bi > 0) await sleep(throttleMs)

    var keys = batches[bi]
    var jql = 'key in (' + keys.join(', ') + ')'

    try {
      var issues = await fetchAllJqlResults(jiraRequest, jql, CHANGELOG_FIELDS, { expand: 'changelog' })

      for (var ii = 0; ii < issues.length; ii++) {
        var issue = issues[ii]
        var existing = enrichmentMap.get(issue.key) || {}
        existing.refinementHistory = parseChangelog(issue)
        enrichmentMap.set(issue.key, existing)
      }
    } catch (err) {
      console.warn('[health] Pass 2 batch ' + (bi + 1) + '/' + batches.length + ' failed:', err.message)
    }
  }
}

/**
 * Fetch RICE fields from RHAISTRAT parent issues.
 *
 * @param {Function} jiraRequest - The shared jiraRequest function
 * @param {Function} fetchAllJqlResults - The shared fetchAllJqlResults function
 * @param {Array<string>} parentKeys - Unique parent (outcome) keys
 * @param {object} riceFieldIds - { riceReach, riceImpact, riceConfidence, riceEffort }
 * @param {object} opts - Options: { batchSize, throttleMs }
 * @returns {Promise<Map<string, object>>} Map of parentKey -> { reach, impact, confidence, effort }
 */
async function fetchRiceFields(jiraRequest, fetchAllJqlResults, parentKeys, riceFieldIds, opts) {
  var batchSize = (opts && opts.batchSize) || 40
  var throttleMs = (opts && opts.throttleMs) || 1000
  var riceMap = new Map()

  if (!parentKeys.length) return riceMap

  var fields = [
    riceFieldIds.riceReach,
    riceFieldIds.riceImpact,
    riceFieldIds.riceConfidence,
    riceFieldIds.riceEffort
  ].filter(Boolean).join(',')

  if (!fields) return riceMap

  var batches = batch(parentKeys, batchSize)

  for (var bi = 0; bi < batches.length; bi++) {
    if (bi > 0) await sleep(throttleMs)

    var keys = batches[bi]
    var jql = 'key in (' + keys.join(', ') + ')'

    try {
      var issues = await fetchAllJqlResults(jiraRequest, jql, fields)

      for (var ii = 0; ii < issues.length; ii++) {
        var issue = issues[ii]
        var f = issue.fields || {}
        riceMap.set(issue.key, {
          reach: f[riceFieldIds.riceReach] || null,
          impact: f[riceFieldIds.riceImpact] || null,
          confidence: f[riceFieldIds.riceConfidence] || null,
          effort: f[riceFieldIds.riceEffort] || null
        })
      }
    } catch (err) {
      console.warn('[health] RICE field fetch batch ' + (bi + 1) + '/' + batches.length + ' failed:', err.message)
    }
  }

  return riceMap
}

/**
 * Run the full Jira enrichment pipeline.
 *
 * @param {Function} jiraRequest - The shared jiraRequest function
 * @param {Function} fetchAllJqlResults - The shared fetchAllJqlResults function
 * @param {Array<object>} features - Feature objects (must have .key, .status, .targetVersions)
 * @param {object} config - Release-planning config with healthConfig and customFieldIds
 * @returns {Promise<{ enrichments: Map<string, object>, riceData: Map<string, object>, warnings: Array<string>, stats: object }>}
 */
async function enrichFeatures(jiraRequest, fetchAllJqlResults, features, config) {
  var warnings = []
  var healthConfig = config.healthConfig || {}
  var customFieldIds = config.customFieldIds || {}
  var enableJira = healthConfig.enableJiraEnrichment !== false
  var enableRice = !!healthConfig.enableRice
  var batchSize = healthConfig.enrichmentBatchSize || 40
  var throttleMs = healthConfig.enrichmentThrottleMs || 1000
  var opts = { batchSize: batchSize, throttleMs: throttleMs }

  var emptyMap = new Map()

  // Check Jira credentials
  if (!hasJiraCredentials()) {
    warnings.push('Jira credentials not configured -- enrichment skipped')
    return { enrichments: emptyMap, riceData: emptyMap, warnings: warnings, stats: { pass1: 0, pass2: 0, rice: 0 } }
  }

  if (!enableJira) {
    warnings.push('Jira enrichment disabled in config')
    return { enrichments: emptyMap, riceData: emptyMap, warnings: warnings, stats: { pass1: 0, pass2: 0, rice: 0 } }
  }

  var featureKeys = features.map(function(f) { return f.key }).filter(Boolean)

  // Pass 1: Lightweight enrichment for all features
  var enrichmentMap = await runPass1(jiraRequest, fetchAllJqlResults, featureKeys, opts)

  // Pass 2: Changelog for at-risk features
  var changelogTargets = identifyChangelogTargets(featureKeys, enrichmentMap, features)
  await runPass2(jiraRequest, fetchAllJqlResults, changelogTargets, enrichmentMap, opts)

  // RICE: Fetch from parent keys if enabled
  var riceData = new Map()
  if (enableRice) {
    var hasRiceFields = customFieldIds.riceReach && customFieldIds.riceImpact &&
      customFieldIds.riceConfidence && customFieldIds.riceEffort

    if (hasRiceFields) {
      // Collect unique parentKeys
      var parentKeySet = new Set()
      for (var pi = 0; pi < features.length; pi++) {
        if (features[pi].parentKey) parentKeySet.add(features[pi].parentKey)
      }
      var uniqueParentKeys = Array.from(parentKeySet)

      if (uniqueParentKeys.length > 0) {
        riceData = await fetchRiceFields(jiraRequest, fetchAllJqlResults, uniqueParentKeys, customFieldIds, opts)

        // Map RICE data back to child features via parentKey
        for (var ri = 0; ri < features.length; ri++) {
          var feat = features[ri]
          if (feat.parentKey && riceData.has(feat.parentKey)) {
            var enrichment = enrichmentMap.get(feat.key) || {}
            enrichment.rice = riceData.get(feat.parentKey)
            enrichmentMap.set(feat.key, enrichment)
          }
        }
      }
    } else {
      warnings.push('RICE scoring enabled but field IDs not configured')
    }
  }

  var stats = {
    pass1: featureKeys.length,
    pass2: changelogTargets.length,
    rice: riceData.size
  }

  return { enrichments: enrichmentMap, riceData: riceData, warnings: warnings, stats: stats }
}

module.exports = {
  enrichFeatures: enrichFeatures,
  hasJiraCredentials: hasJiraCredentials,
  // Exported for testing
  parseIssueLinks: parseIssueLinks,
  hasDescriptionContent: hasDescriptionContent,
  parseChangelog: parseChangelog,
  identifyChangelogTargets: identifyChangelogTargets,
  runPass1: runPass1,
  runPass2: runPass2,
  fetchRiceFields: fetchRiceFields
}
