var { adfToText } = require('./tshirt-parser')

var AC_PATTERN = /\b(given\s.*?\b(when|then)\b|acceptance\s+criter|success\s+criter|AC\s*:)/i
var USE_CASE_PATTERN = /\b(use\s+case|user\s+stor|as\s+a\s+.*?\bso\s+that\b)/i
var SCOPE_PATTERN = /\b(in\s+scope|out\s+of\s+scope|\bscope\b\s*[:=-])/i
var REQUIREMENTS_PATTERN = /\b(requirement|HLR|NFR|non[\s-]?functional)/i
var RISKS_PATTERN = /\b(risks?\s*(and|&)\s*assumptions?|dependencies?|blockers?|constraints?|risks?\s*[:=-]|assumptions?\s*[:=-])/i
// Review-artifact signals only — bare narrative "architecture" does not count.
var ARCHITECTURE_EXPLICIT = /\b(arch(?:itecture)?[\s-]?review|technical\s+(design|approach)|system\s+design|design\s+doc|\bADR\b|\bRFC\b)\b/i
var ARCHITECTURE_HEADING = /(^|\n)\s*(#{1,6}\s*|\*\*)?architecture(\*\*)?\b/i
var ARCHITECTURE_CONTEXT = /\barchitecture\b[\s\S]{0,80}\b(review|decision|approved|sign[\s-]?off|ADR|RFC|reference)\b/i
var CROSS_FUNCTIONAL_DEP_PATTERN = /\b(depends?\s+on|cross[\s-]?team|cross[\s-]?functional|multi[\s-]?team|multi[\s-]?component)\b/i

function emptySignals() {
  return {
    hasContent: false,
    hasAcceptanceCriteria: false,
    hasUseCases: false,
    hasScopeDefinition: false,
    hasRequirements: false,
    hasRisks: false,
    hasArchitectureSignal: false,
    hasCrossFunctionalDependency: false,
    signalCount: 0
  }
}

function hasArchitectureReviewSignal(text) {
  return ARCHITECTURE_EXPLICIT.test(text)
    || ARCHITECTURE_HEADING.test(text)
    || ARCHITECTURE_CONTEXT.test(text)
}

function parseDescriptionSignals(description) {
  if (!description) return emptySignals()

  var text
  if (typeof description === 'string') {
    text = description
  } else if (description.type === 'doc') {
    text = adfToText(description)
  } else {
    return emptySignals()
  }

  var hasContent = text.trim().length > 0
  if (!hasContent) return emptySignals()

  var hasAcceptanceCriteria = AC_PATTERN.test(text)
  var hasUseCases = USE_CASE_PATTERN.test(text)
  var hasScopeDefinition = SCOPE_PATTERN.test(text)
  var hasRequirements = REQUIREMENTS_PATTERN.test(text)
  var hasRisks = RISKS_PATTERN.test(text)
  var hasArchitectureSignal = hasArchitectureReviewSignal(text)
  var hasCrossFunctionalDependency = CROSS_FUNCTIONAL_DEP_PATTERN.test(text)

  var signalCount = 0
  if (hasAcceptanceCriteria) signalCount++
  if (hasUseCases) signalCount++
  if (hasScopeDefinition) signalCount++
  if (hasRequirements) signalCount++
  if (hasRisks) signalCount++

  return {
    hasContent: true,
    hasAcceptanceCriteria: hasAcceptanceCriteria,
    hasUseCases: hasUseCases,
    hasScopeDefinition: hasScopeDefinition,
    hasRequirements: hasRequirements,
    hasRisks: hasRisks,
    hasArchitectureSignal: hasArchitectureSignal,
    hasCrossFunctionalDependency: hasCrossFunctionalDependency,
    signalCount: signalCount
  }
}

module.exports = { parseDescriptionSignals: parseDescriptionSignals }
