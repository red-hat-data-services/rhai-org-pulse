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

// ─── Phase Extraction ───

const RELEASE_TYPE_MAP = {
  'Tech Preview': 'TP',
  'Developer Preview': 'DP',
  'General Availability': 'GA',
  'TP': 'TP',
  'DP': 'DP',
  'GA': 'GA'
}

function getPhase(item, fixVersions) {
  // Prefer explicit releaseType field from Jira (customfield_10851)
  if (item.releaseType) {
    const mapped = RELEASE_TYPE_MAP[item.releaseType]
    if (mapped) return mapped
  }
  // Fall back to deriving from fixVersions
  for (let i = 0; i < fixVersions.length; i++) {
    const v = fixVersions[i].toUpperCase()
    if (v.indexOf('GA') !== -1) return 'GA'
  }
  for (let j = 0; j < fixVersions.length; j++) {
    const v2 = fixVersions[j].toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (v2.indexOf('EA2') !== -1 || v2.indexOf('DP2') !== -1) return 'DP'
    if (v2.indexOf('EA1') !== -1 || v2.indexOf('DP1') !== -1 || v2.indexOf('TP') !== -1) return 'TP'
  }
  return ''
}

// ─── Candidate Mapping ───

/**
 * Map a feature-traffic item to the candidate format expected by the UI.
 * Works for both index entries (strings for pm/architect/assignee) and
 * detail files (objects with displayName).
 */
function mapToCandidate(item, bigRockName, sourcePass) {
  const components = getComponents(item)
  const targetVersions = getTargetVersions(item)
  const fixVersions = getFixVersions(item)
  const labels = getLabels(item)

  return {
    bigRock: bigRockName,
    issueKey: item.key,
    status: item.status || '',
    priority: item.priority || '',
    phase: getPhase(item, fixVersions),
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
  for (let i = 0; i < issueLinks.length; i++) {
    const link = issueLinks[i]
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
  for (let i = 0; i < issueLinks.length; i++) {
    if (outcomeSet.has(issueLinks[i].linkedKey)) return true
  }
  return false
}

// ─── Tier Discovery ───

/**
 * Find Tier 1 features: children of outcome keys with matching target version.
 * Uses parentKey from the index to identify outcome children.
 */
function findTier1Features(readFromStorage, index, outcomeKeys, stats) {
  const outcomeSet = new Set(outcomeKeys)
  const results = []

  if (stats) {
    stats.totalMatches = 0
    stats.closedFiltered = 0
    stats.noTargetVersion = 0
  }

  const features = index.features || []
  for (let i = 0; i < features.length; i++) {
    const f = features[i]
    if (!f.parentKey || !outcomeSet.has(f.parentKey)) continue

    if (stats) stats.totalMatches++

    const versions = getTargetVersions(f)
    if (versions.length === 0) {
      if (stats) stats.noTargetVersion++
      continue
    }

    const status = f.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) {
      if (stats) stats.closedFiltered++
      continue
    }

    // Load detail for components and issueLinks
    const detail = loadFeatureDetail(readFromStorage, f.key)
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
  const outcomeSet = new Set(outcomeKeys)
  const results = []
  const candidateLabel = release + '-candidate'

  const rfes = index.rfes || []
  for (let i = 0; i < rfes.length; i++) {
    const r = rfes[i]
    const status = r.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue
    if (status === 'Approved') continue

    const labels = getLabels(r)
    if (labels.indexOf(candidateLabel) === -1) continue

    // Need detail file to check issueLinks
    const detail = loadRfeDetail(readFromStorage, r.key)
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
  const summaries = {}
  if (!outcomeKeys || outcomeKeys.length === 0) return summaries

  const keySet = new Set(outcomeKeys)
  const features = index.features || []
  for (let i = 0; i < features.length; i++) {
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
  const results = []
  const features = index.features || []

  for (let i = 0; i < features.length; i++) {
    const f = features[i]
    if (excludeKeys.has(f.key)) continue

    const versions = getTargetVersions(f)
    let matchesRelease = false
    for (let j = 0; j < versions.length; j++) {
      if (versions[j].indexOf(release) !== -1) {
        matchesRelease = true
        break
      }
    }
    if (!matchesRelease) continue

    const status = f.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue

    const detail = loadFeatureDetail(readFromStorage, f.key)
    results.push(detail || f)
  }

  return results
}

/**
 * Find Tier 2 RFEs: RFEs with {release}-candidate label,
 * not closed, not Approved, excluding Tier 1 keys.
 */
function findTier2Rfes(readFromStorage, index, release, excludeKeys) {
  const results = []
  const candidateLabel = release + '-candidate'
  const rfes = index.rfes || []

  for (let i = 0; i < rfes.length; i++) {
    const r = rfes[i]
    if (excludeKeys.has(r.key)) continue

    const status = r.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue
    if (status === 'Approved') continue

    const labels = getLabels(r)
    if (labels.indexOf(candidateLabel) === -1) continue

    const detail = loadRfeDetail(readFromStorage, r.key)
    results.push(detail || r)
  }

  return results
}

/**
 * Find Tier 3 features: In Progress, no target version, no fix version.
 */
function findTier3Features(readFromStorage, index, excludeKeys) {
  const results = []
  const features = index.features || []

  for (let i = 0; i < features.length; i++) {
    const f = features[i]
    if (excludeKeys.has(f.key)) continue

    if (f.status !== 'In Progress') continue

    const versions = getTargetVersions(f)
    if (versions.length > 0) continue

    const fixVersions = getFixVersions(f)
    if (fixVersions.length > 0) continue

    const detail = loadFeatureDetail(readFromStorage, f.key)
    results.push(detail || f)
  }

  return results
}

/**
 * Validate issue keys against the feature-traffic cache.
 * Returns { key: { valid, summary?, error? } } for each key.
 */
function validateKeysFromCache(index, keys) {
  const results = {}
  const keyMap = {}

  const features = index.features || []
  for (let i = 0; i < features.length; i++) {
    keyMap[features[i].key] = features[i].summary || ''
  }

  const rfes = index.rfes || []
  for (let j = 0; j < rfes.length; j++) {
    keyMap[rfes[j].key] = rfes[j].summary || ''
  }

  for (let k = 0; k < keys.length; k++) {
    const key = keys[k]
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
