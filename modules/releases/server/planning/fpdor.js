/**
 * Feature Planning Definition of Ready (FPDoR)
 * Source of truth: Confluence Planning Phase DoR checklist
 * https://redhat.atlassian.net/wiki/spaces/RHAI/pages/442958832
 */

var FPDOR_TOTAL_COUNT = 17
var FPDOR_CONFLUENCE_URL = 'https://redhat.atlassian.net/wiki/spaces/RHAI/pages/442958832/Planning+Phase+-+Definition+of+Ready+Definition+of+Done'

var MANDATORY_ITEMS = [
  'Target Version',
  'Release Type',
  'Components',
  'PM',
  'Delivery Owner',
  'Priority',
  'RICE',
  'Docs impact'
]

var CRITERIA_ITEMS = [
  'Source RFE / AI SDLC',
  'Requirements clarity',
  'Acceptance criteria',
  'Risks & assumptions',
  'Architectural alignment',
  'UXD',
  'Cross-team deps',
  'Feature human sign-off',
  'Child epics'
]

var NON_ENG_COMPONENTS = {
  Documentation: true,
  Docs: true,
  UXD: true
}

function getLabels(feature) {
  return Array.isArray(feature.labels) ? feature.labels : []
}

function hasLabel(feature, exact) {
  var labels = getLabels(feature)
  for (var i = 0; i < labels.length; i++) {
    if (labels[i] === exact) return true
  }
  return false
}

function hasLabelPrefix(feature, prefix) {
  var labels = getLabels(feature)
  for (var i = 0; i < labels.length; i++) {
    var label = labels[i]
    if (typeof label === 'string' && label.indexOf(prefix) === 0) return true
  }
  return false
}

/**
 * Trust rp-qg1-pass only when bot-verified.
 *
 * A bare label can be hand-applied in Jira; Org Pulse must not treat that as
 * evidence for FPDoR shortcuts. Set feature.qg1PassVerified=true only when a
 * Quality Gate bot comment with QG1-FP backs the label (enrichment / future
 * gate-artifact ingest). Until then, field and strat-creator checks decide.
 */
function hasRpQg1Pass(feature) {
  if (!hasLabel(feature, 'rp-qg1-pass')) return false
  return feature.qg1PassVerified === true
}

function hasStratCreatorRubricPass(feature) {
  return hasLabel(feature, 'strat-creator-rubric-pass')
}

function hasStratCreatorHumanSignOffExact(feature) {
  return hasLabel(feature, 'strat-creator-human-sign-off')
}

function hasStratCreatorHumanLabel(feature) {
  return hasLabelPrefix(feature, 'strat-creator-human')
}

function isAiFirstFeature(feature) {
  return hasLabelPrefix(feature, 'strat-creator-')
}

function hasStratCreatorSignOff(feature) {
  return hasStratCreatorHumanLabel(feature)
}

function hasEpicCreatorDecomposed(feature) {
  return hasLabel(feature, 'epic-creator-auto-decomposed')
}

function hasStratCreatorAutoCreated(feature) {
  return hasLabel(feature, 'strat-creator-auto-created')
}

function normalizeComponentName(name) {
  if (!name || typeof name !== 'string') return ''
  return name.trim()
}

function isNonEngComponent(name) {
  return !!NON_ENG_COMPONENTS[normalizeComponentName(name)]
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

function hasDocumentationComponent(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    var name = normalizeComponentName(comps[i])
    if (name === 'Documentation' || name === 'Docs') return true
  }
  return false
}

function hasUxdComponent(feature) {
  var comps = feature.components || []
  if (!Array.isArray(comps)) return false
  for (var i = 0; i < comps.length; i++) {
    if (normalizeComponentName(comps[i]) === 'UXD') return true
  }
  return false
}

function getReleaseType(feature) {
  return feature.releaseType || feature.phase || null
}

function hasRiceScore(feature) {
  return feature.riceScore != null && feature.riceScore > 0
}

function hasRfeLink(feature) {
  return !!(feature.sourceRfe || feature.rfe || feature.linkedRfeKey)
}

function hasReleaseType(feature) {
  return !!getReleaseType(feature)
}

function hasTargetVersion(feature) {
  var tvs = feature.targetVersions || []
  return Array.isArray(tvs) && tvs.length > 0
}

function hasAssignee(feature) {
  return !!(feature.deliveryOwner || feature.assignee)
}

function hasPmAssigned(feature) {
  return !!(feature.pmOwner || feature.pm)
}

function hasPriority(feature) {
  var p = feature.priority
  if (p == null || p === '') return false
  if (typeof p === 'string') return p.trim().length > 0 && p !== 'Undefined'
  if (typeof p === 'object' && p.name) return !!String(p.name).trim()
  return true
}

function hasChildEpics(feature) {
  return feature.epicCount != null && feature.epicCount > 0
}

function hasCrossFunctionalDependencySignal(feature) {
  var signals = feature.descriptionSignals
  return !!(signals && signals.hasContent && signals.hasCrossFunctionalDependency)
}

function matchedSectionDetail(signals, kinds) {
  if (!signals || !Array.isArray(signals.matchedSections)) return null
  for (var i = 0; i < signals.matchedSections.length; i++) {
    var m = signals.matchedSections[i]
    if (kinds.indexOf(m.kind) !== -1) {
      return m.title || m.kind
    }
  }
  return null
}

/**
 * @param {string} name
 * @param {boolean|null} passed
 * @param {string|null} detail
 * @param {string} group - 'mandatory' | 'criteria'
 */
function evalItem(name, passed, detail, group) {
  if (passed === null) {
    return {
      name: name,
      pass: null,
      source: 'jira',
      state: 'not-checked',
      group: group || 'criteria',
      detail: detail || null
    }
  }
  return {
    name: name,
    pass: !!passed,
    source: 'jira',
    state: passed ? 'passed' : 'failed',
    group: group || 'criteria',
    detail: detail || null
  }
}

function passViaLabel(name, label, group) {
  return evalItem(name, true, 'Passed via ' + label, group)
}

function passViaField(name, detail, group) {
  return evalItem(name, true, detail || 'Passed via Jira field', group)
}

function passViaDescription(name, sectionTitle, group) {
  var msg = sectionTitle
    ? 'Passed via description (' + sectionTitle + ')'
    : 'Passed via description'
  return evalItem(name, true, msg, group)
}

// --- Mandatory field evaluators ---

function evalTargetVersion(feature) {
  if (hasTargetVersion(feature)) return passViaField('Target Version', 'Passed via Target Version field', 'mandatory')
  if (hasRpQg1Pass(feature)) return passViaLabel('Target Version', 'rp-qg1-pass', 'mandatory')
  return evalItem('Target Version', false, 'No target version set', 'mandatory')
}

function evalReleaseType(feature) {
  if (hasReleaseType(feature)) return passViaField('Release Type', 'Passed via Release Type field', 'mandatory')
  if (hasRpQg1Pass(feature)) return passViaLabel('Release Type', 'rp-qg1-pass', 'mandatory')
  return evalItem('Release Type', false, 'No release type set', 'mandatory')
}

function evalComponents(feature) {
  if (countEngineeringComponents(feature) >= 1) {
    return passViaField('Components', 'Passed via engineering component(s)', 'mandatory')
  }
  if (hasRpQg1Pass(feature)) return passViaLabel('Components', 'rp-qg1-pass', 'mandatory')
  return evalItem('Components', false, 'Need ≥1 engineering component (excluding Documentation/UXD)', 'mandatory')
}

function evalPm(feature) {
  if (hasPmAssigned(feature)) return passViaField('PM', 'Passed via PM field', 'mandatory')
  return evalItem('PM', false, 'No PM assigned', 'mandatory')
}

function evalDeliveryOwner(feature) {
  if (hasAssignee(feature)) return passViaField('Delivery Owner', 'Passed via Assignee field', 'mandatory')
  return evalItem('Delivery Owner', false, 'No delivery owner (assignee) set', 'mandatory')
}

function evalPriority(feature) {
  if (hasPriority(feature)) return passViaField('Priority', 'Passed via Priority field', 'mandatory')
  if (hasRpQg1Pass(feature)) return passViaLabel('Priority', 'rp-qg1-pass', 'mandatory')
  return evalItem('Priority', false, 'No priority set', 'mandatory')
}

function evalRice(feature) {
  if (hasRiceScore(feature)) return passViaField('RICE', 'Passed via RICE score', 'mandatory')
  if (hasRpQg1Pass(feature)) return passViaLabel('RICE', 'rp-qg1-pass', 'mandatory')
  if (feature.riceScore == null) return evalItem('RICE', false, 'No RICE score in Jira', 'mandatory')
  return evalItem('RICE', false, 'RICE score is 0', 'mandatory')
}

function evalDocsImpact(feature) {
  if (hasRpQg1Pass(feature)) return passViaLabel('Docs impact', 'rp-qg1-pass', 'mandatory')

  var docsRequired = feature.docsRequired
  var hasDocComp = hasDocumentationComponent(feature)

  if (docsRequired == null || docsRequired === '') {
    // Assessed via Documentation component alone still counts as Yes path incomplete without Yes/No —
    // Confluence requires Docs Required Yes/No; if Yes then Documentation component.
    if (hasDocComp) {
      return evalItem('Docs impact', false, 'Documentation component set but Docs Required (Yes/No) not assessed', 'mandatory')
    }
    return evalItem('Docs impact', false, 'Docs Required (Yes/No) not set', 'mandatory')
  }

  var normalized = String(docsRequired).trim()
  if (/^no$/i.test(normalized)) {
    return passViaField('Docs impact', 'Passed via Docs Required = No', 'mandatory')
  }
  if (/^yes$/i.test(normalized)) {
    if (hasDocComp) return passViaField('Docs impact', 'Passed via Docs Required = Yes + Documentation component', 'mandatory')
    return evalItem('Docs impact', false, 'Docs Required = Yes but Documentation component missing', 'mandatory')
  }

  // Other assessed values: require Documentation component when not explicitly No
  if (hasDocComp) return passViaField('Docs impact', 'Passed via Documentation component', 'mandatory')
  return evalItem('Docs impact', false, 'Docs Required assessed but Documentation component missing', 'mandatory')
}

// --- Criteria evaluators ---

function evalSourceRfe(feature) {
  if (hasStratCreatorAutoCreated(feature)) {
    return passViaLabel('Source RFE / AI SDLC', 'strat-creator-auto-created', 'criteria')
  }
  if (hasRfeLink(feature)) {
    return passViaField('Source RFE / AI SDLC', 'Passed via RFE link', 'criteria')
  }
  return evalItem('Source RFE / AI SDLC', false, 'No RFE link and no strat-creator-auto-created label', 'criteria')
}

function evalRequirementsClarity(feature) {
  if (hasStratCreatorRubricPass(feature)) {
    return passViaLabel('Requirements clarity', 'strat-creator-rubric-pass', 'criteria')
  }
  if (hasStratCreatorHumanSignOffExact(feature) || hasStratCreatorHumanLabel(feature)) {
    return passViaLabel('Requirements clarity', 'strat-creator-human-sign-off', 'criteria')
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent) {
    var ok = !!(signals.hasRequirements || signals.hasUseCases || signals.hasScopeDefinition)
    if (ok) {
      var title = matchedSectionDetail(signals, ['requirements', 'useCases', 'scope'])
      return passViaDescription('Requirements clarity', title, 'criteria')
    }
    return evalItem('Requirements clarity', false, 'Description lacks problem/scope/requirements/use-case sections', 'criteria')
  }
  return evalItem('Requirements clarity', false, 'No requirements clarity data available', 'criteria')
}

function evalAcceptanceCriteria(feature) {
  if (hasStratCreatorRubricPass(feature)) {
    return passViaLabel('Acceptance criteria', 'strat-creator-rubric-pass', 'criteria')
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent && signals.hasAcceptanceCriteria) {
    var title = matchedSectionDetail(signals, ['acceptanceCriteria'])
    return passViaDescription('Acceptance criteria', title, 'criteria')
  }
  return evalItem('Acceptance criteria', false, 'No acceptance/success criteria found in description', 'criteria')
}

function evalRisksAndAssumptions(feature) {
  if (hasStratCreatorRubricPass(feature)) {
    return passViaLabel('Risks & assumptions', 'strat-creator-rubric-pass', 'criteria')
  }
  if (hasStratCreatorHumanSignOffExact(feature) || hasStratCreatorHumanLabel(feature)) {
    return passViaLabel('Risks & assumptions', 'strat-creator-human-sign-off', 'criteria')
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent && signals.hasRisks) {
    var title = matchedSectionDetail(signals, ['risks'])
    return passViaDescription('Risks & assumptions', title, 'criteria')
  }
  return evalItem('Risks & assumptions', false, 'No risks or assumptions documented in description', 'criteria')
}

function evalArchitecturalAlignment(feature) {
  if (hasStratCreatorRubricPass(feature)) {
    return passViaLabel('Architectural alignment', 'strat-creator-rubric-pass', 'criteria')
  }
  if (hasStratCreatorHumanSignOffExact(feature) || hasStratCreatorHumanLabel(feature)) {
    return passViaLabel('Architectural alignment', 'strat-creator-human-sign-off', 'criteria')
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasContent) {
    if (signals.hasArchitectureNotRequired) {
      return evalItem('Architectural alignment', true, 'Passed via description (architecture not required)', 'criteria')
    }
    if (signals.hasArchitectureSignal) {
      var title = matchedSectionDetail(signals, ['architecture'])
      return passViaDescription('Architectural alignment', title, 'criteria')
    }
    // When required is unknown — not-checked rather than hard fail
    return evalItem('Architectural alignment', null, 'Not checked — no architecture notes or “not required” in description', 'criteria')
  }
  return evalItem('Architectural alignment', null, 'Not checked — no description architecture signals', 'criteria')
}

function evalUxd(feature) {
  if (hasUxdComponent(feature)) {
    return passViaField('UXD', 'Passed via UXD component', 'criteria')
  }
  var signals = feature.descriptionSignals
  if (signals && signals.hasNaNoUx) {
    return evalItem('UXD', true, 'Passed via description (N/A – no UX)', 'criteria')
  }
  return evalItem('UXD', null, 'Not checked — no UXD component and no “N/A – no UX” note', 'criteria')
}

function evalCrossTeamDeps(feature) {
  if (hasEpicCreatorDecomposed(feature)) {
    return passViaLabel('Cross-team deps', 'epic-creator-auto-decomposed', 'criteria')
  }
  var engCount = countEngineeringComponents(feature)
  if (engCount >= 2) {
    return passViaField('Cross-team deps', 'Passed via multiple engineering components', 'criteria')
  }
  if (hasCrossFunctionalDependencySignal(feature)) {
    return passViaDescription('Cross-team deps', 'cross-team dependency language', 'criteria')
  }
  return evalItem(
    'Cross-team deps',
    false,
    'Need ≥2 engineering components, dependency language, or epic-creator-auto-decomposed (found ' + engCount + ' eng component' + (engCount === 1 ? '' : 's') + ')',
    'criteria'
  )
}

function evalFeatureHumanSignOff(feature) {
  if (!isAiFirstFeature(feature)) {
    return evalItem('Feature human sign-off', null, 'N/A — not an AI First (strat-creator-*) feature', 'criteria')
  }
  if (hasStratCreatorHumanLabel(feature)) {
    return passViaLabel('Feature human sign-off', 'strat-creator-human*', 'criteria')
  }
  if (hasRpQg1Pass(feature)) {
    return passViaLabel('Feature human sign-off', 'rp-qg1-pass', 'criteria')
  }
  return evalItem(
    'Feature human sign-off',
    false,
    'Missing strat-creator-human* (or bot-verified rp-qg1-pass) label',
    'criteria'
  )
}

function evalChildEpics(feature) {
  if (hasEpicCreatorDecomposed(feature)) {
    return passViaLabel('Child epics', 'epic-creator-auto-decomposed', 'criteria')
  }
  if (hasChildEpics(feature)) {
    return passViaField('Child epics', 'Passed via linked child epics', 'criteria')
  }
  return evalItem('Child epics', false, 'No linked child epics and no epic-creator-auto-decomposed label', 'criteria')
}

/** @deprecated Prefer Child epics; retained for transitional callers */
function hasScopeDefined(feature) {
  return hasChildEpics(feature) || hasEpicCreatorDecomposed(feature) || hasRfeLink(feature)
}

function hasRequirementsClarity(feature) {
  return evalRequirementsClarity(feature).pass === true
}

function hasAcceptanceCriteria(feature) {
  return evalAcceptanceCriteria(feature).pass === true
}

function hasArchitecturalAlignment(feature) {
  var result = evalArchitecturalAlignment(feature)
  return result.pass === true
}

function hasRisksAndAssumptions(feature) {
  return evalRisksAndAssumptions(feature).pass === true
}

function hasCrossFunctionalEngineering(feature) {
  return evalCrossTeamDeps(feature).pass === true
}

function hasCrossFunctionalEngagement(feature) {
  return hasCrossFunctionalEngineering(feature)
}

function hasDocsEngagement(feature) {
  return evalDocsImpact(feature).pass === true
}

function hasUxdEngagement(feature) {
  var result = evalUxd(feature)
  return result.pass === true
}

/**
 * Extract rubric scores for display/priority only — not used by FPDoR gates.
 */
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

function computeFPDoRReadiness(feature) {
  var items = [
    evalTargetVersion(feature),
    evalReleaseType(feature),
    evalComponents(feature),
    evalPm(feature),
    evalDeliveryOwner(feature),
    evalPriority(feature),
    evalRice(feature),
    evalDocsImpact(feature),
    evalSourceRfe(feature),
    evalRequirementsClarity(feature),
    evalAcceptanceCriteria(feature),
    evalRisksAndAssumptions(feature),
    evalArchitecturalAlignment(feature),
    evalUxd(feature),
    evalCrossTeamDeps(feature),
    evalFeatureHumanSignOff(feature),
    evalChildEpics(feature)
  ]

  var signedOff = hasStratCreatorHumanLabel(feature)
  if (signedOff) {
    var verifiedNames = {
      'Requirements clarity': true,
      'Acceptance criteria': true,
      'Architectural alignment': true,
      'Risks & assumptions': true,
      'Feature human sign-off': true
    }
    for (var hi = 0; hi < items.length; hi++) {
      if (verifiedNames[items[hi].name]) items[hi].humanVerified = true
    }
  }

  var passedCount = 0
  var evaluatedCount = 0
  var applicableCount = 0
  for (var i = 0; i < items.length; i++) {
    if (items[i].pass === true) passedCount++
    if (items[i].pass !== null) {
      evaluatedCount++
      applicableCount++
    }
  }

  var allApplicablePassed = items.every(function(item) { return item.pass !== false })

  return {
    items: items,
    passedCount: passedCount,
    totalCount: FPDOR_TOTAL_COUNT,
    evaluatedCount: evaluatedCount,
    applicableCount: applicableCount,
    allApplicablePassed: allApplicablePassed,
    groups: {
      mandatory: MANDATORY_ITEMS.slice(),
      criteria: CRITERIA_ITEMS.slice()
    },
    confluenceUrl: FPDOR_CONFLUENCE_URL
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
  hasPriority: hasPriority,
  hasRfeLink: hasRfeLink,
  hasStratCreatorSignOff: hasStratCreatorSignOff,
  isAiFirstFeature: isAiFirstFeature,
  hasRpQg1Pass: hasRpQg1Pass,
  FPDOR_TOTAL_COUNT: FPDOR_TOTAL_COUNT,
  FPDOR_CONFLUENCE_URL: FPDOR_CONFLUENCE_URL,
  MANDATORY_ITEMS: MANDATORY_ITEMS,
  CRITERIA_ITEMS: CRITERIA_ITEMS
}
