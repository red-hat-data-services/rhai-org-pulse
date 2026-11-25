const { classifyBug } = require('./bug-score')

const SCHEMA_VERSION = 1
const STALE_AFTER_MS = 48 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const PROJECTS = ['RHAI', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'AIPCC']
const STORAGE_KEY = 'releases/tech-debt/trends.json'
const NO_COMPONENT_LABEL = 'No component'
const NO_FIX_VERSION_LABEL = 'No Fix Version'
const MULTIPLE_FIX_VERSIONS_LABEL = 'Multiple Fix Versions'
const NO_AFFECTS_VERSION_LABEL = 'No Affects Version'
const MULTIPLE_AFFECTS_VERSIONS_LABEL = 'Multiple Affects Versions'

const CATEGORY_DEFINITIONS = [
  { code: 'vulnerability', label: 'CVE / Vulnerability', issueType: 'Vulnerability', color: '#a21caf' },
  { code: 'dashboard-integration-e2e', label: 'Dashboard Integration E2E', issueType: 'Bug', color: '#be123c' },
  { code: 'build-cannot-run', label: 'Build Cannot Run', issueType: 'Bug', color: '#b45309' },
  { code: 'customer-linked', label: 'Affecting customer', issueType: 'Bug', color: '#dc2626' },
  { code: 'prerelease-cve', label: 'Pre-release CVE', issueType: 'Bug', color: '#db2777' },
  { code: 'approved-release-blocker', label: 'Approved Release Blocker', issueType: 'Bug', color: '#ea580c' },
  { code: 'snyk', label: 'Snyk', issueType: 'Bug', color: '#7c3aed' },
  { code: 'field-feedback', label: 'BU/SSA/field feedback', issueType: 'Bug', color: '#2563eb' },
  { code: 'operator-e2e', label: 'Operator auto E2E blocker', issueType: 'Bug', color: '#047857' },
  { code: 'devtestops-e2e', label: 'DevTestOps automated test failure', issueType: 'Bug', color: '#0d9488' },
  { code: 'workflow-validation', label: 'Workflow validation', issueType: 'Bug', color: '#0891b2' },
  { code: 'component-team', label: 'Component-team/unclassified', issueType: 'Bug', color: '#64748b' },
  { code: 'unclassified-automation', label: 'Unclassified automation', issueType: 'Bug', color: '#78716c' }
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

function utcDate(value) {
  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()))
}

function isoDate(value) {
  const parsed = utcDate(value)
  return parsed ? parsed.toISOString().slice(0, 10) : null
}

function isoWeekStart(value) {
  const parsed = utcDate(value)
  if (!parsed) return null
  const daysSinceMonday = (parsed.getUTCDay() + 6) % 7
  parsed.setUTCDate(parsed.getUTCDate() - daysSinceMonday)
  return parsed
}

function isoWeekId(value) {
  const parsed = utcDate(value)
  if (!parsed) return null
  const isoDay = parsed.getUTCDay() || 7
  parsed.setUTCDate(parsed.getUTCDate() + 4 - isoDay)
  const isoYear = parsed.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil((((parsed - yearStart) / DAY_MS) + 1) / 7)
  return String(isoYear) + '-W' + String(week).padStart(2, '0')
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

function buildWeeklyBugSeries(rawIssues, window, now) {
  const generatedAt = now instanceof Date ? now : new Date(now)
  const windowStart = new Date(window.startDate + 'T00:00:00.000Z')
  const windowEnd = new Date(window.endExclusive + 'T00:00:00.000Z')
  const throughDate = utcDate(generatedAt)
  const firstWeekStart = isoWeekStart(windowStart)
  const lastWeekStart = isoWeekStart(throughDate)
  const weeks = []
  const byWeek = new Map()

  for (let cursor = firstWeekStart; cursor && lastWeekStart && cursor <= lastWeekStart; cursor = new Date(cursor.getTime() + 7 * DAY_MS)) {
    const week = {
      week: isoWeekId(cursor),
      startDate: isoDate(cursor),
      created: 0,
      resolved: 0
    }
    weeks.push(week)
    byWeek.set(week.week, week)
  }

  function increment(value, metric) {
    if (!value) return
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return
    if (parsed < windowStart || parsed >= windowEnd || parsed > generatedAt) return
    const bucket = byWeek.get(isoWeekId(parsed))
    if (bucket) bucket[metric] += 1
  }

  for (const issue of rawIssues) {
    const fields = issue && issue.fields || {}
    if (normalizeText(fields.issuetype && fields.issuetype.name) !== 'Bug') continue
    increment(fields.created, 'created')
    increment(fields.resolutiondate, 'resolved')
  }

  return {
    granularity: 'iso-week',
    timezone: 'UTC',
    startDate: window.startDate,
    throughDate: isoDate(generatedAt),
    totals: {
      created: weeks.reduce(function (sum, week) { return sum + week.created }, 0),
      resolved: weeks.reduce(function (sum, week) { return sum + week.resolved }, 0)
    },
    weeks
  }
}

function buildBugVersionDistribution(rawIssues, includedBugKeys, fieldName, noValueLabel, multipleValuesLabel) {
  const counts = new Map()
  for (const issue of rawIssues) {
    const key = normalizeText(issue && issue.key)
    if (!includedBugKeys.has(key)) continue
    const versions = normalizeNamedRows(issue && issue.fields && issue.fields[fieldName])
    const label = versions.length === 0
      ? noValueLabel
      : (versions.length === 1 ? versions[0] : multipleValuesLabel)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  const versions = Array.from(counts.entries()).map(function ([version, count]) {
    return { version, count }
  }).sort(function (a, b) {
    return b.count - a.count || a.version.localeCompare(b.version)
  })
  return {
    sourceField: fieldName,
    assignment: 'one-bucket-per-issue',
    total: versions.reduce(function (sum, row) { return sum + row.count }, 0),
    versions
  }
}

function buildBugFixVersionDistribution(rawIssues, includedBugKeys) {
  return buildBugVersionDistribution(
    rawIssues,
    includedBugKeys,
    'fixVersions',
    NO_FIX_VERSION_LABEL,
    MULTIPLE_FIX_VERSIONS_LABEL
  )
}

function buildBugAffectsVersionDistribution(rawIssues, includedBugKeys) {
  return buildBugVersionDistribution(
    rawIssues,
    includedBugKeys,
    'versions',
    NO_AFFECTS_VERSION_LABEL,
    MULTIPLE_AFFECTS_VERSIONS_LABEL
  )
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
  const includedBugKeys = new Set(events.filter(function (event) {
    return event.issueType === 'Bug'
  }).map(function (event) { return event.key }))
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    window,
    projects: PROJECTS,
    issueCount: events.length,
    events,
    weeklyBugs: buildWeeklyBugSeries(issueMap.values(), window, now),
    bugFixVersions: buildBugFixVersionDistribution(issueMap.values(), includedBugKeys),
    bugAffectsVersions: buildBugAffectsVersionDistribution(issueMap.values(), includedBugKeys)
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

function normalizeWeeklyBugs(value, window, generatedAt) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'weeklyBugs must be an object' }
  if (value.granularity !== 'iso-week') return { error: 'weeklyBugs.granularity must be iso-week' }
  if (value.timezone !== 'UTC') return { error: 'weeklyBugs.timezone must be UTC' }
  const startDate = normalizeText(value.startDate)
  const throughDate = normalizeText(value.throughDate)
  if (startDate !== window.startDate) return { error: 'weeklyBugs.startDate must match window.startDate' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(throughDate)) return { error: 'weeklyBugs.throughDate must use YYYY-MM-DD' }
  const through = utcDate(throughDate)
  const windowStart = utcDate(window.startDate)
  const windowEnd = utcDate(window.endExclusive)
  if (!through || through < windowStart || through >= windowEnd) {
    return { error: 'weeklyBugs.throughDate must fall inside the trend window' }
  }
  if (throughDate !== isoDate(generatedAt)) return { error: 'weeklyBugs.throughDate must match generatedAt in UTC' }
  if (!Array.isArray(value.weeks) || !value.weeks.length) return { error: 'weeklyBugs.weeks must be a non-empty array' }

  const weeks = []
  let previousStart = null
  for (const row of value.weeks) {
    const week = normalizeText(row && row.week)
    const weekStart = normalizeText(row && row.startDate)
    const parsedStart = /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? utcDate(weekStart) : null
    const created = Number(row && row.created)
    const resolved = Number(row && row.resolved)
    if (!/^\d{4}-W\d{2}$/.test(week) || !parsedStart || parsedStart.getUTCDay() !== 1 || isoWeekId(parsedStart) !== week) {
      return { error: 'weeklyBugs.weeks contains an invalid ISO week' }
    }
    if (!Number.isInteger(created) || created < 0 || !Number.isInteger(resolved) || resolved < 0) {
      return { error: 'weeklyBugs week counts must be non-negative integers' }
    }
    if (previousStart && parsedStart.getTime() - previousStart.getTime() !== 7 * DAY_MS) {
      return { error: 'weeklyBugs.weeks must be contiguous and ordered' }
    }
    previousStart = parsedStart
    weeks.push({ week, startDate: weekStart, created, resolved })
  }

  const firstStart = utcDate(weeks[0].startDate)
  const lastStart = utcDate(weeks[weeks.length - 1].startDate)
  if (windowStart < firstStart || windowStart >= new Date(firstStart.getTime() + 7 * DAY_MS)) {
    return { error: 'weeklyBugs.weeks must include the trend window start' }
  }
  if (lastStart.getTime() !== isoWeekStart(through).getTime()) {
    return { error: 'weeklyBugs.weeks must end with the throughDate week' }
  }

  const totals = {
    created: weeks.reduce(function (sum, week) { return sum + week.created }, 0),
    resolved: weeks.reduce(function (sum, week) { return sum + week.resolved }, 0)
  }
  if (Number(value.totals && value.totals.created) !== totals.created || Number(value.totals && value.totals.resolved) !== totals.resolved) {
    return { error: 'weeklyBugs.totals must equal the sum of weekly counts' }
  }
  return {
    weeklyBugs: {
      granularity: 'iso-week',
      timezone: 'UTC',
      startDate,
      throughDate,
      totals,
      weeks
    }
  }
}

function normalizeBugVersionDistribution(value, propertyName, sourceField) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: propertyName + ' must be an object' }
  if (value.sourceField !== sourceField) return { error: propertyName + '.sourceField must be ' + sourceField }
  if (value.assignment !== 'one-bucket-per-issue') return { error: propertyName + '.assignment must be one-bucket-per-issue' }
  if (!Array.isArray(value.versions)) return { error: propertyName + '.versions must be an array' }
  const versions = []
  const seen = new Set()
  for (const row of value.versions) {
    const version = normalizeText(row && row.version)
    const count = Number(row && row.count)
    if (!version || seen.has(version) || !Number.isInteger(count) || count <= 0) {
      return { error: propertyName + '.versions contains an invalid record' }
    }
    seen.add(version)
    versions.push({ version, count })
  }
  const total = versions.reduce(function (sum, row) { return sum + row.count }, 0)
  if (!Number.isInteger(Number(value.total)) || Number(value.total) !== total) {
    return { error: propertyName + '.total must equal the sum of version counts' }
  }
  versions.sort(function (a, b) { return b.count - a.count || a.version.localeCompare(b.version) })
  return {
    distribution: {
      sourceField,
      assignment: 'one-bucket-per-issue',
      total,
      versions
    }
  }
}

function normalizeBugFixVersions(value) {
  const normalized = normalizeBugVersionDistribution(value, 'bugFixVersions', 'fixVersions')
  return normalized.error ? normalized : { bugFixVersions: normalized.distribution }
}

function normalizeBugAffectsVersions(value) {
  const normalized = normalizeBugVersionDistribution(value, 'bugAffectsVersions', 'versions')
  return normalized.error ? normalized : { bugAffectsVersions: normalized.distribution }
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
  const window = { months, startDate, endExclusive, timezone: 'UTC' }
  let weeklyBugs
  if (body.weeklyBugs !== undefined) {
    const normalizedWeekly = normalizeWeeklyBugs(body.weeklyBugs, window, generatedAt)
    if (normalizedWeekly.error) return { error: normalizedWeekly.error }
    weeklyBugs = normalizedWeekly.weeklyBugs
  }
  let bugFixVersions
  if (body.bugFixVersions !== undefined) {
    const normalizedFixVersions = normalizeBugFixVersions(body.bugFixVersions)
    if (normalizedFixVersions.error) return { error: normalizedFixVersions.error }
    bugFixVersions = normalizedFixVersions.bugFixVersions
  }
  let bugAffectsVersions
  if (body.bugAffectsVersions !== undefined) {
    const normalizedAffectsVersions = normalizeBugAffectsVersions(body.bugAffectsVersions)
    if (normalizedAffectsVersions.error) return { error: normalizedAffectsVersions.error }
    bugAffectsVersions = normalizedAffectsVersions.bugAffectsVersions
  }
  return {
    snapshot: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: generatedAt.toISOString(),
      window,
      projects: PROJECTS,
      issueCount: events.length,
      events,
      ...(weeklyBugs ? { weeklyBugs } : {}),
      ...(bugFixVersions ? { bugFixVersions } : {}),
      ...(bugAffectsVersions ? { bugAffectsVersions } : {})
    }
  }
}

function emptyMetric(categoryCodes) {
  return {
    total: 0,
    categories: Object.fromEntries(categoryCodes.map(function (code) { return [code, 0] }))
  }
}

function buildTrendResponse(snapshot, selectedComponents, selectedIssueType, now = new Date(), includeNoComponent = false) {
  const componentSet = new Set(selectedComponents)
  const categories = CATEGORY_DEFINITIONS.filter(function (category) {
    return !selectedIssueType || category.issueType === selectedIssueType
  })
  const categoryCodes = categories.map(function (category) { return category.code })
  const matched = snapshot.events.filter(function (event) {
    return (!selectedIssueType || event.issueType === selectedIssueType) &&
      (event.components.some(function (component) { return componentSet.has(component) }) ||
        (includeNoComponent && event.components.length === 0))
  })

  const panelSelections = selectedComponents.map(function (component) {
    return { component, noComponent: false }
  })
  if (includeNoComponent) panelSelections.push({ component: NO_COMPONENT_LABEL, noComponent: true })

  const panels = panelSelections.map(function (selection) {
    const months = snapshot.window.months.map(function (month) {
      return { month, received: emptyMetric(categoryCodes), resolved: emptyMetric(categoryCodes) }
    })
    const byMonth = new Map(months.map(function (month) { return [month.month, month] }))
    for (const event of matched) {
      const belongsToPanel = selection.noComponent
        ? event.components.length === 0
        : event.components.includes(selection.component)
      if (!belongsToPanel) continue
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
      component: selection.component,
      noComponent: selection.noComponent,
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
    includeNoComponent,
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

function buildWeeklyBugTrendResponse(snapshot, now = new Date()) {
  if (!snapshot.weeklyBugs) return null
  const generatedAt = Date.parse(snapshot.generatedAt)
  const ageMs = Number.isNaN(generatedAt) ? Number.MAX_SAFE_INTEGER : now.getTime() - generatedAt
  const stale = ageMs > STALE_AFTER_MS
  return {
    generatedAt: snapshot.generatedAt,
    window: {
      ...snapshot.window,
      throughDate: snapshot.weeklyBugs.throughDate
    },
    projects: PROJECTS,
    issueType: 'Bug',
    componentScope: 'all',
    includeNoComponent: true,
    granularity: 'iso-week',
    totals: snapshot.weeklyBugs.totals,
    weeks: snapshot.weeklyBugs.weeks,
    bugFixVersions: snapshot.bugFixVersions || null,
    bugAffectsVersions: snapshot.bugAffectsVersions || null,
    stale,
    warning: stale ? 'Tech debt weekly Bug trend data is more than 48 hours old.' : null
  }
}

module.exports = {
  CATEGORY_DEFINITIONS,
  MULTIPLE_AFFECTS_VERSIONS_LABEL,
  MULTIPLE_FIX_VERSIONS_LABEL,
  NO_AFFECTS_VERSION_LABEL,
  NO_FIX_VERSION_LABEL,
  NO_COMPONENT_LABEL,
  PROJECTS,
  SCHEMA_VERSION,
  STALE_AFTER_MS,
  STORAGE_KEY,
  buildTrendResponse,
  buildTrendSnapshot,
  buildBugAffectsVersionDistribution,
  buildBugFixVersionDistribution,
  buildWeeklyBugSeries,
  buildWeeklyBugTrendResponse,
  eventFromIssue,
  isoWeekId,
  isoWeekStart,
  monthId,
  normalizeWeeklyBugs,
  normalizeBugAffectsVersions,
  normalizeBugFixVersions,
  normalizeTrendSnapshot,
  sixMonthWindow
}
