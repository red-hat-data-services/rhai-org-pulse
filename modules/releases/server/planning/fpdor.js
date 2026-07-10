var RUBRIC_PASS_THRESHOLD = 2

function hasRiceScore(feature) {
  return feature.riceScore != null && feature.riceScore > 0
}

function hasSizing(feature) {
  var hasSize = (feature.storyPoints != null && feature.storyPoints > 0)
    || !!feature.tshirtSize
    || (feature.effort != null && feature.effort > 0)
  var hasBreakdown = feature.epicCount != null && feature.epicCount > 0
  return hasSize && hasBreakdown
}

function hasTargetAndReleaseType(feature) {
  var tvs = feature.targetVersions || []
  var hasTarget = tvs.length > 0
  var hasReleaseType = !!(feature.releaseType || feature.phase)
  return hasTarget && hasReleaseType
}

function hasOwners(feature) {
  var hasDelivery = !!(feature.deliveryOwner || feature.assignee)
  var hasPM = !!(feature.pmOwner || feature.pm)
  return hasDelivery && hasPM
}

function hasComponents(feature) {
  var comps = feature.components || []
  return Array.isArray(comps) ? comps.length > 0 : !!(comps && String(comps).trim())
}

function hasDocsEngagement(feature) {
  if (feature.docsRequired && feature.docsRequired !== 'No') return true
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    if (comps[i] && comps[i] === 'Documentation') return true
  }
  return false
}

function hasUxdEngagement(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    if (comps[i] && comps[i] === 'UXD') return true
  }
  return false
}

function hasCrossFunctional(feature) {
  return hasDocsEngagement(feature) && hasUxdEngagement(feature)
}

function hasRequirementsClarity(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.scope != null) {
    return rubricData.scope >= RUBRIC_PASS_THRESHOLD
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent) {
    return signals.signalCount >= 2
  }
  return false
}

function extractRubricData(feature) {
  if (!feature) return null
  var scores = feature.scores || {}
  var hasAny = scores.testability != null || scores.architecture != null
    || scores.feasibility != null || scores.scope != null
  if (!hasAny) return null
  return {
    scored: true,
    testability: scores.testability != null ? scores.testability : null,
    architecture: scores.architecture != null ? scores.architecture : null,
    feasibility: scores.feasibility != null ? scores.feasibility : null,
    scope: scores.scope != null ? scores.scope : null
  }
}

function evalRubricItem(name, rubricData, dimension, detail) {
  if (!rubricData || !rubricData.scored || rubricData[dimension] == null) {
    return { name: name, pass: null, source: 'strat-pipeline', state: 'not-evaluated', detail: 'No rubric data available' }
  }
  var passed = rubricData[dimension] >= RUBRIC_PASS_THRESHOLD
  return { name: name, pass: passed, source: 'strat-pipeline', state: passed ? 'passed' : 'failed', detail: passed ? null : (detail || 'Score below threshold (' + rubricData[dimension] + '/' + RUBRIC_PASS_THRESHOLD + ')') }
}

function evalJiraItem(name, passed, detail) {
  return { name: name, pass: passed, source: 'jira', state: passed ? 'passed' : 'failed', detail: passed ? null : (detail || null) }
}

function riceDetail(feature) {
  if (feature.riceScore == null) return 'No RICE score in Jira'
  if (feature.riceScore === 0) return 'RICE score is 0'
  return null
}

function sizingDetail(feature) {
  var hasSize = (feature.storyPoints != null && feature.storyPoints > 0)
    || !!feature.tshirtSize
    || (feature.effort != null && feature.effort > 0)
  var hasBreakdown = feature.epicCount != null && feature.epicCount > 0
  if (!hasSize && !hasBreakdown) return 'No sizing and no child work items'
  if (!hasSize) return 'No sizing (set story points, t-shirt size, or effort)'
  if (!hasBreakdown) return 'No child work items (create child epics)'
  return null
}

function targetDetail(feature) {
  var tvs = feature.targetVersions || []
  var hasTarget = tvs.length > 0
  var hasReleaseType = !!(feature.releaseType || feature.phase)
  var parts = []
  if (!hasTarget) parts.push('missing target version')
  if (!hasReleaseType) parts.push('missing release type')
  return parts.join(', ') || null
}

function ownersDetail(feature) {
  var hasDelivery = !!(feature.deliveryOwner || feature.assignee)
  var hasPM = !!(feature.pmOwner || feature.pm)
  var parts = []
  if (!hasDelivery) parts.push('no assignee')
  if (!hasPM) parts.push('no PM assigned')
  return parts.join(', ') || null
}

function crossFunctionalDetail(feature) {
  var hasDocs = hasDocsEngagement(feature)
  var hasUxd = hasUxdEngagement(feature)
  var parts = []
  if (!hasDocs) parts.push('missing Documentation component or docsRequired')
  if (!hasUxd) parts.push('missing UXD component')
  return parts.join('; ') || null
}

function requirementsDetail(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.scope != null) {
    return 'Scope score below threshold (' + rubricData.scope + '/' + RUBRIC_PASS_THRESHOLD + ')'
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent) {
    return 'Description lacks sufficient requirement signals (' + signals.signalCount + '/2 needed)'
  }
  return 'No requirements clarity data available'
}

function computeFPDoRReadiness(feature, rubricData) {
  var items = [
    evalJiraItem('Requirements Clarity', hasRequirementsClarity(feature, rubricData), requirementsDetail(feature, rubricData)),
    evalJiraItem('RICE Score', hasRiceScore(feature), riceDetail(feature)),
    evalJiraItem('Sizing & Breakdown', hasSizing(feature), sizingDetail(feature)),
    evalJiraItem('Target Version + Release Type', hasTargetAndReleaseType(feature), targetDetail(feature)),
    evalJiraItem('Assignee + PM', hasOwners(feature), ownersDetail(feature)),
    evalJiraItem('Components', hasComponents(feature), 'No components set'),
    evalJiraItem('Cross-functional Engagement', hasCrossFunctional(feature), crossFunctionalDetail(feature)),
    evalRubricItem('Acceptance Criteria', rubricData, 'testability'),
    evalRubricItem('Architecture Review', rubricData, 'architecture'),
    evalRubricItem('Risks & Assumptions', rubricData, 'feasibility')
  ]

  var passedCount = 0
  var evaluatedCount = 0
  for (var i = 0; i < items.length; i++) {
    if (items[i].pass === true) passedCount++
    if (items[i].pass !== null) evaluatedCount++
  }

  return {
    items: items,
    passedCount: passedCount,
    totalCount: 10,
    evaluatedCount: evaluatedCount
  }
}

module.exports = {
  computeFPDoRReadiness: computeFPDoRReadiness,
  extractRubricData: extractRubricData,
  evalRubricItem: evalRubricItem,
  hasRiceScore: hasRiceScore,
  hasSizing: hasSizing,
  hasTargetAndReleaseType: hasTargetAndReleaseType,
  hasOwners: hasOwners,
  hasComponents: hasComponents,
  hasCrossFunctional: hasCrossFunctional,
  hasDocsEngagement: hasDocsEngagement,
  hasUxdEngagement: hasUxdEngagement,
  hasRequirementsClarity: hasRequirementsClarity,
  RUBRIC_PASS_THRESHOLD: RUBRIC_PASS_THRESHOLD
}

