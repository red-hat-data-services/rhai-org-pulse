var MS_PER_DAY = 86400000
var STALE_THRESHOLD_DAYS = 90
var THROUGHPUT_WINDOW_DAYS = 90

function daysBetween(isoA, isoB) {
  var a = new Date(isoA)
  var b = new Date(isoB)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.abs(b - a) / MS_PER_DAY
}

function round1(n) {
  return Math.round(n * 10) / 10
}

function isClosed(issue) {
  if (issue.statusCategory === 'Done') return true
  return issue.resolution && issue.resolution !== 'Unresolved'
}

function closedDate(issue) {
  return issue.resolved || issue.updated || null
}

/**
 * Build an executive summary object from the full BU/SSA feedback issue list.
 *
 * @param {Array} issues - Array of feedback issues from the API
 * @param {Date|string} now - Current timestamp (injectable for testing)
 * @returns {object} summary with metrics, bullets, and bottleneck data
 */
export function buildExecutiveSummary(issues, now) {
  var nowMs = new Date(now).getTime()
  var cutoffMs = nowMs - THROUGHPUT_WINDOW_DAYS * MS_PER_DAY

  var total = issues.length
  var closed = []
  var open = []
  var wipCount = 0
  var unassignedOpenCount = 0

  for (var i = 0; i < total; i++) {
    var issue = issues[i]
    if (isClosed(issue)) {
      closed.push(issue)
    } else {
      open.push(issue)
      if (issue.statusCategory === 'In Progress') wipCount++
      if (!issue.assignee || issue.assignee === 'Unassigned') unassignedOpenCount++
    }
  }

  var leadTimeSamples = []
  var cycleTimeSamples = []
  var throughputCount = 0

  for (var ci = 0; ci < closed.length; ci++) {
    var c = closed[ci]
    var cDate = closedDate(c)
    if (c.created && cDate) {
      var lt = daysBetween(c.created, cDate)
      if (lt !== null) leadTimeSamples.push(lt)
    }
    if (c.inProgressAt && cDate) {
      var ct = daysBetween(c.inProgressAt, cDate)
      if (ct !== null) cycleTimeSamples.push(ct)
    }
    if (cDate && new Date(cDate).getTime() >= cutoffMs) {
      throughputCount++
    }
  }

  var openAgeSamples = []
  var staleOpenCount = 0

  for (var oi = 0; oi < open.length; oi++) {
    var o = open[oi]
    if (o.created) {
      var age = daysBetween(o.created, now)
      if (age !== null) {
        openAgeSamples.push(age)
        if (age >= STALE_THRESHOLD_DAYS) staleOpenCount++
      }
    }
  }

  var avgLeadTime = leadTimeSamples.length
    ? round1(leadTimeSamples.reduce(function(s, v) { return s + v }, 0) / leadTimeSamples.length)
    : null
  var avgCycleTime = cycleTimeSamples.length
    ? round1(cycleTimeSamples.reduce(function(s, v) { return s + v }, 0) / cycleTimeSamples.length)
    : null
  var avgOpenAge = openAgeSamples.length
    ? round1(openAgeSamples.reduce(function(s, v) { return s + v }, 0) / openAgeSamples.length)
    : null

  var resolutionRate = total > 0 ? round1(100 * closed.length / total) : 0

  var componentMap = {}
  for (var bi = 0; bi < open.length; bi++) {
    var comps = open[bi].components || []
    var issueAge = open[bi].created ? daysBetween(open[bi].created, now) : 0
    for (var bj = 0; bj < comps.length; bj++) {
      var comp = comps[bj]
      if (!componentMap[comp]) componentMap[comp] = { name: comp, openCount: 0, totalAge: 0 }
      componentMap[comp].openCount++
      componentMap[comp].totalAge += issueAge || 0
    }
  }

  var bottlenecks = Object.keys(componentMap).map(function(k) {
    var entry = componentMap[k]
    return {
      component: entry.name,
      openCount: entry.openCount,
      avgAge: entry.openCount > 0 ? round1(entry.totalAge / entry.openCount) : 0
    }
  })

  bottlenecks.sort(function(a, b) {
    if (b.openCount !== a.openCount) return b.openCount - a.openCount
    return b.avgAge - a.avgAge
  })

  var topBottlenecks = bottlenecks.slice(0, 5)

  return {
    total: total,
    closedCount: closed.length,
    openCount: open.length,
    avgLeadTime: avgLeadTime,
    avgLeadTimeSample: leadTimeSamples.length,
    avgCycleTime: avgCycleTime,
    avgCycleTimeSample: cycleTimeSamples.length,
    avgOpenAge: avgOpenAge,
    avgOpenAgeSample: openAgeSamples.length,
    resolutionRate: resolutionRate,
    throughput: throughputCount,
    throughputWindowDays: THROUGHPUT_WINDOW_DAYS,
    wipCount: wipCount,
    staleOpenCount: staleOpenCount,
    staleThresholdDays: STALE_THRESHOLD_DAYS,
    unassignedOpenCount: unassignedOpenCount,
    bottlenecks: topBottlenecks
  }
}
