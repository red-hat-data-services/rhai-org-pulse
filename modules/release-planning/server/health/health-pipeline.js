/**
 * Health pipeline orchestrator.
 *
 * Coordinates the full health assessment flow:
 *   1. Load features from Big Rocks candidates cache
 *   2. Load milestone dates (Product Pages → Smartsheet fallback for freeze dates)
 *   3. Run Jira enrichment (two-pass)
 *   4. Evaluate DoR for each feature
 *   5. Compute risk for each feature
 *   6. Compute RICE scores (if enabled)
 *   7. Build and write health cache
 *
 * Graceful degradation at every step -- if any data source is unavailable,
 * the pipeline continues with reduced accuracy rather than failing entirely.
 */

const { loadIndex, loadFeatureDetail } = require('../cache-reader')
const { getConfig } = require('../config')
const { JIRA_BROWSE_URL, CLOSED_STATUSES, PLANNING_DEADLINE_OFFSET_DAYS, VALID_PHASES } = require('../constants')
const { enrichFeatures } = require('./jira-enrichment')
const { evaluateDor } = require('./dor-checker')
const { computeFeatureRisk } = require('./risk-engine')
const { buildRiceResult } = require('./rice-scorer')
const smartsheetClient = require('../../../../shared/server/smartsheet')

var DATA_PREFIX = 'release-planning'

/**
 * Get a display name from an assignee/pm field that may be a string or object.
 * @param {*} field
 * @returns {string}
 */
function getDisplayName(field) {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (field.displayName) return field.displayName
  if (field.name) return field.name
  return ''
}

/**
 * Split a comma-separated string into a trimmed array.
 * @param {string} str
 * @returns {Array<string>}
 */
function splitCommaString(str) {
  if (!str || typeof str !== 'string') return []
  return str.split(',').map(function(s) { return s.trim() }).filter(Boolean)
}

/**
 * Check whether a candidate feature passes the phase filter.
 * If no phase is specified, all features pass.
 * If a feature has a phase-specific fixVersion (e.g., rhoai-3.5-EA2),
 * it only appears in the matching phase view.
 * Features without phase-specific fixVersions appear in all views.
 *
 * @param {object} candidate - Candidate feature from pipeline
 * @param {string} version - Release version (e.g., '3.5')
 * @param {string|null} phase - Selected phase (EA1/EA2/GA) or null
 * @returns {boolean}
 */
function passesPhaseFilter(candidate, version, phase) {
  if (!phase) return true

  var fixVersionStr = candidate.fixVersion || ''
  var fixVersions = splitCommaString(fixVersionStr)

  var hasPhaseSpecific = false
  var matchesRequestedPhase = false

  for (var i = 0; i < fixVersions.length; i++) {
    var fv = fixVersions[i].toUpperCase()
    for (var j = 0; j < VALID_PHASES.length; j++) {
      if (fv.indexOf('-' + VALID_PHASES[j]) !== -1) {
        hasPhaseSpecific = true
        if (VALID_PHASES[j] === phase.toUpperCase()) {
          matchesRequestedPhase = true
        }
      }
    }
  }

  if (!hasPhaseSpecific) return true
  return matchesRequestedPhase
}

/**
 * Map a candidate feature from the Big Rocks pipeline to the shape
 * expected by the health pipeline.
 *
 * @param {object} candidate
 * @returns {object}
 */
function mapCandidateToHealthFeature(candidate) {
  return {
    key: candidate.issueKey,
    summary: candidate.summary || '',
    status: candidate.status || '',
    priority: candidate.priority || '',
    releaseType: candidate.phase || '',
    components: splitCommaString(candidate.components),
    fixVersions: splitCommaString(candidate.fixVersion),
    targetVersions: candidate.targetRelease ? [candidate.targetRelease] : [],
    assignee: candidate.deliveryOwner || '',
    deliveryOwner: candidate.deliveryOwner || '',
    pm: candidate.pm || '',
    bigRock: candidate.bigRock || '',
    tier: candidate.tier || null,
    rfe: candidate.rfe || '',
    labels: splitCommaString(candidate.labels),
    parentKey: candidate.rfe || ''
  }
}

/**
 * Load features from the Big Rocks candidates pipeline cache.
 *
 * @param {Function} readFromStorage
 * @param {string} version - Release version (e.g., '3.5')
 * @param {string|null} phase - Phase filter (EA1/EA2/GA) or null for all
 * @returns {{ features: Array<object>, warnings: Array<string> }}
 */
function loadFeaturesFromCandidates(readFromStorage, version, phase) {
  var warnings = []
  var cacheKey = DATA_PREFIX + '/candidates-cache-' + version + '.json'
  var cached = readFromStorage(cacheKey)

  if (!cached || !cached.data || !cached.data.features) {
    warnings.push('No candidates found -- run a Big Rocks refresh first')
    return { features: [], warnings: warnings }
  }

  var candidates = cached.data.features
  var features = []

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i]

    if (!passesPhaseFilter(candidate, version, phase)) continue

    var status = candidate.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue

    features.push(mapCandidateToHealthFeature(candidate))
  }

  return { features: features, warnings: warnings }
}

/**
 * Compute the planning deadline for a given phase.
 * The planning deadline is the code freeze date minus PLANNING_DEADLINE_OFFSET_DAYS.
 *
 * @param {object|null} milestones - Milestone dates from Product Pages
 * @param {string|null} phase - Selected phase (EA1/EA2/GA)
 * @returns {{ date: string, daysRemaining: number }|null}
 */
function computePlanningDeadline(milestones, phase) {
  if (!milestones || !phase) return null

  var freezeMap = {
    'EA1': milestones.ea1Freeze,
    'EA2': milestones.ea2Freeze,
    'GA': milestones.gaFreeze
  }

  var freezeDate = freezeMap[phase.toUpperCase()]
  if (!freezeDate) return null

  var freeze = new Date(freezeDate + 'T00:00:00Z')
  var deadline = new Date(freeze.getTime() - PLANNING_DEADLINE_OFFSET_DAYS * 24 * 60 * 60 * 1000)
  var deadlineStr = deadline.toISOString().split('T')[0]

  var today = new Date()
  var todayStr = today.toISOString().split('T')[0]
  var todayDate = new Date(todayStr + 'T00:00:00Z')
  var daysRemaining = Math.ceil((deadline - todayDate) / (1000 * 60 * 60 * 24))

  return { date: deadlineStr, daysRemaining: daysRemaining }
}

/**
 * Get the release phase from a feature's releaseType or fixVersions.
 * Simplified version -- just returns the raw releaseType or infers from data.
 * @param {object} feature
 * @returns {string}
 */
function getFeaturePhase(feature) {
  var RELEASE_TYPE_MAP = {
    'Tech Preview': 'TP',
    'Developer Preview': 'DP',
    'General Availability': 'GA',
    'TP': 'TP',
    'DP': 'DP',
    'GA': 'GA'
  }

  if (feature.releaseType) {
    var mapped = RELEASE_TYPE_MAP[feature.releaseType]
    if (mapped) return mapped
  }

  var fixVersions = feature.fixVersions || []
  for (var i = 0; i < fixVersions.length; i++) {
    var v = fixVersions[i].toUpperCase()
    if (v.indexOf('GA') !== -1) return 'GA'
  }
  for (var j = 0; j < fixVersions.length; j++) {
    var v2 = fixVersions[j].toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (v2.indexOf('EA2') !== -1 || v2.indexOf('DP2') !== -1) return 'DP'
    if (v2.indexOf('EA1') !== -1 || v2.indexOf('DP1') !== -1 || v2.indexOf('TP') !== -1) return 'TP'
  }
  return ''
}

/**
 * Load milestone data from the Product Pages cache (written by release-analysis module).
 * Maps Product Pages release entries to the milestones shape the health pipeline expects.
 *
 * @param {Function} readFromStorage
 * @param {string} version - Release version (e.g., '3.5')
 * @returns {object|null} Milestone dates or null
 */
function loadMilestones(readFromStorage, version) {
  var cached = readFromStorage('release-analysis/product-pages-releases-cache.json')
  if (!cached || !cached.releases || !Array.isArray(cached.releases)) {
    return null
  }

  var ea1Entry = null
  var ea2Entry = null
  var gaEntry = null

  for (var i = 0; i < cached.releases.length; i++) {
    var r = cached.releases[i]
    var rn = r.releaseNumber || ''
    if (rn.indexOf(version + '.EA1') !== -1) {
      ea1Entry = r
    } else if (rn.indexOf(version + '.EA2') !== -1) {
      ea2Entry = r
    } else if (rn.indexOf(version) !== -1 && rn.indexOf('.EA') === -1) {
      gaEntry = r
    }
  }

  if (!ea1Entry && !ea2Entry && !gaEntry) {
    return null
  }

  return {
    ea1Freeze: ea1Entry ? ea1Entry.codeFreezeDate || null : null,
    ea1Target: ea1Entry ? ea1Entry.dueDate || null : null,
    ea2Freeze: ea2Entry ? ea2Entry.codeFreezeDate || null : null,
    ea2Target: ea2Entry ? ea2Entry.dueDate || null : null,
    gaFreeze: gaEntry ? gaEntry.codeFreezeDate || null : null,
    gaTarget: gaEntry ? gaEntry.dueDate || null : null
  }
}

/**
 * Fill missing freeze dates from Smartsheet.
 *
 * If milestones is null (no Product Pages data), attempts to load everything
 * from Smartsheet. If milestones exist but freeze dates are null, merges
 * Smartsheet freeze dates into the existing object.
 *
 * @param {object|null} milestones - Milestones from Product Pages (may have null freeze fields)
 * @param {string} version - Release version (e.g., '3.5')
 * @returns {Promise<{ milestones: object|null, warnings: string[] }>}
 */
async function backfillFreezeDatesFromSmartsheet(milestones, version) {
  var warnings = []

  if (!smartsheetClient.isConfigured()) {
    if (!milestones) {
      warnings.push('Neither Product Pages nor Smartsheet is configured -- milestone risk checks will be skipped')
    } else if (!milestones.ea1Freeze && !milestones.ea2Freeze && !milestones.gaFreeze) {
      warnings.push('Product Pages freeze dates are missing and Smartsheet is not configured')
    }
    return { milestones: milestones, warnings: warnings }
  }

  var needsFullLoad = !milestones
  var needsFreezeFill = milestones &&
    !milestones.ea1Freeze && !milestones.ea2Freeze && !milestones.gaFreeze

  if (!needsFullLoad && !needsFreezeFill) {
    return { milestones: milestones, warnings: warnings }
  }

  try {
    var releases = await smartsheetClient.discoverReleasesWithFreezes()
    var match = null
    for (var i = 0; i < releases.length; i++) {
      if (releases[i].version === version) {
        match = releases[i]
        break
      }
    }

    if (!match) {
      if (needsFullLoad) {
        warnings.push('No milestone data found in Smartsheet for version ' + version)
      }
      return { milestones: milestones, warnings: warnings }
    }

    if (needsFullLoad) {
      warnings.push('Using Smartsheet as milestone source (Product Pages unavailable)')
      return {
        milestones: {
          ea1Freeze: match.ea1Freeze,
          ea1Target: match.ea1Target,
          ea2Freeze: match.ea2Freeze,
          ea2Target: match.ea2Target,
          gaFreeze: match.gaFreeze,
          gaTarget: match.gaTarget
        },
        warnings: warnings
      }
    }

    // Merge freeze dates from Smartsheet into existing Product Pages milestones
    var merged = {
      ea1Freeze: milestones.ea1Freeze || match.ea1Freeze || null,
      ea1Target: milestones.ea1Target,
      ea2Freeze: milestones.ea2Freeze || match.ea2Freeze || null,
      ea2Target: milestones.ea2Target,
      gaFreeze: milestones.gaFreeze || match.gaFreeze || null,
      gaTarget: milestones.gaTarget
    }
    var filled = []
    if (!milestones.ea1Freeze && merged.ea1Freeze) filled.push('ea1Freeze')
    if (!milestones.ea2Freeze && merged.ea2Freeze) filled.push('ea2Freeze')
    if (!milestones.gaFreeze && merged.gaFreeze) filled.push('gaFreeze')
    if (filled.length > 0) {
      warnings.push('Backfilled freeze dates from Smartsheet: ' + filled.join(', '))
    }
    return { milestones: merged, warnings: warnings }
  } catch (err) {
    warnings.push('Smartsheet fallback failed: ' + err.message)
    return { milestones: milestones, warnings: warnings }
  }
}

/**
 * Load features for a release version from the feature-traffic cache.
 * Filters features by target version match and excludes closed statuses.
 * Loads detail files for each feature to get pm, components, releaseType, etc.
 *
 * @param {Function} readFromStorage
 * @param {string} version - Release version (e.g., '3.5')
 * @returns {{ features: Array<object>, warnings: Array<string> }}
 */
function loadFeaturesForRelease(readFromStorage, version) {
  var index = loadIndex(readFromStorage)
  var warnings = []

  if (!index.features || index.features.length === 0) {
    warnings.push('Feature-traffic index is empty -- run a feature-traffic refresh first')
    return { features: [], warnings: warnings }
  }

  var features = []
  var allFeatures = index.features || []

  for (var i = 0; i < allFeatures.length; i++) {
    var f = allFeatures[i]

    // Check if feature targets or is committed to this version
    var targetVersions = f.targetVersions || []
    var fixVersions = f.fixVersions || []
    var matchesVersion = false
    for (var j = 0; j < targetVersions.length; j++) {
      if (targetVersions[j].indexOf(version) !== -1) {
        matchesVersion = true
        break
      }
    }
    if (!matchesVersion) {
      for (var j2 = 0; j2 < fixVersions.length; j2++) {
        if (fixVersions[j2].indexOf(version) !== -1) {
          matchesVersion = true
          break
        }
      }
    }
    if (!matchesVersion) continue

    // Skip closed features
    var status = f.status || ''
    if (CLOSED_STATUSES.indexOf(status) !== -1) continue

    // Load detail file for additional fields
    var detail = loadFeatureDetail(readFromStorage, f.key)

    // Merge index + detail data, preferring detail where available
    var merged = Object.assign({}, f)
    if (detail) {
      // Preserve raw arrays from detail -- do NOT use mapToCandidate
      if (detail.pm !== undefined) merged.pm = detail.pm
      if (detail.components !== undefined) merged.components = detail.components
      if (detail.releaseType !== undefined) merged.releaseType = detail.releaseType
      if (detail.labels !== undefined) merged.labels = detail.labels
      if (detail.issueLinks !== undefined) merged.issueLinks = detail.issueLinks
    }

    features.push(merged)
  }

  return { features: features, warnings: warnings }
}

/**
 * Compute next milestone info for the release summary.
 *
 * @param {object|null} milestones - Milestone dates
 * @param {Date} today
 * @returns {{ currentPhase: string, daysToNextMilestone: number|null, nextMilestone: string|null }}
 */
function computeMilestoneInfo(milestones, today) {
  if (!milestones) {
    return { currentPhase: 'Unknown', daysToNextMilestone: null, nextMilestone: null }
  }

  var todayStr = today.toISOString().split('T')[0]
  var milestoneList = [
    { key: 'ea1Freeze', label: 'EA1 Code Freeze', date: milestones.ea1Freeze },
    { key: 'ea1Target', label: 'EA1 Release', date: milestones.ea1Target },
    { key: 'ea2Freeze', label: 'EA2 Code Freeze', date: milestones.ea2Freeze },
    { key: 'ea2Target', label: 'EA2 Release', date: milestones.ea2Target },
    { key: 'gaFreeze', label: 'GA Code Freeze', date: milestones.gaFreeze },
    { key: 'gaTarget', label: 'GA Release', date: milestones.gaTarget }
  ]

  // Find the next upcoming milestone
  var nextMilestone = null
  var daysToNext = null
  for (var i = 0; i < milestoneList.length; i++) {
    var ms = milestoneList[i]
    if (ms.date && ms.date > todayStr) {
      nextMilestone = ms.label
      var msDate = new Date(ms.date + 'T00:00:00Z')
      var todayDate = new Date(todayStr + 'T00:00:00Z')
      daysToNext = Math.ceil((msDate - todayDate) / (1000 * 60 * 60 * 24))
      break
    }
  }

  // Determine current phase based on what's passed
  var currentPhase = 'Pre-EA1'
  if (milestones.gaTarget && todayStr >= milestones.gaTarget) currentPhase = 'Post-GA'
  else if (milestones.gaFreeze && todayStr >= milestones.gaFreeze) currentPhase = 'GA Freeze'
  else if (milestones.ea2Target && todayStr >= milestones.ea2Target) currentPhase = 'Post-EA2'
  else if (milestones.ea2Freeze && todayStr >= milestones.ea2Freeze) currentPhase = 'EA2 Freeze'
  else if (milestones.ea1Target && todayStr >= milestones.ea1Target) currentPhase = 'Post-EA1'
  else if (milestones.ea1Freeze && todayStr >= milestones.ea1Freeze) currentPhase = 'EA1 Freeze'

  return {
    currentPhase: currentPhase,
    daysToNextMilestone: daysToNext,
    nextMilestone: nextMilestone
  }
}

/**
 * Run the health pipeline for a release version.
 *
 * @param {string} version - Release version (e.g., '3.5')
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {Function} jiraRequest - From shared/server/jira.js
 * @param {Function} fetchAllJqlResults - From shared/server/jira.js
 * @param {string|null} phase - Phase filter (EA1/EA2/GA) or null for all
 * @returns {Promise<object>} Health cache data
 */
async function runHealthPipeline(version, readFromStorage, writeToStorage, jiraRequest, fetchAllJqlResults, phase) {
  var config = getConfig(readFromStorage)
  var healthConfig = config.healthConfig || {}
  var warnings = []
  var today = new Date()
  var phaseKey = phase || 'all'

  console.log('[health] Starting health pipeline for version ' + version + ' phase ' + phaseKey)

  // Step 1: Load features from Big Rocks candidates cache
  var featureResult = loadFeaturesFromCandidates(readFromStorage, version, phase)
  var features = featureResult.features
  warnings = warnings.concat(featureResult.warnings)

  if (features.length === 0) {
    console.warn('[health] No features found for version ' + version + ' phase ' + phaseKey)
    var emptyCache = buildEmptyCache(version, warnings)
    writeToStorage(DATA_PREFIX + '/health-cache-' + version + '-' + phaseKey + '.json', emptyCache)
    return emptyCache
  }

  console.log('[health] Found ' + features.length + ' features for version ' + version + ' phase ' + phaseKey)

  // Step 2: Load milestone dates (Product Pages → Smartsheet fallback for freeze dates)
  var milestones = loadMilestones(readFromStorage, version)
  var fallbackResult = await backfillFreezeDatesFromSmartsheet(milestones, version)
  milestones = fallbackResult.milestones
  warnings = warnings.concat(fallbackResult.warnings)

  // Step 3: Run Jira enrichment
  var enrichResult = { enrichments: new Map(), riceData: new Map(), warnings: [], stats: { pass1: 0, pass2: 0, rice: 0 } }
  try {
    enrichResult = await enrichFeatures(jiraRequest, fetchAllJqlResults, features, config)
    warnings = warnings.concat(enrichResult.warnings)
  } catch (err) {
    console.error('[health] Jira enrichment failed:', err.message)
    warnings.push('Jira enrichment failed: ' + err.message)
  }

  // Step 4: Load manual DoR state and overrides
  var dorState = readFromStorage(DATA_PREFIX + '/dor-state-' + version + '.json') || { features: {} }
  var overrides = readFromStorage(DATA_PREFIX + '/health-overrides-' + version + '.json') || { overrides: {} }

  // Step 5: Build per-feature health assessments
  var planningDeadline = computePlanningDeadline(milestones, phase)
  var milestoneInfo = computeMilestoneInfo(milestones, today)
  var healthFeatures = []
  var riskCounts = { green: 0, yellow: 0, red: 0 }
  var totalDorChecked = 0
  var totalDorItems = 0
  var totalRiceScore = 0
  var riceCount = 0
  var blockedCount = 0
  var unestimatedCount = 0

  for (var i = 0; i < features.length; i++) {
    var feature = features[i]
    var key = feature.key
    var enrichment = enrichResult.enrichments.get(key) || null
    var manualChecks = (dorState.features && dorState.features[key] && dorState.features[key].manualChecks) || null

    // Evaluate DoR
    var dorStatus = evaluateDor(feature, enrichment, manualChecks)
    totalDorChecked += dorStatus.checkedCount
    totalDorItems += dorStatus.totalCount

    // Derive phase for risk engine
    var featurePhase = getFeaturePhase(feature)

    // Build a feature object with phase for risk engine
    var featureForRisk = Object.assign({}, feature, { phase: featurePhase })

    // Compute risk
    var riskResult = computeFeatureRisk(featureForRisk, milestones, dorStatus, enrichment, {
      riskThresholds: healthConfig.riskThresholds,
      phaseCompletionExpectations: healthConfig.phaseCompletionExpectations,
      today: today,
      planningDeadline: planningDeadline,
      version: version
    })

    // Apply manual override if present
    var override = (overrides.overrides && overrides.overrides[key]) || null
    var effectiveRisk = riskResult.risk
    if (override && override.riskOverride) {
      effectiveRisk = override.riskOverride
    }

    riskCounts[effectiveRisk] = (riskCounts[effectiveRisk] || 0) + 1

    // Count specific risk types
    for (var fi = 0; fi < riskResult.flags.length; fi++) {
      if (riskResult.flags[fi].category === 'BLOCKED') blockedCount++
      if (riskResult.flags[fi].category === 'UNESTIMATED') unestimatedCount++
    }

    // RICE score
    var riceResult = null
    if (enrichment && enrichment.rice) {
      riceResult = buildRiceResult(enrichment.rice)
      if (riceResult && riceResult.score !== null) {
        totalRiceScore += riceResult.score
        riceCount++
      }
    }

    // Build health feature entry
    var components = Array.isArray(feature.components)
      ? feature.components.join(', ')
      : ''

    healthFeatures.push({
      key: key,
      summary: feature.summary || '',
      status: feature.status || '',
      priority: feature.priority || '',
      phase: phase,
      bigRock: feature.bigRock || '',
      tier: feature.tier || null,
      pm: getDisplayName(feature.pm),
      deliveryOwner: getDisplayName(feature.assignee),
      components: components,
      completionPct: typeof feature.completionPct === 'number' ? feature.completionPct : 0,
      epicCount: feature.epicCount || 0,
      issueCount: feature.issueCount || 0,
      blockerCount: feature.blockerCount || 0,
      health: feature.health || '',
      risk: {
        level: effectiveRisk,
        score: riskResult.riskScore,
        flags: riskResult.flags,
        override: override
      },
      dor: dorStatus,
      rice: riceResult,
      jiraUrl: JIRA_BROWSE_URL + '/' + key
    })
  }

  // Step 6: Build summary
  var averageRice = riceCount > 0 ? Math.round(totalRiceScore / riceCount) : null
  var dorCompletionRate = totalDorItems > 0 ? Math.round((totalDorChecked / totalDorItems) * 100) : 0

  var cache = {
    cachedAt: today.toISOString(),
    version: version,
    milestones: milestones ? {
      ea1Freeze: milestones.ea1Freeze,
      ea1Target: milestones.ea1Target,
      ea2Freeze: milestones.ea2Freeze,
      ea2Target: milestones.ea2Target,
      gaFreeze: milestones.gaFreeze,
      gaTarget: milestones.gaTarget
    } : null,
    phase: phaseKey,
    summary: {
      totalFeatures: features.length,
      byRisk: riskCounts,
      dorCompletionRate: dorCompletionRate,
      averageRiceScore: averageRice,
      blockedCount: blockedCount,
      unestimatedCount: unestimatedCount,
      currentPhase: milestoneInfo.currentPhase,
      daysToNextMilestone: milestoneInfo.daysToNextMilestone,
      nextMilestone: milestoneInfo.nextMilestone,
      planningDeadline: planningDeadline
    },
    features: healthFeatures,
    enrichmentStatus: {
      jiraQueriesRun: enrichResult.stats.pass1 + enrichResult.stats.pass2,
      featuresEnriched: enrichResult.enrichments.size,
      featuresSkipped: features.length - enrichResult.enrichments.size,
      riceAvailable: riceCount > 0,
      warnings: warnings
    }
  }

  // Step 7: Write health cache
  writeToStorage(DATA_PREFIX + '/health-cache-' + version + '-' + phaseKey + '.json', cache)
  console.log('[health] Health pipeline completed for version ' + version + ' phase ' + phaseKey + ': ' + features.length + ' features assessed')

  return cache
}

/**
 * Build an empty health cache for when no features are found.
 * @param {string} version
 * @param {Array<string>} warnings
 * @returns {object}
 */
function buildEmptyCache(version, warnings) {
  return {
    cachedAt: new Date().toISOString(),
    version: version,
    milestones: null,
    summary: {
      totalFeatures: 0,
      byRisk: { green: 0, yellow: 0, red: 0 },
      dorCompletionRate: 0,
      averageRiceScore: null,
      blockedCount: 0,
      unestimatedCount: 0,
      currentPhase: 'Unknown',
      daysToNextMilestone: null,
      nextMilestone: null
    },
    features: [],
    enrichmentStatus: {
      jiraQueriesRun: 0,
      featuresEnriched: 0,
      featuresSkipped: 0,
      riceAvailable: false,
      warnings: warnings
    }
  }
}

module.exports = {
  runHealthPipeline: runHealthPipeline,
  // Exported for testing
  loadFeaturesForRelease: loadFeaturesForRelease,
  loadFeaturesFromCandidates: loadFeaturesFromCandidates,
  loadMilestones: loadMilestones,
  backfillFreezeDatesFromSmartsheet: backfillFreezeDatesFromSmartsheet,
  computeMilestoneInfo: computeMilestoneInfo,
  computePlanningDeadline: computePlanningDeadline,
  getFeaturePhase: getFeaturePhase,
  buildEmptyCache: buildEmptyCache,
  splitCommaString: splitCommaString,
  passesPhaseFilter: passesPhaseFilter,
  mapCandidateToHealthFeature: mapCandidateToHealthFeature
}
