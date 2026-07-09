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
  var parts = []
  if (feature.storyPoints == null || feature.storyPoints <= 0) parts.push('no story points')
  if (feature.epicCount == null || feature.epicCount <= 0) parts.push('no child epics')
  return parts.length === 2 ? 'No story points or child epics' : null
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

function computeFPDoRReadiness(feature, rubricData) {
  var items = [
    evalJiraItem('RICE Score', hasRiceScore(feature), riceDetail(feature)),
    evalJiraItem('Sizing & Breakdown', hasSizing(feature), sizingDetail(feature)),
    evalJiraItem('Target Version + Release Type', hasTargetAndReleaseType(feature), targetDetail(feature)),
    evalJiraItem('Assignee + PM', hasOwners(feature), ownersDetail(feature)),
    evalJiraItem('Components', hasComponents(feature), 'No components set'),
    evalJiraItem('Cross-functional Engagement', hasCrossFunctional(feature), 'Missing docs/UXD engagement'),
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
