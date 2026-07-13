var RUBRIC_PASS_THRESHOLD = 2

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

function hasScopeDefined(feature, rubricData) {
  if (rubricData && rubricData.scored && rubricData.scope != null) {
    return rubricData.scope >= RUBRIC_PASS_THRESHOLD
  }
  var hasBreakdown = feature.epicCount != null && feature.epicCount > 0
  var hasSizing = (feature.storyPoints != null && feature.storyPoints > 0)
    || !!feature.tshirtSize
    || (feature.effort != null && feature.effort > 0)
  return hasBreakdown || hasSizing
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

function hasCrossFunctionalEngagement(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  var hasDocumentation = false
  for (var i = 0; i < comps.length; i++) {
    if (comps[i] && comps[i] === 'Documentation') hasDocumentation = true
  }
  if (hasDocumentation) return comps.length >= 3
  return comps.length > 1
}

function hasReleaseType(feature) {
  return !!(feature.releaseType || feature.phase)
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

function evalJiraItem(name, passed, detail) {
  return { name: name, pass: passed, source: 'jira', state: passed ? 'passed' : 'failed', detail: passed ? null : (detail || null) }
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
  if (!hasBreakdown && !hasSizing) return 'No child epics and no sizing (story points, t-shirt size, or effort)'
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

function crossFunctionalDetail(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps) || comps.length === 0) return 'No components assigned'
  var hasDocumentation = false
  for (var i = 0; i < comps.length; i++) {
    if (comps[i] && comps[i] === 'Documentation') hasDocumentation = true
  }
  if (hasDocumentation && comps.length < 3) return 'Documentation present but need at least 3 components (have ' + comps.length + ')'
  if (comps.length <= 1) return 'Only 1 component assigned; need more than 1 for cross-functional engagement'
  return null
}

function computeFPDoRReadiness(feature, rubricData) {
  var items = [
    evalJiraItem('Requirements Clarity', hasRequirementsClarity(feature, rubricData), requirementsDetail(feature, rubricData)),
    evalJiraItem('Acceptance Criteria', hasAcceptanceCriteria(feature, rubricData), acceptanceCriteriaDetail(feature, rubricData)),
    evalJiraItem('Scope Defined', hasScopeDefined(feature, rubricData), scopeDetail(feature, rubricData)),
    evalJiraItem('RICE Score', hasRiceScore(feature), riceDetail(feature)),
    evalJiraItem('Cross-functional Engagement', hasCrossFunctionalEngagement(feature), crossFunctionalDetail(feature)),
    evalJiraItem('Architectural Alignment', hasArchitecturalAlignment(feature, rubricData), architectureDetail(feature, rubricData)),
    evalJiraItem('Risks & Assumptions', hasRisksAndAssumptions(feature, rubricData), risksDetail(feature, rubricData)),
    evalJiraItem('Release Type', hasReleaseType(feature), 'No release type set'),
    evalJiraItem('Target Version', hasTargetVersion(feature), 'No target version set'),
    evalJiraItem('Assignee', hasAssignee(feature), 'No assignee set'),
    evalJiraItem('PM Assigned', hasPmAssigned(feature), 'No PM assigned')
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
    totalCount: 11,
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
  hasCrossFunctionalEngagement: hasCrossFunctionalEngagement,
  hasReleaseType: hasReleaseType,
  hasTargetVersion: hasTargetVersion,
  hasAssignee: hasAssignee,
  hasPmAssigned: hasPmAssigned,
  RUBRIC_PASS_THRESHOLD: RUBRIC_PASS_THRESHOLD
}
