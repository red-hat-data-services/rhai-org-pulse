var { CLOSED_STATUSES, STRAT_CREATOR_LABELS } = require('../constants')

var PLANNING_STATUS_ORDER = { 'not-ready': 0, 'in-planning': 1, 'ready-for-execution': 2 }

function getUnresolvedBlockers(enrichment) {
  var safeEnrichment = enrichment || {}
  var links = safeEnrichment.dependencyLinks || []
  return links.filter(function(d) {
    return d.direction === 'inward' &&
      d.type === 'Blocks' &&
      CLOSED_STATUSES.indexOf(d.linkedStatus) === -1
  })
}

function parseStratCreatorStatus(labels) {
  if (!labels || !Array.isArray(labels) || labels.length === 0) {
    return 'not-assessed'
  }
  if (labels.indexOf(STRAT_CREATOR_LABELS.HUMAN_SIGN_OFF) !== -1) return 'human-sign-off'
  if (labels.indexOf(STRAT_CREATOR_LABELS.RUBRIC_PASS) !== -1) return 'rubric-pass'
  if (labels.indexOf(STRAT_CREATOR_LABELS.NEEDS_ATTENTION) !== -1) return 'needs-attention'
  return 'not-assessed'
}

function computeDoD(feature, enrichment) {
  var hasOwner = !!(feature.deliveryOwner || feature.assignee)
  var ownerDetail = feature.deliveryOwner || feature.assignee || null

  var fixVersions = feature.fixVersions || []
  var hasFixVersion = fixVersions.length > 0
  var versionDetail = hasFixVersion ? fixVersions.join(', ') : 'No fix version set'

  var unresolvedBlockers = getUnresolvedBlockers(enrichment)
  var hasNoBlockers = unresolvedBlockers.length === 0
  var blockerDetail = hasNoBlockers
    ? null
    : unresolvedBlockers.map(function(b) { return b.linkedKey }).join(', ')

  var checks = [
    { id: 'DoD-1', label: 'Owner Assigned', passed: hasOwner, detail: ownerDetail },
    { id: 'DoD-2', label: 'Fix Version Set', passed: hasFixVersion, detail: versionDetail },
    { id: 'DoD-3', label: 'Blockers Resolved', passed: hasNoBlockers, detail: blockerDetail }
  ]

  return {
    gate: 'dod',
    passed: checks.every(function(c) { return c.passed }),
    checks: checks
  }
}

function computeDoR(feature, enrichment, opts) {
  var options = opts || {}
  var enableStratCreator = !!options.enableStratCreator
  var enableRice = !!options.enableRice
  var safeEnrichment = enrichment || {}

  // ─── DoR-B1: Strategy Human Sign-off ───
  var b1Passed = true
  var b1Detail = 'strat-creator-disabled'
  if (enableStratCreator) {
    var featureLabels = (feature.labels && feature.labels.length > 0) ? feature.labels : (safeEnrichment.labels || [])
    var stratStatus = parseStratCreatorStatus(featureLabels)
    b1Passed = stratStatus === 'human-sign-off'
    b1Detail = stratStatus
  }

  // ─── DoR-B2: RICE Score Present ───
  var b2Passed = true
  var b2Detail = 'rice-disabled'
  if (enableRice) {
    var rice = safeEnrichment.rice
    var hasRice = rice && rice.score != null
    b2Passed = !!hasRice
    b2Detail = hasRice ? 'complete' : 'missing'
  }

  // ─── DoR Warnings ───
  var hasOwner = !!(feature.deliveryOwner || feature.assignee)
  var ownerDetail = feature.deliveryOwner || feature.assignee || null

  var fixVersions = feature.fixVersions || []
  var targetVersions = feature.targetVersions || []
  var hasVersion = fixVersions.length > 0 || targetVersions.length > 0
  var versionDetail = hasVersion
    ? (fixVersions.length > 0 ? fixVersions : targetVersions).join(', ')
    : 'No fixVersion or targetVersion'

  var unresolvedBlockers = getUnresolvedBlockers(enrichment)
  var hasNoBlockers = unresolvedBlockers.length === 0
  var blockerDetail = hasNoBlockers
    ? null
    : unresolvedBlockers.map(function(b) { return b.linkedKey }).join(', ')

  var blockers = [
    { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: b1Passed, detail: b1Detail },
    { id: 'DoR-B2', label: 'RICE Score Present', passed: b2Passed, detail: b2Detail }
  ]

  var allBlockersPass = blockers.every(function(b) { return b.passed })

  return {
    gate: 'dor',
    passed: allBlockersPass,
    blockers: blockers,
    warnings: [
      { id: 'DoR-W1', label: 'Owner Assigned', passed: hasOwner, detail: ownerDetail },
      { id: 'DoR-W2', label: 'Version Set', passed: hasVersion, detail: versionDetail },
      { id: 'DoR-W3', label: 'Blockers Resolved', passed: hasNoBlockers, detail: blockerDetail }
    ]
  }
}

function applyBlockerEscalation(healthFeatures) {
  var dorFailedKeys = new Set()
  for (var i = 0; i < healthFeatures.length; i++) {
    if (healthFeatures[i].dor && !healthFeatures[i].dor.passed) {
      dorFailedKeys.add(healthFeatures[i].key)
    }
  }

  if (dorFailedKeys.size === 0) return 0

  var escalatedCount = 0
  for (var j = 0; j < healthFeatures.length; j++) {
    var hf = healthFeatures[j]
    if (!hf.dor || !hf.dor.warnings) continue

    var w3 = null
    for (var k = 0; k < hf.dor.warnings.length; k++) {
      if (hf.dor.warnings[k].id === 'DoR-W3') {
        w3 = hf.dor.warnings[k]
        break
      }
    }
    if (!w3 || w3.passed) continue

    var blockerKeys = w3.detail ? w3.detail.split(', ') : []
    var hasEscalated = false
    for (var m = 0; m < blockerKeys.length; m++) {
      if (dorFailedKeys.has(blockerKeys[m])) {
        hasEscalated = true
        break
      }
    }
    if (hasEscalated) {
      w3.escalated = true
      escalatedCount++
    }
  }

  return escalatedCount
}

function derivePlanningStatus(dorResult, dodResult) {
  if (!dorResult.passed) return 'not-ready'
  if (!dodResult.passed) return 'in-planning'
  return 'ready-for-execution'
}

module.exports = {
  computeDoD: computeDoD,
  computeDoR: computeDoR,
  derivePlanningStatus: derivePlanningStatus,
  parseStratCreatorStatus: parseStratCreatorStatus,
  applyBlockerEscalation: applyBlockerEscalation,
  PLANNING_STATUS_ORDER: PLANNING_STATUS_ORDER
}
