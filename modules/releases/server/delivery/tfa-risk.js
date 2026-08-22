'use strict'

var sharedJira = require('../../../../shared/server/jira')

var DEMO_MODE = process.env.DEMO_MODE === 'true'

var TFA_FIELDS = [
  'summary', 'status', 'components', 'assignee',
  'labels', 'created', 'updated'
].join(',')

var CACHE_TTL_MS = 5 * 60 * 1000
var CACHE_MAX_ENTRIES = 50
var tfaRiskCache = new Map()

var RELEASE_NUMBER_RE = /^[a-zA-Z0-9._\- ]+$/

function sanitizeForJql(value) {
  return value.replace(/'/g, "\\'")
}

function buildVersionClause(safe) {
  return (
    "(fixVersion IN ('" + safe + "') " +
    "OR affectedVersion IN ('" + safe + "') " +
    "OR cf[10855] IN ('" + safe + "'))"
  )
}

function buildTfaSignoffJql(version) {
  var safe = sanitizeForJql(version)
  return (
    'project in (RHAIENG, RHOAIENG) ' +
    'AND ' + buildVersionClause(safe) + ' ' +
    'AND summary ~ "TFA Sign-Off" ' +
    'AND issuetype NOT IN (Epic, Initiative)'
  )
}

function buildFailedTestJql(version) {
  var safe = sanitizeForJql(version)
  return (
    'project in (RHAIENG, RHOAIENG) ' +
    'AND ' + buildVersionClause(safe) + ' ' +
    'AND labels = "test-failed" ' +
    'AND status not in (Closed, Resolved) ' +
    'AND issuetype NOT IN (Epic, Initiative)'
  )
}

function statusCategoryKey(status) {
  var cat = (status && status.statusCategory) || {}
  var key = String(cat.key || '').toLowerCase()
  if (key === 'done') return 'done'
  if (key === 'indeterminate') return 'inProgress'
  return 'todo'
}

function computeRiskLevel(pct, total, failedOpen) {
  if (total === 0 && failedOpen > 0) return 'red'
  if (total === 0) return 'green'
  if (pct < 50) return 'red'
  if (pct < 80) return 'yellow'
  return 'green'
}

function buildComponentSignoffJqlUrl(jiraHost, version, componentName) {
  var safe = sanitizeForJql(version)
  var safeComp = sanitizeForJql(componentName)
  var jql = 'project in (RHAIENG, RHOAIENG) AND ' + buildVersionClause(safe) +
    ' AND summary ~ "TFA Sign-Off" AND component = "' + safeComp + '" AND issuetype NOT IN (Epic, Initiative)'
  return jiraHost + '/issues/?jql=' + encodeURIComponent(jql)
}

function buildComponentFailedJqlUrl(jiraHost, version, componentName) {
  var safe = sanitizeForJql(version)
  var safeComp = sanitizeForJql(componentName)
  var jql = 'project in (RHAIENG, RHOAIENG) AND ' + buildVersionClause(safe) +
    ' AND labels = "test-failed" AND component = "' + safeComp + '" AND status not in (Closed, Resolved) AND issuetype NOT IN (Epic, Initiative)'
  return jiraHost + '/issues/?jql=' + encodeURIComponent(jql)
}

function buildTfaRiskResponse(releaseNumber, signoffIssues, failedIssues, jiraHost) {
  var componentMap = {}

  for (var i = 0; i < signoffIssues.length; i++) {
    var issue = signoffIssues[i]
    var components = ((issue.fields && issue.fields.components) || [])
      .map(function (c) { return (c.name || '').trim() })
      .filter(Boolean)

    if (components.length === 0) components = ['(No component)']

    var catKey = statusCategoryKey(issue.fields && issue.fields.status)
    var assigneeObj = issue.fields && issue.fields.assignee
    var assignee = assigneeObj ? (assigneeObj.displayName || null) : null

    var issueRecord = {
      key: issue.key,
      summary: (issue.fields && issue.fields.summary) || '',
      status: (issue.fields && issue.fields.status && issue.fields.status.name) || 'Unknown',
      statusCategory: catKey,
      assignee: assignee,
      link: jiraHost + '/browse/' + encodeURIComponent(issue.key)
    }

    for (var ci = 0; ci < components.length; ci++) {
      var compName = components[ci]
      if (!componentMap[compName]) {
        componentMap[compName] = {
          name: compName,
          signoffs: { done: 0, inProgress: 0, todo: 0, total: 0, pct: 0 },
          failedOpen: 0,
          riskLevel: 'green',
          issues: [],
          failedIssues: []
        }
      }
      componentMap[compName].signoffs[catKey]++
      componentMap[compName].signoffs.total++
      componentMap[compName].issues.push(issueRecord)
    }
  }

  for (var j = 0; j < failedIssues.length; j++) {
    var fi = failedIssues[j]
    var fComponents = ((fi.fields && fi.fields.components) || [])
      .map(function (c) { return (c.name || '').trim() })
      .filter(Boolean)

    if (fComponents.length === 0) fComponents = ['(No component)']

    var fAssigneeObj = fi.fields && fi.fields.assignee
    var fAssignee = fAssigneeObj ? (fAssigneeObj.displayName || null) : null

    var failedRecord = {
      key: fi.key,
      summary: (fi.fields && fi.fields.summary) || '',
      status: (fi.fields && fi.fields.status && fi.fields.status.name) || 'Unknown',
      assignee: fAssignee,
      link: jiraHost + '/browse/' + encodeURIComponent(fi.key)
    }

    for (var fci = 0; fci < fComponents.length; fci++) {
      var fCompName = fComponents[fci]
      if (!componentMap[fCompName]) {
        componentMap[fCompName] = {
          name: fCompName,
          signoffs: { done: 0, inProgress: 0, todo: 0, total: 0, pct: 0 },
          failedOpen: 0,
          riskLevel: 'green',
          issues: [],
          failedIssues: []
        }
      }
      componentMap[fCompName].failedOpen++
      componentMap[fCompName].failedIssues.push(failedRecord)
    }
  }

  var overallDone = 0
  var overallTotal = 0
  var overallFailedOpen = 0
  var componentList = []

  var names = Object.keys(componentMap)
  for (var k = 0; k < names.length; k++) {
    var comp = componentMap[names[k]]
    var s = comp.signoffs
    s.pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
    comp.riskLevel = computeRiskLevel(s.pct, s.total, comp.failedOpen)
    if (comp.name !== '(No component)') {
      comp.signoffJqlUrl = buildComponentSignoffJqlUrl(jiraHost, releaseNumber, comp.name)
      comp.failedJqlUrl = buildComponentFailedJqlUrl(jiraHost, releaseNumber, comp.name)
    }
    overallDone += s.done
    overallTotal += s.total
    overallFailedOpen += comp.failedOpen
    componentList.push(comp)
  }

  componentList.sort(function (a, b) { return a.name.localeCompare(b.name) })

  var overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0

  return {
    releaseNumber: releaseNumber,
    fetchedAt: new Date().toISOString(),
    overall: {
      signoffDone: overallDone,
      signoffTotal: overallTotal,
      signoffPct: overallPct,
      failedOpen: overallFailedOpen
    },
    components: componentList
  }
}

module.exports = async function registerTfaRiskRoutes(router, context) {
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
   * /api/modules/releases/delivery/tfa-risk/{releaseNumber}:
   *   get:
   *     tags: ['Releases: Delivery']
   *     summary: Get TFA sign-off risk assessment data for a specific release
   *     description: Queries Jira for TFA sign-off issues and failed test issues, aggregated by component with assignee info
   *     parameters:
   *       - in: path
   *         name: releaseNumber
   *         required: true
   *         schema: { type: string }
   *         description: Release version identifier (e.g., "rhoai-3.5.EA1")
   *     responses:
   *       200:
   *         description: TFA risk assessment data with component breakdowns
   *       400:
   *         description: Invalid release number format
   */
  router.get('/tfa-risk/:releaseNumber', requireAuth, requireScope('releases:read'), async function (req, res) {
    var releaseNumber = req.params.releaseNumber

    if (!releaseNumber || !RELEASE_NUMBER_RE.test(releaseNumber)) {
      return res.status(400).json({ error: 'Invalid release number format' })
    }

    if (DEMO_MODE) {
      var fixture = await readFromStorage('releases/delivery/tfa-risk-' + releaseNumber + '.json')
      if (fixture) return res.json(fixture)
      return res.json({
        releaseNumber: releaseNumber,
        fetchedAt: new Date().toISOString(),
        overall: { signoffDone: 0, signoffTotal: 0, signoffPct: 0, failedOpen: 0 },
        components: []
      })
    }

    var cached = tfaRiskCache.get(releaseNumber)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      return res.json(cached.data)
    }

    try {
      var signoffJql = buildTfaSignoffJql(releaseNumber)
      var failedJql = buildFailedTestJql(releaseNumber)

      var results = await Promise.all([
        fetchJql(signoffJql, TFA_FIELDS, { maxResults: 100 }),
        fetchJql(failedJql, TFA_FIELDS, { maxResults: 100 })
      ])

      var signoffIssues = results[0] || []
      var failedIssues = results[1] || []

      var response = buildTfaRiskResponse(releaseNumber, signoffIssues, failedIssues, jiraHost)

      tfaRiskCache.set(releaseNumber, { data: response, timestamp: Date.now() })
      if (tfaRiskCache.size > CACHE_MAX_ENTRIES) {
        var oldest = tfaRiskCache.keys().next().value
        tfaRiskCache.delete(oldest)
      }

      res.json(response)
    } catch (err) {
      console.error('[releases/delivery] tfa-risk fetch error:', err)
      res.status(500).json({ error: 'Failed to fetch TFA risk data: ' + err.message })
    }
  })
}
