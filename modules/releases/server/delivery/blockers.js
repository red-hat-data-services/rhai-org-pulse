'use strict'

const sharedJira = require('../../../../shared/server/jira')
const blockerAnalysis = require('./blocker-analysis')

const DEMO_MODE = process.env.DEMO_MODE === 'true'

const BLOCKER_FIELD_ID = 'customfield_10847'
const TARGET_VERSION_FIELD_ID = 'customfield_10855'
const TEAM_FIELD_ID = 'customfield_10001'
const DEVELOPMENT_FIELD_ID = 'customfield_10000'
const PRODUCT_MANAGER_FIELD_ID = 'customfield_10469'
const GITHUB_APPLICATION_TYPE = 'oAuth-com.github.integration.production'
const RELEASE_BLOCKER_OPTION_LABELS = {
  '16772': 'Approved',
  '16773': 'Proposed',
  '16774': 'Rejected'
}

const BLOCKER_FIELDS = [
  'summary', 'status', 'priority', 'issuetype', 'components', 'assignee', 'reporter',
  'fixVersions', 'versions', TEAM_FIELD_ID,
  'created', 'updated', 'resolutiondate',
  BLOCKER_FIELD_ID, TARGET_VERSION_FIELD_ID, DEVELOPMENT_FIELD_ID,
  PRODUCT_MANAGER_FIELD_ID, 'labels', 'comment'
].join(',')

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 50
const ANALYSIS_STORAGE_KEY = 'releases/delivery/blocker-analysis.json'
const blockersCache = new Map()

const RELEASE_NUMBER_RE = /^[a-zA-Z0-9._\- ]+$/
const Z_STREAM_VERSION_RE = /(?:^|[^\d])\d+\.\d+\.\d+(?:[^\d]|$)/
const ASSESSMENT_QUESTIONS = [
  {
    key: 'workaround',
    pattern: /(?:are\s+there\s+any\s+known\s+workarounds?|known\s+workarounds?)(?:[^?]*)\?/i
  },
  {
    key: 'impact',
    pattern: /(?:what\s+is\s+the\s+)?overall\s+impact(?:\s+of\s+the\s+issue)?(?:[^?]*)\?/i
  },
  {
    key: 'earlyCatch',
    pattern: /could\s+(?:this\s+issue|it)\s+have\s+been\s+identified\s+earlier(?:[^?]*)\?/i
  },
  {
    key: 'regression',
    pattern: /is\s+(?:this(?:\s+issue)?|it)\s+a\s+regression(?:[^?]*)\?/i
  },
  {
    key: 'reviewsAndTests',
    pattern: /(?:what\s+reviews?\s+and\s+tests?\s+have\s+been\s+performed|reviews?\s+and\s+tests?\s+to\s+prevent\s+collateral\s+damage)(?:[^?]*)\?/i
  }
]

function extractJiraNames(field) {
  if (field === null || field === undefined) return []
  if (Array.isArray(field)) {
    return field.map(function (value) {
      if (value && typeof value === 'object') return value.name || value.value || null
      return value || null
    }).filter(Boolean)
  }
  if (typeof field === 'object') return field.name || field.value ? [field.name || field.value] : []
  return field ? [String(field)] : []
}

function serializeJiraUser(field) {
  if (field === null || field === undefined) return null
  if (typeof field === 'string') return field || null
  if (typeof field !== 'object') return String(field)
  return field.displayName || field.name || field.emailAddress || null
}

function serializeJiraField(field) {
  if (field === null || field === undefined) return null
  if (typeof field === 'object' && !Array.isArray(field)) {
    return field.name || field.value || field.displayName || field.label || null
  }
  return extractJiraNames(field)[0] || null
}

function serializeReleaseBlockerStatus(field) {
  if (field === null || field === undefined) return null
  if (typeof field === 'object') {
    return field.value || field.name || RELEASE_BLOCKER_OPTION_LABELS[String(field.id)] || null
  }
  return RELEASE_BLOCKER_OPTION_LABELS[String(field)] || String(field)
}

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

function assessmentAnswerFlags(commentField) {
  var flags = {
    workaround: false,
    impact: false,
    earlyCatch: false,
    regression: false,
    reviewsAndTests: false
  }
  var comments = commentField && Array.isArray(commentField.comments) ? commentField.comments : []

  for (var i = 0; i < comments.length; i++) {
    if (isAutomationComment(comments[i])) continue
    var text = extractAdfText(comments[i].body).replace(/\s+/g, ' ').trim()
    if (!text) continue

    var matches = ASSESSMENT_QUESTIONS.map(function (question) {
      return text.match(question.pattern)
    })

    for (var q = 0; q < ASSESSMENT_QUESTIONS.length; q++) {
      var match = matches[q]
      if (!match) continue
      var answerStart = match.index + match[0].length
      var answerEnd = text.length
      for (var next = 0; next < matches.length; next++) {
        if (matches[next] && matches[next].index > match.index && matches[next].index < answerEnd) {
          answerEnd = matches[next].index
        }
      }
      var answer = text.slice(answerStart, answerEnd).replace(/^[\s:;\-–—]+/, '').trim()
      if (/[a-z0-9]{2}/i.test(answer)) flags[ASSESSMENT_QUESTIONS[q].key] = true
    }
  }

  return flags
}

function regressionStatus(commentField) {
  var comments = commentField && Array.isArray(commentField.comments) ? commentField.comments : []

  // Prefer the most recent human comment so a later correction can supersede
  // an earlier assessment. Automation comments are not evidence of a defect
  // being identified as a regression.
  for (var i = comments.length - 1; i >= 0; i--) {
    if (isAutomationComment(comments[i])) continue
    var text = extractAdfText(comments[i].body).replace(/\s+/g, ' ').trim()
    if (!text) continue

    var question = text.match(/is\s+(?:this(?:\s+issue)?|it)\s+a\s+regression(?:[^?]*)\?/i)
    if (question) {
      var answer = text.slice(question.index + question[0].length).match(/^\s*[:;\-–—]?\s*(yes|no)\b/i)
      if (answer) return answer[1].toLowerCase() === 'yes' ? 'Yes' : 'No'
    }

    if (/\b(?:not|no)\s+(?:a\s+)?regression\b|\bpre[-\s]?existing\b|\bnever\s+worked\b/i.test(text)) {
      return 'No'
    }

    if (/\b(?:this|it)\s+is\s+(?:clearly\s+|definitely\s+)?(?:a\s+)?regression\b|\b(?:confirmed|identified|introduced|caused)\s+(?:as\s+)?(?:a\s+)?regression\b|\bregression\s+(?:bug|issue)\b|\bregressed\s+(?:after|since|in|from)\b/i.test(text)) {
      return 'Yes'
    }
  }

  return 'Unknown'
}

function isZStreamVersion(fixVersions) {
  return (fixVersions || []).some(function (version) {
    return Z_STREAM_VERSION_RE.test(String(version || ''))
  })
}

function hasPmAcknowledgement(commentField, productManager) {
  var comments = commentField && Array.isArray(commentField.comments) ? commentField.comments : []
  var pmName = String(productManager || '').trim().toLowerCase()

  for (var i = 0; i < comments.length; i++) {
    var comment = comments[i]
    if (isAutomationComment(comment)) continue
    var text = extractAdfText(comment.body).replace(/\s+/g, ' ').trim()
    var author = (comment.author && (comment.author.displayName || comment.author.name) || '').trim().toLowerCase()
    if (/\bpm\s*(?:ack(?:nowledged|nowledgement)?|approv(?:e|ed|al))\b/i.test(text)) return true
    if (pmName && author === pmName && /\b(?:ack(?:nowledged)?|approv(?:e|ed|al))\b/i.test(text)) return true
  }

  return false
}

function extractActiveRhdPullRequests(payload) {
  var active = []
  var details = payload && Array.isArray(payload.detail) ? payload.detail : []
  for (var i = 0; i < details.length; i++) {
    var pullRequests = Array.isArray(details[i].pullRequests) ? details[i].pullRequests : []
    for (var j = 0; j < pullRequests.length; j++) {
      var pullRequest = pullRequests[j]
      var repository = String(pullRequest.repositoryName || '')
      var url = String(pullRequest.url || '')
      var isRhdRepository = /^red-hat-data-services\//i.test(repository) || /github\.com\/red-hat-data-services\//i.test(url)
      if (!isRhdRepository || String(pullRequest.status || '').toUpperCase() !== 'OPEN') continue
      active.push({
        name: pullRequest.name || pullRequest.id || url,
        repository: repository,
        status: 'OPEN',
        url: url
      })
    }
  }
  return active
}

function buildTriageReadiness(issue, activePullRequests) {
  var fields = (issue && issue.fields) || {}
  var fixVersions = extractJiraNames(fields.fixVersions)
  var zStream = isZStreamVersion(fixVersions)
  var answers = assessmentAnswerFlags(fields.comment)
  var assessmentCompleted = Object.keys(answers).every(function (key) { return answers[key] })
  var productManager = serializeJiraUser(fields[PRODUCT_MANAGER_FIELD_ID])
  var pmAcknowledged = !zStream || hasPmAcknowledgement(fields.comment, productManager)
  var criteria = {
    fixVersion: fixVersions.length > 0,
    linkedPullRequest: (activePullRequests || []).length > 0,
    assessmentCompleted: assessmentCompleted,
    pmAcknowledgement: pmAcknowledged
  }
  var missingCriteria = []
  if (!criteria.fixVersion) missingCriteria.push('Fix Version')
  if (!criteria.linkedPullRequest) missingCriteria.push('active red-hat-data-services PR')
  if (!criteria.assessmentCompleted) missingCriteria.push('all five assessment answers')
  if (!criteria.pmAcknowledgement) missingCriteria.push('PM acknowledgement')

  return {
    ready: Object.keys(criteria).every(function (key) { return criteria[key] }),
    criteria: criteria,
    missingCriteria: missingCriteria,
    assessmentAnswers: answers,
    activePullRequests: activePullRequests || [],
    isZStream: zStream,
    pmAcknowledgementRequired: zStream,
    productManager: productManager
  }
}

async function fetchActiveRhdPullRequests(issue, jiraRequest) {
  if (!jiraRequest || !issue || !issue.id) return []
  try {
    var path = '/rest/dev-status/1.0/issue/detail?issueId=' + encodeURIComponent(issue.id) +
      '&applicationType=' + encodeURIComponent(GITHUB_APPLICATION_TYPE) + '&dataType=pullrequest'
    return extractActiveRhdPullRequests(await jiraRequest(path))
  } catch (err) {
    console.warn('[releases/delivery] PR readiness lookup failed for ' + issue.key + ': ' + err.message)
    return []
  }
}

async function buildTriageReadinessMap(issues, jiraRequest) {
  var proposedIssues = (issues || []).filter(function (issue) {
    return serializeReleaseBlockerStatus(issue.fields && issue.fields[BLOCKER_FIELD_ID]) === 'Proposed'
  })
  var readiness = new Map()
  var nextIndex = 0

  async function worker() {
    while (nextIndex < proposedIssues.length) {
      var issue = proposedIssues[nextIndex++]
      var activePullRequests = await fetchActiveRhdPullRequests(issue, jiraRequest)
      readiness.set(issue.key, buildTriageReadiness(issue, activePullRequests))
    }
  }

  var workers = []
  var workerCount = Math.min(5, proposedIssues.length)
  for (var i = 0; i < workerCount; i++) workers.push(worker())
  await Promise.all(workers)
  return readiness
}

// Escapes single quotes for safe JQL string interpolation (input already validated by RELEASE_NUMBER_RE)
function sanitizeForJql(value) {
  return value.replace(/'/g, "\\'")
}

function buildBlockerJql(version) {
  var safe = sanitizeForJql(version)
  return (
    'project in (RHAIENG, RHOAIENG) ' +
    'AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service) OR labels is empty) ' +
    'AND component not in (Documentation, PXE) ' +
    'AND status not in (Closed, Resolved) ' +
    "AND (affectedVersion IN ('" + safe + "') OR cf[10855] IN ('" + safe + "')) " +
    'AND priority in (Blocker)'
  )
}

function buildCriticalMonitoringJql(version) {
  var safe = sanitizeForJql(version)
  return (
    'project in (RHAIENG, RHOAIENG) ' +
    'AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service) OR labels is empty) ' +
    'AND component not in (Documentation, PXE) ' +
    'AND status not in (Closed, Resolved) ' +
    "AND (affectedVersion IN ('" + safe + "') OR cf[10855] IN ('" + safe + "')) " +
    'AND priority in (Critical, Blocker) ' +
    'AND (cf[10847] is EMPTY OR cf[10847] not in (Approved))'
  )
}

function buildAwarenessTrendsJql(version) {
  var safe = sanitizeForJql(version)
  return (
    'project in (RHAIENG, RHOAIENG) ' +
    'AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service) OR labels is empty) ' +
    'AND component not in (Documentation, PXE) ' +
    'AND status not in (Closed, Resolved) ' +
    "AND (fixVersion IN ('" + safe + "') OR affectedVersion IN ('" + safe + "') OR cf[10855] IN ('" + safe + "')) " +
    'AND priority in (Blocker) ' +
    'AND cf[10847] is not EMPTY ' +
    'ORDER BY updated DESC'
  )
}

function buildHistoricalTrendsJql() {
  return (
    'project in (RHAIENG, RHOAIENG) ' +
    'AND (labels not in (RHOAI-releases, RHOAI-internal, devtestops-service) OR labels is empty) ' +
    'AND component not in (Documentation, PXE) ' +
    'AND priority in (Blocker) ' +
    'AND cf[10847] in (16772, 16774) ' +
    'ORDER BY updated DESC'
  )
}

function compareReleaseNames(left, right) {
  function releaseKey(value) {
    var text = String(value || '').toLowerCase()
    var version = text.match(/(\d+)(?:\.(\d+))?/)
    var phase = text.match(/\b(?:ea|rc)\s*(\d+)?\b/)
    var phaseNumber = phase && phase[1] ? Number(phase[1]) : 0
    var phaseRank = /\bea\s*\d*\b/.test(text)
      ? 10 + phaseNumber
      : /\brc\s*\d*\b/.test(text)
        ? 30 + phaseNumber
        : /\bga\b/.test(text) ? 50 : 40
    return [version ? Number(version[1]) : Number.MAX_SAFE_INTEGER, version && version[2] ? Number(version[2]) : 0, phaseRank, text]
  }

  var a = releaseKey(left)
  var b = releaseKey(right)
  for (var i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}

function buildHistoricalTrends(issues, jiraHost) {
  var releaseGroups = new Map()
  var componentGroups = new Map()
  var historicalIssues = []

  function ensureGroup(groups, label) {
    if (!groups.has(label)) groups.set(label, { label: label, approved: new Set(), rejected: new Set() })
    return groups.get(label)
  }

  for (var i = 0; i < (issues || []).length; i++) {
    var issue = issues[i]
    var status = serializeReleaseBlockerStatus(issue.fields && issue.fields[BLOCKER_FIELD_ID])
    if (status !== 'Approved' && status !== 'Rejected') continue

    var fixVersions = extractJiraNames(issue.fields && issue.fields.fixVersions)
    var affectedVersions = extractJiraNames(issue.fields && issue.fields.versions)
    var targetVersions = extractJiraNames(issue.fields && issue.fields[TARGET_VERSION_FIELD_ID])
    var releaseNames = []
      .concat(fixVersions)
      .concat(affectedVersions)
      .concat(targetVersions)
    releaseNames = [...new Set(releaseNames.filter(Boolean))]

    var componentNames = extractJiraNames(issue.fields && issue.fields.components)
    if (!componentNames.length) componentNames = ['(No component)']
    componentNames = [...new Set(componentNames)]

    for (var r = 0; r < releaseNames.length; r++) {
      var releaseGroup = ensureGroup(releaseGroups, releaseNames[r])
      releaseGroup[status.toLowerCase()].add(issue.key)
    }
    for (var c = 0; c < componentNames.length; c++) {
      var componentGroup = ensureGroup(componentGroups, componentNames[c])
      componentGroup[status.toLowerCase()].add(issue.key)
    }

    var commentAnalysis = blockerAnalysis.classifyCommentAnalysis(issue.fields && issue.fields.comment && issue.fields.comment.comments)

    historicalIssues.push({
      key: issue.key,
      summary: (issue.fields && issue.fields.summary) || '',
      link: jiraHost ? jiraHost + '/browse/' + encodeURIComponent(issue.key) : null,
      priority: (issue.fields && issue.fields.priority && issue.fields.priority.name) || 'Unknown',
      issueType: (issue.fields && issue.fields.issuetype && issue.fields.issuetype.name) || 'Unknown',
      status: (issue.fields && issue.fields.status && issue.fields.status.name) || 'Unknown',
      releaseBlockerStatus: status,
      assignee: serializeJiraUser(issue.fields && issue.fields.assignee),
      reporter: serializeJiraUser(issue.fields && issue.fields.reporter),
      fixVersions: fixVersions,
      affectedVersions: affectedVersions,
      trendReleases: releaseNames,
      components: componentNames,
      labels: extractJiraNames(issue.fields && issue.fields.labels),
      team: serializeJiraField(issue.fields && issue.fields[TEAM_FIELD_ID]),
      isRegression: regressionStatus(issue.fields && issue.fields.comment),
      couldIdentifyEarlier: commentAnalysis.couldIdentifyEarlier,
      earlyDetectionResponse: commentAnalysis.earlyDetectionResponse,
      earlyDetectionCategory: commentAnalysis.earlyDetectionCategory,
      preventionCategory: commentAnalysis.preventionCategory,
      prevention: commentAnalysis.prevention,
      earlyIdentificationEvidence: commentAnalysis.earlyIdentificationEvidence,
      created: issue.fields && issue.fields.created ? issue.fields.created : null,
      updated: issue.fields && issue.fields.updated ? issue.fields.updated : null,
      latestProposedDate: null
    })
  }

  function serializeGroups(groups, sorter) {
    return Array.from(groups.values()).sort(function (a, b) { return sorter(a.label, b.label) }).map(function (group) {
      return {
        label: group.label,
        approved: group.approved.size,
        rejected: group.rejected.size,
        total: group.approved.size + group.rejected.size
      }
    })
  }

  return {
    releases: serializeGroups(releaseGroups, compareReleaseNames),
    components: serializeGroups(componentGroups, function (a, b) { return a.localeCompare(b) }),
    issues: historicalIssues
  }
}

function parseBlockerHistory(issue) {
  var now = new Date()
  var histories = (issue.changelog && issue.changelog.histories) || []

  var transitions = []
  for (var h = 0; h < histories.length; h++) {
    var history = histories[h]
    var items = history.items || []
    for (var k = 0; k < items.length; k++) {
      var item = items[k]
      if (item.fieldId === BLOCKER_FIELD_ID || item.field === 'Release Blocker') {
        transitions.push({
          date: new Date(history.created),
          from: item.fromString || RELEASE_BLOCKER_OPTION_LABELS[String(item.from)] || null,
          to: item.toString || RELEASE_BLOCKER_OPTION_LABELS[String(item.to)] || null
        })
      }
    }
  }
  transitions.sort(function (a, b) { return a.date - b.date })

  var fieldValue = issue.fields && issue.fields[BLOCKER_FIELD_ID]
  var currentStatus = serializeReleaseBlockerStatus(fieldValue)

  var enteredCurrentStateAt = null
  if (transitions.length > 0) {
    var last = transitions[transitions.length - 1]
    if (last.to === currentStatus) {
      enteredCurrentStateAt = last.date
    }
  }
  if (!enteredCurrentStateAt && currentStatus) {
    enteredCurrentStateAt = new Date(issue.fields.created)
  }

  var daysInCurrentState = null
  if (enteredCurrentStateAt) {
    daysInCurrentState = Math.floor((now - enteredCurrentStateAt) / (1000 * 60 * 60 * 24))
  }

  var proposedDate = null
  var latestProposedDate = null
  var decisionDate = null
  for (var i = 0; i < transitions.length; i++) {
    var t = transitions[i]
    if (t.to === 'Proposed') {
      if (!proposedDate) proposedDate = t.date
      latestProposedDate = t.date
    }
    if (proposedDate && !decisionDate && (t.to === 'Approved' || t.to === 'Rejected')) {
      decisionDate = t.date
    }
  }
  if (!proposedDate && currentStatus === 'Proposed') {
    proposedDate = new Date(issue.fields.created)
    latestProposedDate = proposedDate
  }

  var daysToDecision = null
  if (proposedDate && decisionDate) {
    daysToDecision = Math.floor((decisionDate - proposedDate) / (1000 * 60 * 60 * 24))
  }

  return {
    currentStatus: currentStatus,
    daysInCurrentState: daysInCurrentState,
    proposedDate: proposedDate ? proposedDate.toISOString() : null,
    latestProposedDate: latestProposedDate ? latestProposedDate.toISOString() : null,
    decisionDate: decisionDate ? decisionDate.toISOString() : null,
    daysToDecision: daysToDecision
  }
}

function computeMedian(values) {
  if (!values.length) return null
  var sorted = values.slice().sort(function (a, b) { return a - b })
  var mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

function computePercentile(values, p) {
  if (!values.length) return null
  var sorted = values.slice().sort(function (a, b) { return a - b })
  var idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function computeAvg(values) {
  if (!values.length) return null
  return Math.round(values.reduce(function (a, b) { return a + b }, 0) / values.length)
}

function buildAgingStats(values) {
  return {
    avg: computeAvg(values),
    median: computeMedian(values),
    p90: computePercentile(values, 90),
    max: values.length ? Math.max.apply(null, values) : null,
    count: values.length
  }
}

function buildResponse(releaseNumber, blockerIssues, criticalIssues, codeFreezeDate, jiraHost, awarenessIssues, triageReadinessByKey) {
  var now = new Date()

  var proposed = 0
  var approved = 0
  var rejected = 0
  var noStatus = 0
  var beforeCF = 0
  var afterCF = 0
  var decisionDays = []
  var resolutionDays = []
  var daysInProposed = []
  var daysInApproved = []
  var daysInRejected = []

  var blockers = []
  var blockerKeys = new Set()

  for (var i = 0; i < blockerIssues.length; i++) {
    var issue = blockerIssues[i]
    var key = issue.key
    blockerKeys.add(key)

    var history = parseBlockerHistory(issue)
    var components = ((issue.fields && issue.fields.components) || [])
      .map(function (c) { return (c.name || '').trim() })
      .filter(Boolean)
    var assignee = serializeJiraUser(issue.fields && issue.fields.assignee)
    var reporter = serializeJiraUser(issue.fields && issue.fields.reporter)
    var fixVersions = extractJiraNames(issue.fields && issue.fields.fixVersions)
    var affectedVersions = extractJiraNames(issue.fields && issue.fields.versions)
    var team = serializeJiraField(issue.fields && issue.fields[TEAM_FIELD_ID])

    var status = history.currentStatus
    if (status === 'Proposed') {
      proposed++
      if (history.daysInCurrentState !== null) daysInProposed.push(history.daysInCurrentState)
    } else if (status === 'Approved') {
      approved++
      if (history.daysInCurrentState !== null) daysInApproved.push(history.daysInCurrentState)
    } else if (status === 'Rejected') {
      rejected++
      if (history.daysInCurrentState !== null) daysInRejected.push(history.daysInCurrentState)
    } else {
      noStatus++
    }

    var isBeforeCF = false
    if (codeFreezeDate && issue.fields && issue.fields.created) {
      isBeforeCF = issue.fields.created.slice(0, 10) <= codeFreezeDate
    }
    if (isBeforeCF) beforeCF++
    else afterCF++

    if (history.daysToDecision !== null) {
      decisionDays.push(history.daysToDecision)
    }

    if (status === 'Approved' && issue.fields && issue.fields.resolutiondate && history.decisionDate) {
      var resolvedAt = new Date(issue.fields.resolutiondate)
      var approvedAt = new Date(history.decisionDate)
      var days = Math.floor((resolvedAt - approvedAt) / (1000 * 60 * 60 * 24))
      if (days >= 0) resolutionDays.push(days)
    }

    blockers.push({
      key: key,
      summary: (issue.fields && issue.fields.summary) || '',
      link: jiraHost + '/browse/' + encodeURIComponent(key),
      priority: (issue.fields && issue.fields.priority && issue.fields.priority.name) || 'Unknown',
      issueType: (issue.fields && issue.fields.issuetype && issue.fields.issuetype.name) || 'Unknown',
      status: (issue.fields && issue.fields.status && issue.fields.status.name) || 'Unknown',
      components: components,
      assignee: assignee,
      reporter: reporter,
      fixVersions: fixVersions,
      affectedVersions: affectedVersions,
      team: team,
      releaseBlockerStatus: history.currentStatus,
      created: issue.fields && issue.fields.created ? issue.fields.created.slice(0, 10) : null,
      daysInCurrentState: history.daysInCurrentState,
      daysToDecision: history.daysToDecision,
      proposedBeforeCodeFreeze: isBeforeCF
    })
  }

  var criticalMonitoring = []
  for (var j = 0; j < criticalIssues.length; j++) {
    var ci = criticalIssues[j]
    if (blockerKeys.has(ci.key)) continue

    var cComponents = ((ci.fields && ci.fields.components) || [])
      .map(function (c) { return (c.name || '').trim() })
      .filter(Boolean)
    var cAssignee = serializeJiraUser(ci.fields && ci.fields.assignee)
    var cReporter = serializeJiraUser(ci.fields && ci.fields.reporter)

    var cHistory = parseBlockerHistory(ci)

    var daysOpen = 0
    if (ci.fields && ci.fields.created) {
      daysOpen = Math.floor((now - new Date(ci.fields.created)) / (1000 * 60 * 60 * 24))
    }

    criticalMonitoring.push({
      key: ci.key,
      summary: (ci.fields && ci.fields.summary) || '',
      link: jiraHost + '/browse/' + encodeURIComponent(ci.key),
      priority: (ci.fields && ci.fields.priority && ci.fields.priority.name) || 'Unknown',
      issueType: (ci.fields && ci.fields.issuetype && ci.fields.issuetype.name) || 'Unknown',
      status: (ci.fields && ci.fields.status && ci.fields.status.name) || 'Unknown',
      components: cComponents,
      assignee: cAssignee,
      reporter: cReporter,
      fixVersions: extractJiraNames(ci.fields && ci.fields.fixVersions),
      affectedVersions: extractJiraNames(ci.fields && ci.fields.versions),
      team: serializeJiraField(ci.fields && ci.fields[TEAM_FIELD_ID]),
      releaseBlockerStatus: cHistory.currentStatus,
      created: ci.fields && ci.fields.created ? ci.fields.created.slice(0, 10) : null,
      daysOpen: daysOpen,
      daysInCurrentState: cHistory.daysInCurrentState
    })
  }

  var awarenessTrends = []
  var trendIssues = awarenessIssues || []
  for (var a = 0; a < trendIssues.length; a++) {
    var trendIssue = trendIssues[a]
    var trendHistory = parseBlockerHistory(trendIssue)
    var trendComponents = ((trendIssue.fields && trendIssue.fields.components) || [])
      .map(function (component) { return (component.name || '').trim() })
      .filter(Boolean)

    awarenessTrends.push({
      key: trendIssue.key,
      summary: (trendIssue.fields && trendIssue.fields.summary) || '',
      link: jiraHost + '/browse/' + encodeURIComponent(trendIssue.key),
      priority: (trendIssue.fields && trendIssue.fields.priority && trendIssue.fields.priority.name) || 'Unknown',
      issueType: (trendIssue.fields && trendIssue.fields.issuetype && trendIssue.fields.issuetype.name) || 'Unknown',
      status: (trendIssue.fields && trendIssue.fields.status && trendIssue.fields.status.name) || 'Unknown',
      releaseBlockerStatus: trendHistory.currentStatus,
      assignee: serializeJiraUser(trendIssue.fields && trendIssue.fields.assignee),
      reporter: serializeJiraUser(trendIssue.fields && trendIssue.fields.reporter),
      fixVersions: extractJiraNames(trendIssue.fields && trendIssue.fields.fixVersions),
      affectedVersions: extractJiraNames(trendIssue.fields && trendIssue.fields.versions),
      components: trendComponents,
      labels: extractJiraNames(trendIssue.fields && trendIssue.fields.labels),
      team: serializeJiraField(trendIssue.fields && trendIssue.fields[TEAM_FIELD_ID]),
      isRegression: regressionStatus(trendIssue.fields && trendIssue.fields.comment),
      created: trendIssue.fields && trendIssue.fields.created ? trendIssue.fields.created : null,
      updated: trendIssue.fields && trendIssue.fields.updated ? trendIssue.fields.updated : null,
      latestProposedDate: trendHistory.latestProposedDate,
      triageReadiness: trendHistory.currentStatus === 'Proposed'
        ? ((triageReadinessByKey && triageReadinessByKey.get(trendIssue.key)) || buildTriageReadiness(trendIssue, []))
        : null
    })
  }

  return {
    releaseNumber: releaseNumber,
    fetchedAt: now.toISOString(),
    summary: {
      proposed: proposed,
      approved: approved,
      rejected: rejected,
      noStatus: noStatus,
      total: proposed + approved + rejected + noStatus
    },
    timing: {
      proposedBeforeCodeFreeze: beforeCF,
      proposedAfterCodeFreeze: afterCF
    },
    aging: {
      proposalToDecision: buildAgingStats(decisionDays),
      approvalToResolution: buildAgingStats(resolutionDays),
      byStatus: {
        proposed: buildAgingStats(daysInProposed),
        approved: buildAgingStats(daysInApproved),
        rejected: buildAgingStats(daysInRejected)
      }
    },
    blockers: blockers,
    criticalMonitoring: criticalMonitoring,
    awarenessTrends: awarenessTrends
  }
}

async function registerBlockerRoutes(router, context) {
  var storage = context.storage
  var requireAuth = context.requireAuth
  var requireScope = context.requireScope
  var readFromStorage = storage.readFromStorage

  var jiraHost = sharedJira.JIRA_HOST
  var fetchJql
  var jiraRequest
  if (context.jira) {
    jiraHost = context.jira.JIRA_HOST
    jiraRequest = context.jira.jiraRequest
    fetchJql = function (jql, fields, opts) {
      return context.jira.fetchAllJqlResults(jql, fields, opts)
    }
  } else {
    jiraRequest = sharedJira.jiraRequest
    fetchJql = function (jql, fields, opts) {
      return sharedJira.fetchAllJqlResults(sharedJira.jiraRequest, jql, fields, opts)
    }
  }

  /**
   * @openapi
   * /api/modules/releases/delivery/blockers/trends:
   *   get:
   *     tags: ['Releases: Delivery']
   *     summary: Get historical release blocker trends
   *     description: Returns raw Approved and Rejected blocker totals grouped by Jira release version and component, plus the deduplicated issue records used to build those totals. The data is independent of dashboard filters.
   *     responses:
   *       200:
   *         description: Historical blocker trend totals
   *       500:
   *         description: Failed to fetch historical blocker trends
   */
  router.get('/blockers/trends', requireAuth, requireScope('releases:read'), async function (req, res) {
    var cacheKey = '__historical-trends__'
    var cached = blockersCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return res.json(cached.data)
    }

    if (DEMO_MODE) {
      var trendFixture = await readFromStorage('releases/delivery/blockers-trends.json')
      var demoData = trendFixture || { releases: [], components: [] }
      var demoResponse = { fetchedAt: new Date().toISOString(), releases: demoData.releases, components: demoData.components, issues: demoData.issues || [] }
      blockersCache.set(cacheKey, { data: demoResponse, timestamp: Date.now() })
      return res.json(demoResponse)
    }

    try {
      var issues = await fetchJql(buildHistoricalTrendsJql(), BLOCKER_FIELDS, { maxResults: 100 })
      var trends = buildHistoricalTrends(issues || [], jiraHost)
      var response = { fetchedAt: new Date().toISOString(), releases: trends.releases, components: trends.components, issues: trends.issues }
      blockersCache.set(cacheKey, { data: response, timestamp: Date.now() })
      res.json(response)
    } catch (err) {
      console.error('[releases/delivery] historical blocker trends fetch error:', err)
      res.status(500).json({ error: 'Failed to fetch historical blocker trends: ' + err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/blockers/analysis:
   *   get:
   *     tags: ['Releases: Delivery']
   *     summary: Get release blocker continuous-improvement analysis
   *     description: Returns the precomputed historical analysis snapshot for Approved and Rejected release blockers. The data is independent of dashboard filters.
   *     responses:
   *       200:
   *         description: Release blocker analysis snapshot
   *       404:
   *         description: No analysis snapshot is available
   */
  router.get('/blockers/analysis', requireAuth, requireScope('releases:read'), async function (req, res) {
    if (DEMO_MODE) {
      var demoAnalysis = await readFromStorage(ANALYSIS_STORAGE_KEY)
      if (!demoAnalysis) return res.status(404).json({ error: 'No release blocker analysis snapshot is available.' })
      var normalizedDemo = blockerAnalysis.normalizeBlockerAnalysisSnapshot(demoAnalysis)
      return normalizedDemo.error
        ? res.status(500).json({ error: 'Invalid release blocker analysis fixture.' })
        : res.json(normalizedDemo.snapshot)
    }

    var snapshot = await readFromStorage(ANALYSIS_STORAGE_KEY)
    if (!snapshot) return res.status(404).json({ error: 'No release blocker analysis snapshot is available.' })
    var normalized = blockerAnalysis.normalizeBlockerAnalysisSnapshot(snapshot)
    if (normalized.error) return res.status(500).json({ error: 'Stored release blocker analysis is invalid.' })
    res.json(normalized.snapshot)
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/blockers/analysis/bulk:
   *   post:
   *     tags: ['Releases: Delivery']
   *     summary: Upload a release blocker analysis snapshot
   *     description: Stores a validated, precomputed snapshot produced by the continuous-improvement analysis pipeline.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Snapshot stored successfully
   *       400:
   *         description: Invalid or oversized snapshot
   *       413:
   *         description: Snapshot exceeds the maximum payload size
   */
  router.post('/blockers/analysis/bulk', requireAuth, requireScope('releases:write'), async function (req, res) {
    if (DEMO_MODE) return res.json({ status: 'skipped', message: 'Release blocker analysis ingest disabled in demo mode.' })

    var body = req.body || {}
    var serializedPayload
    try {
      serializedPayload = JSON.stringify(body)
    } catch {
      return res.status(400).json({ error: 'payload must be JSON serializable' })
    }
    var serializedSize = Buffer.byteLength(serializedPayload, 'utf8')
    if (serializedSize > 15 * 1024 * 1024) return res.status(413).json({ error: 'payload exceeds maximum size of 15 MB' })

    var normalized = blockerAnalysis.normalizeBlockerAnalysisSnapshot(body)
    if (normalized.error) return res.status(400).json({ error: normalized.error })

    try {
      await storage.writeToStorage(ANALYSIS_STORAGE_KEY, normalized.snapshot)
      blockersCache.delete('__historical-analysis__')
      res.json({
        status: 'ok',
        generatedAt: normalized.snapshot.generatedAt,
        issueCount: normalized.snapshot.issues.length,
        partial: normalized.snapshot.partial
      })
    } catch (err) {
      console.error('[releases/delivery] release blocker analysis upload error:', err)
      res.status(500).json({ error: 'Failed to store release blocker analysis snapshot' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/blockers/{releaseNumber}:
   *   get:
   *     tags: ['Releases: Delivery']
   *     summary: Get release blockers data with aging metrics for a specific release
   *     parameters:
   *       - in: path
   *         name: releaseNumber
   *         required: true
   *         schema: { type: string }
   *         description: Release version identifier (e.g., "rhoai-3.5.EA1")
   *       - in: query
   *         name: codeFreezeDate
   *         schema: { type: string, format: date }
   *         description: Code freeze date (YYYY-MM-DD) for timing breakdown
   *     responses:
   *       200:
   *         description: Release blockers with aging metrics
   *       400:
   *         description: Invalid release number format
   */
  router.get('/blockers/:releaseNumber', requireAuth, requireScope('releases:read'), async function (req, res) {
    var releaseNumber = req.params.releaseNumber
    var codeFreezeDate = req.query.codeFreezeDate || null

    if (!releaseNumber || !RELEASE_NUMBER_RE.test(releaseNumber)) {
      return res.status(400).json({ error: 'Invalid release number format' })
    }

    if (codeFreezeDate && !/^\d{4}-\d{2}-\d{2}$/.test(codeFreezeDate)) {
      codeFreezeDate = null
    }

    if (DEMO_MODE) {
      var fixture = await readFromStorage('releases/delivery/blockers-' + releaseNumber + '.json')
      if (fixture) return res.json(fixture)
      var emptyStats = { avg: null, median: null, p90: null, max: null, count: 0 }
      return res.json({
        releaseNumber: releaseNumber,
        fetchedAt: new Date().toISOString(),
        summary: { proposed: 0, approved: 0, rejected: 0, noStatus: 0, total: 0 },
        timing: { proposedBeforeCodeFreeze: 0, proposedAfterCodeFreeze: 0 },
        aging: {
          proposalToDecision: emptyStats,
          approvalToResolution: emptyStats,
          byStatus: { proposed: emptyStats, approved: emptyStats, rejected: emptyStats }
        },
        blockers: [],
        criticalMonitoring: [],
        awarenessTrends: []
      })
    }

    var cacheKey = releaseNumber + ':' + (codeFreezeDate || '')
    var cached = blockersCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return res.json(cached.data)
    }

    try {
      var blockerJql = buildBlockerJql(releaseNumber)
      var criticalJql = buildCriticalMonitoringJql(releaseNumber)
      var awarenessJql = buildAwarenessTrendsJql(releaseNumber)

      // Blockers: fetch with changelog for aging metrics
      // Critical monitoring: fetch without changelog (larger result set, Jira chokes on expand)
      // Awareness trends: fetch only issues with a Release Blocker value and include changelog
      // so current proposals can be ordered by their latest transition into Proposed.
      var results = await Promise.all([
        fetchJql(blockerJql, BLOCKER_FIELDS, { expand: 'changelog', maxResults: 100 }),
        fetchJql(criticalJql, BLOCKER_FIELDS, { maxResults: 100 }),
        fetchJql(awarenessJql, BLOCKER_FIELDS, { expand: 'changelog', maxResults: 100 })
      ])

      var blockerIssues = results[0] || []
      var criticalIssues = results[1] || []
      var awarenessIssues = results[2] || []
      var triageReadinessByKey = await buildTriageReadinessMap(awarenessIssues, jiraRequest)

      var response = buildResponse(
        releaseNumber,
        blockerIssues,
        criticalIssues,
        codeFreezeDate,
        jiraHost,
        awarenessIssues,
        triageReadinessByKey
      )

      blockersCache.set(cacheKey, { data: response, timestamp: Date.now() })
      if (blockersCache.size > CACHE_MAX_ENTRIES) {
        var oldest = blockersCache.keys().next().value
        blockersCache.delete(oldest)
      }

      res.json(response)
    } catch (err) {
      console.error('[releases/delivery] blockers fetch error:', err)
      res.status(500).json({ error: 'Failed to fetch release blockers: ' + err.message })
    }
  })
}

module.exports = registerBlockerRoutes
module.exports.BLOCKER_FIELDS = BLOCKER_FIELDS
module.exports.buildResponse = buildResponse
module.exports.buildAwarenessTrendsJql = buildAwarenessTrendsJql
module.exports.buildHistoricalTrendsJql = buildHistoricalTrendsJql
module.exports.buildHistoricalTrends = buildHistoricalTrends
module.exports.assessmentAnswerFlags = assessmentAnswerFlags
module.exports.regressionStatus = regressionStatus
module.exports.isZStreamVersion = isZStreamVersion
module.exports.extractActiveRhdPullRequests = extractActiveRhdPullRequests
module.exports.buildTriageReadiness = buildTriageReadiness
module.exports.ANALYSIS_STORAGE_KEY = ANALYSIS_STORAGE_KEY
module.exports.buildBlockerAnalysisAggregates = blockerAnalysis.buildBlockerAnalysisAggregates
module.exports.normalizeBlockerAnalysisSnapshot = blockerAnalysis.normalizeBlockerAnalysisSnapshot
