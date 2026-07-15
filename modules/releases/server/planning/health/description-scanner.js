var { adfToText } = require('./tshirt-parser')

var AC_PATTERN = /\b(given\s.*?\b(when|then)\b|acceptance\s+criter|success\s+criter|AC\s*:)/i
var USE_CASE_PATTERN = /\b(use\s+case|user\s+stor|as\s+a\s+.*?\bso\s+that\b)/i
var SCOPE_PATTERN = /\b(in\s+scope|out\s+of\s+scope|\bscope\b\s*[:=-])/i
var REQUIREMENTS_PATTERN = /\b(requirement|HLR|NFR|non[\s-]?functional)/i
var RISKS_PATTERN = /\b(risks?\s*(and|&)\s*assumptions?|dependencies?|blockers?|constraints?|risks?\s*[:=-]|assumptions?\s*[:=-])/i
var ARCHITECTURE_PATTERN = /\b(architect|arch[\s-]?review|technical\s+(design|approach)|system\s+design)\b/i

function parseDescriptionSignals(description) {
  if (!description) return { hasContent: false, hasAcceptanceCriteria: false, hasUseCases: false, hasScopeDefinition: false, hasRequirements: false, hasRisks: false, hasArchitectureSignal: false, signalCount: 0 }

  var text
  if (typeof description === 'string') {
    text = description
  } else if (description.type === 'doc') {
    text = adfToText(description)
  } else {
    return { hasContent: false, hasAcceptanceCriteria: false, hasUseCases: false, hasScopeDefinition: false, hasRequirements: false, hasRisks: false, hasArchitectureSignal: false, signalCount: 0 }
  }

  var hasContent = text.trim().length > 0
  if (!hasContent) return { hasContent: false, hasAcceptanceCriteria: false, hasUseCases: false, hasScopeDefinition: false, hasRequirements: false, hasRisks: false, hasArchitectureSignal: false, signalCount: 0 }

  var hasAcceptanceCriteria = AC_PATTERN.test(text)
  var hasUseCases = USE_CASE_PATTERN.test(text)
  var hasScopeDefinition = SCOPE_PATTERN.test(text)
  var hasRequirements = REQUIREMENTS_PATTERN.test(text)
  var hasRisks = RISKS_PATTERN.test(text)
  var hasArchitectureSignal = ARCHITECTURE_PATTERN.test(text)

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
    signalCount: signalCount
  }
}

module.exports = { parseDescriptionSignals: parseDescriptionSignals }
