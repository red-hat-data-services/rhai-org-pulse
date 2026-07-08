var RUBRIC_PASS_THRESHOLD = 2

function hasRiceScore(feature) {
  return feature.riceScore != null && feature.riceScore > 0
}

function hasSizing(feature) {
  var hasPoints = feature.storyPoints != null && feature.storyPoints > 0
  var hasEpics = feature.epicCount != null && feature.epicCount > 0
  return hasPoints || hasEpics
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

function hasCrossFunctional(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    if (comps[i] && comps[i].toLowerCase().indexOf('doc') !== -1) return true
  }
  return false
}

function extractRubricData(feature) {
  if (!feature) return null
  var scores = feature.scores || {}
  var hasAny = scores.testability != null || scores.architecture != null || scores.feasibility != null
  if (!hasAny) return null
  return {
    scored: true,
    testability: scores.testability != null ? scores.testability : null,
    architecture: scores.architecture != null ? scores.architecture : null,
    feasibility: scores.feasibility != null ? scores.feasibility : null
  }
}

function evalRubricItem(name, rubricData, dimension) {
  if (!rubricData || !rubricData.scored || rubricData[dimension] == null) {
    return { name: name, pass: null, source: 'strat-pipeline', state: 'not-evaluated' }
  }
  var passed = rubricData[dimension] >= RUBRIC_PASS_THRESHOLD
  return { name: name, pass: passed, source: 'strat-pipeline', state: passed ? 'passed' : 'failed' }
}

function computeFPDoRReadiness(feature, rubricData) {
  var items = [
    { name: 'RICE Score', pass: hasRiceScore(feature), source: 'jira', state: hasRiceScore(feature) ? 'passed' : 'failed' },
    { name: 'Sizing & Breakdown', pass: hasSizing(feature), source: 'jira', state: hasSizing(feature) ? 'passed' : 'failed' },
    { name: 'Target Version + Release Type', pass: hasTargetAndReleaseType(feature), source: 'jira', state: hasTargetAndReleaseType(feature) ? 'passed' : 'failed' },
    { name: 'Assignee + PM', pass: hasOwners(feature), source: 'jira', state: hasOwners(feature) ? 'passed' : 'failed' },
    { name: 'Components', pass: hasComponents(feature), source: 'jira', state: hasComponents(feature) ? 'passed' : 'failed' },
    { name: 'Cross-functional Engagement', pass: hasCrossFunctional(feature), source: 'jira', state: hasCrossFunctional(feature) ? 'passed' : 'failed' },
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
    totalCount: 9,
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
  RUBRIC_PASS_THRESHOLD: RUBRIC_PASS_THRESHOLD
}
