const { classifyBug } = require('./bug-score')

const SCHEMA_VERSION = 1
const STALE_AFTER_MS = 48 * 60 * 60 * 1000
const PROJECTS = ['RHAI', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'AIPCC']
const STORAGE_KEY = 'releases/tech-debt/trends.json'

const CATEGORY_DEFINITIONS = [
  { code: 'vulnerability', label: 'CVE / Vulnerability', issueType: 'Vulnerability', color: '#a21caf' },
  { code: 'customer-linked', label: 'Affecting customer', issueType: 'Bug', color: '#dc2626' },
  { code: 'prerelease-cve', label: 'Pre-release CVE', issueType: 'Bug', color: '#db2777' },
  { code: 'approved-release-blocker', label: 'Approved Release Blocker', issueType: 'Bug', color: '#ea580c' },
  { code: 'field-feedback', label: 'BU/SSA/field feedback', issueType: 'Bug', color: '#2563eb' },
  { code: 'devtestops-e2e', label: 'DevTestOps/E2E', issueType: 'Bug', color: '#0d9488' },
  { code: 'workflow-validation', label: 'Workflow validation', issueType: 'Bug', color: '#0891b2' },
  { code: 'component-team', label: 'Component-team/unclassified', issueType: 'Bug', color: '#64748b' }
]

const CATEGORY_BY_CODE = new Map(CATEGORY_DEFINITIONS.map(function (category) {
  return [category.code, category]
}))

function normalizeText(value) {
  return String(value || '').trim()
}

function monthId(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 7)
}

function monthStart(month) {
  return month + '-01'
}

function sixMonthWindow(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.getTime())) throw new Error('A valid date is required')
  const currentMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const months = []
  for (let offset = 5; offset >= 0; offset--) {
    months.push(new Date(Date.UTC(
      currentMonth.getUTCFullYear(),
      currentMonth.getUTCMonth() - offset,
      1
    )).toISOString().slice(0, 7))
  }
  const endExclusive = new Date(Date.UTC(
    currentMonth.getUTCFullYear(),
    currentMonth.getUTCMonth() + 1,
    1
  )).toISOString().slice(0, 10)
  return {
    months,
    startDate: monthStart(months[0]),
    endExclusive,
    timezone: 'UTC'
  }
}

function normalizeNamedRows(rows) {
  if (!Array.isArray(rows)) return []
  const names = []
  const seen = new Set()
  for (const row of rows) {
    const name = normalizeText(row && (row.name || row.value || row))
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function releaseBlockerStatus(value) {
  if (!value) return null
  if (typeof value === 'string') return normalizeText(value) || null
  const optionId = normalizeText(value.id)
  return normalizeText(value.value || value.name || {
    '16772': 'Approved',
    '16773': 'Proposed',
    '16774': 'Rejected'
  }[optionId]) || null
}

function eventFromIssue(issue, sfdcKeys, window) {
  const fields = issue && issue.fields || {}
  const key = normalizeText(issue && issue.key)
  const issueType = normalizeText(fields.issuetype && fields.issuetype.name)
  if (!key || !['Bug', 'Vulnerability'].includes(issueType)) return null

  const validMonths = new Set(window.months)
  const createdMonth = monthId(fields.created)
  const resolvedMonth = monthId(fields.resolutiondate)
  const received = validMonths.has(createdMonth) ? createdMonth : null
  const resolved = validMonths.has(resolvedMonth) ? resolvedMonth : null
  if (!received && !resolved) return null

  const components = normalizeNamedRows(fields.components)
  if (!components.length) return null

  let category = CATEGORY_BY_CODE.get('vulnerability')
  if (issueType === 'Bug') {
    const classification = classifyBug({
      hasSfdcCases: sfdcKeys.has(key),
      labels: Array.isArray(fields.labels) ? fields.labels : [],
      reporter: fields.reporter ? {
        id: normalizeText(fields.reporter.accountId || fields.reporter.key || fields.reporter.name),
        name: normalizeText(fields.reporter.displayName || fields.reporter.name)
      } : null,
      releaseBlockerStatus: releaseBlockerStatus(fields.customfield_10847)
    })
    category = CATEGORY_BY_CODE.get(classification.primaryBugType.code)
  }

  if (!category) return null
  return {
    key,
    issueType,
    category: category.code,
    components,
    createdMonth: received,
    resolvedMonth: resolved
  }
}

function buildTrendSnapshot(rawIssues, sfdcKeys = new Set(), now = new Date()) {
  const window = sixMonthWindow(now)
  const issueMap = new Map()
  for (const issue of Array.isArray(rawIssues) ? rawIssues : []) {
    const key = normalizeText(issue && issue.key)
    if (key && !issueMap.has(key)) issueMap.set(key, issue)
  }
  const events = []
  for (const issue of issueMap.values()) {
    const event = eventFromIssue(issue, sfdcKeys, window)
    if (event) events.push(event)
  }
  events.sort(function (a, b) { return a.key.localeCompare(b.key) })
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    window,
    projects: PROJECTS,
    issueCount: events.length,
    events
  }
}

function normalizeEvent(value, validMonths) {
  if (!value || typeof value !== 'object') return null
  const key = normalizeText(value.key)
  const issueType = normalizeText(value.issueType)
  const category = normalizeText(value.category)
  const definition = CATEGORY_BY_CODE.get(category)
  if (!key || !['Bug', 'Vulnerability'].includes(issueType) || !definition || definition.issueType !== issueType) return null
  const components = normalizeNamedRows(value.components)
  if (!components.length) return null
  const createdMonth = value.createdMonth === null || value.createdMonth === undefined
    ? null
    : normalizeText(value.createdMonth)
  const resolvedMonth = value.resolvedMonth === null || value.resolvedMonth === undefined
    ? null
    : normalizeText(value.resolvedMonth)
  if (createdMonth && !validMonths.has(createdMonth)) return null
  if (resolvedMonth && !validMonths.has(resolvedMonth)) return null
  if (!createdMonth && !resolvedMonth) return null
  return { key, issueType, category, components, createdMonth, resolvedMonth }
}

function normalizeTrendSnapshot(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'payload must be an object' }
  if (Number(body.schemaVersion) !== SCHEMA_VERSION) return { error: 'schemaVersion must be 1' }
  const generatedAt = new Date(body.generatedAt)
  if (Number.isNaN(generatedAt.getTime())) return { error: 'generatedAt must be a valid timestamp' }
  const months = body.window && Array.isArray(body.window.months) ? body.window.months.map(normalizeText) : []
  if (months.length !== 6 || new Set(months).size !== 6 || months.some(function (month) { return !/^\d{4}-\d{2}$/.test(month) })) {
    return { error: 'window.months must contain six unique YYYY-MM values' }
  }
  const validMonths = new Set(months)
  if (!Array.isArray(body.events)) return { error: 'events must be an array' }
  const events = []
  const seenKeys = new Set()
  for (const value of body.events) {
    const event = normalizeEvent(value, validMonths)
    if (!event) return { error: 'events contains an invalid record' }
    if (seenKeys.has(event.key)) return { error: 'events contains duplicate Jira keys' }
    seenKeys.add(event.key)
    events.push(event)
  }
  const startDate = normalizeText(body.window.startDate) || monthStart(months[0])
  const endExclusive = normalizeText(body.window.endExclusive)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endExclusive)) {
    return { error: 'window dates must use YYYY-MM-DD' }
  }
  return {
    snapshot: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: generatedAt.toISOString(),
      window: { months, startDate, endExclusive, timezone: 'UTC' },
      projects: PROJECTS,
      issueCount: events.length,
      events
    }
  }
}

function emptyMetric(categoryCodes) {
  return {
    total: 0,
    categories: Object.fromEntries(categoryCodes.map(function (code) { return [code, 0] }))
  }
}

function buildTrendResponse(snapshot, selectedComponents, selectedIssueType, now = new Date()) {
  const componentSet = new Set(selectedComponents)
  const categories = CATEGORY_DEFINITIONS.filter(function (category) {
    return !selectedIssueType || category.issueType === selectedIssueType
  })
  const categoryCodes = categories.map(function (category) { return category.code })
  const matched = snapshot.events.filter(function (event) {
    return (!selectedIssueType || event.issueType === selectedIssueType) &&
      event.components.some(function (component) { return componentSet.has(component) })
  })

  const panels = selectedComponents.map(function (component) {
    const months = snapshot.window.months.map(function (month) {
      return { month, received: emptyMetric(categoryCodes), resolved: emptyMetric(categoryCodes) }
    })
    const byMonth = new Map(months.map(function (month) { return [month.month, month] }))
    for (const event of matched) {
      if (!event.components.includes(component)) continue
      if (event.createdMonth && byMonth.has(event.createdMonth)) {
        const metric = byMonth.get(event.createdMonth).received
        metric.total += 1
        metric.categories[event.category] += 1
      }
      if (event.resolvedMonth && byMonth.has(event.resolvedMonth)) {
        const metric = byMonth.get(event.resolvedMonth).resolved
        metric.total += 1
        metric.categories[event.category] += 1
      }
    }
    return {
      component,
      totals: {
        received: months.reduce(function (sum, month) { return sum + month.received.total }, 0),
        resolved: months.reduce(function (sum, month) { return sum + month.resolved.total }, 0)
      },
      months
    }
  })

  const generatedAt = Date.parse(snapshot.generatedAt)
  const ageMs = Number.isNaN(generatedAt) ? Number.MAX_SAFE_INTEGER : now.getTime() - generatedAt
  const stale = ageMs > STALE_AFTER_MS
  return {
    generatedAt: snapshot.generatedAt,
    window: snapshot.window,
    selectedComponents,
    selectedIssueType: selectedIssueType || null,
    categories,
    totals: {
      received: matched.filter(function (event) { return Boolean(event.createdMonth) }).length,
      resolved: matched.filter(function (event) { return Boolean(event.resolvedMonth) }).length
    },
    components: panels,
    issueCount: matched.length,
    stale,
    warning: stale ? 'Tech debt flow data is more than 48 hours old.' : null
  }
}

module.exports = {
  CATEGORY_DEFINITIONS,
  PROJECTS,
  SCHEMA_VERSION,
  STALE_AFTER_MS,
  STORAGE_KEY,
  buildTrendResponse,
  buildTrendSnapshot,
  eventFromIssue,
  monthId,
  normalizeTrendSnapshot,
  sixMonthWindow
}
