const INACTIVE_THRESHOLD_DAYS = 5
const CRITICAL_THRESHOLD_DAYS = 30
const CONCURRENCY = 5

const OPEN_EPICS_JQL =
  'project = AIPCC AND issuetype = Epic ' +
  'AND labels in ("dashboard-filed", "package") ' +
  'AND status not in (Closed, Done)'

const ALL_EPICS_JQL =
  'project = AIPCC AND issuetype = Epic ' +
  'AND labels in ("dashboard-filed", "package")'

function extractAdfText(node) {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractAdfText).join('')
  if (node && typeof node === 'object') {
    let text = node.text || ''
    if (node.content) text += extractAdfText(node.content)
    return text
  }
  return ''
}

function classifyEpic(epic, today, thresholdDays) {
  const children = epic.children
  const total = children.length
  const closed = children.filter(c => c.status === 'Closed').length

  let daysSince = null
  if (epic.last_comment.date) {
    const dt = new Date(epic.last_comment.date)
    daysSince = Math.floor((today - dt) / (1000 * 60 * 60 * 24))
  }

  const allChildrenClosed = total > 0 && closed === total
  const isInactive = daysSince !== null && daysSince > thresholdDays

  let category
  if (allChildrenClosed) {
    category = 'all_children_closed'
  } else if (isInactive && daysSince >= CRITICAL_THRESHOLD_DAYS) {
    category = 'critical'
  } else if (isInactive) {
    category = 'moderate'
  } else {
    category = 'active'
  }

  const statusCounts = {}
  for (const c of children) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
  }

  let childSummary
  if (total === 0) {
    childSummary = 'No children'
  } else {
    childSummary = `${closed}/${total} Closed`
    if (closed < total) {
      const nonClosed = Object.entries(statusCounts)
        .filter(([s]) => s !== 'Closed')
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${n} ${s}`)
      childSummary += ` (${nonClosed.join(', ')})`
    }
  }

  return {
    category,
    days_since: daysSince,
    all_children_closed: allChildrenClosed,
    child_summary: childSummary,
    closed_children: closed,
    total_children: total,
  }
}

function buildInsight(epic) {
  const cls = epic.classification
  const comment = epic.last_comment
  const status = epic.status
  const text = comment.text ? comment.text.slice(0, 150) : ''

  const parts = []
  if (cls.all_children_closed) {
    parts.push(`All ${cls.total_children} children closed.`)
    if (['In Progress', 'Review', 'Refinement'].includes(status)) {
      parts.push(`EPIC stuck in ${status}.`)
    }
  } else if (cls.total_children === 0) {
    parts.push('No child stories created.')
  }

  if (cls.days_since && cls.days_since > INACTIVE_THRESHOLD_DAYS) {
    parts.push(`Last activity ${cls.days_since} days ago by ${comment.by}.`)
  }

  if (text) {
    const lower = text.toLowerCase()
    if (['depriori', 'minor', 'nice-to-have', 'nice to have'].some(w => lower.includes(w))) {
      parts.push('Deprioritized (minor/nice-to-have).')
    } else if (['blocked', 'cannot'].some(w => lower.includes(w))) {
      parts.push('Possibly blocked.')
    } else if (lower.includes('test repo')) {
      parts.push('Package in test repo.')
    } else if (['complexity', 'complex'].some(w => lower.includes(w))) {
      parts.push('Flagged as complex build.')
    }
  }

  if (cls.total_children > 4 && !cls.all_children_closed) {
    parts.push('May have duplicate child stories.')
  }

  return parts.length > 0
    ? parts.join(' ')
    : `Status: ${status}. Last comment by ${comment.by}.`
}

async function getOpenEpics(jira) {
  const issues = await jira.fetchAllJqlResults(
    OPEN_EPICS_JQL,
    'key,summary,status,assignee,labels,updated'
  )
  return issues.map(issue => ({
    key: issue.key,
    summary: (issue.fields || {}).summary || '',
    status: ((issue.fields || {}).status || {}).name || '',
    assignee: ((issue.fields || {}).assignee || {}).displayName || 'Unassigned',
  }))
}

async function getTotalCount(jira) {
  const data = await jira.jiraRequest(
    `/rest/api/3/search/jql?${new URLSearchParams({
      jql: ALL_EPICS_JQL,
      fields: 'key',
      maxResults: '1',
    })}`
  )
  return data.total || 0
}

async function getChildren(jira, epicKey) {
  const issues = await jira.fetchAllJqlResults(
    `"Epic Link" = ${epicKey}`,
    'key,summary,status',
    { maxResults: 100 }
  )
  return issues.map(issue => ({
    key: issue.key,
    status: ((issue.fields || {}).status || {}).name || '',
    summary: (issue.fields || {}).summary || '',
  }))
}

async function getComments(jira, issueKey) {
  try {
    const data = await jira.jiraRequest(
      `/rest/api/3/issue/${issueKey}/comment?${new URLSearchParams({
        maxResults: '100',
        orderBy: '+created',
      })}`
    )
    return data.comments || []
  } catch {
    return []
  }
}

async function getLastComment(jira, epicKey) {
  const comments = await getComments(jira, epicKey)
  if (!comments.length) {
    return { date: null, date_str: '', by: '', text: '', total: 0 }
  }

  const last = comments[comments.length - 1]
  const author = ((last.author || {}).displayName) || '?'
  const dateStr = last.updated || last.created || ''

  const body = last.body || ''
  const text = body ? extractAdfText(body).slice(0, 300) : ''

  let dateIso = null
  if (dateStr) {
    try {
      dateIso = new Date(dateStr.replace('+0000', '+00:00')).toISOString()
    } catch {
      // ignore parse errors
    }
  }

  return {
    date: dateIso,
    date_str: dateStr ? dateStr.slice(0, 10) : '',
    by: author,
    text,
    total: comments.length,
  }
}

async function buildReport(jira, options = {}) {
  const thresholdDays = options.thresholdDays || INACTIVE_THRESHOLD_DAYS
  const today = new Date()
  const dateStr = options.reportDate || today.toISOString().slice(0, 10)

  console.log('[package-analysis] Building report for %s...', dateStr)

  const [rawEpics, totalCount] = await Promise.all([
    getOpenEpics(jira),
    getTotalCount(jira),
  ])

  console.log('[package-analysis] Fetching children and comments for %d EPICs...', rawEpics.length)

  const epics = []
  for (let i = 0; i < rawEpics.length; i += CONCURRENCY) {
    const batch = rawEpics.slice(i, i + CONCURRENCY)
    console.log('  [%d-%d/%d]...', i + 1, Math.min(i + CONCURRENCY, rawEpics.length), rawEpics.length)

    const results = await Promise.all(batch.map(async (raw) => {
      const [children, lastComment] = await Promise.all([
        getChildren(jira, raw.key),
        getLastComment(jira, raw.key),
      ])
      const epic = {
        key: raw.key,
        summary: raw.summary,
        summary_short: raw.summary.replace(' package update request', '').trim(),
        status: raw.status,
        assignee: raw.assignee,
        children,
        last_comment: lastComment,
      }
      epic.classification = classifyEpic(epic, today, thresholdDays)
      epic.insight = buildInsight(epic)
      return epic
    }))
    epics.push(...results)
  }

  epics.sort((a, b) => (b.classification.days_since || 0) - (a.classification.days_since || 0))

  const categories = {
    all_children_closed: [],
    critical: [],
    moderate: [],
    active: [],
  }
  for (const e of epics) {
    categories[e.classification.category].push(e)
  }

  const assigneeCounts = {}
  const statusCounts = {}
  for (const e of epics) {
    assigneeCounts[e.assignee] = (assigneeCounts[e.assignee] || 0) + 1
    statusCounts[e.status] = (statusCounts[e.status] || 0) + 1
  }

  const topAssignee = Object.entries(assigneeCounts).sort((a, b) => b[1] - a[1])

  const summary = {
    total_epics: totalCount,
    open_epics: rawEpics.length,
    closed_epics: totalCount - rawEpics.length,
    all_children_closed: categories.all_children_closed.length,
    critical: categories.critical.length,
    moderate: categories.moderate.length,
    active: categories.active.length,
    inactive_threshold_days: thresholdDays,
    top_assignee: topAssignee.length > 0 ? topAssignee[0] : null,
    status_distribution: statusCounts,
  }

  console.log('[package-analysis] Report built with %d open EPICs', epics.length)

  return {
    report_date: dateStr,
    report_time: today.toISOString(),
    summary,
    categories,
  }
}

function onboardedJql(days) {
  const safeDays = Math.floor(Math.max(1, Math.min(90, Number(days) || 7)))
  return (
    'project = AIPCC AND issuetype = Epic ' +
    'AND labels in ("dashboard-filed", "package") ' +
    'AND status in (Closed, Done) ' +
    `AND status changed to (Closed, Done) AFTER -${safeDays}d ` +
    'ORDER BY updated DESC'
  )
}

async function getPackagesOnboarded(jira, days = 7) {
  const issues = await jira.fetchAllJqlResults(
    onboardedJql(days),
    'key,summary,status,assignee,resolutiondate,updated'
  )
  return issues.map(issue => {
    const f = issue.fields || {}
    const resolved = f.resolutiondate || f.updated || ''
    return {
      key: issue.key,
      summary: (f.summary || '').replace(' package update request', '').trim(),
      assignee: (f.assignee || {}).displayName || 'Unassigned',
      status: (f.status || {}).name || '',
      resolved_date: resolved ? resolved.slice(0, 10) : '',
    }
  })
}

module.exports = {
  extractAdfText,
  classifyEpic,
  buildInsight,
  getOpenEpics,
  getTotalCount,
  getChildren,
  getComments,
  getLastComment,
  buildReport,
  getPackagesOnboarded,
  INACTIVE_THRESHOLD_DAYS,
  CRITICAL_THRESHOLD_DAYS,
}
