/**
 * Build PM Hub Component Release Load groups from shared canonical features.
 * Open-only by default (same population as Features List).
 */

const { filterCommittedFixVersions } = require('./committed-definition')
const {
  classifyForRelease,
  isAlignedCategory,
  isReleaseFrozen
} = require('../tv-fv-delta/alignment')

/**
 * Map a canonical feature to a PM Hub load row (FPDoR already computed).
 * @param {object} feature
 * @returns {object}
 */
function canonicalToLoadRow(feature) {
  var fixVersions = Array.isArray(feature.fixVersions) && feature.fixVersions.length > 0
    ? feature.fixVersions.slice()
    : (feature.fixVersion ? [feature.fixVersion] : [])
  var tv = Array.isArray(feature.targetVersions) ? feature.targetVersions.slice() : []
  return {
    key: feature.key,
    summary: feature.title || '',
    title: feature.title || '',
    status: feature.status || null,
    statusCategory: feature.statusCategory || null,
    colorStatus: feature.colorStatus || null,
    statusSummary: feature.statusSummary || null,
    releaseType: feature.releaseType || null,
    priority: feature.priority || null,
    isBlocked: !!feature.isBlocked,
    blockedBy: feature.blockedBy || [],
    components: feature.components || [],
    fixVersions: fixVersions,
    targetVersions: tv,
    alignmentCategory: null,
    pmDoAligned: false,
    assignee: feature.deliveryOwner || feature.assignee || null,
    pmOwner: feature.pmOwner || null,
    docsRequired: feature.docsRequired || null,
    labels: feature.labels || [],
    riceScore: feature.riceScore != null ? feature.riceScore : null,
    linkedRfeKey: feature.sourceRfe || null,
    bigRock: feature.bigRock || null,
    team: feature.team || null,
    size: feature.size || null,
    effectivePriorityScore: feature.effectivePriorityScore != null
      ? feature.effectivePriorityScore
      : null,
    priorityScoreBreakdown: feature.priorityScoreBreakdown || null,
    recommendation: feature.recommendation || null,
    scores: feature.scores || null,
    reviewers: feature.reviewers || null,
    humanReviewStatus: feature.humanReviewStatus || null,
    needsAttention: !!feature.needsAttention,
    fpdor: feature.fpdor || null,
    isAiFirst: !!feature.isAiFirst,
    confidence: feature.confidence || null,
    dataSource: feature.dataSource || 'canonical'
  }
}

/**
 * @param {object} featureObj
 * @param {string} release
 * @param {object} releaseDates
 * @returns {object}
 */
function attachAlignment(featureObj, release, releaseDates) {
  if (!featureObj) return featureObj
  var cat = release
    ? classifyForRelease(
      featureObj.targetVersions,
      featureObj.fixVersions,
      release,
      releaseDates || {}
    )
    : null
  featureObj.alignmentCategory = cat
  featureObj.pmDoAligned = isAlignedCategory(cat)
  return featureObj
}

function featureMatchesComponents(feature, componentNames) {
  if (!componentNames || componentNames.length === 0) return true
  var comps = feature.components || []
  if (comps.length === 0) return false
  for (var i = 0; i < comps.length; i++) {
    if (componentNames.indexOf(comps[i]) !== -1) return true
  }
  return false
}

/**
 * @param {object[]} canonicalFeatures
 * @param {{ components: string[], versions: string[], releaseDates?: object }} filters
 * @returns {{ groups: object[] }}
 */
function buildComponentReleaseLoadGroups(canonicalFeatures, filters) {
  var componentNames = (filters && filters.components) || []
  var versionNames = (filters && filters.versions) || []
  var releaseDates = (filters && filters.releaseDates) || {}

  var versionGroups = {}

  function ensureGroup(vName, cName) {
    if (!versionGroups[vName]) {
      versionGroups[vName] = { version: vName, components: {} }
    }
    if (!versionGroups[vName].components[cName]) {
      versionGroups[vName].components[cName] = {
        component: cName,
        requestedFeatures: [],
        committedFeatures: [],
        requestedCount: 0,
        committedCount: 0,
        blockedCount: 0
      }
    }
    return versionGroups[vName].components[cName]
  }

  for (var fi = 0; fi < canonicalFeatures.length; fi++) {
    var feature = canonicalFeatures[fi]
    if (!featureMatchesComponents(feature, componentNames)) continue

    var tvNames = Array.isArray(feature.targetVersions) ? feature.targetVersions : []
    var fvList = Array.isArray(feature.fixVersions) && feature.fixVersions.length > 0
      ? feature.fixVersions
      : (feature.fixVersion ? [feature.fixVersion] : [])
    var comps = feature.components && feature.components.length > 0
      ? feature.components
      : ['No Component']
    if (componentNames.length > 0) {
      comps = comps.filter(function(c) { return componentNames.indexOf(c) !== -1 })
      if (comps.length === 0) continue
    }

    var baseRow = canonicalToLoadRow(feature)

    if (versionNames.length === 0) {
      var committedFvOnly = filterCommittedFixVersions(fvList, tvNames)
      if (committedFvOnly.length === 0) continue
      for (var ufi = 0; ufi < committedFvOnly.length; ufi++) {
        for (var uci = 0; uci < comps.length; uci++) {
          var uGroup = ensureGroup(committedFvOnly[ufi], comps[uci])
          if (!uGroup.committedFeatures.some(function(e) { return e.key === feature.key })) {
            uGroup.committedFeatures.push(
              attachAlignment(Object.assign({}, baseRow), committedFvOnly[ufi], releaseDates)
            )
            uGroup.committedCount++
            if (baseRow.isBlocked) uGroup.blockedCount++
          }
        }
      }
      continue
    }

    var matchingFv = []
    var matchingTv = []
    for (var fvi = 0; fvi < fvList.length; fvi++) {
      if (versionNames.indexOf(fvList[fvi]) !== -1) matchingFv.push(fvList[fvi])
    }
    for (var tvi = 0; tvi < tvNames.length; tvi++) {
      if (versionNames.indexOf(tvNames[tvi]) !== -1) matchingTv.push(tvNames[tvi])
    }
    if (matchingFv.length === 0 && matchingTv.length === 0) continue

    var committedFv = filterCommittedFixVersions(matchingFv, tvNames)
    var groupVersions = {}
    for (var mf = 0; mf < committedFv.length; mf++) groupVersions[committedFv[mf]] = true
    for (var mt = 0; mt < matchingTv.length; mt++) groupVersions[matchingTv[mt]] = true
    var groupVersionKeys = Object.keys(groupVersions)
    if (groupVersionKeys.length === 0) continue

    var isRequested = matchingTv.length > 0
    for (var gvi = 0; gvi < groupVersionKeys.length; gvi++) {
      var vKey = groupVersionKeys[gvi]
      var featureObj = attachAlignment(Object.assign({}, baseRow), vKey, releaseDates)
      for (var ci = 0; ci < comps.length; ci++) {
        var group = ensureGroup(vKey, comps[ci])
        if (committedFv.indexOf(vKey) !== -1) {
          if (!group.committedFeatures.some(function(e) { return e.key === feature.key })) {
            group.committedFeatures.push(featureObj)
            group.committedCount++
            if (featureObj.isBlocked) group.blockedCount++
          }
        }
        if (isRequested && matchingTv.indexOf(vKey) !== -1) {
          if (!group.requestedFeatures.some(function(e) { return e.key === feature.key })) {
            group.requestedFeatures.push(featureObj)
            group.requestedCount++
          }
        }
      }
    }
  }

  var groups = Object.keys(versionGroups).sort().map(function(vKey) {
    var vg = versionGroups[vKey]
    var compGroups = Object.keys(vg.components).sort().map(function(cKey) {
      return vg.components[cKey]
    })
    var totalRequested = 0
    var totalCommitted = 0
    var totalBlocked = 0
    for (var cgi = 0; cgi < compGroups.length; cgi++) {
      totalRequested += compGroups[cgi].requestedCount
      totalCommitted += compGroups[cgi].committedCount
      totalBlocked += compGroups[cgi].blockedCount
    }
    return {
      version: vg.version,
      planningFrozen: isReleaseFrozen(vg.version, releaseDates),
      components: compGroups,
      requestedCount: totalRequested,
      committedCount: totalCommitted,
      blockedCount: totalBlocked
    }
  })

  return { groups: groups }
}

module.exports = {
  canonicalToLoadRow: canonicalToLoadRow,
  attachAlignment: attachAlignment,
  featureMatchesComponents: featureMatchesComponents,
  buildComponentReleaseLoadGroups: buildComponentReleaseLoadGroups
}
