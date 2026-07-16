var RUBRIC_PASS_THRESHOLD = 2
var FPDOR_TOTAL_COUNT = 13

var NON_ENG_COMPONENTS = {
  Documentation: true,
  Docs: true,
  UXD: true
}

var DOCS_REQUIRED_RELEASE_TYPES = {
  GA: true,
  'Tech Preview': true,
  'Technical Preview': true
}

var DOCS_ASSESSED_RELEASE_TYPES = {
  'Dev Preview': true,
  'Developer Preview': true
}

function hasRiceScore(feature) {
  return feature.riceScore != null && feature.riceScore > 0
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

function hasAcceptanceCriteria(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.testability != null) {
    return rubricData.testability >= RUBRIC_PASS_THRESHOLD
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent) {
    return !!signals.hasAcceptanceCriteria
  }
  return false
}

function hasRfeLink(feature) {
  return !!(feature.sourceRfe || feature.rfe || feature.linkedRfeKey)
}

function hasScopeDefined(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.scope != null) {
    return rubricData.scope >= RUBRIC_PASS_THRESHOLD
  }
  var hasBreakdown = feature.epicCount != null && feature.epicCount > 0
  var hasSizing = (feature.storyPoints != null && feature.storyPoints > 0)
    || !!feature.tshirtSize
    || (feature.effort != null && feature.effort > 0)
  return hasBreakdown || hasSizing || hasRfeLink(feature)
}

function hasArchitecturalAlignment(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.architecture != null) {
    return rubricData.architecture >= RUBRIC_PASS_THRESHOLD
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent) {
    return !!signals.hasArchitectureSignal
  }
  return false
}

function hasRisksAndAssumptions(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.feasibility != null) {
    return rubricData.feasibility >= RUBRIC_PASS_THRESHOLD
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent) {
    return !!signals.hasRisks
  }
  return false
}

function normalizeComponentName(name) {
  if (!name || typeof name !== 'string') return ''
  return name.trim()
}

function isNonEngComponent(name) {
  return !!NON_ENG_COMPONENTS[normalizeComponentName(name)]
}

function hasDocumentationComponent(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    var name = normalizeComponentName(comps[i])
    if (name === 'Documentation' || name === 'Docs') return true
  }
  return false
}

function getReleaseType(feature) {
  return feature.releaseType || feature.phase || null
}

function isDocsAssessed(feature) {
  var docsRequired = feature.docsRequired
  if (docsRequired != null && docsRequired !== '') return true
  return hasDocumentationComponent(feature)
}

function hasDocsEngagement(feature) {
  var releaseType = getReleaseType(feature)
  var docsRequired = feature.docsRequired
  var hasDocComp = hasDocumentationComponent(feature)

  // No release type: not checked unless docs were explicitly assessed.
  if (!releaseType) {
    if (!isDocsAssessed(feature)) return null
    if (hasDocComp) return true
    return docsRequired != null && docsRequired !== ''
  }

  if (DOCS_REQUIRED_RELEASE_TYPES[releaseType]) {
    if (hasDocComp) return true
    return !!docsRequired && docsRequired !== 'No'
  }

  if (DOCS_ASSESSED_RELEASE_TYPES[releaseType]) {
    return docsRequired != null && docsRequired !== ''
  }

  if (hasDocComp) return true
  return !!docsRequired && docsRequired !== 'No'
}

function hasUxdEngagement(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    if (normalizeComponentName(comps[i]) === 'UXD') return true
  }
  return false
}

function countEngineeringComponents(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return 0
  var seen = {}
  var count = 0
  for (var i = 0; i < comps.length; i++) {
    var name = normalizeComponentName(comps[i])
    if (!name || isNonEngComponent(name) || seen[name]) continue
    seen[name] = true
    count++
  }
  return count
}

function hasCrossFunctionalDependencySignal(feature) {
  var signals = feature.descriptionSignals
  return !!(signals && signals.hasContent && signals.hasCrossFunctionalDependency)
}

function hasCrossFunctionalEngineering(feature) {
  return countEngineeringComponents(feature) >= 2 || hasCrossFunctionalDependencySignal(feature)
}

/** @deprecated Use hasCrossFunctionalEngineering; retained for callers during transition */
function hasCrossFunctionalEngagement(feature) {
  return hasCrossFunctionalEngineering(feature)
}

function hasReleaseType(feature) {
  return !!getReleaseType(feature)
}

function hasTargetVersion(feature) {
  var tvs = feature.targetVersions || []
  return tvs.length > 0
}

function hasAssignee(feature) {
  return !!(feature.deliveryOwner || feature.assignee)
}

function hasPmAssigned(feature) {
  return !!(feature.pmOwner || feature.pm)
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

function hasStratCreatorSignOff(feature) {
  var labels = feature.labels || []
  for (var i = 0; i < labels.length; i++) {
    if (labels[i] === 'strat-creator-human-sign-off') return true
  }
  return false
}

function evalJiraItem(name, passed, detail) {
  if (passed === null) {
    return {
      name: name,
      pass: null,
      source: 'jira',
      state: 'not-checked',
      detail: detail || null
    }
  }
  return {
    name: name,
    pass: passed,
    source: 'jira',
    state: passed ? 'passed' : 'failed',
    detail: passed ? null : (detail || null)
  }
}

function riceDetail(feature) {
  if (feature.riceScore == null) return 'No RICE score in Jira'
  if (feature.riceScore === 0) return 'RICE score is 0'
  return null
}

function scopeDetail(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.scope != null) {
    return 'Scope score below threshold (' + rubricData.scope + '/' + RUBRIC_PASS_THRESHOLD + ')'
  }
  var hasBreakdown = feature.epicCount != null && feature.epicCount > 0
  var hasSizing = (feature.storyPoints != null && feature.storyPoints > 0)
    || !!feature.tshirtSize
    || (feature.effort != null && feature.effort > 0)
  if (!hasBreakdown && !hasSizing && !hasRfeLink(feature)) return 'No child epics, no sizing (story points, t-shirt size, or effort), and no RFE link'
  return null
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

function acceptanceCriteriaDetail(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.testability != null) {
    return 'Testability score below threshold (' + rubricData.testability + '/' + RUBRIC_PASS_THRESHOLD + ')'
  }
  return 'No acceptance criteria found in description'
}

function architectureDetail(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.architecture != null) {
    return 'Architecture score below threshold (' + rubricData.architecture + '/' + RUBRIC_PASS_THRESHOLD + ')'
  }
  return 'No architecture review signals in description'
}

function risksDetail(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.feasibility != null) {
    return 'Feasibility score below threshold (' + rubricData.feasibility + '/' + RUBRIC_PASS_THRESHOLD + ')'
  }
  return 'No risks or assumptions documented in description'
}

function crossFunctionalEngineeringDetail(feature) {
  var engCount = countEngineeringComponents(feature)
  if (engCount >= 2) return null
  if (hasCrossFunctionalDependencySignal(feature)) return null
  return 'Need ≥2 engineering components (excluding Documentation/UXD) or cross-team dependency language in description (found ' + engCount + ' eng component' + (engCount === 1 ? '' : 's') + ')'
}

function documentationDetail(feature) {
  var releaseType = getReleaseType(feature)
  if (!releaseType) {
    if (!isDocsAssessed(feature)) {
      return 'Not checked — no release type and docsRequired not set'
    }
    return null
  }
  if (DOCS_REQUIRED_RELEASE_TYPES[releaseType]) {
    return 'GA/Tech Preview requires docsRequired (not No) or Documentation component'
  }
  if (DOCS_ASSESSED_RELEASE_TYPES[releaseType]) {
    return 'Dev Preview requires docsRequired to be assessed (Yes or No)'
  }
  return 'Missing Documentation component or docsRequired'
}

function uxdDetail() {
  return 'Missing UXD component'
}

var HUMAN_VERIFIED_ITEMS = {
  'Requirements Clarity': true,
  'Acceptance Criteria': true,
  'Architectural Alignment': true,
  'Risks & Assumptions': true
}

function computeFPDoRReadiness(feature, rubricData) {
  var items = [
    evalJiraItem('Requirements Clarity', hasRequirementsClarity(feature, rubricData), requirementsDetail(feature, rubricData)),
    evalJiraItem('Acceptance Criteria', hasAcceptanceCriteria(feature, rubricData), acceptanceCriteriaDetail(feature, rubricData)),
    evalJiraItem('Scope Defined', hasScopeDefined(feature, rubricData), scopeDetail(feature, rubricData)),
    evalJiraItem('RICE Score', hasRiceScore(feature), riceDetail(feature)),
    evalJiraItem('Cross-functional Engineering', hasCrossFunctionalEngineering(feature), crossFunctionalEngineeringDetail(feature)),
    evalJiraItem('Documentation', hasDocsEngagement(feature), documentationDetail(feature)),
    evalJiraItem('UXD', hasUxdEngagement(feature), uxdDetail()),
    evalJiraItem('Architectural Alignment', hasArchitecturalAlignment(feature, rubricData), architectureDetail(feature, rubricData)),
    evalJiraItem('Risks & Assumptions', hasRisksAndAssumptions(feature, rubricData), risksDetail(feature, rubricData)),
    evalJiraItem('Release Type', hasReleaseType(feature), 'No release type set'),
    evalJiraItem('Target Version', hasTargetVersion(feature), 'No target version set'),
    evalJiraItem('Assignee', hasAssignee(feature), 'No assignee set'),
    evalJiraItem('PM Assigned', hasPmAssigned(feature), 'No PM assigned')
  ]

  var signedOff = hasStratCreatorSignOff(feature)
  if (signedOff) {
    for (var hi = 0; hi < items.length; hi++) {
      if (HUMAN_VERIFIED_ITEMS[items[hi].name]) {
        items[hi].humanVerified = true
      }
    }
  }

  var passedCount = 0
  var evaluatedCount = 0
  for (var i = 0; i < items.length; i++) {
    if (items[i].pass === true) passedCount++
    if (items[i].pass !== null) evaluatedCount++
  }

  return {
    items: items,
    passedCount: passedCount,
    totalCount: FPDOR_TOTAL_COUNT,
    evaluatedCount: evaluatedCount
  }
}

module.exports = {
  computeFPDoRReadiness: computeFPDoRReadiness,
  extractRubricData: extractRubricData,
  hasRiceScore: hasRiceScore,
  hasScopeDefined: hasScopeDefined,
  hasRequirementsClarity: hasRequirementsClarity,
  hasAcceptanceCriteria: hasAcceptanceCriteria,
  hasArchitecturalAlignment: hasArchitecturalAlignment,
  hasRisksAndAssumptions: hasRisksAndAssumptions,
  hasCrossFunctionalEngineering: hasCrossFunctionalEngineering,
  hasCrossFunctionalEngagement: hasCrossFunctionalEngagement,
  hasDocsEngagement: hasDocsEngagement,
  hasUxdEngagement: hasUxdEngagement,
  countEngineeringComponents: countEngineeringComponents,
  hasReleaseType: hasReleaseType,
  hasTargetVersion: hasTargetVersion,
  hasAssignee: hasAssignee,
  hasPmAssigned: hasPmAssigned,
  hasRfeLink: hasRfeLink,
  hasStratCreatorSignOff: hasStratCreatorSignOff,
  RUBRIC_PASS_THRESHOLD: RUBRIC_PASS_THRESHOLD,
  FPDOR_TOTAL_COUNT: FPDOR_TOTAL_COUNT
}
