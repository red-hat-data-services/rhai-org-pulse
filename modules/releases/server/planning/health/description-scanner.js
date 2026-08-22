var { adfToText } = require('./tshirt-parser')

var MIN_BODY_CHARS = 20

var AC_INLINE = /\b(given\s[\s\S]*?\b(when|then)\b|AC\s*:)/i
var USE_CASE_INLINE = /\b(use\s+case|user\s+stor|as\s+a\s+.*?\bso\s+that\b)/i
var ARCHITECTURE_INLINE = /\b(arch(?:itecture)?[\s-]?review|technical\s+(design|approach)|system\s+design|design\s+doc|\bADR\b|\bRFC\b)\b/i
var CROSS_FUNCTIONAL_DEP_PATTERN = /\b(depends?\s+on|cross[\s-]?team|cross[\s-]?functional|multi[\s-]?team|multi[\s-]?component)\b/i
var NA_NO_UX_PATTERN = /\bN\s*\/\s*A\s*[–—-]\s*no\s+UX\b|\bN\s*\/\s*A\s*[–—-]\s*no\s+UI\b|\bno\s+UX(?:D)?\s+required\b|\bno\s+UI\s+required\b/i
var ARCH_NOT_REQUIRED_PATTERN = /\barchitecture\s+(is\s+)?not\s+required\b|\bnot\s+required\s*[–—-]\s*architecture\b|\bno\s+architecture\s+(review|alignment)\s+required\b/i

var SECTION_ALIASES = {
  acceptanceCriteria: [
    /^acceptance\s+criteria?$/i,
    /^success\s+criteria?$/i,
    /^definition\s+of\s+done$/i,
    /^acceptance$/i,
    /^ac$/i
  ],
  requirements: [
    /^requirements?$/i,
    /^problem\s+statement$/i,
    /^goals?$/i,
    /^high[\s-]?level\s+requirements?$/i,
    /^hlr$/i,
    /^nfr$/i,
    /^non[\s-]?functional(\s+requirements?)?$/i
  ],
  useCases: [
    /^use\s+cases?$/i,
    /^user\s+stor(?:y|ies)$/i
  ],
  scope: [
    /^scope$/i,
    /^in\s+scope$/i,
    /^out\s+of\s+scope$/i,
    /^non[\s-]?goals?$/i
  ],
  risks: [
    /^risks?$/i,
    /^risks?\s*(and|&)\s*assumptions?$/i,
    /^assumptions?$/i,
    /^constraints?$/i,
    /^dependencies$/i,
    /^blockers?$/i
  ],
  architecture: [
    /^architecture$/i,
    /^architecture\s+review$/i,
    /^technical\s+(design|approach)$/i,
    /^system\s+design$/i,
    /^design\s+doc$/i,
    /^adr$/i,
    /^rfc$/i
  ]
}

function emptySignals() {
  return {
    hasContent: false,
    hasAcceptanceCriteria: false,
    hasUseCases: false,
    hasScopeDefinition: false,
    hasRequirements: false,
    hasRisks: false,
    hasArchitectureSignal: false,
    hasArchitectureNotRequired: false,
    hasCrossFunctionalDependency: false,
    hasNaNoUx: false,
    matchedSections: [],
    signalCount: 0
  }
}

function normalizeHeading(title) {
  return String(title || '')
    .replace(/^#+\s*/, '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/:$/, '')
    .trim()
}

function classifyHeading(title) {
  var normalized = normalizeHeading(title)
  if (!normalized) return null
  var keys = Object.keys(SECTION_ALIASES)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var patterns = SECTION_ALIASES[key]
    for (var j = 0; j < patterns.length; j++) {
      if (patterns[j].test(normalized)) return key
    }
  }
  return null
}

function bodyHasSubstance(body) {
  var trimmed = String(body || '').trim()
  if (!trimmed) return false
  if (trimmed.length >= MIN_BODY_CHARS) return true
  // Short but substantive list/bullet content
  return /^[-*•]/.test(trimmed) || trimmed.split(/\n/).filter(Boolean).length >= 2
}

function extractAdfSections(doc) {
  var sections = []
  var nodes = (doc && doc.content) || []
  var current = null

  function flush() {
    if (current) {
      sections.push(current)
      current = null
    }
  }

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i]
    if (node.type === 'heading') {
      flush()
      current = {
        title: adfToText(node),
        level: (node.attrs && node.attrs.level) || 1,
        body: ''
      }
      continue
    }
    if (!current) {
      // Lead-in content before first heading — ignore for section map
      continue
    }
    var piece = adfToText(node)
    if (piece) current.body += (current.body ? '\n' : '') + piece
  }
  flush()
  return sections
}

function extractMarkdownSections(text) {
  var sections = []
  var lines = String(text || '').split(/\n/)
  var current = null

  function flush() {
    if (current) {
      sections.push(current)
      current = null
    }
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    var md = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    var bold = line.match(/^\*\*(.+?)\*\*\s*$/)
    var plainAlias = classifyHeading(line.replace(/:$/, '').trim()) && !line.startsWith('#')
      && line.trim().length < 80 && !/[.!?]$/.test(line.trim())
      ? line.trim()
      : null

    var title = null
    var isStructuralHeading = false
    if (md) {
      title = md[2]
      isStructuralHeading = true
    } else if (bold) {
      title = bold[1]
      isStructuralHeading = !!classifyHeading(title)
    } else if (plainAlias) {
      title = plainAlias
      isStructuralHeading = true
    }

    if (title && (isStructuralHeading || classifyHeading(title))) {
      flush()
      current = { title: title, level: md ? md[1].length : 2, body: '' }
      continue
    }
    if (current) {
      current.body += (current.body ? '\n' : '') + line
    }
  }
  flush()
  return sections
}

function applySectionSignals(signals, sections) {
  for (var i = 0; i < sections.length; i++) {
    var section = sections[i]
    var kind = classifyHeading(section.title)
    if (!kind || !bodyHasSubstance(section.body)) continue

    var matchedTitle = normalizeHeading(section.title)
    signals.matchedSections.push({ kind: kind, title: matchedTitle })

    if (kind === 'acceptanceCriteria') signals.hasAcceptanceCriteria = true
    else if (kind === 'requirements') signals.hasRequirements = true
    else if (kind === 'useCases') signals.hasUseCases = true
    else if (kind === 'scope') signals.hasScopeDefinition = true
    else if (kind === 'risks') signals.hasRisks = true
    else if (kind === 'architecture') signals.hasArchitectureSignal = true
  }
}

function applyInlineFallbacks(signals, text) {
  // Ignore heading lines so empty "## Acceptance Criteria" does not count as AC.
  var bodyText = String(text || '')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^\*\*[^*].*[^*]\*\*\s*$/gm, '')

  if (!signals.hasAcceptanceCriteria && AC_INLINE.test(bodyText)) {
    signals.hasAcceptanceCriteria = true
    signals.matchedSections.push({ kind: 'acceptanceCriteria', title: 'inline AC' })
  }
  if (!signals.hasAcceptanceCriteria && /\b(acceptance\s+criter|success\s+criter)/i.test(bodyText)) {
    signals.hasAcceptanceCriteria = true
    signals.matchedSections.push({ kind: 'acceptanceCriteria', title: 'inline acceptance criteria' })
  }
  if (!signals.hasUseCases && USE_CASE_INLINE.test(bodyText)) {
    signals.hasUseCases = true
    signals.matchedSections.push({ kind: 'useCases', title: 'inline use case' })
  }
  if (!signals.hasArchitectureSignal && ARCHITECTURE_INLINE.test(bodyText)) {
    signals.hasArchitectureSignal = true
    signals.matchedSections.push({ kind: 'architecture', title: 'inline architecture' })
  }
  if (!signals.hasScopeDefinition && /\b(in\s+scope|out\s+of\s+scope|\bscope\b\s*[:=-])/i.test(bodyText)) {
    signals.hasScopeDefinition = true
    signals.matchedSections.push({ kind: 'scope', title: 'inline scope' })
  }
  if (!signals.hasRequirements && /\b(requirement|HLR|NFR|non[\s-]?functional|problem\s+statement)/i.test(bodyText)) {
    signals.hasRequirements = true
    signals.matchedSections.push({ kind: 'requirements', title: 'inline requirements' })
  }
  if (!signals.hasRisks && /\b(risks?\s*(and|&)\s*assumptions?|risks?\s*[:=-]|assumptions?\s*[:=-]|constraints?\s*[:=-]|blockers?\s*[:=-])/i.test(bodyText)) {
    signals.hasRisks = true
    signals.matchedSections.push({ kind: 'risks', title: 'inline risks' })
  }
  if (!signals.hasRisks && /(^|\n)\s*(Risks?(?:\s*(?:and|&)\s*Assumptions?)?|Assumptions?|Constraints?|Dependencies|Blockers?)\s*\n\s*\S/i.test(text)) {
    signals.hasRisks = true
    signals.matchedSections.push({ kind: 'risks', title: 'risks heading' })
  }
}

function parseDescriptionSignals(description) {
  if (!description) return emptySignals()

  var text
  var sections
  if (typeof description === 'string') {
    text = description
    sections = extractMarkdownSections(text)
  } else if (description.type === 'doc') {
    text = adfToText(description)
    sections = extractAdfSections(description)
    if (!sections.length) sections = extractMarkdownSections(text)
  } else {
    return emptySignals()
  }

  var hasContent = text.trim().length > 0
  if (!hasContent) return emptySignals()

  var signals = emptySignals()
  signals.hasContent = true
  applySectionSignals(signals, sections)

  // Strip empty recognized headings so their titles do not trigger inline keyword matches.
  var scrubbedText = text
  for (var si = 0; si < sections.length; si++) {
    var sec = sections[si]
    if (classifyHeading(sec.title) && !bodyHasSubstance(sec.body)) {
      var title = normalizeHeading(sec.title)
      if (title) scrubbedText = scrubbedText.split(title).join(' ')
    }
  }
  applyInlineFallbacks(signals, scrubbedText)

  signals.hasCrossFunctionalDependency = CROSS_FUNCTIONAL_DEP_PATTERN.test(text)
  signals.hasNaNoUx = NA_NO_UX_PATTERN.test(text)
  signals.hasArchitectureNotRequired = ARCH_NOT_REQUIRED_PATTERN.test(text)

  var signalCount = 0
  if (signals.hasAcceptanceCriteria) signalCount++
  if (signals.hasUseCases) signalCount++
  if (signals.hasScopeDefinition) signalCount++
  if (signals.hasRequirements) signalCount++
  if (signals.hasRisks) signalCount++
  signals.signalCount = signalCount

  return signals
}

module.exports = {
  parseDescriptionSignals: parseDescriptionSignals,
  classifyHeading: classifyHeading,
  bodyHasSubstance: bodyHasSubstance
}
