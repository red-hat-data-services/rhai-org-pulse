import { computed } from 'vue'

// ─── JQL constants (mirrored from server) ───────────────────────────────────

const BASE_JQL = [
  'project in (RHAIENG, RHOAIENG, INFERENG, AIPCC)',
  '(labels not in (RHOAI-releases, RHOAI-internal, devtestops-service) OR labels is EMPTY)',
  'component not in (Documentation, PXE, Devops, testops)',
  'issuetype in (vulnerability)',
  'status not in (Closed, Resolved)'
].join(' AND ')

// ─── JQL helpers ─────────────────────────────────────────────────────────────

function jqlUrl(searchBase, jql) {
  return searchBase + encodeURIComponent(jql)
}

function quoteComponent(name) {
  return name === 'None' ? ' AND component is EMPTY' : ` AND component = "${name}"`
}

function quoteVersion(name) {
  return name === 'None' ? ' AND "Target Version" is EMPTY' : ` AND "Target Version" = "${name}"`
}

function quoteAssignee(name) {
  return name === 'Unassigned' ? ' AND assignee is EMPTY' : ` AND assignee = "${name}"`
}

function quoteStatus(name) {
  return ` AND status = "${name}"`
}

/**
 * Build a JQL fragment from active filters to append to drill-down URLs.
 * Each active filter field adds an AND clause.
 */
function buildFilterJql(activeFilters) {
  const parts = []
  for (const [field, values] of Object.entries(activeFilters)) {
    if (!values || values.length === 0) continue
    if (field === 'component') {
      if (values.length === 1) {
        parts.push(quoteComponent(values[0]))
      } else {
        const clauses = values.map(v => v === 'None' ? 'component is EMPTY' : `component = "${v}"`)
        parts.push(` AND (${clauses.join(' OR ')})`)
      }
    } else if (field === 'versions') {
      if (values.length === 1) {
        parts.push(quoteVersion(values[0]))
      } else {
        const clauses = values.map(v => v === 'None' ? '"Target Version" is EMPTY' : `"Target Version" = "${v}"`)
        parts.push(` AND (${clauses.join(' OR ')})`)
      }
    } else if (field === 'assignee') {
      if (values.length === 1) {
        parts.push(quoteAssignee(values[0]))
      } else {
        const clauses = values.map(v => v === 'Unassigned' ? 'assignee is EMPTY' : `assignee = "${v}"`)
        parts.push(` AND (${clauses.join(' OR ')})`)
      }
    } else if (field === 'status') {
      if (values.length === 1) {
        parts.push(quoteStatus(values[0]))
      } else {
        parts.push(` AND status in (${values.map(v => `"${v}"`).join(', ')})`)
      }
    }
  }
  return parts.join('')
}

// ─── Aggregation functions ───────────────────────────────────────────────────
// These mirror the server-side aggregation but operate on projected issue
// records (flat fields: component, components, versions, status, assignee, duedate).

function buildComponentCounts(issues, searchBase, filterJql) {
  const counts = {}
  for (const issue of issues) {
    const comp = issue.component
    counts[comp] = (counts[comp] || 0) + 1
  }
  const total = issues.length || 1
  return Object.entries(counts)
    .map(([component, count]) => ({
      component,
      count,
      pct: parseFloat(((count / total) * 100).toFixed(2)),
      jql: jqlUrl(searchBase, BASE_JQL + filterJql + quoteComponent(component))
    }))
    .sort((a, b) => b.count - a.count)
}

function buildDueDateBuckets(issues, searchBase, filterJql) {
  const now = new Date()
  const buckets = { passed: 0, lessThan30: 0, between30And90: 0, moreThan90: 0, none: 0 }
  const total = issues.length || 1

  for (const issue of issues) {
    if (!issue.duedate) {
      buckets.none++
      continue
    }
    const due = new Date(issue.duedate)
    const diffDays = Math.floor((due - now) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) buckets.passed++
    else if (diffDays < 30) buckets.lessThan30++
    else if (diffDays <= 90) buckets.between30And90++
    else buckets.moreThan90++
  }

  const today = now.toISOString().slice(0, 10)
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)
  const in90 = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10)
  const base = BASE_JQL + filterJql

  return {
    passed: { count: buckets.passed, pct: Math.round((buckets.passed / total) * 100), jql: jqlUrl(searchBase, base + ` AND duedate < "${today}"`) },
    lessThan30: { count: buckets.lessThan30, pct: Math.round((buckets.lessThan30 / total) * 100), jql: jqlUrl(searchBase, base + ` AND duedate >= "${today}" AND duedate < "${in30}"`) },
    between30And90: { count: buckets.between30And90, pct: Math.round((buckets.between30And90 / total) * 100), jql: jqlUrl(searchBase, base + ` AND duedate >= "${in30}" AND duedate <= "${in90}"`) },
    moreThan90: { count: buckets.moreThan90, pct: Math.round((buckets.moreThan90 / total) * 100), jql: jqlUrl(searchBase, base + ` AND duedate > "${in90}"`) },
    none: { count: buckets.none, pct: Math.round((buckets.none / total) * 100), jql: jqlUrl(searchBase, base + ' AND duedate is EMPTY') },
    total: issues.length,
    total_jql: jqlUrl(searchBase, base)
  }
}

function buildVersionComponentMatrix(issues, searchBase, filterJql) {
  const components = new Set()
  const versions = new Set()
  const matrix = {}

  for (const issue of issues) {
    for (const comp of issue.components) {
      components.add(comp)
      for (const ver of issue.versions) {
        versions.add(ver)
        const key = `${comp}||${ver}`
        matrix[key] = (matrix[key] || 0) + 1
      }
    }
  }

  const sortedComponents = [...components].sort()
  const sortedVersions = [...versions].sort().sort((a, b) => {
    if (a === 'None') return 1
    if (b === 'None') return -1
    return 0
  })
  const base = BASE_JQL + filterJql

  const rows = sortedComponents.map(comp => {
    const cells = {}
    const cellJqls = {}
    let rowTotal = 0
    for (const ver of sortedVersions) {
      const val = matrix[`${comp}||${ver}`] || 0
      cells[ver] = val
      if (val > 0) cellJqls[ver] = jqlUrl(searchBase, base + quoteComponent(comp) + quoteVersion(ver))
      rowTotal += val
    }
    return {
      component: comp,
      cells,
      cellJqls,
      total: rowTotal,
      total_jql: rowTotal > 0 ? jqlUrl(searchBase, base + quoteComponent(comp)) : null
    }
  })

  const columnTotals = {}
  const columnJqls = {}
  let grandTotal = 0
  for (const ver of sortedVersions) {
    const sum = rows.reduce((acc, r) => acc + (r.cells[ver] || 0), 0)
    columnTotals[ver] = sum
    if (sum > 0) columnJqls[ver] = jqlUrl(searchBase, base + quoteVersion(ver))
    grandTotal += sum
  }

  return { versions: sortedVersions, rows, columnTotals, columnJqls, grandTotal, grandTotal_jql: jqlUrl(searchBase, base) }
}

function buildVersionCounts(issues, searchBase, filterJql) {
  const counts = {}
  for (const issue of issues) {
    for (const ver of issue.versions) {
      counts[ver] = (counts[ver] || 0) + 1
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1
  const base = BASE_JQL + filterJql
  return Object.entries(counts)
    .map(([version, count]) => ({
      version,
      count,
      pct: parseFloat(((count / total) * 100).toFixed(2)),
      jql: jqlUrl(searchBase, base + quoteVersion(version))
    }))
    .sort((a, b) => b.count - a.count)
}

function buildAssigneeStatusMatrix(issues, searchBase, filterJql) {
  const assignees = new Set()
  const statuses = new Set()
  const matrix = {}

  for (const issue of issues) {
    assignees.add(issue.assignee)
    statuses.add(issue.status)
    const key = `${issue.status}||${issue.assignee}`
    matrix[key] = (matrix[key] || 0) + 1
  }

  const statusOrder = ['NEW', 'IN PROGRESS', 'REVIEW', 'RESOLVED', 'CLOSED']
  const sortedStatuses = [...statuses].sort((a, b) => {
    const ai = statusOrder.indexOf(a.toUpperCase())
    const bi = statusOrder.indexOf(b.toUpperCase())
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const sortedAssignees = [...assignees].sort()
  const base = BASE_JQL + filterJql

  const rows = sortedStatuses.map(status => {
    const cells = {}
    const cellJqls = {}
    let rowTotal = 0
    for (const assignee of sortedAssignees) {
      const val = matrix[`${status}||${assignee}`] || 0
      cells[assignee] = val
      if (val > 0) cellJqls[assignee] = jqlUrl(searchBase, base + quoteStatus(status) + quoteAssignee(assignee))
      rowTotal += val
    }
    return {
      status,
      cells,
      cellJqls,
      total: rowTotal,
      total_jql: rowTotal > 0 ? jqlUrl(searchBase, base + quoteStatus(status)) : null
    }
  })

  const columnTotals = {}
  const columnJqls = {}
  let grandTotal = 0
  for (const assignee of sortedAssignees) {
    const sum = rows.reduce((acc, r) => acc + (r.cells[assignee] || 0), 0)
    columnTotals[assignee] = sum
    if (sum > 0) columnJqls[assignee] = jqlUrl(searchBase, base + quoteAssignee(assignee))
    grandTotal += sum
  }

  return { assignees: sortedAssignees, rows, columnTotals, columnJqls, grandTotal, grandTotal_jql: jqlUrl(searchBase, base) }
}

// ─── Composable ──────────────────────────────────────────────────────────────

/**
 * Reactive CVE aggregation from filtered issue records.
 *
 * @param {import('vue').Ref<Array>} filteredIssues - Filtered projected issue records
 * @param {import('vue').Ref<string>} jiraSearchBase - Jira search URL prefix
 * @param {import('vue').Ref<Object>} activeFilterDisplay - Current active filters (for JQL)
 */
export function useCveAggregation(filteredIssues, jiraSearchBase, activeFilterDisplay) {
  const filterJql = computed(() => buildFilterJql(activeFilterDisplay.value))

  const totalOpen = computed(() => filteredIssues.value.length)
  const totalOpen_jql = computed(() =>
    jqlUrl(jiraSearchBase.value, BASE_JQL + filterJql.value)
  )

  const openCvesByComponent = computed(() =>
    buildComponentCounts(filteredIssues.value, jiraSearchBase.value, filterJql.value)
  )

  const cvesByDueDate = computed(() =>
    buildDueDateBuckets(filteredIssues.value, jiraSearchBase.value, filterJql.value)
  )

  const cvesAcrossVersions = computed(() =>
    buildVersionComponentMatrix(filteredIssues.value, jiraSearchBase.value, filterJql.value)
  )

  const openCvesByVersion = computed(() =>
    buildVersionCounts(filteredIssues.value, jiraSearchBase.value, filterJql.value)
  )

  const cvesByAssigneeStatus = computed(() =>
    buildAssigneeStatusMatrix(filteredIssues.value, jiraSearchBase.value, filterJql.value)
  )

  return {
    totalOpen,
    totalOpen_jql,
    openCvesByComponent,
    cvesByDueDate,
    cvesAcrossVersions,
    openCvesByVersion,
    cvesByAssigneeStatus
  }
}
