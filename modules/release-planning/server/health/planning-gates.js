var { CLOSED_STATUSES } = require('../constants')

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

function computeDoR(feature, enrichment) {
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

  return {
    gate: 'dor',
    passed: true,
    blockers: [
      { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: true, detail: 'strat-creator-disabled' },
      { id: 'DoR-B2', label: 'RICE Score Present', passed: true, detail: 'rice-disabled' }
    ],
    warnings: [
      { id: 'DoR-W1', label: 'Owner Assigned', passed: hasOwner, detail: ownerDetail },
      { id: 'DoR-W2', label: 'Version Set', passed: hasVersion, detail: versionDetail },
      { id: 'DoR-W3', label: 'Blockers Resolved', passed: hasNoBlockers, detail: blockerDetail }
    ]
  }
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
  PLANNING_STATUS_ORDER: PLANNING_STATUS_ORDER
}
