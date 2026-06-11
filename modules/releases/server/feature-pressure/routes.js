/**
 * Feature Pressure — server routes.
 *
 * Queries Jira LIVE for RHAISTRAT Features and RHAIRFE RFEs, computes
 * inflow vs burn analysis RHAI-wide by component.  Every count is backed
 * by a clickable JQL verification URL.
 *
 * Pattern: mirrors tv-fv-delta/routes.js (stale-while-revalidate cache,
 * background refresh with cooldown, polling status endpoint).
 */

// NOTE: uses deprecated jiraRequest/fetchAllJqlResults (process.env auth) to match
// tv-fv-delta pattern.  Migrate to context.secrets + createJiraClient when tv-fv-delta does.
const { jiraRequest, JIRA_HOST, fetchAllJqlResults } = require('../../../../shared/server/jira')

const JIRA_BROWSE = JIRA_HOST + '/browse'
const JIRA_SEARCH = JIRA_HOST + '/issues/?jql='
const CACHE_KEY = 'releases/feature-pressure.json'
const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
const FETCH_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes — abort if Jira fetch hangs
const HEATMAP_MIN_ACTIVITY = 3 // minimum total created+resolved to appear in heatmap
const HEATMAP_MAX_COMPONENTS = 25 // cap for readability

const FEATURE_PROJECT = 'RHAISTRAT'
const RFE_PROJECT = 'RHAIRFE'

// Fields to fetch from Jira (Jira REST API uses 'resolutiondate', not 'resolved')
const FEATURE_FIELDS = 'summary,status,components,created,resolutiondate'
const RFE_FIELDS = 'summary,status,components,created,resolutiondate'

// ---------------------------------------------------------------------------
// Status classification constants
// ---------------------------------------------------------------------------

// Open/done classification uses statusCategory from Jira (not individual status names).
const RFE_ACCEPTED = ['Approved', 'In Progress', 'Refinement', 'Planning', 'Review', 'Resolved']
const RFE_PENDING = ['New', 'Draft', 'Stakeholder review', 'Stakeholder Feedback', 'Pending Approval']

// ---------------------------------------------------------------------------
// JQL helpers
// ---------------------------------------------------------------------------

function jqlUrl(jql) {
  return JIRA_SEARCH + encodeURIComponent(jql)
}

/** Quote a component name for JQL (escape backslashes first, then quotes) */
function quoteComponent(name) {
  return '"' + name.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

// ---------------------------------------------------------------------------
// JSON serialisation helpers
// ---------------------------------------------------------------------------

/**
 * Replace non-finite numeric values so JSON.stringify doesn't silently
 * turn them into null.  Infinity → "Infinity", -Infinity → "-Infinity",
 * NaN → null.  Mutates in place.
 */
function sanitizeInfinity(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    for (var i = 0; i < obj.length; i++) {
      if (obj[i] === Infinity) obj[i] = 'Infinity'
      else if (obj[i] === -Infinity) obj[i] = '-Infinity'
      else if (typeof obj[i] === 'number' && isNaN(obj[i])) obj[i] = null
      else if (typeof obj[i] === 'object' && obj[i] !== null) sanitizeInfinity(obj[i])
    }
  } else {
    var keys = Object.keys(obj)
    for (var k = 0; k < keys.length; k++) {
      if (obj[keys[k]] === Infinity) obj[keys[k]] = 'Infinity'
      else if (obj[keys[k]] === -Infinity) obj[keys[k]] = '-Infinity'
      else if (typeof obj[keys[k]] === 'number' && isNaN(obj[keys[k]])) obj[keys[k]] = null
      else if (typeof obj[keys[k]] === 'object' && obj[keys[k]] !== null) sanitizeInfinity(obj[keys[k]])
    }
  }
  return obj
}

// ---------------------------------------------------------------------------
// Issue normalisation
// ---------------------------------------------------------------------------

/** Shared normaliser for both Features and RFEs (identical field shape). */
function normalizeIssue(issue) {
  var fields = issue.fields || {}

  var components = []
  if (Array.isArray(fields.components)) {
    components = fields.components.map(function (c) { return c.name || '' }).filter(Boolean)
  }

  var status = ''
  var statusCategory = ''
  if (fields.status) {
    status = fields.status.name || ''
    statusCategory = (fields.status.statusCategory && fields.status.statusCategory.name) || ''
  }

  return {
    key: issue.key,
    url: JIRA_BROWSE + '/' + issue.key,
    summary: String(fields.summary || '').slice(0, 120),
    status: status,
    statusCategory: statusCategory,
    components: components,
    created: fields.created || null,
    resolved: fields.resolutiondate || null
  }
}

// Backward-compatible aliases
var normalizeFeature = normalizeIssue
var normalizeRfe = normalizeIssue

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Parse ISO date string to YYYY-MM month key */
function toMonth(dateStr) {
  if (!dateStr) return null
  var d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  var m = d.getMonth() + 1
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m
}

/** Generate array of YYYY-MM strings for the lookback window */
function generateMonthRange(lookbackMonths) {
  var months = []
  var now = new Date()
  for (var i = lookbackMonths - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    var m = d.getMonth() + 1
    months.push(d.getFullYear() + '-' + (m < 10 ? '0' : '') + m)
  }
  return months
}

/** Return ISO date string for N months ago */
function lookbackDate(months) {
  var d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Analysis functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Bucket features by created/resolved month within the lookback window.
 * Returns { months: [{month, created, resolved, net, cumulative}] }
 */
function classifyByMonth(features, lookbackMonths) {
  var monthRange = generateMonthRange(lookbackMonths)
  var cutoff = lookbackDate(lookbackMonths)

  var createdMap = {}
  var resolvedMap = {}
  for (var i = 0; i < monthRange.length; i++) {
    createdMap[monthRange[i]] = 0
    resolvedMap[monthRange[i]] = 0
  }

  for (var fi = 0; fi < features.length; fi++) {
    var feat = features[fi]
    if (feat.created && feat.created >= cutoff) {
      var cm = toMonth(feat.created)
      if (cm && createdMap[cm] !== undefined) createdMap[cm]++
    }
    if (feat.resolved && feat.resolved >= cutoff) {
      var rm = toMonth(feat.resolved)
      if (rm && resolvedMap[rm] !== undefined) resolvedMap[rm]++
    }
  }

  var months = []
  var cumulative = 0
  for (var mi = 0; mi < monthRange.length; mi++) {
    var month = monthRange[mi]
    var created = createdMap[month]
    var resolved = resolvedMap[month]
    var net = created - resolved
    cumulative += net
    months.push({
      month: month,
      created: created,
      created_jql: jqlUrl('project = ' + FEATURE_PROJECT + ' AND issuetype = Feature AND created >= "' + month + '-01" AND created < "' + nextMonth(month) + '-01"'),
      resolved: resolved,
      resolved_jql: jqlUrl('project = ' + FEATURE_PROJECT + ' AND issuetype = Feature AND resolved >= "' + month + '-01" AND resolved < "' + nextMonth(month) + '-01"'),
      net: net,
      cumulative: cumulative
    })
  }

  return { months: months }
}

/** Get next month as YYYY-MM */
function nextMonth(ym) {
  var parts = ym.split('-')
  var y = parseInt(parts[0], 10)
  var m = parseInt(parts[1], 10)
  m++
  if (m > 12) { m = 1; y++ }
  return y + '-' + (m < 10 ? '0' : '') + m
}

/**
 * Per-component pressure analysis.
 * Returns sorted array of { component, created, resolved, open, net, pressure_ratio, ..._jql }
 */
function computeComponentPressure(features, lookbackMonths) {
  var cutoff = lookbackDate(lookbackMonths)
  var compMap = {} // component -> { created, resolved, open }

  for (var fi = 0; fi < features.length; fi++) {
    var feat = features[fi]
    var comps = feat.components.length > 0 ? feat.components : ['(No Component)']

    for (var ci = 0; ci < comps.length; ci++) {
      var comp = comps[ci]
      if (!compMap[comp]) {
        compMap[comp] = { created: 0, resolved: 0, open: 0 }
      }

      if (feat.created && feat.created >= cutoff) {
        compMap[comp].created++
      }
      if (feat.resolved && feat.resolved >= cutoff) {
        compMap[comp].resolved++
      }
      if (feat.statusCategory !== 'Done') {
        compMap[comp].open++
      }
    }
  }

  var baseJql = 'project = ' + FEATURE_PROJECT + ' AND issuetype = Feature'
  var result = []
  var compNames = Object.keys(compMap)

  for (var ni = 0; ni < compNames.length; ni++) {
    var name = compNames[ni]
    var data = compMap[name]
    var net = data.created - data.resolved
    var ratio = data.resolved > 0 ? Math.round(100 * data.created / data.resolved) / 100 : (data.created > 0 ? Infinity : 0)
    var compQ = name === '(No Component)' ? ' AND component is EMPTY' : ' AND component = ' + quoteComponent(name)

    result.push({
      component: name,
      created: data.created,
      created_jql: jqlUrl(baseJql + compQ + ' AND created >= "' + cutoff + '"'),
      resolved: data.resolved,
      resolved_jql: jqlUrl(baseJql + compQ + ' AND resolved >= "' + cutoff + '"'),
      open: data.open,
      open_jql: jqlUrl(baseJql + compQ + ' AND statusCategory != Done'),
      net: net,
      pressure_ratio: ratio
    })
  }

  // Filter to components with activity and sort by net descending
  result = result.filter(function (r) { return r.created > 0 || r.open > 0 })
  result.sort(function (a, b) { return b.net - a.net || a.component.localeCompare(b.component) })

  return result
}

/**
 * RFE pipeline analysis.
 * Returns { status_breakdown, monthly_arrivals, per_component_pending }
 */
function computeRfePipeline(rfes, lookbackMonths) {
  var cutoff = lookbackDate(lookbackMonths)
  var monthRange = generateMonthRange(lookbackMonths)

  // Status breakdown
  var accepted = 0
  var pending = 0
  var other = 0
  for (var ri = 0; ri < rfes.length; ri++) {
    var s = rfes[ri].status
    if (RFE_ACCEPTED.indexOf(s) !== -1) accepted++
    else if (RFE_PENDING.indexOf(s) !== -1) pending++
    else other++
  }

  var baseJql = 'project = ' + RFE_PROJECT + ' AND issuetype = "Feature Request"'
  var pendingStatusJql = 'status in (New, Draft, "Stakeholder review", "Stakeholder Feedback", "Pending Approval")'
  var acceptedStatusJql = 'status in (Approved, "In Progress", Refinement, Planning, Review, Resolved)'

  var statusBreakdown = {
    total: { count: rfes.length, jql: jqlUrl(baseJql) },
    accepted: { count: accepted, jql: jqlUrl(baseJql + ' AND ' + acceptedStatusJql) },
    pending: { count: pending, jql: jqlUrl(baseJql + ' AND ' + pendingStatusJql) },
    other: { count: other }
  }

  // Monthly arrivals
  var arrivalMap = {}
  for (var mi = 0; mi < monthRange.length; mi++) arrivalMap[monthRange[mi]] = 0

  for (var ai = 0; ai < rfes.length; ai++) {
    if (rfes[ai].created && rfes[ai].created >= cutoff) {
      var m = toMonth(rfes[ai].created)
      if (m && arrivalMap[m] !== undefined) arrivalMap[m]++
    }
  }

  var monthlyArrivals = []
  for (var mai = 0; mai < monthRange.length; mai++) {
    var month = monthRange[mai]
    monthlyArrivals.push({
      month: month,
      count: arrivalMap[month],
      jql: jqlUrl(baseJql + ' AND created >= "' + month + '-01" AND created < "' + nextMonth(month) + '-01"')
    })
  }

  // Per-component pending
  var compPending = {}
  for (var pi = 0; pi < rfes.length; pi++) {
    var rfe = rfes[pi]
    if (RFE_PENDING.indexOf(rfe.status) === -1) continue
    var rfeComps = rfe.components.length > 0 ? rfe.components : ['(No Component)']
    for (var pci = 0; pci < rfeComps.length; pci++) {
      var c = rfeComps[pci]
      compPending[c] = (compPending[c] || 0) + 1
    }
  }

  var perComponentPending = Object.keys(compPending)
    .map(function (comp) {
      var compQ = comp === '(No Component)' ? ' AND component is EMPTY' : ' AND component = ' + quoteComponent(comp)
      return {
        component: comp,
        count: compPending[comp],
        jql: jqlUrl(baseJql + ' AND ' + pendingStatusJql + compQ)
      }
    })
    .sort(function (a, b) { return b.count - a.count })

  return {
    status_breakdown: statusBreakdown,
    monthly_arrivals: monthlyArrivals,
    per_component_pending: perComponentPending
  }
}

/**
 * Backlog half-life per component.
 * Returns array of { component, open, resolved_per_month, months_to_clear }
 */
function computeBacklogHalfLife(componentPressure, lookbackMonths) {
  return componentPressure
    .filter(function (c) { return c.open > 0 })
    .map(function (c) {
      var resolvedPerMonth = c.resolved / lookbackMonths
      var monthsToClear = resolvedPerMonth > 0
        ? Math.round(10 * c.open / resolvedPerMonth) / 10
        : Infinity

      return {
        component: c.component,
        open: c.open,
        open_jql: c.open_jql,
        resolved_per_month: Math.round(100 * resolvedPerMonth) / 100,
        months_to_clear: monthsToClear
      }
    })
    .sort(function (a, b) {
      // Infinity sorts last among themselves, but before finite values? No — infinity first (worst)
      if (a.months_to_clear === Infinity && b.months_to_clear === Infinity) return a.component.localeCompare(b.component)
      if (a.months_to_clear === Infinity) return -1
      if (b.months_to_clear === Infinity) return 1
      return b.months_to_clear - a.months_to_clear
    })
}

/**
 * Component x Month heatmap matrix.
 * Returns { months, components, matrix } where matrix[i][j] = net flow for component i in month j.
 */
function buildHeatmapMatrix(features, lookbackMonths) {
  var monthRange = generateMonthRange(lookbackMonths)
  var cutoff = lookbackDate(lookbackMonths)

  // Count created and resolved per component per month
  var compMonthCreated = {} // comp -> { month -> count }
  var compMonthResolved = {}
  var activeComps = {}

  for (var fi = 0; fi < features.length; fi++) {
    var feat = features[fi]
    // Intentionally skip features with no component — heatmap/trend are per-component views.
    // "(No Component)" is tracked separately in computeComponentPressure.
    var comps = feat.components.length > 0 ? feat.components : []
    if (comps.length === 0) continue

    for (var ci = 0; ci < comps.length; ci++) {
      var comp = comps[ci]
      activeComps[comp] = true

      if (feat.created && feat.created >= cutoff) {
        var cm = toMonth(feat.created)
        if (cm) {
          if (!compMonthCreated[comp]) compMonthCreated[comp] = {}
          compMonthCreated[comp][cm] = (compMonthCreated[comp][cm] || 0) + 1
        }
      }
      if (feat.resolved && feat.resolved >= cutoff) {
        var rm = toMonth(feat.resolved)
        if (rm) {
          if (!compMonthResolved[comp]) compMonthResolved[comp] = {}
          compMonthResolved[comp][rm] = (compMonthResolved[comp][rm] || 0) + 1
        }
      }
    }
  }

  // Filter to components with >= 3 total activity
  var compNames = Object.keys(activeComps).filter(function (comp) {
    var total = 0
    if (compMonthCreated[comp]) {
      var vals = Object.values(compMonthCreated[comp])
      for (var v = 0; v < vals.length; v++) total += vals[v]
    }
    if (compMonthResolved[comp]) {
      var rvals = Object.values(compMonthResolved[comp])
      for (var rv = 0; rv < rvals.length; rv++) total += rvals[rv]
    }
    return total >= HEATMAP_MIN_ACTIVITY
  })

  // Sort by total net (worst first)
  compNames.sort(function (a, b) {
    var netA = 0
    var netB = 0
    for (var mi = 0; mi < monthRange.length; mi++) {
      var m = monthRange[mi]
      netA += ((compMonthCreated[a] || {})[m] || 0) - ((compMonthResolved[a] || {})[m] || 0)
      netB += ((compMonthCreated[b] || {})[m] || 0) - ((compMonthResolved[b] || {})[m] || 0)
    }
    return netB - netA
  })

  // Limit to top N for readability
  compNames = compNames.slice(0, HEATMAP_MAX_COMPONENTS)

  // Build matrix
  var matrix = []
  for (var cni = 0; cni < compNames.length; cni++) {
    var row = []
    for (var mj = 0; mj < monthRange.length; mj++) {
      var month = monthRange[mj]
      var created = (compMonthCreated[compNames[cni]] || {})[month] || 0
      var resolved = (compMonthResolved[compNames[cni]] || {})[month] || 0
      row.push(created - resolved)
    }
    matrix.push(row)
  }

  return { months: monthRange, components: compNames, matrix: matrix }
}

/**
 * Trend analysis — compare first-half vs second-half of lookback window.
 * Returns array of { component, first_half_net, second_half_net, direction, delta }
 */
function computeTrend(features, lookbackMonths) {
  var monthRange = generateMonthRange(lookbackMonths)
  var cutoff = lookbackDate(lookbackMonths)
  var midIdx = Math.floor(monthRange.length / 2)
  var firstHalfMonths = monthRange.slice(0, midIdx)
  var secondHalfMonths = monthRange.slice(midIdx)

  var firstHalfSet = {}
  var secondHalfSet = {}
  for (var i = 0; i < firstHalfMonths.length; i++) firstHalfSet[firstHalfMonths[i]] = true
  for (var j = 0; j < secondHalfMonths.length; j++) secondHalfSet[secondHalfMonths[j]] = true

  // Per component: count created/resolved in each half
  var compData = {} // comp -> { h1_created, h1_resolved, h2_created, h2_resolved }
  var activeComps = {}

  for (var fi = 0; fi < features.length; fi++) {
    var feat = features[fi]
    // Skip unclassified features — trend is per-component only (same as heatmap)
    var comps = feat.components.length > 0 ? feat.components : []
    if (comps.length === 0) continue

    for (var ci = 0; ci < comps.length; ci++) {
      var comp = comps[ci]
      if (!compData[comp]) {
        compData[comp] = { h1_created: 0, h1_resolved: 0, h2_created: 0, h2_resolved: 0 }
      }

      if (feat.created && feat.created >= cutoff) {
        var cm = toMonth(feat.created)
        if (cm) {
          activeComps[comp] = true
          if (firstHalfSet[cm]) compData[comp].h1_created++
          else if (secondHalfSet[cm]) compData[comp].h2_created++
        }
      }
      if (feat.resolved && feat.resolved >= cutoff) {
        var rm = toMonth(feat.resolved)
        if (rm) {
          activeComps[comp] = true
          if (firstHalfSet[rm]) compData[comp].h1_resolved++
          else if (secondHalfSet[rm]) compData[comp].h2_resolved++
        }
      }
    }
  }

  var result = []
  var compNames = Object.keys(activeComps)

  for (var ni = 0; ni < compNames.length; ni++) {
    var name = compNames[ni]
    var d = compData[name]
    var h1Net = d.h1_created - d.h1_resolved
    var h2Net = d.h2_created - d.h2_resolved
    var delta = h2Net - h1Net
    var direction = delta > 0 ? 'worsening' : (delta < 0 ? 'improving' : 'stable')

    result.push({
      component: name,
      first_half_net: h1Net,
      second_half_net: h2Net,
      direction: direction,
      delta: delta
    })
  }

  result.sort(function (a, b) { return b.delta - a.delta || a.component.localeCompare(b.component) })
  return result
}

/**
 * Combined scorecard — composite risk score per component.
 * Score is computed from three signals: net feature inflow, open backlog size,
 * and pending RFE demand.  Backlog half-life and trend are included as display
 * columns but do not affect the score calculation.
 *
 * Risk score = (net/5, cap 10) x 0.4 + (open/10, cap 10) x 0.3 + (rfePending/5, cap 10) x 0.3
 * Risk levels: low (<2.5), medium (2.5-5), high (5-7.5), critical (>7.5)
 */
function computeScorecard(componentPressure, rfePipeline, backlogHalfLife, trend) {
  var rfeMap = {}
  var pendingList = rfePipeline.per_component_pending
  for (var pi = 0; pi < pendingList.length; pi++) {
    rfeMap[pendingList[pi].component] = pendingList[pi].count
  }

  var halfLifeMap = {}
  for (var hi = 0; hi < backlogHalfLife.length; hi++) {
    halfLifeMap[backlogHalfLife[hi].component] = backlogHalfLife[hi].months_to_clear
  }

  var trendMap = {}
  for (var ti = 0; ti < trend.length; ti++) {
    trendMap[trend[ti].component] = trend[ti].direction
  }

  var scorecard = []
  for (var ci = 0; ci < componentPressure.length; ci++) {
    var cp = componentPressure[ci]
    var rfePending = rfeMap[cp.component] || 0
    var halfLife = halfLifeMap[cp.component] !== undefined ? halfLifeMap[cp.component] : null
    var trendDir = trendMap[cp.component] || 'stable'

    var netScore = Math.min(Math.max(cp.net, 0) / 5, 10)
    var backlogScore = Math.min(cp.open / 10, 10)
    var rfeScore = Math.min(rfePending / 5, 10)
    var riskScore = Math.round(10 * (netScore * 0.4 + backlogScore * 0.3 + rfeScore * 0.3)) / 10

    var riskLevel = riskScore >= 7.5 ? 'critical'
      : riskScore >= 5 ? 'high'
      : riskScore >= 2.5 ? 'medium'
      : 'low'

    scorecard.push({
      component: cp.component,
      risk_score: riskScore,
      risk_level: riskLevel,
      created: cp.created,
      resolved: cp.resolved,
      net: cp.net,
      open: cp.open,
      open_jql: cp.open_jql,
      pressure_ratio: cp.pressure_ratio,
      rfe_pending: rfePending,
      rfe_pending_jql: (pendingList.find(function (p) { return p.component === cp.component }) || {}).jql || '',
      backlog_months: halfLife,
      trend: trendDir
    })
  }

  scorecard.sort(function (a, b) { return b.risk_score - a.risk_score || a.component.localeCompare(b.component) })
  return scorecard
}

// ---------------------------------------------------------------------------
// Fetch + analyse pipeline
// ---------------------------------------------------------------------------

async function fetchAndAnalyze(lookbackMonths, storage) {
  var fetchTimestamp = new Date().toISOString()

  // Fetch features and RFEs in parallel with timeout guard
  var featureJql = 'project = ' + FEATURE_PROJECT + ' AND issuetype = Feature'
  var rfeJql = 'project = ' + RFE_PROJECT + ' AND issuetype = "Feature Request"'

  console.log('[releases/feature-pressure] Fetching features: ' + featureJql)
  console.log('[releases/feature-pressure] Fetching RFEs: ' + rfeJql)

  var timer
  var timeout = new Promise(function (_, reject) {
    timer = setTimeout(function () { reject(new Error('Jira fetch timed out after ' + (FETCH_TIMEOUT_MS / 1000) + 's')) }, FETCH_TIMEOUT_MS)
  })

  var results
  try {
    results = await Promise.race([
      Promise.all([
        fetchAllJqlResults(jiraRequest, featureJql, FEATURE_FIELDS),
        fetchAllJqlResults(jiraRequest, rfeJql, RFE_FIELDS)
      ]),
      timeout
    ])
  } finally {
    clearTimeout(timer)
  }

  var rawFeatures = results[0]
  var rawRfes = results[1]

  console.log('[releases/feature-pressure] Fetched ' + rawFeatures.length + ' features and ' + rawRfes.length + ' RFEs')

  // Normalize
  var features = rawFeatures.map(normalizeFeature)
  var rfes = rawRfes.map(normalizeRfe)

  // Run all analyses
  var monthlyFlow = classifyByMonth(features, lookbackMonths)
  var componentPressure = computeComponentPressure(features, lookbackMonths)
  var rfePipeline = computeRfePipeline(rfes, lookbackMonths)
  var backlogHalfLife = computeBacklogHalfLife(componentPressure, lookbackMonths)
  var heatmap = buildHeatmapMatrix(features, lookbackMonths)
  var trend = computeTrend(features, lookbackMonths)
  var scorecard = computeScorecard(componentPressure, rfePipeline, backlogHalfLife, trend)

  // Executive summary
  var cutoff = lookbackDate(lookbackMonths)
  var baseJql = 'project = ' + FEATURE_PROJECT + ' AND issuetype = Feature'
  var rfeBaseJql = 'project = ' + RFE_PROJECT + ' AND issuetype = "Feature Request"'
  var pendingStatusJql = 'status in (New, Draft, "Stakeholder review", "Stakeholder Feedback", "Pending Approval")'
  var acceptedStatusJql = 'status in (Approved, "In Progress", Refinement, Planning, Review, Resolved)'

  var totalOpen = features.filter(function (f) { return f.statusCategory !== 'Done' }).length
  var totalCreated = features.filter(function (f) { return f.created && f.created >= cutoff }).length
  var totalResolved = features.filter(function (f) { return f.resolved && f.resolved >= cutoff }).length
  var burnRate = Math.round(100 * totalResolved / lookbackMonths) / 100
  var monthsToClear = burnRate > 0 ? Math.round(10 * totalOpen / burnRate) / 10 : Infinity

  // Trend counts
  var improving = trend.filter(function (t) { return t.direction === 'improving' }).length
  var worsening = trend.filter(function (t) { return t.direction === 'worsening' }).length
  var stable = trend.filter(function (t) { return t.direction === 'stable' }).length

  var result = {
    metadata: {
      generated_at: new Date().toISOString(),
      data_timestamp: fetchTimestamp,
      lookback_months: lookbackMonths,
      total_features: features.length,
      total_rfes: rfes.length
    },
    executive_summary: {
      total_features: features.length,
      total_features_jql: jqlUrl(baseJql),
      open_features: totalOpen,
      open_features_jql: jqlUrl(baseJql + ' AND statusCategory != Done'),
      created_in_window: totalCreated,
      created_in_window_jql: jqlUrl(baseJql + ' AND created >= "' + cutoff + '"'),
      resolved_in_window: totalResolved,
      resolved_in_window_jql: jqlUrl(baseJql + ' AND resolved >= "' + cutoff + '"'),
      net_in_window: totalCreated - totalResolved,
      monthly_burn_rate: burnRate,
      months_to_clear: monthsToClear,
      backlog_trend: totalCreated > totalResolved ? 'growing' : (totalCreated < totalResolved ? 'burning down' : 'stable'),
      total_rfes: rfes.length,
      total_rfes_jql: jqlUrl(rfeBaseJql),
      rfe_pending: rfePipeline.status_breakdown.pending.count,
      rfe_pending_jql: jqlUrl(rfeBaseJql + ' AND ' + pendingStatusJql),
      rfe_accepted: rfePipeline.status_breakdown.accepted.count,
      rfe_accepted_jql: jqlUrl(rfeBaseJql + ' AND ' + acceptedStatusJql),
      trend_improving: improving,
      trend_worsening: worsening,
      trend_stable: stable
    },
    monthly_flow: monthlyFlow.months,
    component_pressure: componentPressure,
    rfe_pipeline: rfePipeline,
    backlog_half_life: backlogHalfLife,
    heatmap: heatmap,
    trend: trend,
    scorecard: scorecard
  }

  // Sanitise Infinity before caching — JSON.stringify(Infinity) produces null
  sanitizeInfinity(result)

  // Cache
  storage.writeToStorage(CACHE_KEY, result)
  console.log('[releases/feature-pressure] Cached analysis (' + features.length + ' features, ' + rfes.length + ' RFEs, ' + componentPressure.length + ' components)')

  return result
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

function registerRoutes(router, context) {
  var storage = context.storage
  var requireAuth = context.requireAuth
  var requireScope = context.requireScope

  var refreshState = { running: false, lastResult: null, startedAt: null, completedAt: null }

  function triggerBackgroundRefresh(lookbackMonths, force) {
    if (refreshState.running) return
    if (!force && refreshState.completedAt) {
      var elapsed = Date.now() - new Date(refreshState.completedAt).getTime()
      if (elapsed < REFRESH_COOLDOWN_MS) return
    }

    refreshState.running = true
    refreshState.startedAt = new Date().toISOString()

    console.log('[releases/feature-pressure] Background refresh started (lookback: ' + lookbackMonths + 'mo)')
    setImmediate(function () {
      fetchAndAnalyze(lookbackMonths, storage)
        .then(function (result) {
          refreshState.running = false
          refreshState.completedAt = new Date().toISOString()
          refreshState.lastResult = {
            status: 'success',
            message: result.metadata.total_features + ' features, ' + result.metadata.total_rfes + ' RFEs analysed',
            completedAt: new Date().toISOString()
          }
          console.log('[releases/feature-pressure] Background refresh completed')
        })
        .catch(function (err) {
          refreshState.running = false
          refreshState.completedAt = new Date().toISOString()
          refreshState.lastResult = {
            status: 'error',
            message: err.message,
            completedAt: new Date().toISOString()
          }
          console.error('[releases/feature-pressure] Background refresh failed:', err.message)
        })
    })
  }

  /**
   * @openapi
   * /api/modules/releases/feature-pressure:
   *   get:
   *     tags: ['Releases']
   *     summary: Get feature pressure analysis (RHAI-wide)
   *     description: Returns cached data with stale-while-revalidate. Triggers background refresh if cache is stale.
   *     responses:
   *       200:
   *         description: Feature pressure analysis with per-component breakdowns
   *       202:
   *         description: Data pipeline is running for the first time
   */
  router.get('/', requireAuth, requireScope('releases:read'), function (req, res) {
    var data = storage.readFromStorage(CACHE_KEY)

    if (data) {
      var cachedAt = data.metadata && data.metadata.generated_at
      if (cachedAt) {
        var age = Date.now() - new Date(cachedAt).getTime()
        if (age >= CACHE_MAX_AGE_MS) {
          var lm = (data.metadata && data.metadata.lookback_months) || 12
          triggerBackgroundRefresh(lm)
        }
      }
      return res.json({
        ...data,
        _refreshing: refreshState.running
      })
    }

    // No cache — trigger first fetch
    triggerBackgroundRefresh(12)
    res.status(202).json({
      _refreshing: true,
      _noCache: true,
      message: 'Data pipeline is running for the first time. Refresh the page in a few moments.'
    })
  })

  /**
   * @openapi
   * /api/modules/releases/feature-pressure/refresh:
   *   post:
   *     tags: ['Releases']
   *     summary: Trigger a refresh of feature pressure data from Jira
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               lookback_months:
   *                 type: integer
   *                 description: Lookback period in months (1-36, default 12)
   *     responses:
   *       200:
   *         description: Refresh started or already running
   */
  router.post('/refresh', requireAuth, requireScope('releases:write'), function (req, res) {
    if (refreshState.running) {
      return res.json({ status: 'already_running', startedAt: refreshState.startedAt })
    }

    var lookbackMonths = 12
    if (req.body && req.body.lookback_months !== undefined) {
      var lm = parseInt(req.body.lookback_months, 10)
      if (isNaN(lm) || lm < 1 || lm > 36) {
        return res.status(400).json({
          error: 'Invalid lookback_months: must be an integer between 1 and 36'
        })
      }
      lookbackMonths = lm
    }

    triggerBackgroundRefresh(lookbackMonths, true)
    res.json({ status: 'started', lookback_months: lookbackMonths })
  })

  /**
   * @openapi
   * /api/modules/releases/feature-pressure/refresh/status:
   *   get:
   *     tags: ['Releases']
   *     summary: Check status of the feature pressure refresh
   *     responses:
   *       200:
   *         description: Refresh state
   */
  router.get('/refresh/status', requireAuth, requireScope('releases:read'), function (req, res) {
    res.json(refreshState)
  })

  // Diagnostics hook
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function () {
      var fp = storage.readFromStorage(CACHE_KEY)
      return {
        featurePressure: fp ? {
          generatedAt: fp.metadata && fp.metadata.generated_at,
          lookbackMonths: fp.metadata && fp.metadata.lookback_months,
          totalFeatures: fp.metadata && fp.metadata.total_features,
          totalRfes: fp.metadata && fp.metadata.total_rfes
        } : null,
        refresh: refreshState
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Exports (pure functions exported for testing)
// ---------------------------------------------------------------------------

module.exports = registerRoutes
module.exports.normalizeIssue = normalizeIssue
module.exports.normalizeFeature = normalizeFeature
module.exports.normalizeRfe = normalizeRfe
module.exports.toMonth = toMonth
module.exports.nextMonth = nextMonth
module.exports.generateMonthRange = generateMonthRange
module.exports.lookbackDate = lookbackDate
module.exports.classifyByMonth = classifyByMonth
module.exports.computeComponentPressure = computeComponentPressure
module.exports.computeRfePipeline = computeRfePipeline
module.exports.computeBacklogHalfLife = computeBacklogHalfLife
module.exports.buildHeatmapMatrix = buildHeatmapMatrix
module.exports.computeTrend = computeTrend
module.exports.computeScorecard = computeScorecard
module.exports.jqlUrl = jqlUrl
module.exports.quoteComponent = quoteComponent
module.exports.RFE_ACCEPTED = RFE_ACCEPTED
module.exports.RFE_PENDING = RFE_PENDING
module.exports.CACHE_KEY = CACHE_KEY
module.exports.sanitizeInfinity = sanitizeInfinity
