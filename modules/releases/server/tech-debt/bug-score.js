const {
  priorityBand,
  scoreAge,
  scoreDeadline,
  utcDateOnly
} = require('./vulnerability-score')

const FEEDBACK_LABELS = new Set(['aibu_feedback', 'aissa_feedback', 'bu_earlyaccess_feedback'])
const SECURITY_LABELS = new Set(['security', 'conforma', 'conforma-violation', 'tls-profile-compliance'])
const CI_LABELS = new Set(['ci-detected', 'cypress_found_bug', 'found_in_nightly'])
const RELEASE_TOOLING_LABELS = new Set(['rhoai-sustaining', 'rhoai-jenkins-agent', 'fbc', 'build-failure'])
const DEVTESTOPS_REPORTER = 'devtestops jira bot'
const AUTOMATION_REPORTER = 'rhoaieng automationbot'
const WORKFLOW_REPORTER = 'workflow validation'

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizedLabels(labels) {
  return new Set((Array.isArray(labels) ? labels : []).map(normalize).filter(Boolean))
}

function hasAny(labels, candidates) {
  return Array.from(candidates).some(function (label) { return labels.has(label) })
}

function addSignal(signals, code, label, evidence, evidenceData) {
  if (signals.some(function (signal) { return signal.code === code })) return
  const signal = { code, label, evidence }
  if (evidenceData) signal.evidenceData = evidenceData
  signals.push(signal)
}

function chooseHighest(candidates, emptyState) {
  if (!candidates.length) return { points: 0, state: emptyState, code: null, evidence: null }
  return candidates.reduce(function (highest, candidate) {
    return candidate.points > highest.points ? candidate : highest
  })
}

function jiraSeverity(priority) {
  const value = normalize(priority)
  const scores = {
    blocker: 20,
    highest: 20,
    critical: 16,
    high: 16,
    major: 12,
    medium: 8,
    normal: 8,
    low: 4,
    minor: 4,
    lowest: 2
  }
  const points = scores[value] || 0
  return {
    points,
    state: points ? String(priority) : 'Missing or unrecognized',
    value: value || null
  }
}

function classifyBug(issue) {
  const labels = normalizedLabels(issue.labels)
  const reporter = normalize(issue.reporter && issue.reporter.name)
  const signals = []
  const feedback = hasAny(labels, FEEDBACK_LABELS)
  const approvedBlocker = normalize(issue.releaseBlockerStatus) === 'approved'
  const prereleaseCve = labels.has('prerelease-cve-remediation') && reporter === DEVTESTOPS_REPORTER
  const operatorE2e = labels.has('odh-operator-auto-e2e-blocker') && reporter === AUTOMATION_REPORTER
  const devtestopsFailure = labels.has('test-failed') && reporter === DEVTESTOPS_REPORTER
  const workflowValidation = reporter === WORKFLOW_REPORTER
  const automationReporter = reporter === DEVTESTOPS_REPORTER || reporter === AUTOMATION_REPORTER
  const humanTestFailure = labels.has('test-failed') && !automationReporter
  const humanGate = Array.from(labels).some(function (label) { return label.startsWith('gate:') }) && !automationReporter
  const ciDetected = hasAny(labels, CI_LABELS)
  const releaseTooling = hasAny(labels, RELEASE_TOOLING_LABELS)
  const securityRelated = hasAny(labels, SECURITY_LABELS)
  const snyk = labels.has('snyk') && reporter === AUTOMATION_REPORTER
  const snykSca = snyk && (labels.has('dependency') || labels.has('vuln'))
  const snykSast = snyk && Array.from(labels).some(function (label) {
    return label === 'code-analysis' || label === 'cwe' || label.startsWith('cwe-')
  })
  const reporterEvidence = issue.reporter ? {
    reporter: { id: issue.reporter.id || null, name: issue.reporter.name || null }
  } : null

  if (issue.hasSfdcCases) addSignal(signals, 'customer-linked', 'Affecting customer', 'SFDC Cases Counter is populated')
  if (feedback) addSignal(signals, 'field-feedback', 'BU/SSA/field feedback', 'Feedback label is present')
  if (prereleaseCve) addSignal(signals, 'prerelease-cve', 'Pre-release CVE', 'prerelease-cve-remediation label and DevTestOps reporter', reporterEvidence)
  if (approvedBlocker) addSignal(signals, 'approved-release-blocker', 'Approved Release Blocker', 'Release Blocker is Approved')
  if (snykSca) addSignal(signals, 'snyk-sca', 'Snyk SCA', 'Snyk automation with dependency/vulnerability label', reporterEvidence)
  else if (snykSast) addSignal(signals, 'snyk-sast', 'Snyk SAST', 'Snyk automation with code-analysis/CWE label', reporterEvidence)
  else if (snyk) addSignal(signals, 'snyk', 'Snyk', 'Snyk automation without a recognized subtype label', reporterEvidence)
  if (securityRelated) addSignal(signals, 'security-related', 'Security/compliance related', 'Security, Conforma, or TLS compliance label')
  if (operatorE2e) addSignal(signals, 'operator-e2e', 'Operator auto E2E blocker', 'Operator E2E blocker label and automation reporter', reporterEvidence)
  if (devtestopsFailure) addSignal(signals, 'devtestops-test-failure', 'DevTestOps automated test failure', 'test-failed label and DevTestOps reporter', reporterEvidence)
  if (workflowValidation) addSignal(signals, 'workflow-validation', 'Workflow-validation bug', 'Workflow Validation reporter', reporterEvidence)
  if (ciDetected) addSignal(signals, 'ci-detected', 'CI/nightly detected', 'CI, Cypress, or nightly label')
  if (releaseTooling) addSignal(signals, 'release-tooling', 'Release/CI tooling', 'Release or build tooling label')
  if (humanTestFailure) addSignal(signals, 'human-test-failure', 'Human-filed test bug', 'test-failed label from a non-automation reporter', reporterEvidence)
  if (humanGate) addSignal(signals, 'human-gate', 'Human-filed gate bug', 'gate:* label from a non-automation reporter', reporterEvidence)

  let primaryBugType
  if (issue.hasSfdcCases) primaryBugType = { code: 'customer-linked', label: 'Affecting customer' }
  else if (prereleaseCve) primaryBugType = { code: 'prerelease-cve', label: 'Pre-release CVE' }
  else if (approvedBlocker) primaryBugType = { code: 'approved-release-blocker', label: 'Approved Release Blocker' }
  else if (feedback) primaryBugType = { code: 'field-feedback', label: 'BU/SSA/field feedback' }
  else if (operatorE2e || devtestopsFailure) primaryBugType = { code: 'devtestops-e2e', label: 'DevTestOps/E2E bug' }
  else if (workflowValidation) primaryBugType = { code: 'workflow-validation', label: 'Workflow-validation bug' }
  else primaryBugType = { code: 'component-team', label: 'Component-team/unclassified Bug' }

  if (primaryBugType.code === 'component-team') {
    addSignal(signals, 'component-team', primaryBugType.label, 'No higher-precedence source classification matched')
  }

  return {
    labels,
    reporter,
    signals,
    primaryBugType,
    matches: {
      approvedBlocker,
      ciDetected,
      devtestopsFailure,
      feedback,
      humanGate,
      humanTestFailure,
      operatorE2e,
      prereleaseCve,
      releaseTooling,
      securityRelated,
      snyk,
      snykSca,
      snykSast,
      workflowValidation
    }
  }
}

function scoreBug(issue, now = new Date()) {
  const asOfDate = utcDateOnly(now) || new Date().toISOString().slice(0, 10)
  const classification = classifyBug(issue)
  const matches = classification.matches

  const customerCandidates = []
  if (issue.hasSfdcCases) customerCandidates.push({ points: 30, state: 'Affecting customer', code: 'customer-linked', evidence: 'SFDC Cases Counter is populated' })
  else if (matches.feedback) customerCandidates.push({ points: 15, state: 'BU/SSA/field feedback', code: 'field-feedback', evidence: 'Feedback label without an SFDC case' })
  const customerImpact = chooseHighest(customerCandidates, 'No customer or field signal')

  const deliveryCandidates = []
  if (matches.prereleaseCve) deliveryCandidates.push({ points: 25, state: 'Pre-release CVE', code: 'prerelease-cve', evidence: 'Pre-release CVE rule matched' })
  if (matches.approvedBlocker) deliveryCandidates.push({ points: 22, state: 'Approved Release Blocker', code: 'approved-release-blocker', evidence: 'Release Blocker is Approved' })
  if (matches.snykSca) deliveryCandidates.push({ points: 20, state: 'Snyk SCA', code: 'snyk-sca', evidence: 'Snyk dependency/vulnerability scan' })
  else if (matches.snykSast) deliveryCandidates.push({ points: 16, state: 'Snyk SAST', code: 'snyk-sast', evidence: 'Snyk code-analysis/CWE scan' })
  else if (matches.snyk) deliveryCandidates.push({ points: 14, state: 'Snyk', code: 'snyk', evidence: 'Snyk scan without a recognized subtype' })
  if (matches.securityRelated) deliveryCandidates.push({ points: 12, state: 'Security/compliance related', code: 'security-related', evidence: 'Security, Conforma, or TLS label' })
  const deliverySecurity = chooseHighest(deliveryCandidates, 'No delivery or security signal')

  const detectionCandidates = []
  if (matches.operatorE2e) detectionCandidates.push({ points: 5, state: 'Operator auto E2E blocker', code: 'operator-e2e', evidence: 'Operator E2E blocker automation rule matched' })
  if (matches.devtestopsFailure) detectionCandidates.push({ points: 4, state: 'DevTestOps automated test failure', code: 'devtestops-test-failure', evidence: 'DevTestOps test-failed rule matched' })
  if (matches.workflowValidation) detectionCandidates.push({ points: 3, state: 'Workflow validation', code: 'workflow-validation', evidence: 'Workflow Validation reporter' })
  if (matches.ciDetected || matches.releaseTooling || matches.humanTestFailure || matches.humanGate) {
    detectionCandidates.push({ points: 2, state: 'CI, nightly, gate, or human test', code: 'other-detection', evidence: 'A secondary detection-source rule matched' })
  }
  const detectionSource = chooseHighest(detectionCandidates, 'No detection-source signal')

  const severity = jiraSeverity(issue.jiraPriority)
  const dueDate = scoreDeadline(issue.dueDate, asOfDate, 'due')
  const age = scoreAge(issue.createdAt, asOfDate)
  const rawScore = customerImpact.points + deliverySecurity.points + detectionSource.points + severity.points + dueDate.points + age.points
  let priorityScore = rawScore
  const guardrailReasons = []

  if (matches.approvedBlocker) {
    priorityScore = Math.max(priorityScore, 70)
    guardrailReasons.push('Approved Release Blocker guarantees at least P1')
  }
  if (issue.hasSfdcCases && ['blocker', 'highest', 'critical', 'high'].includes(severity.value)) {
    priorityScore = Math.max(priorityScore, 70)
    guardrailReasons.push('Affecting-customer Blocker/Critical/High priority Bug guarantees at least P1')
  }

  const band = priorityBand(priorityScore)
  return {
    asOfDate,
    rawScore,
    priorityScore,
    priorityBand: {
      level: band.level,
      label: band.label,
      expectedAction: band.expectedAction
    },
    scoreStatus: 'scored',
    scoreModel: 'bug-v1',
    primaryBugType: classification.primaryBugType,
    classificationSignals: classification.signals,
    scoreBreakdown: {
      customerImpact,
      deliverySecurity,
      detectionSource,
      jiraSeverity: severity,
      dueDate,
      age
    },
    guardrail: {
      applied: priorityScore !== rawScore,
      minimumScore: priorityScore !== rawScore ? priorityScore : null,
      reasons: guardrailReasons
    }
  }
}

module.exports = {
  classifyBug,
  jiraSeverity,
  scoreBug
}
