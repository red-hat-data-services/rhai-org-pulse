'use strict'

const RELEASE_BLOCKER_VALUES = ['Approved', 'Rejected']
const RELEASE_BLOCKER_OPTION_LABELS = { '16772': 'Approved', '16773': 'Proposed', '16774': 'Rejected' }
const DECISION_VALUES = ['Yes', 'No', 'Unknown']
const EARLY_DETECTION_CATEGORIES = [
  'Missing automated tests',
  'Test coverage gap',
  'CI/CD validation gap',
  'Build validation gap',
  'Environment/configuration issue',
  'Monitoring/observability gap',
  'Release validation gap',
  'Documentation/process gap',
  'Other',
  'Unknown'
]
const PREVENTION_CATEGORIES = [
  'Add or expand automated tests',
  'Improve test coverage',
  'Add CI/CD validation',
  'Add build validation',
  'Fix environment/configuration',
  'Improve monitoring/observability',
  'Expand release validation',
  'Improve documentation/process',
  'Other',
  'Unknown'
]

const QUESTION_PATTERNS = [
  /(?:are\s+there\s+any\s+known\s+workarounds?|known\s+workarounds?)(?:[^?]*)\?/i,
  /(?:what\s+is\s+the\s+)?overall\s+impact(?:\s+of\s+the\s+issue)?(?:[^?]*)\?/i,
  /could\s+(?:(?:this|the)\s+issue|this|it|the\s+defect)\s+have\s+been\s+identified\s+earlier(?:[^?]*)\?/i,
  /is\s+(?:this(?:\s+issue)?|it)\s+a\s+regression(?:[^?]*)\?/i,
  /(?:what\s+reviews?\s+and\s+tests?\s+have\s+been\s+performed|reviews?\s+and\s+tests?\s+to\s+prevent\s+collateral\s+damage)(?:[^?]*)\?/i
]

function extractAdfText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractAdfText).join(' ')
  if (node.type === 'text') return node.text || ''
  if (node.type === 'hardBreak') return '\n'
  if (Array.isArray(node.content)) return node.content.map(extractAdfText).join(' ')
  return ''
}

function isAutomationComment(comment) {
  var author = (comment && comment.author) || {}
  var name = author.displayName || author.name || ''
  return author.accountType === 'app' || /automation\s+for\s+jira|jira\s+bot/i.test(name)
}

function commentText(comment) {
  return extractAdfText(comment && comment.body).replace(/\s+/g, ' ').trim()
}

function answerForQuestion(text, pattern, questionIndex) {
  var match = text.match(pattern)
  if (!match) return null
  var answerStart = match.index + match[0].length
  var answerEnd = text.length
  for (var i = questionIndex + 1; i < QUESTION_PATTERNS.length; i++) {
    var next = text.match(QUESTION_PATTERNS[i])
    if (next && next.index > match.index && next.index < answerEnd) answerEnd = next.index
  }
  var answer = text.slice(answerStart, answerEnd).replace(/^[\s:;\-–—]+/, '').trim()
  return answer || null
}

function extractCommentSignals(comments) {
  var signals = {
    assessmentAnswers: {},
    earlyDetectionResponse: null,
    regressionEvidence: [],
    relevantExcerpts: []
  }
  var list = Array.isArray(comments) ? comments : []

  for (var i = 0; i < list.length; i++) {
    if (isAutomationComment(list[i])) continue
    var text = commentText(list[i])
    if (!text) continue

    var matched = false
    var questionKeys = ['workaround', 'impact', 'earlyDetection', 'regression', 'reviewsAndTests']
    for (var q = 0; q < QUESTION_PATTERNS.length; q++) {
      var answer = answerForQuestion(text, QUESTION_PATTERNS[q], q)
      if (!answer) continue
      matched = true
      signals.assessmentAnswers[questionKeys[q]] = answer
      if (questionKeys[q] === 'earlyDetection') signals.earlyDetectionResponse = answer
      if (questionKeys[q] === 'regression') signals.regressionEvidence.push(answer)
    }

    if (/\b(?:regression|regressed|pre[-\s]?existing|never\s+worked)\b/i.test(text)) {
      matched = true
      signals.regressionEvidence.push(text.slice(0, 500))
    }
    if (matched) signals.relevantExcerpts.push(text.slice(0, 1000))
  }

  signals.regressionEvidence = Array.from(new Set(signals.regressionEvidence)).slice(-5)
  signals.relevantExcerpts = Array.from(new Set(signals.relevantExcerpts)).slice(-10)
  return signals
}

function normalizeDecision(value) {
  var normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'true') return 'Yes'
  if (normalized === 'no' || normalized === 'false') return 'No'
  return 'Unknown'
}

function decisionFromEarlyDetectionResponse(response) {
  var text = String(response || '').replace(/\s+/g, ' ').trim()
  if (!text) return 'Unknown'
  if (/^(?:yes|y|yep|yeah|possibly|potentially)\b/i.test(text)) return 'Yes'
  if (/^(?:no|n|nope|not really|not possible|impossible)\b/i.test(text)) return 'No'
  if (/\b(?:could|would|should)\s+have\b|\b(?:an?|the)\s+(?:automated|unit|integration|e2e|regression)\s+test\b|\b(?:missed|not covered|untested|identified only when|detected only when|caught by|catch(?:es|ing)?|detect(?:s|ed|ing)? earlier|earlier if)\b/i.test(text)) return 'Yes'
  if (/\b(?:could not|would not|was not possible|no way|unavailable|not reproducible)\b/i.test(text)) return 'No'
  return 'Unknown'
}

function earlyDetectionCategory(response, decision) {
  var text = String(response || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!text) return 'Unknown'
  if (/\b(?:environment|configuration|config|cluster|permissions?|networkpolicy|secret|credential|deployment|rbac|access)\b/.test(text)) return 'Environment/configuration issue'
  if (/\b(?:ci\/?cd|continuous integration|pipeline|pre[- ]?merge|merge gate|quality gate)\b/.test(text)) return 'CI/CD validation gap'
  if (/\b(?:build validation|build verification|compile|image build|build image|container build|test build|tested\s+(?:the\s+)?build|build\s*(?:\/|and)\s*(?:image|container))\b/.test(text)) return 'Build validation gap'
  if (/\b(?:monitoring|observability|metric|alert|logging|logs|telemetry|dashboard)\b/.test(text)) return 'Monitoring/observability gap'
  if (/\b(?:release validation|upgrade validation|ga validation|staging validation|release check)\b/.test(text)) return 'Release validation gap'
  if (/\b(?:documentation|docs|runbook|checklist|process|review process|procedure)\b/.test(text)) return 'Documentation/process gap'
  if (/\b(?:coverage gap|test coverage|not covered|untested|insufficient coverage|missing coverage)\b/.test(text)) return 'Test coverage gap'
  if (/\b(?:automated test|unit test|integration test|e2e test|end[- ]to[- ]end test|regression test|missing test|add a test|add tests|test would have)\b/.test(text)) return 'Missing automated tests'
  return decision === 'Yes' ? 'Other' : 'Unknown'
}

function preventionCategoryForDetection(category) {
  var mapping = {
    'Missing automated tests': 'Add or expand automated tests',
    'Test coverage gap': 'Improve test coverage',
    'CI/CD validation gap': 'Add CI/CD validation',
    'Build validation gap': 'Add build validation',
    'Environment/configuration issue': 'Fix environment/configuration',
    'Monitoring/observability gap': 'Improve monitoring/observability',
    'Release validation gap': 'Expand release validation',
    'Documentation/process gap': 'Improve documentation/process',
    Other: 'Other',
    Unknown: 'Unknown'
  }
  return mapping[category] || 'Unknown'
}

function preventionRecommendation(category) {
  var recommendations = {
    'Missing automated tests': 'Add or expand automated tests for the affected path and regression scenario.',
    'Test coverage gap': 'Expand test coverage for the affected scenario, including the relevant upgrade or edge path.',
    'CI/CD validation gap': 'Add a CI/CD validation gate that exercises the affected scenario before release.',
    'Build validation gap': 'Add build or image validation that catches the affected failure before release.',
    'Environment/configuration issue': 'Add environment and configuration validation or a preflight check for the affected setup.',
    'Monitoring/observability gap': 'Add monitoring, logging, or alerting that detects the failure earlier.',
    'Release validation gap': 'Add the affected scenario to release or upgrade validation before GA.',
    'Documentation/process gap': 'Update the documented process, checklist, or runbook to include this prevention step.',
    Other: 'Review the failure path and add the earliest practical validation or prevention control.',
    Unknown: null
  }
  return recommendations[category] || null
}

function classifyCommentAnalysis(comments) {
  var signals = extractCommentSignals(comments)
  var response = signals.earlyDetectionResponse
  var decision = decisionFromEarlyDetectionResponse(response)
  var category = earlyDetectionCategory(response, decision)
  return {
    couldIdentifyEarlier: decision,
    earlyDetectionResponse: response,
    earlyDetectionCategory: category,
    preventionCategory: preventionCategoryForDetection(category),
    prevention: preventionRecommendation(category),
    earlyIdentificationEvidence: response ? 'Human Jira comment response: ' + response : null
  }
}

function normalizeCategory(value, allowed) {
  var text = String(value || '').trim()
  if (!text) return 'Unknown'
  if (allowed.includes(text)) return text
  if (/missing automated tests?/i.test(text)) return 'Missing automated tests'
  if (/test coverage/i.test(text)) return 'Test coverage gap'
  return 'Other'
}

function normalizePreventionCategory(value) {
  var text = String(value || '').trim()
  if (!text) return 'Unknown'
  if (PREVENTION_CATEGORIES.includes(text)) return text
  if (/automated test|\btests?\b/i.test(text)) return 'Add or expand automated tests'
  if (/coverage/i.test(text)) return 'Improve test coverage'
  if (/ci|cd|pipeline/i.test(text)) return 'Add CI/CD validation'
  if (/build/i.test(text)) return 'Add build validation'
  if (/environment|config/i.test(text)) return 'Fix environment/configuration'
  if (/monitor|observab/i.test(text)) return 'Improve monitoring/observability'
  if (/release/i.test(text)) return 'Expand release validation'
  if (/doc|process/i.test(text)) return 'Improve documentation/process'
  return 'Other'
}

function getMostRecentProposedDate(histories) {
  var dates = []
  var list = Array.isArray(histories) ? histories : []
  for (var i = 0; i < list.length; i++) {
    var items = Array.isArray(list[i].items) ? list[i].items : []
    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      var fieldName = item.fieldId || item.field
      var to = item.toString || RELEASE_BLOCKER_OPTION_LABELS[String(item.to)] || item.to
      if ((fieldName === 'customfield_10847' || fieldName === 'Release Blocker') && String(to || '') === 'Proposed') {
        var date = new Date(list[i].created)
        if (!isNaN(date.getTime())) dates.push(date.toISOString())
      }
    }
  }
  return dates.sort().pop() || null
}

function releaseLabels(issue) {
  var versions = Array.isArray(issue && issue.fixVersions) ? issue.fixVersions.filter(Boolean) : []
  return versions.length ? Array.from(new Set(versions)) : ['No Fix Version']
}

function componentLabels(issue) {
  var components = Array.isArray(issue && issue.components) ? issue.components.filter(Boolean) : []
  return components.length ? Array.from(new Set(components)) : ['(No component)']
}

function emptyDecisionCounts() {
  return { yes: 0, no: 0, unknown: 0 }
}

function incrementDecision(counts, value) {
  var key = String(value || 'Unknown').toLowerCase()
  counts[key === 'yes' || key === 'no' ? key : 'unknown']++
}

function addIssueToGroup(group, issue) {
  group.total++
  if (issue.releaseBlocker === 'Approved') group.approved++
  if (issue.releaseBlocker === 'Rejected') group.rejected++
  incrementDecision(group.regression, issue.regression)
  incrementDecision(group.earlierIdentification, issue.couldIdentifyEarlier)
  if (issue.hasPrereleaseCveLabel) group.prereleaseCveRemediation++
  var detection = issue.earlyDetectionCategory || 'Unknown'
  var prevention = issue.preventionCategory || 'Unknown'
  group.earlyDetectionCategories[detection] = (group.earlyDetectionCategories[detection] || 0) + 1
  group.preventionCategories[prevention] = (group.preventionCategories[prevention] || 0) + 1
}

function newGroup(label) {
  return {
    label: label,
    approved: 0,
    rejected: 0,
    total: 0,
    regression: emptyDecisionCounts(),
    earlierIdentification: emptyDecisionCounts(),
    prereleaseCveRemediation: 0,
    earlyDetectionCategories: {},
    preventionCategories: {}
  }
}

function serializeGroups(groups, sortFn) {
  return Array.from(groups.values()).sort(function (a, b) { return sortFn(a.label, b.label) })
}

function compareReleaseNames(left, right) {
  var a = String(left || '').toLowerCase()
  var b = String(right || '').toLowerCase()
  var av = a.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/) || []
  var bv = b.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/) || []
  for (var i = 1; i <= 3; i++) {
    var an = av[i] ? Number(av[i]) : Number.MAX_SAFE_INTEGER
    var bn = bv[i] ? Number(bv[i]) : Number.MAX_SAFE_INTEGER
    if (an !== bn) return an - bn
  }
  return a.localeCompare(b)
}

function countMap(values) {
  return Object.entries(values || {}).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]) }).map(function (entry) {
    return { label: entry[0], count: entry[1] }
  })
}

function buildBlockerAnalysisAggregates(issues) {
  var cleanIssues = Array.isArray(issues) ? issues : []
  var overall = {
    totalAnalyzed: cleanIssues.length,
    regression: emptyDecisionCounts(),
    earlierIdentification: emptyDecisionCounts(),
    prereleaseCveRemediation: 0
  }
  var byRelease = new Map()
  var byComponent = new Map()
  var detectionCategories = {}
  var preventionCategories = {}

  cleanIssues.forEach(function (issue) {
    incrementDecision(overall.regression, issue.regression)
    incrementDecision(overall.earlierIdentification, issue.couldIdentifyEarlier)
    if (issue.hasPrereleaseCveLabel) overall.prereleaseCveRemediation++
    var detection = issue.earlyDetectionCategory || 'Unknown'
    var prevention = issue.preventionCategory || 'Unknown'
    detectionCategories[detection] = (detectionCategories[detection] || 0) + 1
    preventionCategories[prevention] = (preventionCategories[prevention] || 0) + 1

    releaseLabels(issue).forEach(function (label) {
      if (!byRelease.has(label)) byRelease.set(label, newGroup(label))
      addIssueToGroup(byRelease.get(label), issue)
    })
    componentLabels(issue).forEach(function (label) {
      if (!byComponent.has(label)) byComponent.set(label, newGroup(label))
      addIssueToGroup(byComponent.get(label), issue)
    })
  })

  return {
    overall: overall,
    byRelease: serializeGroups(byRelease, compareReleaseNames),
    byComponent: serializeGroups(byComponent, function (a, b) { return String(a).localeCompare(String(b)) }),
    topEarlyDetectionCategories: countMap(detectionCategories),
    topPreventionActions: countMap(preventionCategories)
  }
}

function normalizeIssue(issue) {
  var source = issue && typeof issue === 'object' ? issue : {}
  var labels = Array.isArray(source.labels) ? source.labels.map(String).filter(Boolean) : []
  var releaseBlocker = RELEASE_BLOCKER_VALUES.includes(source.releaseBlocker) ? source.releaseBlocker : null
  var normalized = {
    key: String(source.key || '').trim(),
    link: source.link ? String(source.link) : null,
    summary: String(source.summary || ''),
    components: Array.isArray(source.components) ? source.components.map(String).filter(Boolean) : [],
    fixVersions: Array.isArray(source.fixVersions) ? source.fixVersions.map(String).filter(Boolean) : [],
    releaseBlocker: releaseBlocker,
    labels: labels,
    hasPrereleaseCveLabel: labels.includes('prerelease-cve-remediation'),
    proposedDate: source.proposedDate || null,
    regression: normalizeDecision(source.regression),
    regressionEvidence: source.regressionEvidence ? String(source.regressionEvidence) : null,
    couldIdentifyEarlier: normalizeDecision(source.couldIdentifyEarlier),
    earlyDetectionResponse: source.earlyDetectionResponse ? String(source.earlyDetectionResponse) : null,
    earlyDetectionCategory: normalizeCategory(source.earlyDetectionCategory, EARLY_DETECTION_CATEGORIES),
    preventionCategory: normalizePreventionCategory(source.preventionCategory),
    prevention: source.prevention ? String(source.prevention) : null,
    analysisConfidence: source.analysisConfidence ? String(source.analysisConfidence) : 'Unknown',
    analysisFingerprint: source.analysisFingerprint ? String(source.analysisFingerprint) : null
  }
  return normalized
}

function validateBlockerAnalysisSnapshot(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'payload must be an object'
  if (!Array.isArray(body.issues)) return 'issues must be an array'
  if (body.issues.length > 5000) return 'issues exceeds maximum of 5000 entries'
  var seen = new Set()
  for (var i = 0; i < body.issues.length; i++) {
    var issue = body.issues[i]
    if (!issue || !/^[A-Z][A-Z0-9]+-\d+$/.test(String(issue.key || ''))) return 'issues[' + i + '].key is invalid'
    if (seen.has(issue.key)) return 'duplicate issue key: ' + issue.key
    seen.add(issue.key)
    if (!RELEASE_BLOCKER_VALUES.includes(issue.releaseBlocker)) return 'issues[' + i + '].releaseBlocker must be Approved or Rejected'
  }
  if (body.insights != null && (!Array.isArray(body.insights) || body.insights.length > 5)) return 'insights must be an array with at most 5 entries'
  return null
}

function normalizeBlockerAnalysisSnapshot(body) {
  var error = validateBlockerAnalysisSnapshot(body)
  if (error) return { error: error, snapshot: null }
  var issues = body.issues.map(normalizeIssue)
  var insights = (Array.isArray(body.insights) ? body.insights : []).map(function (insight) {
    return {
      text: String(insight && insight.text || '').trim(),
      evidenceCount: Number.isFinite(Number(insight && insight.evidenceCount)) ? Number(insight.evidenceCount) : 0,
      issueKeys: Array.isArray(insight && insight.issueKeys) ? insight.issueKeys.map(String).filter(Boolean).slice(0, 20) : []
    }
  }).filter(function (insight) { return insight.text }).slice(0, 5)
  return {
    error: null,
    snapshot: {
      fetchedAt: body.fetchedAt || new Date().toISOString(),
      generatedAt: body.generatedAt || body.fetchedAt || new Date().toISOString(),
      model: body.model ? String(body.model) : 'Unknown',
      promptVersion: body.promptVersion ? String(body.promptVersion) : 'Unknown',
      source: body.source && typeof body.source === 'object' ? body.source : {},
      partial: body.partial === true,
      errors: Array.isArray(body.errors) ? body.errors.slice(0, 5000) : [],
      issues: issues,
      aggregates: buildBlockerAnalysisAggregates(issues),
      insights: insights
    }
  }
}

module.exports = {
  DECISION_VALUES,
  EARLY_DETECTION_CATEGORIES,
  PREVENTION_CATEGORIES,
  RELEASE_BLOCKER_VALUES,
  extractAdfText,
  isAutomationComment,
  extractCommentSignals,
  decisionFromEarlyDetectionResponse,
  earlyDetectionCategory,
  classifyCommentAnalysis,
  normalizeDecision,
  normalizeCategory,
  normalizePreventionCategory,
  getMostRecentProposedDate,
  buildBlockerAnalysisAggregates,
  normalizeIssue,
  validateBlockerAnalysisSnapshot,
  normalizeBlockerAnalysisSnapshot,
  releaseLabels,
  componentLabels
}
