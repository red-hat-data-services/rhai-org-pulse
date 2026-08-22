export var PAGE_SIZE = 25
export var MAX_VISIBLE_COMPONENT_CHIPS = 2

var SOURCE_SHORT = {
  AIBU_Feedback: 'BU',
  AISSA_Feedback: 'SSA'
}

export function emptyFilters() {
  return {
    search: '',
    issueType: [],
    component: [],
    priority: [],
    status: [],
    source: [],
    sfdc: []
  }
}

export var FILTER_KEYS = ['issueType', 'component', 'priority', 'status', 'source', 'sfdc']

export function hasActiveFilters(filters) {
  if (!filters) return false
  if (filters.search) return true
  for (var i = 0; i < FILTER_KEYS.length; i++) {
    var v = filters[FILTER_KEYS[i]]
    if (Array.isArray(v) ? v.length > 0 : !!v) return true
  }
  return false
}

export function uniqueSortedValues(issues, getter) {
  var seen = {}
  var values = []
  for (var i = 0; i < (issues || []).length; i++) {
    var extracted = getter(issues[i]) || []
    for (var j = 0; j < extracted.length; j++) {
      var val = extracted[j]
      if (val && !seen[val]) {
        seen[val] = true
        values.push(val)
      }
    }
  }
  values.sort()
  return values
}

export function collectFilterOptions(issues) {
  return {
    issueType: uniqueSortedValues(issues, function(issue) { return issue.issueType ? [issue.issueType] : [] }),
    component: uniqueSortedValues(issues, function(issue) { return issue.components || [] }),
    priority: uniqueSortedValues(issues, function(issue) { return issue.priority ? [issue.priority] : [] }),
    status: uniqueSortedValues(issues, function(issue) { return issue.status ? [issue.status] : [] }),
    source: uniqueSortedValues(issues, function(issue) { return issue.feedbackLabels || [] }),
    sfdc: collectSfdcOptions(issues)
  }
}

export var SFDC_BUCKETS = [
  { id: '0', label: 'None', min: 0, max: 0 },
  { id: '1-2', label: '1–2', min: 1, max: 2 },
  { id: '3-5', label: '3–5', min: 3, max: 5 },
  { id: '6-10', label: '6–10', min: 6, max: 10 },
  { id: '11+', label: '11+', min: 11, max: Infinity }
]

export function sfdcBucketId(count) {
  var n = count || 0
  for (var i = 0; i < SFDC_BUCKETS.length; i++) {
    if (n >= SFDC_BUCKETS[i].min && n <= SFDC_BUCKETS[i].max) return SFDC_BUCKETS[i].id
  }
  return '0'
}

export function sfdcBucketLabel(id) {
  for (var i = 0; i < SFDC_BUCKETS.length; i++) {
    if (SFDC_BUCKETS[i].id === id) return SFDC_BUCKETS[i].label
  }
  return id
}

export function collectSfdcOptions(issues) {
  var seen = {}
  for (var i = 0; i < (issues || []).length; i++) {
    var count = issues[i].sfdcCasesCount || (issues[i].hasSfdcCases ? 1 : 0)
    seen[sfdcBucketId(count)] = true
  }
  var opts = []
  for (var j = 0; j < SFDC_BUCKETS.length; j++) {
    if (seen[SFDC_BUCKETS[j].id]) opts.push(SFDC_BUCKETS[j].id)
  }
  return opts
}

export function issueMatchesSearch(issue, query) {
  var q = (query || '').trim().toLowerCase()
  if (!q) return true
  var haystacks = [
    issue.key,
    issue.summary,
    issue.assignee,
    issue.reporter,
    issue.issueType,
    (issue.components || []).join(' '),
    (issue.feedbackLabels || []).join(' ')
  ]
  for (var i = 0; i < haystacks.length; i++) {
    if ((haystacks[i] || '').toLowerCase().indexOf(q) !== -1) return true
  }
  return false
}

function matchesMulti(selected, value) {
  if (!selected || !selected.length) return true
  return selected.indexOf(value) !== -1
}

function matchesMultiArray(selected, values) {
  if (!selected || !selected.length) return true
  for (var i = 0; i < (values || []).length; i++) {
    if (selected.indexOf(values[i]) !== -1) return true
  }
  return false
}

export function filterIssues(issues, filters) {
  var f = filters || emptyFilters()
  return (issues || []).filter(function(issue) {
    if (!issueMatchesSearch(issue, f.search)) return false
    if (!matchesMulti(f.issueType, issue.issueType)) return false
    if (!matchesMulti(f.priority, issue.priority)) return false
    if (!matchesMulti(f.status, issue.status)) return false
    if (!matchesMultiArray(f.component, issue.components)) return false
    if (!matchesMultiArray(f.source, issue.feedbackLabels)) return false
    if (f.sfdc && f.sfdc.length) {
      var count = issue.sfdcCasesCount || (issue.hasSfdcCases ? 1 : 0)
      if (f.sfdc.indexOf(sfdcBucketId(count)) === -1) return false
    }
    return true
  })
}

function sortValue(issue, key) {
  if (key === 'component') return (issue.components || []).join(', ')
  if (key === 'source') return (issue.feedbackLabels || []).join(', ')
  if (key === 'hasSfdcCases') return issue.sfdcCasesCount || (issue.hasSfdcCases ? 1 : 0)
  return issue[key] || ''
}

export function sortIssues(issues, sortKey, sortDir) {
  var arr = (issues || []).slice()
  var key = sortKey || 'created'
  var dir = sortDir === 'asc' ? 1 : -1
  arr.sort(function(a, b) {
    var aVal = sortValue(a, key)
    var bVal = sortValue(b, key)
    if (aVal < bVal) return -1 * dir
    if (aVal > bVal) return 1 * dir
    return 0
  })
  return arr
}

export function paginate(items, page, pageSize) {
  var size = pageSize || PAGE_SIZE
  var total = (items || []).length
  var pageCount = Math.max(1, Math.ceil(total / size))
  var safePage = Math.min(Math.max(1, page || 1), pageCount)
  var start = (safePage - 1) * size
  return {
    page: safePage,
    pageCount: pageCount,
    pageSize: size,
    total: total,
    start: total ? start + 1 : 0,
    end: Math.min(start + size, total),
    items: (items || []).slice(start, start + size)
  }
}

export function toggleFilterValue(arr, value) {
  var idx = arr.indexOf(value)
  if (idx === -1) {
    arr.push(value)
  } else {
    arr.splice(idx, 1)
  }
}

export function sourceShortLabel(label) {
  return SOURCE_SHORT[label] || label
}

export function typeBadgeClass(issueType) {
  var t = (issueType || '').toLowerCase()
  if (t === 'bug') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  if (t.indexOf('feature') !== -1 || t === 'story' || t === 'rfe') {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  }
  if (t === 'epic') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
  if (t === 'task' || t === 'sub-task' || t === 'subtask') {
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
}

export function statusClasses(category) {
  var c = (category || '').toLowerCase()
  if (c === 'done') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  if (c === 'in progress') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

export function priorityDot(priority) {
  var p = (priority || '').toLowerCase()
  if (p === 'blocker' || p === 'critical') return 'bg-red-500'
  if (p === 'major') return 'bg-orange-400'
  if (p === 'normal' || p === 'minor') return 'bg-yellow-400'
  if (p === 'trivial') return 'bg-green-400'
  return 'bg-gray-300 dark:bg-gray-500'
}

export function formatDate(iso) {
  if (!iso) return ''
  var d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function visibleChips(items, max) {
  var list = items || []
  var limit = max || MAX_VISIBLE_COMPONENT_CHIPS
  return {
    shown: list.slice(0, limit),
    overflow: Math.max(0, list.length - limit),
    overflowTitle: list.slice(limit).join(', ')
  }
}
