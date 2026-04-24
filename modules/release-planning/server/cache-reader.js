/**
 * Cache reader for feature-traffic pipeline data.
 *
 * Replaces direct Jira API calls by reading pre-fetched data from
 * the feature-traffic CI pipeline stored in data/feature-traffic/.
 */

const { CLOSED_STATUSES, JIRA_BROWSE_URL } = require('./constants')

const FT_PREFIX = 'feature-traffic'

// ─── Data Loading ───

function loadIndex(readFromStorage) {
  return readFromStorage(FT_PREFIX + '/index.json') || { features: [], rfes: [] }
}

function loadFeatureDetail(readFromStorage, key) {
  return readFromStorage(FT_PREFIX + '/features/' + key + '.json')
}

function loadRfeDetail(readFromStorage, key) {
  return readFromStorage(FT_PREFIX + '/rfes/' + key + '.json')
}

// ─── Field Extraction Helpers ───

function getDisplayName(field) {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (field.displayName) return field.displayName
  if (field.name) return field.name
  return String(field)
}

function getTargetVersions(feature) {
  if (!feature.targetVersions) return []
  if (Array.isArray(feature.targetVersions)) return feature.targetVersions
  return []
}

function getFixVersions(feature) {
  if (!feature.fixVersions) return []
  if (Array.isArray(feature.fixVersions)) return feature.fixVersions
  return []
}

function getLabels(item) {
  if (!item.labels) return []
  if (Array.isArray(item.labels)) return item.labels
  return []
}

function getComponents(item) {
  if (!item.components) return []
  if (Array.isArray(item.components)) return item.components
  return []
}

// ─── Candidate Mapping ───

/**
 * Map a feature-traffic item to the candidate format expected by the UI.
 * Works for both index entries (strings for pm/architect/assignee) and
 * detail files (objects with displayName).
 */
function mapToCandidate(item, bigRockName, sourcePass) {
  var components = getComponents(item)
  var targetVersions = getTargetVersions(item)
  var fixVersions = getFixVersions(item)
  var labels = getLabels(item)

  return {
    bigRock: bigRockName,
    issueKey: item.key,
    status: item.status || '',
    priority: item.priority || '',
    phase: '',
    summary: item.summary || '',
    components: components.join(', '),
    labels: labels.join(', '),
    targetRelease: targetVersions.length > 0 ? targetVersions[0] : '',
    fixVersion: fixVersions.join(', '),
    team: components.join(', '),
    pm: getDisplayName(item.pm),
    architect: getDisplayName(item.architect),
    deliveryOwner: getDisplayName(item.assignee),
    rfe: '',
    rfeStatus: '',
    source: item.key.startsWith('RHAIRFE-') ? 'rfe' : 'jira',
    sourcePass: sourcePass,
    jiraUrl: JIRA_BROWSE_URL + '/' + item.key
  }
}

/**
 * Find linked RFE key and status from a detail file's issueLinks.
 * Looks for any link where the linked issue is an RHAIRFE key.
 */
function findRfeFromLinks(issueLinks) {
  if (!Array.isArray(issueLinks)) return { key: '', status: '' }
  for (var i = 0; i < issueLinks.length; i++) {
    var link = issueLinks[i]
    if (link.linkedKey && link.linkedKey.startsWith('RHAIRFE-')) {
      return { key: link.linkedKey, status: link.linkedStatus || '' }
    }
  }
  return { key: '', status: '' }
}

/**
 * Check if an RFE's issueLinks reference any of the given outcome keys.
 */
function rfeLinksToOutcome(issueLinks, outcomeSet) {
  if (!Array.isArray(issueLinks)) return false
  for (var i = 0; i < issueLinks.length; i++) {
    if (outcomeSet.has(issueLinks[i].linkedKey)) return true
  }
  return false
}

// ─── Tier Discovery ───

/**
 * Find Tier 1 features: children of outcome keys with matching target version.
 * Uses parentKey from the index to identify outcome children.
 */
function findTier1Features(readFromStorage, index, outcomeKeys) {
  var outcomeSet = new Set(outcomeKeys)
  var results = []

  var features = index.features || []
  for (var i = 0; i < features.length; i++) {
    var f = features[i]
    if (!f.parentKey || !outcomeSet.has(f.parentKey)) continue

    var versions = getTargetVersions(f)
    if (versions.length === 0) continue

    var status = f.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue

    // Load detail for components and issueLinks
    var detail = loadFeatureDetail(readFromStorage, f.key)
    if (detail) {
      detail._indexEntry = f
    }
    results.push(detail || f)
  }

  return results
}

/**
 * Find Tier 1 RFEs: RFEs linked to outcome keys via issueLinks,
 * with {release}-candidate label, not closed, not Approved.
 *
 * Note: RFEs don't have parentKey in the pipeline data, so we use
 * issueLinks to find connections to outcome keys.
 */
function findTier1Rfes(readFromStorage, index, outcomeKeys, release) {
  var outcomeSet = new Set(outcomeKeys)
  var results = []
  var candidateLabel = release + '-candidate'

  var rfes = index.rfes || []
  for (var i = 0; i < rfes.length; i++) {
    var r = rfes[i]
    var status = r.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue
    if (status === 'Approved') continue

    var labels = getLabels(r)
    if (labels.indexOf(candidateLabel) === -1) continue

    // Need detail file to check issueLinks
    var detail = loadRfeDetail(readFromStorage, r.key)
    if (!detail) continue

    if (!rfeLinksToOutcome(detail.issueLinks, outcomeSet)) continue

    results.push(detail)
  }

  return results
}

/**
 * Look up outcome summaries from the features index.
 * Outcomes are RHAISTRAT issues that may appear in the features list.
 */
function findOutcomeSummaries(index, outcomeKeys) {
  var summaries = {}
  if (!outcomeKeys || outcomeKeys.length === 0) return summaries

  var keySet = new Set(outcomeKeys)
  var features = index.features || []
  for (var i = 0; i < features.length; i++) {
    if (keySet.has(features[i].key)) {
      summaries[features[i].key] = features[i].summary || ''
    }
  }

  return summaries
}

/**
 * Find Tier 2 features: features with target version matching the release,
 * excluding already-discovered Tier 1 keys.
 */
function findTier2Features(readFromStorage, index, release, excludeKeys) {
  var results = []
  var features = index.features || []

  for (var i = 0; i < features.length; i++) {
    var f = features[i]
    if (excludeKeys.has(f.key)) continue

    var versions = getTargetVersions(f)
    var matchesRelease = false
    for (var j = 0; j < versions.length; j++) {
      if (versions[j].indexOf(release) !== -1) {
        matchesRelease = true
        break
      }
    }
    if (!matchesRelease) continue

    var status = f.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue

    var detail = loadFeatureDetail(readFromStorage, f.key)
    results.push(detail || f)
  }

  return results
}

/**
 * Find Tier 2 RFEs: RFEs with {release}-candidate label,
 * not closed, not Approved, excluding Tier 1 keys.
 */
function findTier2Rfes(readFromStorage, index, release, excludeKeys) {
  var results = []
  var candidateLabel = release + '-candidate'
  var rfes = index.rfes || []

  for (var i = 0; i < rfes.length; i++) {
    var r = rfes[i]
    if (excludeKeys.has(r.key)) continue

    var status = r.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue
    if (status === 'Approved') continue

    var labels = getLabels(r)
    if (labels.indexOf(candidateLabel) === -1) continue

    var detail = loadRfeDetail(readFromStorage, r.key)
    results.push(detail || r)
  }

  return results
}

/**
 * Find Tier 3 features: In Progress, no target version, no fix version.
 */
function findTier3Features(readFromStorage, index, excludeKeys) {
  var results = []
  var features = index.features || []

  for (var i = 0; i < features.length; i++) {
    var f = features[i]
    if (excludeKeys.has(f.key)) continue

    if (f.status !== 'In Progress') continue

    var versions = getTargetVersions(f)
    if (versions.length > 0) continue

    var fixVersions = getFixVersions(f)
    if (fixVersions.length > 0) continue

    var detail = loadFeatureDetail(readFromStorage, f.key)
    results.push(detail || f)
  }

  return results
}

/**
 * Validate issue keys against the feature-traffic cache.
 * Returns { key: { valid, summary?, error? } } for each key.
 */
function validateKeysFromCache(index, keys) {
  var results = {}
  var keyMap = {}

  var features = index.features || []
  for (var i = 0; i < features.length; i++) {
    keyMap[features[i].key] = features[i].summary || ''
  }

  var rfes = index.rfes || []
  for (var j = 0; j < rfes.length; j++) {
    keyMap[rfes[j].key] = rfes[j].summary || ''
  }

  for (var k = 0; k < keys.length; k++) {
    var key = keys[k]
    if (keyMap[key] !== undefined) {
      results[key] = { valid: true, summary: keyMap[key] }
    } else {
      results[key] = { valid: false, error: 'Issue not found in feature-traffic cache' }
    }
  }

  return results
}

module.exports = {
  loadIndex: loadIndex,
  loadFeatureDetail: loadFeatureDetail,
  loadRfeDetail: loadRfeDetail,
  mapToCandidate: mapToCandidate,
  findRfeFromLinks: findRfeFromLinks,
  findTier1Features: findTier1Features,
  findTier1Rfes: findTier1Rfes,
  findOutcomeSummaries: findOutcomeSummaries,
  findTier2Features: findTier2Features,
  findTier2Rfes: findTier2Rfes,
  findTier3Features: findTier3Features,
  validateKeysFromCache: validateKeysFromCache
}
