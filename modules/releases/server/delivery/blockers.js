'use strict'

const sharedJira = require('../../../../shared/server/jira')

const DEMO_MODE = process.env.DEMO_MODE === 'true'

const BLOCKER_FIELD_ID = 'customfield_10847'
const TARGET_VERSION_FIELD_ID = 'customfield_10855'
const TEAM_FIELD_ID = 'customfield_10001'
const RELEASE_BLOCKER_OPTION_LABELS = {
  '16772': 'Approved',
  '16773': 'Proposed',
  '16774': 'Rejected'
}

const BLOCKER_FIELDS = [
  'summary', 'status', 'priority', 'issuetype', 'components', 'assignee', 'reporter',
  'fixVersions', 'versions', TEAM_FIELD_ID,
  'created', 'updated', 'resolutiondate',
  BLOCKER_FIELD_ID, TARGET_VERSION_FIELD_ID, 'labels'
].join(',')

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX_ENTRIES = 50
const blockersCache = new Map()

const RELEASE_NUMBER_RE = /^[a-zA-Z0-9._\- ]+$/

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

function buildResponse(releaseNumber, blockerIssues, criticalIssues, codeFreezeDate, jiraHost, awarenessIssues) {
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
      team: serializeJiraField(trendIssue.fields && trendIssue.fields[TEAM_FIELD_ID]),
      created: trendIssue.fields && trendIssue.fields.created ? trendIssue.fields.created : null,
      updated: trendIssue.fields && trendIssue.fields.updated ? trendIssue.fields.updated : null,
      latestProposedDate: trendHistory.latestProposedDate
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
  if (context.jira) {
    jiraHost = context.jira.JIRA_HOST
    fetchJql = function (jql, fields, opts) {
      return context.jira.fetchAllJqlResults(jql, fields, opts)
    }
  } else {
    fetchJql = function (jql, fields, opts) {
      return sharedJira.fetchAllJqlResults(sharedJira.jiraRequest, jql, fields, opts)
    }
  }

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

      var response = buildResponse(releaseNumber, blockerIssues, criticalIssues, codeFreezeDate, jiraHost, awarenessIssues)

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
