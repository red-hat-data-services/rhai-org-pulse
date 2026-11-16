/**
 * Read-only Jira routes used by the Tech Debt Prioritization cockpit.
 */

const {
  CVSS_FIELD_ID,
  SLA_DATE_PROPERTY,
  normalizeCvss,
  normalizeSlaDate
} = require('../cve-sustaining/issue-fields')
const {
  POLICY_CUTOVER,
  VULNERABILITY_SLA_POLICIES,
  assessVulnerabilityPolicy,
  policyForCreatedAt,
  utcDateOnly
} = require('./vulnerability-policy')
const { scoreBug } = require('./bug-score')
const {
  STORAGE_KEY: TRENDS_STORAGE_KEY,
  buildTrendResponse,
  normalizeTrendSnapshot
} = require('./trends')

const RHAI_PROJECT = 'RHAI'
const PROJECTS = ['RHAI', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'AIPCC']
const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CACHE_ENTRIES = 6
const MAX_SELECTED_COMPONENTS = 20
const RELEASE_BLOCKER_FIELD_ID = 'customfield_10847'
const RELEASE_BLOCKER_OPTION_LABELS = {
  '16772': 'Approved',
  '16773': 'Proposed',
  '16774': 'Rejected'
}
const ISSUE_FIELDS = [
  'summary',
  'issuetype',
  'status',
  'priority',
  'components',
  'assignee',
  'reporter',
  'created',
  'updated',
  'duedate',
  'fixVersions',
  'labels',
  RELEASE_BLOCKER_FIELD_ID,
  CVSS_FIELD_ID
].join(',')
const ISSUE_JQL = [
  'project in (' + PROJECTS.join(', ') + ')',
  'issuetype in (Bug, Vulnerability)',
  'statusCategory != Done',
  '(issuetype = Vulnerability OR labels not in ("ux-debt") OR labels is EMPTY)'
].join(' AND ')
const SFDC_BUG_JQL = ISSUE_JQL + ' AND issuetype = Bug AND SFDC_Cases_Counter > 0'

const issueCaches = new Map()
const issueFetchPromises = new Map()

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeNamedRows(rows) {
  if (!Array.isArray(rows)) return []
  const seen = new Set()
  const names = []
  for (const row of rows) {
    const name = normalizeText(row && row.name)
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function normalizeReleaseBlockerStatus(value) {
  if (!value) return null
  if (typeof value === 'string') return normalizeText(value) || null
  const optionId = normalizeText(value.id)
  return normalizeText(value.value || value.name || RELEASE_BLOCKER_OPTION_LABELS[optionId]) || null
}

function normalizeIssue(issue, jiraHost) {
  const fields = issue && issue.fields || {}
  const status = fields.status || {}
  const assignee = fields.assignee || null
  const reporter = fields.reporter || null
  const key = normalizeText(issue && issue.key)

  return {
    key,
    link: normalizeText(jiraHost).replace(/\/$/, '') + '/browse/' + encodeURIComponent(key),
    summary: normalizeText(fields.summary),
    issueType: normalizeText(fields.issuetype && fields.issuetype.name) || 'Unknown',
    jiraPriority: normalizeText(fields.priority && fields.priority.name) || 'Unknown',
    priorityScore: null,
    scoreStatus: 'pending',
    status: normalizeText(status.name) || 'Unknown',
    statusCategory: normalizeText(status.statusCategory && status.statusCategory.name) || 'Unknown',
    components: normalizeNamedRows(fields.components),
    assignee: assignee ? {
      id: normalizeText(assignee.accountId || assignee.key || assignee.name),
      name: normalizeText(assignee.displayName || assignee.name) || 'Unknown'
    } : null,
    reporter: reporter ? {
      id: normalizeText(reporter.accountId || reporter.key || reporter.name),
      name: normalizeText(reporter.displayName || reporter.name) || 'Unknown'
    } : null,
    createdAt: fields.created || null,
    updatedAt: fields.updated || null,
    dueDate: fields.duedate || null,
    fixVersions: normalizeNamedRows(fields.fixVersions),
    labels: Array.isArray(fields.labels) ? fields.labels.map(normalizeText).filter(Boolean) : [],
    releaseBlockerStatus: normalizeReleaseBlockerStatus(fields[RELEASE_BLOCKER_FIELD_ID]),
    hasSfdcCases: false,
    cvss: normalizeCvss(fields[CVSS_FIELD_ID]),
    slaDate: normalizeSlaDate(issue && issue.properties && issue.properties[SLA_DATE_PROPERTY] && issue.properties[SLA_DATE_PROPERTY].value)
  }
}

function dateValue(value, fallback) {
  if (!value) return fallback
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

function selectedComponentsFromQuery(query) {
  const raw = query && query.component
  const values = Array.isArray(raw) ? raw : (raw === undefined ? [] : [raw])
  const seen = new Set()
  const components = []
  for (const value of values) {
    const name = normalizeText(value)
    if (!name || seen.has(name)) continue
    seen.add(name)
    components.push(name)
  }
  return components
}

function includeNoComponentFromQuery(query) {
  return normalizeText(query && query.includeNoComponent).toLowerCase() === 'true'
}

function selectedIssueTypeFromQuery(query) {
  const raw = normalizeText(query && (query.issueType || query.issuetype)).toLowerCase()
  if (!raw || raw === 'all') return { value: null, error: null }
  if (raw === 'bug' || raw === 'bugs') return { value: 'Bug', error: null }
  if (raw === 'vulnerability' || raw === 'vulnerabilities' || raw === 'cve') {
    return { value: 'Vulnerability', error: null }
  }
  return { value: null, error: 'Issue type must be Bug or Vulnerability' }
}

function selectedTriageFromQuery(query) {
  const raw = normalizeText(query && query.triage).toLowerCase()
  if (!raw || raw === 'all') return { value: 'all', error: null }
  if (raw === 'exceptions') return { value: 'exceptions', error: null }
  return { value: null, error: 'Triage must be all or exceptions' }
}

function isRefreshRequested(query) {
  return normalizeText(query && query.refresh).toLowerCase() === 'true'
}

function escapeJqlString(value) {
  return normalizeText(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function componentJqlClause(components, includeNoComponent = false) {
  const clauses = []
  if (components.length) {
    clauses.push('component in (' + components.map(function (component) {
      return '"' + escapeJqlString(component) + '"'
    }).join(', ') + ')')
  }
  if (includeNoComponent) clauses.push('component is EMPTY')
  return clauses.length > 1 ? '(' + clauses.join(' OR ') + ')' : clauses[0] || ''
}

function scopedIssueJql(components, includeNoComponent = false) {
  return ISSUE_JQL + ' AND ' + componentJqlClause(components, includeNoComponent)
}

function scopedSfdcJql(components, includeNoComponent = false) {
  return SFDC_BUG_JQL + ' AND ' + componentJqlClause(components, includeNoComponent)
}

function cohortCacheKey(components, includeNoComponent = false) {
  return JSON.stringify({
    components: components.slice().sort(function (a, b) { return a.localeCompare(b) }),
    includeNoComponent
  })
}

async function fetchIssuePages(jira, jql = ISSUE_JQL) {
  const rows = []
  let nextPageToken = null
  while (true) {
    const params = new URLSearchParams({
      jql,
      fields: ISSUE_FIELDS,
      properties: SLA_DATE_PROPERTY,
      maxResults: '100'
    })
    if (nextPageToken) params.set('nextPageToken', nextPageToken)
    const data = await jira.jiraRequest('/rest/api/3/search/jql?' + params)
    if (!data || !Array.isArray(data.issues) || !data.issues.length) break
    rows.push(...data.issues)
    if (data.isLast !== false || !data.nextPageToken) break
    nextPageToken = data.nextPageToken
  }
  return rows
}

async function fetchIssueKeySet(jira, jql) {
  const keys = new Set()
  let nextPageToken = null
  while (true) {
    const params = new URLSearchParams({ jql, fields: 'key', maxResults: '100' })
    if (nextPageToken) params.set('nextPageToken', nextPageToken)
    const data = await jira.jiraRequest('/rest/api/3/search/jql?' + params)
    if (!data || !Array.isArray(data.issues) || !data.issues.length) break
    for (const issue of data.issues) {
      const key = normalizeText(issue && issue.key)
      if (key) keys.add(key)
    }
    if (data.isLast !== false || !data.nextPageToken) break
    nextPageToken = data.nextPageToken
  }
  return keys
}

async function fetchIssueCohort(jira, selectedComponents, includeNoComponent = false) {
  const [rows, sfdcBugKeys] = await Promise.all([
    fetchIssuePages(jira, scopedIssueJql(selectedComponents, includeNoComponent)),
    fetchIssueKeySet(jira, scopedSfdcJql(selectedComponents, includeNoComponent))
  ])
  const deduplicated = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const issue = normalizeIssue(row, jira.JIRA_HOST || 'https://redhat.atlassian.net')
    issue.hasSfdcCases = sfdcBugKeys.has(issue.key)
    if (issue.key && !deduplicated.has(issue.key)) deduplicated.set(issue.key, issue)
  }
  return Array.from(deduplicated.values())
}

function freshCache(entry) {
  return entry && Date.now() - entry.cachedAt < CACHE_TTL_MS
}

function writeIssueCache(key, entry) {
  issueCaches.delete(key)
  issueCaches.set(key, entry)
  while (issueCaches.size > MAX_CACHE_ENTRIES) {
    issueCaches.delete(issueCaches.keys().next().value)
  }
}

async function loadIssueCohort(jira, selectedComponents, refresh, includeNoComponent = false) {
  const key = cohortCacheKey(selectedComponents, includeNoComponent)
  const cached = issueCaches.get(key)
  if (!refresh && freshCache(cached)) {
    writeIssueCache(key, cached)
    return { issues: cached.issues, fetchedAt: cached.fetchedAt, cacheStatus: 'hit', warning: null }
  }

  if (!issueFetchPromises.has(key)) {
    const fetchPromise = fetchIssueCohort(jira, selectedComponents, includeNoComponent).then(function (issues) {
      const fetchedAt = new Date().toISOString()
      writeIssueCache(key, { issues, fetchedAt, cachedAt: Date.now() })
      return { issues, fetchedAt, cacheStatus: 'refreshed', warning: null }
    }).finally(function () {
      issueFetchPromises.delete(key)
    })
    issueFetchPromises.set(key, fetchPromise)
  }

  try {
    return await issueFetchPromises.get(key)
  } catch (err) {
    if (cached) {
      return {
        issues: cached.issues,
        fetchedAt: cached.fetchedAt,
        cacheStatus: 'stale',
        warning: 'Jira is temporarily unavailable. Showing the most recently cached tech debt data.'
      }
    }
    throw err
  }
}

function isVulnerability(issue) {
  return normalizeText(issue && issue.issueType).toLowerCase() === 'vulnerability'
}

function enrichIssue(issue, now) {
  return isVulnerability(issue)
    ? { ...issue, ...assessVulnerabilityPolicy(issue, now) }
    : { ...issue, ...scoreBug(issue, now) }
}

function comparePriorityScores(a, b) {
  const scoreDifference = (b.priorityScore || 0) - (a.priorityScore || 0)
  if (scoreDifference !== 0) return scoreDifference

  const slaDifference = dateValue(a.slaDate, Number.MAX_SAFE_INTEGER) - dateValue(b.slaDate, Number.MAX_SAFE_INTEGER)
  if (slaDifference !== 0) return slaDifference

  const dueDifference = dateValue(a.dueDate, Number.MAX_SAFE_INTEGER) - dateValue(b.dueDate, Number.MAX_SAFE_INTEGER)
  if (dueDifference !== 0) return dueDifference

  const aCvssValue = a.scoreBreakdown && a.scoreBreakdown.cvss && a.scoreBreakdown.cvss.value
  const bCvssValue = b.scoreBreakdown && b.scoreBreakdown.cvss && b.scoreBreakdown.cvss.value
  const aCvss = Number.isFinite(aCvssValue) ? aCvssValue : -1
  const bCvss = Number.isFinite(bCvssValue) ? bCvssValue : -1
  const cvssDifference = bCvss - aCvss
  if (cvssDifference !== 0) return cvssDifference

  const createdDifference = dateValue(a.createdAt, Number.MAX_SAFE_INTEGER) - dateValue(b.createdAt, Number.MAX_SAFE_INTEGER)
  if (createdDifference !== 0) return createdDifference
  return a.key.localeCompare(b.key)
}

function compareVulnerabilitySla(a, b) {
  const slaDifference = dateValue(a.slaDate, Number.MAX_SAFE_INTEGER) - dateValue(b.slaDate, Number.MAX_SAFE_INTEGER)
  if (slaDifference !== 0) return slaDifference

  const createdDifference = dateValue(a.createdAt, Number.MAX_SAFE_INTEGER) - dateValue(b.createdAt, Number.MAX_SAFE_INTEGER)
  if (createdDifference !== 0) return createdDifference
  return a.key.localeCompare(b.key)
}

function orderPaneIssues(issues, ranked) {
  const vulnerabilities = issues.filter(isVulnerability).slice().sort(compareVulnerabilitySla)
  const bugs = issues.filter(function (issue) { return !isVulnerability(issue) }).slice().sort(comparePriorityScores)
  const assignGroup = function (group, rankGroup) {
    return group.map(function (issue, index) {
      return {
        ...issue,
        ...(ranked ? { rank: index + 1 } : {}),
        rankGroup
      }
    })
  }
  return assignGroup(vulnerabilities, 'vulnerability-sla').concat(assignGroup(bugs, 'bug-score'))
}

function buildCockpitResponse(cohort, selectedComponents, selectedIssueType, selectedTriage = 'all', now = new Date(), includeNoComponent = false) {
  const selected = new Set(selectedComponents)
  let matched = cohort.issues.filter(function (issue) {
    const matchesComponent = issue.components.some(function (component) { return selected.has(component) }) ||
      (includeNoComponent && issue.components.length === 0)
    return matchesComponent &&
      (!selectedIssueType || issue.issueType.toLowerCase() === selectedIssueType.toLowerCase())
  }).map(function (issue) { return enrichIssue(issue, now) })

  if (selectedTriage === 'exceptions') {
    matched = matched.filter(function (issue) { return isVulnerability(issue) && issue.triageFlags.length > 0 })
  }

  const inFlight = []
  const backlog = []
  for (const issue of matched) {
    const status = issue.status.toLowerCase()
    if (status === 'in progress' || status === 'review') inFlight.push(issue)
    else backlog.push(issue)
  }

  const orderedInFlight = orderPaneIssues(inFlight, false)
  const rankedBacklog = orderPaneIssues(backlog, true)

  return {
    projects: PROJECTS,
    selectedComponents,
    includeNoComponent,
    selectedIssueType: selectedIssueType || null,
    selectedTriage,
    bugScoring: { modelVersion: 'bug-v1', mode: 'active', rankingApplied: true },
    vulnerabilityPrioritization: {
      modelVersion: 'company-sla-v1',
      method: 'company-sla',
      slaSource: SLA_DATE_PROPERTY,
      policyCutover: POLICY_CUTOVER,
      policies: VULNERABILITY_SLA_POLICIES
    },
    queueScoring: {
      mode: 'grouped',
      rankingGroups: [
        { rankGroup: 'vulnerability-sla', issueType: 'Vulnerability', rankingField: 'slaDate' },
        { rankGroup: 'bug-score', issueType: 'Bug', rankingField: 'priorityScore' }
      ]
    },
    asOfDate: utcDateOnly(now),
    fetchedAt: cohort.fetchedAt,
    cacheStatus: cohort.cacheStatus,
    warning: cohort.warning,
    counts: {
      total: matched.length,
      inFlight: orderedInFlight.length,
      backlog: rankedBacklog.length,
      bugs: matched.filter(function (issue) { return issue.issueType.toLowerCase() === 'bug' }).length,
      vulnerabilities: matched.filter(function (issue) { return issue.issueType.toLowerCase() === 'vulnerability' }).length
    },
    inFlight: orderedInFlight,
    backlog: rankedBacklog
  }
}

/**
 * @openapi
 * /api/modules/releases/tech-debt/components:
 *   get:
 *     tags: [Releases]
 *     summary: List Jira components for the RHAI project
 *     description: Returns the current Jira component list for Red Hat AI All (RHAI), sorted by name.
 *     responses:
 *       200:
 *         description: Jira components available for Tech Debt Prioritization
 *       503:
 *         description: Jira client is not configured
 *       500:
 *         description: Jira component lookup failed
 */
function registerTechDebtRoutes(router, { requireAuth, requireScope, jira, storage }) {
  router.get('/components', requireAuth, requireScope('releases:read'), async function (req, res) {
    if (!jira) return res.status(503).json({ error: 'Jira client not configured' })

    try {
      const response = await jira.jiraRequest(
        '/rest/api/3/project/' + encodeURIComponent(RHAI_PROJECT) + '/components'
      )
      const rows = Array.isArray(response) ? response : (response && Array.isArray(response.values) ? response.values : [])
      const seen = new Set()
      const components = []

      for (const row of rows) {
        const name = normalizeText(row && row.name)
        if (!name || seen.has(name)) continue
        seen.add(name)
        components.push({ id: normalizeText(row && row.id) || name, name })
      }

      components.sort((a, b) => a.name.localeCompare(b.name))
      res.json({ project: RHAI_PROJECT, components })
    } catch (err) {
      console.error('[releases/tech-debt] Component fetch failed:', err.message)
      res.status(500).json({ error: 'Failed to fetch RHAI Jira components' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/tech-debt/issues:
   *   get:
   *     tags: [Releases]
   *     summary: Get open tech debt issues for selected components
   *     description: Returns unresolved Bugs and Vulnerabilities split into in-flight and backlog panes. Vulnerabilities are grouped and ordered by Jira company SLA date; Bugs are grouped and ordered by their effective priority score. Each backlog group has its own rank sequence.
   *     parameters:
   *       - in: query
   *         name: component
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         style: form
   *         explode: true
   *         description: One or more Jira component names. Optional when includeNoComponent is true.
   *       - in: query
   *         name: includeNoComponent
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include issues whose Jira component field is empty.
   *       - in: query
   *         name: refresh
   *         schema:
   *           type: boolean
   *         description: Bypass the five-minute in-memory cache.
   *       - in: query
   *         name: issueType
   *         schema:
   *           type: string
   *           enum: [Bug, Vulnerability]
   *         description: Limit the selected component cohort to Bugs or CVE vulnerabilities.
   *       - in: query
   *         name: triage
   *         schema:
   *           type: string
   *           enum: [all, exceptions]
   *         description: Limit results to vulnerabilities requiring triage because of breached or incomplete tracking data.
   *     responses:
   *       200:
   *         description: Tech debt cockpit issue data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 includeNoComponent:
   *                   type: boolean
   *                   description: Whether issues with an empty Jira component field are included.
   *                 vulnerabilityPrioritization:
   *                   type: object
   *                   description: Company SLA model metadata and effective-dated policy configuration.
   *                   properties:
   *                     modelVersion: { type: string, example: company-sla-v1 }
   *                     method: { type: string, example: company-sla }
   *                     slaSource: { type: string, example: rh-sla-dt }
   *                     policyCutover: { type: string, format: date-time, example: '2026-12-01T00:00:00.000Z' }
   *                 queueScoring:
   *                   type: object
   *                   description: Grouped queue order; each backlog rank starts at one per rank group.
   *                   properties:
   *                     mode: { type: string, example: grouped }
   *                     rankingGroups:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           rankGroup: { type: string, enum: [vulnerability-sla, bug-score] }
   *                           issueType: { type: string, enum: [Vulnerability, Bug] }
   *                           rankingField: { type: string, enum: [slaDate, priorityScore] }
   *                 backlog:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       key: { type: string, example: RHAIENG-123 }
   *                       rank: { type: integer, minimum: 1 }
   *                       rankGroup: { type: string, enum: [vulnerability-sla, bug-score] }
   *                       priorityMethod: { type: string, nullable: true, enum: [company-sla] }
   *                       slaDate: { type: string, format: date, nullable: true }
   *                       slaState: { type: string, enum: [breached, due-today, upcoming, missing] }
   *                       slaDaysUntil: { type: integer, nullable: true }
   *                       policyVersion: { type: string, nullable: true, enum: [current, dec-2026] }
   *                       policyLabel: { type: string, nullable: true }
   *                       rawScore: { type: number, nullable: true }
   *                       priorityScore: { type: number, nullable: true }
   *                       priorityBand: { type: object, nullable: true }
   *                       scoreStatus: { type: string, enum: [not-applicable, scored] }
   *                       scoreModel: { type: string, nullable: true, example: bug-v1 }
   *                       primaryBugType:
   *                         type: object
   *                         nullable: true
   *                         description: Highest-precedence Jira source classification for a Bug.
   *                         properties:
   *                           code:
   *                             type: string
   *                             enum: [dashboard-integration-e2e, build-cannot-run, customer-linked, prerelease-cve, approved-release-blocker, snyk, field-feedback, operator-e2e, devtestops-e2e, workflow-validation, unclassified-automation, component-team]
   *                           label: { type: string }
   *                       classificationSignals:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             code: { type: string }
   *                             label: { type: string }
   *                             evidence: { type: string }
   *       400:
   *         description: No component was supplied
   *       503:
   *         description: Jira is unavailable and no cached data exists
   */
  router.get('/issues', requireAuth, requireScope('releases:read'), async function (req, res) {
    const selectedComponents = selectedComponentsFromQuery(req.query)
    const includeNoComponent = includeNoComponentFromQuery(req.query)
    if (!selectedComponents.length && !includeNoComponent) {
      return res.status(400).json({ error: 'At least one component or includeNoComponent=true is required' })
    }
    if (selectedComponents.length > MAX_SELECTED_COMPONENTS) {
      return res.status(400).json({ error: 'At most ' + MAX_SELECTED_COMPONENTS + ' components may be selected' })
    }
    if (!jira || typeof jira.jiraRequest !== 'function') {
      return res.status(503).json({ error: 'Jira client not configured' })
    }
    const issueTypeFilter = selectedIssueTypeFromQuery(req.query)
    if (issueTypeFilter.error) {
      return res.status(400).json({ error: issueTypeFilter.error })
    }
    const triageFilter = selectedTriageFromQuery(req.query)
    if (triageFilter.error) {
      return res.status(400).json({ error: triageFilter.error })
    }

    try {
      const cohort = await loadIssueCohort(jira, selectedComponents, isRefreshRequested(req.query), includeNoComponent)
      res.json(buildCockpitResponse(
        cohort,
        selectedComponents,
        issueTypeFilter.value,
        triageFilter.value,
        new Date(),
        includeNoComponent
      ))
    } catch (err) {
      console.error('[releases/tech-debt] Issue fetch failed:', err.message)
      res.status(503).json({ error: 'Tech debt issues are temporarily unavailable' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/tech-debt/trends:
   *   get:
   *     tags: [Releases]
   *     summary: Get six-month tech debt flow for selected components
   *     description: Returns precomputed Jira issue creation and resolution counts for the current UTC calendar month and previous five months, grouped by component and issue category.
   *     parameters:
   *       - in: query
   *         name: component
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *         style: form
   *         explode: true
   *         description: One or more Jira component names. Optional when includeNoComponent is true.
   *       - in: query
   *         name: includeNoComponent
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Include issues whose Jira component field is empty.
   *       - in: query
   *         name: issueType
   *         schema:
   *           type: string
   *           enum: [Bug, Vulnerability]
   *     responses:
   *       200:
   *         description: Six-month Received and Resolved trend data
   *       400:
   *         description: Invalid or missing filters
   *       404:
   *         description: No trend snapshot is available
   */
  router.get('/trends', requireAuth, requireScope('releases:read'), async function (req, res) {
    const selectedComponents = selectedComponentsFromQuery(req.query)
    const includeNoComponent = includeNoComponentFromQuery(req.query)
    if (!selectedComponents.length && !includeNoComponent) {
      return res.status(400).json({ error: 'At least one component or includeNoComponent=true is required' })
    }
    if (selectedComponents.length > MAX_SELECTED_COMPONENTS) {
      return res.status(400).json({ error: 'At most ' + MAX_SELECTED_COMPONENTS + ' components may be selected' })
    }
    const issueTypeFilter = selectedIssueTypeFromQuery(req.query)
    if (issueTypeFilter.error) return res.status(400).json({ error: issueTypeFilter.error })
    if (!storage || typeof storage.readFromStorage !== 'function') {
      return res.status(503).json({ error: 'Tech debt trend storage is unavailable' })
    }

    try {
      const stored = await storage.readFromStorage(TRENDS_STORAGE_KEY)
      if (!stored) return res.status(404).json({ error: 'No tech debt trend snapshot is available' })
      const normalized = normalizeTrendSnapshot(stored)
      if (normalized.error) {
        console.error('[releases/tech-debt] Stored trend snapshot is invalid:', normalized.error)
        return res.status(500).json({ error: 'Stored tech debt trend snapshot is invalid' })
      }
      res.json(buildTrendResponse(
        normalized.snapshot,
        selectedComponents,
        issueTypeFilter.value,
        new Date(),
        includeNoComponent
      ))
    } catch (err) {
      console.error('[releases/tech-debt] Trend snapshot read failed:', err.message)
      res.status(500).json({ error: 'Failed to read tech debt trend data' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/tech-debt/trends/bulk:
   *   post:
   *     tags: [Releases]
   *     summary: Upload a six-month tech debt trend snapshot
   *     description: Validates and stores a precomputed snapshot generated by the scheduled Jira collector.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Snapshot stored successfully
   *       400:
   *         description: Invalid snapshot
   *       413:
   *         description: Snapshot exceeds 15 MB
   */
  router.post('/trends/bulk', requireAuth, requireScope('releases:write'), async function (req, res) {
    if (process.env.DEMO_MODE === 'true') {
      return res.json({ status: 'skipped', message: 'Tech debt trend ingestion is disabled in demo mode.' })
    }
    if (!storage || typeof storage.writeToStorage !== 'function') {
      return res.status(503).json({ error: 'Tech debt trend storage is unavailable' })
    }
    let serialized
    try {
      serialized = JSON.stringify(req.body || {})
    } catch {
      return res.status(400).json({ error: 'payload must be JSON serializable' })
    }
    if (Buffer.byteLength(serialized, 'utf8') > 15 * 1024 * 1024) {
      return res.status(413).json({ error: 'payload exceeds maximum size of 15 MB' })
    }
    const normalized = normalizeTrendSnapshot(req.body || {})
    if (normalized.error) return res.status(400).json({ error: normalized.error })

    try {
      await storage.writeToStorage(TRENDS_STORAGE_KEY, normalized.snapshot)
      res.json({
        status: 'ok',
        generatedAt: normalized.snapshot.generatedAt,
        issueCount: normalized.snapshot.issueCount
      })
    } catch (err) {
      console.error('[releases/tech-debt] Trend snapshot upload failed:', err.message)
      res.status(500).json({ error: 'Failed to store tech debt trend snapshot' })
    }
  })
}

registerTechDebtRoutes._test = {
  ISSUE_FIELDS,
  ISSUE_JQL,
  MAX_CACHE_ENTRIES,
  MAX_SELECTED_COMPONENTS,
  SFDC_BUG_JQL,
  POLICY_CUTOVER,
  VULNERABILITY_SLA_POLICIES,
  assessVulnerabilityPolicy,
  buildCockpitResponse,
  cohortCacheKey,
  componentJqlClause,
  comparePriorityScores,
  compareVulnerabilitySla,
  fetchIssueKeySet,
  fetchIssuePages,
  includeNoComponentFromQuery,
  normalizeIssue,
  normalizeReleaseBlockerStatus,
  orderPaneIssues,
  policyForCreatedAt,
  scopedIssueJql,
  scopedSfdcJql,
  buildTrendResponse,
  normalizeTrendSnapshot,
  resetCache: function () {
    issueCaches.clear()
    issueFetchPromises.clear()
  }
}

module.exports = registerTechDebtRoutes
