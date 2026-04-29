const { jiraRequest, JIRA_HOST, fetchAllJqlResults } = require('../../../shared/server/jira')
const { getConfig, saveConfig, deleteConfig } = require('./config')
const { fetchProductsByShortname, fetchAllProducts, getProductPagesToken, getAuthStatus } = require('./product-pages')

const DEMO_MODE = process.env.DEMO_MODE === 'true'

const FIX_VERSION_FIELD_KEY = 'fixVersions'

function getDefaultFixVersionJql(config) {
  if (config.targetVersionJqlFragment) return config.targetVersionJqlFragment
  return 'fixVersion is not EMPTY'
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, '')
}

function toIsoDate(dateValue) {
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseNumber(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  const parsed = Number(val)
  return Number.isFinite(parsed) ? parsed : null
}

function monthKey(dateValue) {
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Map Jira status category to our buckets (matches UI: To Do / Doing / Done). */
function statusCategoryBucket(status) {
  const cat = status?.statusCategory
  const key = normalizeText(cat?.key || '')
  const name = normalizeText(cat?.name || '')
  if (key === 'done' || name === 'done') return 'done'
  if (key === 'indeterminate' || name === 'in progress') return 'doing'
  if (key === 'new' || name === 'to do') return 'to_do'
  // Fallback when category missing (older payloads or unusual configs)
  return statusBucketFallback(status?.name)
}

function statusBucketFallback(statusName) {
  const s = normalizeText(statusName)
  if (!s) return 'to_do'
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'done'
  if (s.includes('progress') || s.includes('review') || s.includes('qa') || s.includes('test') || s.includes('develop')) return 'doing'
  return 'to_do'
}

function getWeight(issue, config) {
  const fields = issue.fields || {}
  const weight = parseNumber(fields[config.featureWeightField])
  if (weight != null && weight > 0) return weight
  const sp = parseNumber(fields[config.storyPointsField])
  if (sp != null && sp > 0) return sp
  return null
}

function normalizeVersionNameFromJira(v) {
  if (v == null) return null
  if (typeof v === 'string') {
    const s = v.trim()
    return s || null
  }
  if (typeof v === 'object') {
    if (v.name != null) {
      const s = String(v.name).trim()
      return s || null
    }
    if (v.value != null && typeof v.value === 'string') {
      const s = v.value.trim()
      return s || null
    }
  }
  return null
}

/** Version names from a Jira version field (fixVersions, multi/single version picker, or string). */
function extractVersionNamesFromField(fields, fieldId) {
  if (!fields || !fieldId) return []
  const raw = fields[fieldId]
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) {
    const out = []
    for (const item of raw) {
      const n = normalizeVersionNameFromJira(item)
      if (n) out.push(n)
    }
    return out
  }
  const n = normalizeVersionNameFromJira(raw)
  return n ? [n] : []
}

function extractFixVersions(issue) {
  return extractVersionNamesFromField(issue.fields || {}, FIX_VERSION_FIELD_KEY)
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

/**
 * Schedule risk from time remaining and open issue count (To Do + Doing), not story points.
 */
function releaseRiskFromIncompleteAndTime(daysRemaining, incompleteIssues, config) {
  const inc = Math.max(0, Math.floor(Number(incompleteIssues) || 0))
  if (inc === 0) return 'green'
  if (daysRemaining <= 0) return 'red'
  const perDay = inc / Math.max(1, daysRemaining)
  if (perDay <= config.riskIssuesPerDayGreen) return 'green'
  if (perDay <= config.riskIssuesPerDayYellow) return 'yellow'
  return 'red'
}

function riskScoreFromLevel(level) {
  if (level === 'red') return 3
  if (level === 'yellow') return 2
  return 1
}

function incompleteIssueCount(totals) {
  if (!totals) return 0
  return Math.max(0, (totals.issues_to_do || 0) + (totals.issues_doing || 0))
}

function buildReleaseRiskSummary(release, risk, riskDriver, daysRemaining) {
  const incomplete = incompleteIssueCount(release.totals)

  if (daysRemaining <= 0) {
    if (incomplete > 0) {
      return `Past due date with ${incomplete} open issue(s) (to do + in progress).`
    }
    return 'Due date has passed; no open issues remain in scope.'
  }

  if (incomplete === 0) {
    return 'No open issues in To Do or In Progress; mapped scope looks complete for this release.'
  }

  if (risk === 'green') {
    return (
      `With ${daysRemaining} day(s) to the due date, ${incomplete} open issue(s) ` +
      'is a manageable load relative to time remaining.'
    )
  }

  if (risk === 'yellow') {
    const who = riskDriver ? `Project ${riskDriver} has` : 'Workload has'
    return `${who} a tight margin: ${incomplete} open issue(s) over ${daysRemaining} day(s).`
  }

  const who = riskDriver ? `Project ${riskDriver}` : 'Open workload'
  return `${who} is high relative to time remaining (${incomplete} open issue(s) in ${daysRemaining} day(s)).`
}

function safeDaysBetween(fromDate, toDate) {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}

async function fetchOpenReleases(storage, config) {
  // New path: product shortnames configured
  if (config.productPagesProductShortnames?.length) {
    try {
      const releases = await fetchProductsByShortname(config.productPagesProductShortnames, config)
      if (releases.length > 0) {
        storage.writeToStorage('release-analysis/product-pages-releases-cache.json', {
          source: 'api',
          fetchedAt: new Date().toISOString(),
          releases
        })
        return releases
      }
    } catch (err) {
      console.error('[release-analysis] Product Pages fetch by shortname failed:', err.message)
    }
    // Fall through to cache on failure or empty result
  }

  // Legacy path: raw URL (preserved for backward compatibility)
  if (config.productPagesReleasesUrl) {
    const token = await getProductPagesToken(config)
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(config.productPagesReleasesUrl, {
      headers,
      signal: AbortSignal.timeout(30000)
    })
    if (!response.ok) {
      throw new Error(`Product Pages API error (${response.status})`)
    }
    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : (payload.releases || payload.items || [])
    const releases = rows
      .map(r => ({
        productName: r.productName || r.product_name || r.product || r.product_shortname || '',
        releaseNumber: r.releaseNumber || r.release_number || r.name || '',
        dueDate: toIsoDate(r.dueDate || r.due_date || r.gaDate || r.ga_date || r.date_finish || r.date_start),
        codeFreezeDate: toIsoDate(r.codeFreezeDate || r.code_freeze_date || r.codeFreeze || r.code_freeze) || null
      }))
      .filter(r => r.productName && r.releaseNumber && r.dueDate)
    storage.writeToStorage('release-analysis/product-pages-releases-cache.json', {
      source: 'api',
      fetchedAt: new Date().toISOString(),
      releases
    })
    return releases
  }

  // Fallback cache. This lets teams load MCP-fetched release snapshots into storage.
  const cached = storage.readFromStorage('release-analysis/product-pages-releases-cache.json')
  if (cached?.releases && Array.isArray(cached.releases)) {
    return cached.releases
  }
  return []
}

/**
 * Future / in-flight releases only (due date on or after today).
 * Past-due GA rows are intentionally excluded from the analysis set — overdue “risk” in buildAnalysis
 * applies to releases that are still in the catalog with remaining open work, not to historical GAs.
 */
function filterUnreleased(releases) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return releases.filter(r => {
    const due = new Date(`${r.dueDate}T00:00:00Z`)
    if (Number.isNaN(due.getTime())) return false
    return due >= today
  })
}

async function fetchIssuesFromJira(config) {
  const clause = getDefaultFixVersionJql(config)

  const jql = config.jiraAllProjects
    ? `${clause} ORDER BY updated DESC`
    : `project in (${config.projectKeys.join(',')}) AND ${clause} ORDER BY updated DESC`

  const fieldList = [
    'summary',
    'status',
    'resolutiondate',
    'project',
    'issuetype',
    'components',
    'parent',
    'customfield_10014',
    config.storyPointsField,
    config.featureWeightField,
    FIX_VERSION_FIELD_KEY
  ]
  const fields = [...new Set(fieldList)].join(',')
  const issues = await fetchAllJqlResults(jiraRequest, jql, fields, { maxResults: 100 }) || []

  return {
    issues,
    fieldMeta: {
      id: FIX_VERSION_FIELD_KEY,
      name: 'Fix Version',
      schemaCustom: ''
    }
  }
}

function jiraConnectivityHint(err) {
  const msg = String(err?.message || err?.cause || err || '')
  if (/ENOTFOUND|getaddrinfo/i.test(msg)) {
    return (
      ' The server process cannot resolve or reach JIRA_HOST (DNS/network). ' +
      'Confirm VPN if required, DNS works on this machine, and outbound HTTPS to Atlassian is allowed. ' +
      'Jira is called from the API server, not only from the browser.'
    )
  }
  if (/ECONNREFUSED|ETIMEDOUT|ECONNRESET|certificate|SSL/i.test(msg)) {
    return ' Check firewall, VPN, corporate proxy, or TLS interception settings for outbound HTTPS from this host.'
  }
  return ''
}

async function fetchUnreleasedJiraFixVersions(config) {
  const releaseMap = new Map()
  const warnings = []

  async function fetchVersionsForProject(projectKey) {
    let startAt = 0
    const maxResults = 50
    let isLast = false

    while (!isLast) {
      const data = await jiraRequest(`/rest/api/3/project/${encodeURIComponent(projectKey)}/version?startAt=${startAt}&maxResults=${maxResults}`)
      const values = data.values || []

      for (const version of values) {
        const name = String(version.name || '').trim()
        if (!name) continue
        if (version.archived) continue
        if (version.released === true) continue

        if (!releaseMap.has(name)) {
          releaseMap.set(name, {
            productName: 'Jira version catalog',
            releaseNumber: name,
            dueDate: toIsoDate(version.releaseDate),
            _projects: new Set()
          })
        }
        const row = releaseMap.get(name)
        row._projects.add(projectKey)
        if (!row.dueDate && version.releaseDate) {
          row.dueDate = toIsoDate(version.releaseDate)
        }
      }

      isLast = data.isLast === true || values.length < maxResults
      startAt += maxResults
    }
  }

  await Promise.all(config.projectKeys.map(async (projectKey) => {
    try {
      await fetchVersionsForProject(projectKey)
    } catch (err) {
      const hint = jiraConnectivityHint(err)
      warnings.push(`Could not load Jira versions for ${projectKey}: ${err.message}.${hint}`)
    }
  }))

  const releases = [...releaseMap.values()].map(r => ({
    productName: `${r.productName} (${[...r._projects].sort().join(', ')})`,
    releaseNumber: r.releaseNumber,
    dueDate: r.dueDate,
    codeFreezeDate: r.codeFreezeDate || null
  }))
  return { releases, warnings }
}

function enrichJiraReleasesWithProductPages(jiraReleases, productPagesReleases) {
  const byNorm = new Map()
  for (const p of productPagesReleases) {
    byNorm.set(normalizeKey(p.releaseNumber), p)
  }
  return jiraReleases.map(r => {
    const match = byNorm.get(normalizeKey(r.releaseNumber))
    return {
      productName: match?.productName || r.productName,
      releaseNumber: r.releaseNumber,
      dueDate: r.dueDate || match?.dueDate || null,
      codeFreezeDate: match?.codeFreezeDate || r.codeFreezeDate || null
    }
  })
}

/**
 * Cards are keyed by Product Pages or Jira Fix Version name. Names often differ only by
 * punctuation/spacing (e.g. rhoai-3.4.EA2 vs rhoai-3.4 EA2). Match exact normalized text first, then
 * alphanumeric-only key (same idea as enrichJiraReleasesWithProductPages).
 */
function findReleaseForTargetVersion(releaseByText, releaseByKey, versionName) {
  const byText = releaseByText.get(normalizeText(versionName))
  if (byText) return byText
  return releaseByKey.get(normalizeKey(versionName))
}

function buildAnalysis(releases, issues, fieldMeta, config) {
  const releaseByText = new Map()
  const releaseByKey = new Map()
  for (const r of releases) {
    const entry = {
      productName: r.productName,
      releaseNumber: r.releaseNumber,
      dueDate: r.dueDate,
      codeFreezeDate: r.codeFreezeDate || null,
      teams: {},
      issues: [],
      /**
       * Weighted (to_do/doing/done/remaining/total): story points — used for risk & throughput.
       * issues_*: distinct issue counts per status for UI.
       */
      totals: {
        to_do: 0,
        doing: 0,
        done: 0,
        remaining: 0,
        total: 0,
        issues: 0,
        issues_to_do: 0,
        issues_doing: 0,
        issues_done: 0
      },
      risk: 'green'
    }
    releaseByText.set(normalizeText(r.releaseNumber), entry)
    const k = normalizeKey(r.releaseNumber)
    if (!releaseByKey.has(k)) releaseByKey.set(k, entry)
  }

  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - config.baselineDays)

  const throughputByTeamMonthly = {}

  let issuesWithParsedFixVersion = 0
  const sampleFixVersionNames = []

  for (let ii = 0; ii < issues.length; ii++) {
    const issue = issues[ii]
    const projectKey = issue.fields?.project?.key || 'UNKNOWN'
    const key = issue.key
    const summary = issue.fields?.summary || ''
    const statusObj = issue.fields?.status
    const status = statusObj?.name || 'Unknown'
    const bucket = statusCategoryBucket(statusObj)
    const weight = getWeight(issue, config)
    const unitWeight = weight == null ? 1 : weight
    const fixVersions = extractFixVersions(issue)

    if (fixVersions.length > 0) {
      issuesWithParsedFixVersion++
      for (const n of fixVersions) {
        if (sampleFixVersionNames.length < 15 && !sampleFixVersionNames.includes(n)) {
          sampleFixVersionNames.push(n)
        }
      }
    }

    if (fixVersions.length === 0) continue

    const link = `${JIRA_HOST}/browse/${encodeURIComponent(key)}`
    const resolvedAt = issue.fields?.resolutiondate

    if (bucket === 'done' && resolvedAt) {
      const resolvedDate = new Date(resolvedAt)
      if (!Number.isNaN(resolvedDate.getTime()) && resolvedDate >= cutoff) {
        const mk = monthKey(resolvedDate)
        if (mk) {
          if (!throughputByTeamMonthly[projectKey]) throughputByTeamMonthly[projectKey] = {}
          if (!throughputByTeamMonthly[projectKey][mk]) throughputByTeamMonthly[projectKey][mk] = 0
          throughputByTeamMonthly[projectKey][mk] += unitWeight
        }
      }
    }

    const releasesForIssue = new Map()
    for (const target of fixVersions) {
      const release = findReleaseForTargetVersion(releaseByText, releaseByKey, target)
      if (!release) continue
      if (!releasesForIssue.has(release)) {
        releasesForIssue.set(release, target)
      }
    }

    const issueTypeName = issue.fields?.issuetype?.name || ''
    const components = (issue.fields?.components || [])
      .map(c => String(c.name || '').trim())
      .filter(Boolean)
    const parentKey = issue.fields?.parent?.key || issue.fields?.customfield_10014 || null

    for (const [release, target] of releasesForIssue) {
      release.issues.push({
        key,
        summary,
        projectKey,
        issueType: issueTypeName,
        status,
        statusBucket: bucket,
        weight: unitWeight,
        link,
        fixVersion: target,
        components,
        resolvedAt: resolvedAt || null,
        parentKey
      })

      if (!release.teams[projectKey]) {
        release.teams[projectKey] = {
          projectKey,
          to_do: 0,
          doing: 0,
          done: 0,
          remaining: 0,
          total: 0,
          issues: 0,
          issues_to_do: 0,
          issues_doing: 0,
          issues_done: 0,
          expectedThroughputPerMonth: 0,
          expectedThroughputToDue: 0,
          actualDoneThisRelease: 0,
          requiredRatePerDay: 0,
          availableRatePerDay: 0,
          ratio: 0,
          risk: 'green',
          baseline: { avgPerMonth: 0, p90PerMonth: 0, mode: config.baselineMode }
        }
      }

      release.teams[projectKey][bucket] += unitWeight
      release.teams[projectKey].total += unitWeight
      release.teams[projectKey].issues += 1
      if (bucket === 'to_do') release.teams[projectKey].issues_to_do += 1
      else if (bucket === 'doing') release.teams[projectKey].issues_doing += 1
      else release.teams[projectKey].issues_done += 1
      if (bucket !== 'done') release.teams[projectKey].remaining += unitWeight

      release.totals[bucket] += unitWeight
      release.totals.total += unitWeight
      release.totals.issues += 1
      if (bucket === 'to_do') release.totals.issues_to_do += 1
      else if (bucket === 'doing') release.totals.issues_doing += 1
      else release.totals.issues_done += 1
      if (bucket !== 'done') release.totals.remaining += unitWeight
    }
  }

  const releasesOut = []
  for (const release of releaseByText.values()) {
    const daysRemaining = safeDaysBetween(now, release.dueDate)
    const teamEntries = Object.values(release.teams)
    let riskDriver = null

    if (teamEntries.length === 0) {
      release.risk = 'none'
      release.riskScore = null
      release.riskSummary = ''
      release.riskDriver = null
      release.daysRemaining = daysRemaining
      release.capacityMode = config.baselineMode
      release.issues.sort((a, b) => a.projectKey.localeCompare(b.projectKey) || a.key.localeCompare(b.key))
      releasesOut.push(release)
      continue
    }

    let maxTeamIncomplete = -1
    for (const team of teamEntries) {
      const monthlySeries = Object.values(throughputByTeamMonthly[team.projectKey] || {})
      const avgPerMonth = monthlySeries.length
        ? monthlySeries.reduce((a, b) => a + b, 0) / monthlySeries.length
        : 0
      const p90PerMonth = monthlySeries.length ? percentile(monthlySeries, 90) : 0
      const baselinePerMonth = config.baselineMode === 'avg' ? avgPerMonth : p90PerMonth
      const availableRatePerDay = baselinePerMonth / 30
      const requiredRatePerDay = daysRemaining > 0 ? team.remaining / daysRemaining : (team.remaining > 0 ? Infinity : 0)
      const ratio = availableRatePerDay > 0 ? requiredRatePerDay / availableRatePerDay : (requiredRatePerDay > 0 ? Infinity : 0)
      const teamIncompleteIssues = (team.issues_to_do || 0) + (team.issues_doing || 0)
      const teamRisk = releaseRiskFromIncompleteAndTime(daysRemaining, teamIncompleteIssues, config)

      team.baseline.avgPerMonth = +avgPerMonth.toFixed(2)
      team.baseline.p90PerMonth = +p90PerMonth.toFixed(2)
      team.expectedThroughputPerMonth = +baselinePerMonth.toFixed(2)
      team.expectedThroughputToDue = +((baselinePerMonth / 30) * daysRemaining).toFixed(2)
      team.actualDoneThisRelease = +team.done.toFixed(2)
      team.requiredRatePerDay = Number.isFinite(requiredRatePerDay) ? +requiredRatePerDay.toFixed(3) : requiredRatePerDay
      team.availableRatePerDay = +availableRatePerDay.toFixed(3)
      team.ratio = Number.isFinite(ratio) ? +ratio.toFixed(2) : ratio
      team.risk = teamRisk

      if (teamIncompleteIssues > maxTeamIncomplete) {
        maxTeamIncomplete = teamIncompleteIssues
        riskDriver = team.projectKey
      }
    }

    if (maxTeamIncomplete === 0) riskDriver = null

    const aggIncomplete = incompleteIssueCount(release.totals)
    const aggRisk = releaseRiskFromIncompleteAndTime(daysRemaining, aggIncomplete, config)
    release.risk = aggRisk
    release.riskScore = riskScoreFromLevel(aggRisk)
    release.riskSummary = buildReleaseRiskSummary(release, aggRisk, riskDriver, daysRemaining)
    release.riskDriver = riskDriver
    release.daysRemaining = daysRemaining
    release.capacityMode = config.baselineMode
    release.issues.sort((a, b) => a.projectKey.localeCompare(b.projectKey) || a.key.localeCompare(b.key))
    releasesOut.push(release)
  }

  releasesOut.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  return {
    generatedAt: new Date().toISOString(),
    baselineDays: config.baselineDays,
    capacityMode: config.baselineMode,
    projects: config.projectKeys,
    jiraQueryScope: config.jiraAllProjects ? 'all_projects' : 'project_list',
    fixVersionField: FIX_VERSION_FIELD_KEY,
    fixVersionFieldName: 'Fix Version',
    fixVersionJql: getDefaultFixVersionJql(config),
    fixVersionDiagnostics: {
      jiraIssuesFetched: issues.length,
      issuesWithFixVersionParsed: issuesWithParsedFixVersion,
      sampleFixVersionNames: sampleFixVersionNames
    },
    riskThresholds: {
      issuesPerDayGreenMax: config.riskIssuesPerDayGreen,
      issuesPerDayYellowMax: config.riskIssuesPerDayYellow
    },
    releases: releasesOut
  }
}

/**
 * Discovers scrum boards for the configured project keys and finds the most
 * recently completed sprint to establish a synchronized 2-week window.
 * Falls back to a calendar-based 14-day window if no sprints are found.
 */
async function detectSprintWindow(config) {
  const FALLBACK_DAYS = 14
  const now = new Date()
  const fallback = {
    startDate: new Date(now.getTime() - FALLBACK_DAYS * 86400000).toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
    sprintName: null,
    source: 'calendar'
  }

  try {
    const boardResults = await Promise.all(config.projectKeys.map(async (projectKey) => {
      try {
        const data = await jiraRequest(
          `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&type=scrum&maxResults=10`
        )
        return (data?.values || []).map(b => b.id)
      } catch {
        return []
      }
    }))
    const boardIds = [...new Set(boardResults.flat())]

    if (!boardIds.length) return fallback

    const sprintResults = await Promise.all(boardIds.slice(0, 5).map(async (boardId) => {
      try {
        const pageSize = 50
        const probe = await jiraRequest(
          `/rest/agile/1.0/board/${boardId}/sprint?state=closed&startAt=0&maxResults=1`
        )
        if (!probe?.values?.length) return null
        const total = probe.total ?? 0
        const lastPageStart = Math.max(0, total - pageSize)
        const lastPage = await jiraRequest(
          `/rest/agile/1.0/board/${boardId}/sprint?state=closed&startAt=${lastPageStart}&maxResults=${pageSize}`
        )
        let best = null
        for (const s of (lastPage?.values || [])) {
          if (!s.startDate || !s.endDate) continue
          const endIso = (s.completeDate || s.endDate).slice(0, 10)
          if (!best || endIso > best.endDate) {
            best = {
              startDate: s.startDate.slice(0, 10),
              endDate: endIso,
              sprintName: s.name,
              sprintId: s.id,
              boardId,
              source: 'sprint'
            }
          }
        }
        return best
      } catch (err) {
        console.warn(`[release-analysis] Could not fetch sprints for board ${boardId}: ${err.message}`)
        return null
      }
    }))

    let latestSprint = null
    for (const candidate of sprintResults) {
      if (candidate && (!latestSprint || candidate.endDate > latestSprint.endDate)) {
        latestSprint = candidate
      }
    }

    return latestSprint || fallback
  } catch (err) {
    console.warn(`[release-analysis] Sprint detection failed, using calendar fallback: ${err.message}`)
    return fallback
  }
}

/**
 * Fetches all issue keys belonging to a specific sprint.
 * Used to identify Scrum-tracked issues for differentiated throughput.
 */
async function fetchSprintIssueKeys(sprintId) {
  if (!sprintId) return new Set()
  try {
    const issues = await fetchAllJqlResults(
      jiraRequest,
      `sprint = ${sprintId}`,
      'key',
      { maxResults: 100 }
    )
    return new Set((issues || []).map(i => i.key))
  } catch (err) {
    console.warn(`[release-analysis] Could not fetch sprint ${sprintId} issues: ${err.message}`)
    return new Set()
  }
}

const DELIVERABLE_TYPES = new Set(['Epic', 'Feature', 'Initiative'])

const VELOCITY_MONTHS = 6
const VELOCITY_WINDOW_DAYS = 14

const VELOCITY_WORK_TYPES = ['Story', 'Task', 'Bug', 'Spike', 'Sub-task']

/**
 * Fetches all issues resolved in the past 6 months for the configured projects
 * and aggregates per-component velocity (average issues per 2-week window).
 *
 * Issue type rules:
 *  - All projects: Story, Task, Bug, Spike, Sub-task
 *  - Per-project extras via config.velocityExtraJqlByProject (e.g. AIPCC
 *    Epics with label "package")
 *
 * A 50% discount is applied to the raw count to approximate release-supporting work.
 */
async function fetchHistoricalComponentVelocity(config) {
  const weeksBack = Math.ceil((VELOCITY_MONTHS * 30) / 7)
  const dateClause = `resolutiondate >= -${weeksBack}w AND statusCategory = Done`
  const typeList = VELOCITY_WORK_TYPES.map(t => `"${t}"`).join(',')

  const extraJqlByProject = config.velocityExtraJqlByProject || {}
  const activeExtraProjects = config.jiraAllProjects
    ? Object.keys(extraJqlByProject)
    : config.projectKeys.filter(k => k in extraJqlByProject)
  const extraProjectSet = new Set(activeExtraProjects)
  const regularProjects = config.jiraAllProjects
    ? null
    : config.projectKeys.filter(k => !extraProjectSet.has(k))

  const queries = []

  if (regularProjects === null) {
    queries.push({
      jql: `issuetype in (${typeList}) AND ${dateClause} ORDER BY resolutiondate DESC`,
      fields: 'components,resolutiondate,project'
    })
  } else if (regularProjects.length) {
    queries.push({
      jql: `project in (${regularProjects.join(',')}) AND issuetype in (${typeList}) AND ${dateClause} ORDER BY resolutiondate DESC`,
      fields: 'components,resolutiondate,project'
    })
  }

  for (const projKey of activeExtraProjects) {
    queries.push({
      jql: `project = ${projKey} AND issuetype in (${typeList}) AND ${dateClause} ORDER BY resolutiondate DESC`,
      fields: 'components,resolutiondate,project'
    })
    queries.push({
      jql: `project = ${projKey} AND ${extraJqlByProject[projKey]} AND ${dateClause} ORDER BY resolutiondate DESC`,
      fields: 'components,resolutiondate,project'
    })
  }

  let allIssues = []
  const seenKeys = new Set()
  try {
    const results = await Promise.all(
      queries.map(q => fetchAllJqlResults(jiraRequest, q.jql, q.fields, { maxResults: 100 }))
    )
    for (const batch of results) {
      for (const issue of (batch || [])) {
        if (!seenKeys.has(issue.key)) {
          seenKeys.add(issue.key)
          allIssues.push(issue)
        }
      }
    }
  } catch (err) {
    console.warn(`[release-analysis] Historical velocity fetch failed: ${err.message}`)
    return {}
  }

  const totalDays = weeksBack * 7
  const numWindows = totalDays / VELOCITY_WINDOW_DAYS

  const compCounts = {}
  for (const issue of allIssues) {
    const components = (issue.fields?.components || [])
      .map(c => String(c.name || '').trim())
      .filter(Boolean)
    if (!components.length) components.push('(No component)')
    for (const comp of components) {
      compCounts[comp] = (compCounts[comp] || 0) + 1
    }
  }

  const discountFactor = config.velocityDiscountFactor ?? 0.5
  const velocity = {}
  for (const [comp, count] of Object.entries(compCounts)) {
    velocity[comp] = {
      resolved6m: count,
      windows: Math.round(numWindows * 10) / 10,
      velocity: Math.round(((count * discountFactor) / numWindows) * 10) / 10
    }
  }
  return velocity
}

/**
 * For each deliverable key (epic/feature/initiative), queries Jira for child
 * issues via "Epic Link" JQL and resolves the parent from `parent.key` or
 * `customfield_10014` (Epic Link field).
 * Returns { KEY: { total, done, remaining } }.
 */
async function fetchDeliverableChildrenCounts(deliverableKeys) {
  const counts = {}
  for (const k of deliverableKeys) counts[k] = { total: 0, done: 0, remaining: 0 }
  if (!deliverableKeys.length) return counts

  const batchSize = 40
  const batches = []
  for (let i = 0; i < deliverableKeys.length; i += batchSize) {
    batches.push(deliverableKeys.slice(i, i + batchSize))
  }

  await Promise.all(batches.map(async (batch, idx) => {
    const keysStr = batch.join(', ')
    const jql = `"Epic Link" in (${keysStr}) ORDER BY key ASC`
    try {
      const children = await fetchAllJqlResults(
        jiraRequest, jql,
        'status,parent,customfield_10014',
        { maxResults: 100 }
      )
      for (const child of (children || [])) {
        const parentKey =
          child.fields?.parent?.key ||
          child.fields?.customfield_10014 ||
          null
        if (!parentKey || !counts[parentKey]) continue
        counts[parentKey].total++
        const cat = child.fields?.status?.statusCategory?.key
        if (cat === 'done') counts[parentKey].done++
        else counts[parentKey].remaining++
      }
    } catch (err) {
      console.warn(`[release-analysis] Could not fetch children for deliverables batch ${idx}: ${err.message}`)
    }
  }))
  return counts
}

async function runFullAnalysis(storage, config) {
  const releases = await fetchOpenReleases(storage, config)
  const openReleases = filterUnreleased(releases)

  let issues = []
  let fieldMeta = { id: null, name: '', schemaCustom: '' }
  let jiraWarning = null
  let jiraReleases = []
  let sprintWindow = null
  let componentVelocity = {}
  try {
    const [jiraResult, unreleasedJiraFixVersionData, detectedWindow, historicalVelocity] = await Promise.all([
      fetchIssuesFromJira(config),
      fetchUnreleasedJiraFixVersions(config),
      detectSprintWindow(config),
      fetchHistoricalComponentVelocity(config)
    ])
    sprintWindow = detectedWindow
    issues = jiraResult.issues
    fieldMeta = jiraResult.fieldMeta
    componentVelocity = historicalVelocity
    jiraReleases = unreleasedJiraFixVersionData.releases
    if (unreleasedJiraFixVersionData.warnings.length) {
      jiraWarning = unreleasedJiraFixVersionData.warnings.join(' | ')
    }
  } catch (err) {
    jiraWarning = `Jira data unavailable: ${err.message}`
  }

  // When Product Pages product shortnames are configured, use Product Pages as
  // the primary release source. Otherwise fall back to the legacy behavior where
  // Jira Fix Versions are primary and Product Pages only enriches metadata.
  let analysisReleases
  if (config.productPagesProductShortnames?.length) {
    analysisReleases = openReleases
  } else if (jiraReleases.length) {
    analysisReleases = enrichJiraReleasesWithProductPages(jiraReleases, openReleases)
  } else {
    analysisReleases = openReleases
  }
  const analysisOpenReleases = filterUnreleased(analysisReleases)

  if (!analysisOpenReleases.length) {
    throw new Error(
      'No unreleased open releases found. Ensure Jira Fix Versions exist for your projects, ' +
      'or configure Product Pages product shortnames in Release Analysis settings.'
    )
  }

  const result = buildAnalysis(analysisOpenReleases, issues, fieldMeta, config)
  result.sprintWindow = sprintWindow || {
    startDate: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    sprintName: null,
    source: 'calendar'
  }

  // Fetch sprint member issue keys for Scrum vs Kanban differentiation
  const sprintId = sprintWindow?.sprintId || null
  let sprintIssueKeys = []
  if (sprintId) {
    try {
      const keySet = await fetchSprintIssueKeys(sprintId)
      sprintIssueKeys = [...keySet]
    } catch (err) {
      console.warn(`[release-analysis] Sprint issue key fetch failed: ${err.message}`)
    }
  }
  result.sprintWindow.sprintIssueKeys = sprintIssueKeys
  result.componentVelocity = componentVelocity

  // Enrich deliverables (epic/feature/initiative) with child issue counts
  const deliverableKeys = new Set()
  for (const release of result.releases) {
    for (const issue of release.issues) {
      if (DELIVERABLE_TYPES.has(issue.issueType)) deliverableKeys.add(issue.key)
    }
  }
  if (deliverableKeys.size > 0) {
    try {
      const childCounts = await fetchDeliverableChildrenCounts([...deliverableKeys])
      for (const release of result.releases) {
        for (const issue of release.issues) {
          const cc = childCounts[issue.key]
          if (cc && cc.total > 0) {
            issue.childrenTotal = cc.total
            issue.childrenDone = cc.done
            issue.childrenRemaining = cc.remaining
          }
        }
      }
    } catch (err) {
      console.warn(`[release-analysis] Deliverable children enrichment failed: ${err.message}`)
    }
  }

  if (jiraWarning) result.warning = jiraWarning

  const d = result.fixVersionDiagnostics
  if (d && issues.length > 0 && d.issuesWithFixVersionParsed === 0) {
    const msg =
      'No Fix Version values could be parsed from fetched issues.'
    result.warning = result.warning ? `${result.warning} | ${msg}` : msg
  }

  return result
}

const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context
  const { readFromStorage, writeToStorage } = storage

  let refreshState = { running: false, lastResult: null }

  function triggerBackgroundRefresh() {
    if (refreshState.running) return
    refreshState = { running: true, startedAt: new Date().toISOString(), lastResult: refreshState.lastResult }
    const config = getConfig(readFromStorage)
    runFullAnalysis(storage, config)
      .then(result => {
        writeToStorage('release-analysis/analysis-cache.json', {
          cachedAt: new Date().toISOString(),
          data: result
        })
        refreshState.lastResult = {
          status: 'success',
          message: `Analysis generated with ${result.releases?.length || 0} release(s)`,
          completedAt: new Date().toISOString()
        }
      })
      .catch(err => {
        console.error('[release-analysis] Background refresh failed:', err)
        refreshState.lastResult = {
          status: 'error',
          message: err.message,
          completedAt: new Date().toISOString()
        }
      })
      .finally(() => { refreshState.running = false })
  }

  // --- Config routes ---

  router.get('/config', requireAdmin, function(req, res) {
    const saved = readFromStorage('release-analysis/config.json')
    const hasStoredConfig = saved && typeof saved === 'object' && !saved._deleted
    const config = getConfig(readFromStorage)
    // Never expose featureWeightField fallback in stored form — show raw stored value
    if (hasStoredConfig && saved.featureWeightField === undefined) {
      config.featureWeightField = ''
    }
    res.json({ config, source: hasStoredConfig ? 'stored' : 'env' })
  })

  router.post('/config', requireAdmin, function(req, res) {
    try {
      saveConfig(writeToStorage, req.body)
      res.json({ status: 'saved' })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  router.delete('/config', requireAdmin, function(req, res) {
    deleteConfig(writeToStorage)
    const config = getConfig(readFromStorage)
    res.json({ config, source: 'env' })
  })

  // --- Product Pages routes ---

  router.get('/product-pages/products', requireAdmin, async function(req, res) {
    try {
      const config = getConfig(readFromStorage)
      const authStatus = getAuthStatus()
      const products = await fetchAllProducts(config)
      res.json({ products, authStatus })
    } catch (err) {
      console.error('[release-analysis] product-pages/products error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  // --- Refresh routes ---

  router.get('/refresh/status', requireAuth, function(req, res) {
    res.json(refreshState)
  })

  router.post('/refresh', requireAdmin, function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' })
    }
    if (refreshState.running) {
      return res.json({ status: 'already_running' })
    }
    triggerBackgroundRefresh()
    res.json({ status: 'started' })
  })

  // --- Analysis route (stale-while-revalidate) ---

  router.get('/analysis', requireAuth, function(req, res) {
    try {
      const forceRefresh = req.query.refresh === 'true'
      const cached = readFromStorage('release-analysis/analysis-cache.json')
      const hasCachedData = cached?.data && cached.cachedAt

      if (hasCachedData) {
        const age = Date.now() - new Date(cached.cachedAt).getTime()
        const isStale = age >= CACHE_MAX_AGE_MS

        if (isStale || forceRefresh) {
          triggerBackgroundRefresh()
        }

        const payload = {
          ...cached.data,
          _cacheStale: isStale || forceRefresh,
          _refreshing: refreshState.running
        }
        return res.json(payload)
      }

      // No cache at all — trigger background refresh, return a waiting status
      triggerBackgroundRefresh()
      res.status(202).json({
        _cacheStale: true,
        _refreshing: true,
        _noCache: true,
        releases: [],
        warning: 'Analysis is being generated for the first time. This may take a few minutes.'
      })
    } catch (error) {
      console.error('[release-analysis] analysis error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // --- Startup cache seeding ---
  // Warm the cache in the background so the first user request is instant
  if (!DEMO_MODE) {
    const existing = readFromStorage('release-analysis/analysis-cache.json')
    const hasFreshCache = existing?.data && existing.cachedAt &&
      (Date.now() - new Date(existing.cachedAt).getTime()) < CACHE_MAX_AGE_MS
    if (!hasFreshCache) {
      console.log('[release-analysis] No fresh cache found — seeding analysis in background')
      setTimeout(() => triggerBackgroundRefresh(), 2000)
    }
  }

  router.post('/admin/releases', requireAdmin, function(req, res) {
    try {
      const releases = Array.isArray(req.body?.releases) ? req.body.releases : null
      if (!releases || releases.length === 0) {
        return res.status(400).json({ error: 'Request must include non-empty releases array' })
      }
      const normalized = releases.map(r => ({
        productName: r.productName,
        releaseNumber: r.releaseNumber,
        dueDate: toIsoDate(r.dueDate),
        codeFreezeDate: toIsoDate(r.codeFreezeDate) || null
      })).filter(r => r.productName && r.releaseNumber && r.dueDate)

      if (normalized.length === 0) {
        return res.status(400).json({ error: 'No valid releases after normalization' })
      }

      writeToStorage('release-analysis/product-pages-releases-cache.json', {
        source: 'manual',
        fetchedAt: new Date().toISOString(),
        releases: normalized
      })
      res.json({ success: true, count: normalized.length })
    } catch (error) {
      console.error('[release-analysis] save releases error:', error)
      res.status(500).json({ error: error.message })
    }
  })
}
