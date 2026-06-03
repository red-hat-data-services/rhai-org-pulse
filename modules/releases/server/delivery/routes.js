const sharedJira = require('../../../../shared/server/jira')
var { jiraRequest, JIRA_HOST, fetchAllJqlResults } = sharedJira
const { getConfig, saveConfig, deleteConfig } = require('./config')
const productPages = require('./product-pages')
const { fetchProductsByShortname, fetchAllProducts, getProductPagesToken, getAuthStatus } = productPages
const registerConformaRoutes = require('./conforma')
const { logAudit } = require('../planning/audit-log')

const DEMO_MODE = process.env.DEMO_MODE === 'true'

const FIX_VERSION_FIELD_KEY = 'fixVersions'

function getDefaultFixVersionJql(config) {
  if (config.targetVersionJqlFragment) return config.targetVersionJqlFragment
  // Fallback: match any Target Version that looks like a version number (3.x, 4.x, etc.)
  // This auto-discovers future versions without manual config updates
  return 'cf[10855] is not EMPTY'
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

/**
 * Normalizes release/fix version names by removing z-stream notation.
 * Z-stream releases (async/minor updates) should group with parent version.
 * Examples:
 *   "rhoai-3.5.z" → "rhoai-3.5"
 *   "rhoai-3.5.z.EA1" → "rhoai-3.5.EA1"
 *   "RHAI 3.5.z" → "RHAI 3.5"
 */
function normalizeReleaseNumber(value) {
  if (!value) return value
  // Remove .z notation (z-stream releases)
  return String(value).replace(/\.z\b/gi, '')
}

function normalizeKey(value) {
  // Remove common suffixes like " release", " GA", etc. before normalizing
  let normalized = normalizeText(value);
  normalized = normalized.replace(/\s+release$/i, ''); // "rhelai-3.5 EA1 release" → "rhelai-3.5 ea1"
  normalized = normalized.replace(/\s+ga$/i, '');      // "RHAII-3.5 GA" → "rhaii-3.5"
  normalized = normalized.replace(/\.z\b/gi, '');      // "rhoai-3.5.z.EA1" → "rhoai-3.5.ea1"
  return normalized.replace(/[^a-z0-9]/g, '');
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

/**
 * Build regex patterns for phase-aware version matching.
 * Match base version OR phase-specific version, but NOT other phases or z-stream.
 * Examples for "3.4 EA1":
 *   MATCH: rhoai-3.4, rhoai-3.4.EA1, RHAII-3.4 EA1
 *   NO MATCH: rhoai-3.4.EA2, rhoai-3.4.1, RHAII-3.4 EA2
 */
function buildPhaseVersionPatterns(version, phase) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedPhase = phase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    new RegExp(`-${escaped}$`),                    // Pattern 1: base version (e.g., "rhoai-3.4")
    new RegExp(`-${escaped}\\.${escapedPhase}$`),  // Pattern 2: dot-separated phase (e.g., "rhoai-3.4.EA1")
    new RegExp(`-${escaped}\\s+${escapedPhase}$`)  // Pattern 3: space-separated phase (e.g., "RHAII-3.4 EA1")
  ]
}

function extractFixVersions(issue) {
  const versions = extractVersionNamesFromField(issue.fields || {}, FIX_VERSION_FIELD_KEY)
  // Also check Target Version custom field (customfield_10855) - used by RHAISTRAT Features
  const targetVersions = extractVersionNamesFromField(issue.fields || {}, 'customfield_10855')
  // Combine and deduplicate
  const combined = [...new Set([...versions, ...targetVersions])]
  return combined
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

/**
 * Discovers releases by querying Jira and extracting unique Target Version values.
 * Enriches with metadata from storage (product names, dates).
 * Returns releases in the same format as Product Pages.
 */
async function discoverReleasesFromJira(storage, config) {
  // Query Jira using the configured Target Version JQL
  const jqlClause = getDefaultFixVersionJql(config)
  if (!jqlClause) return []

  const projectsFilter = config.jiraAllProjects
    ? ''
    : `project in (${config.projectKeys.map(k => `"${k}"`).join(', ')}) AND `
  const jql = `${projectsFilter}issuetype = Feature AND ${jqlClause} ORDER BY updated DESC`

  const issues = await fetchAllJqlResults(jiraRequest, jql, FIX_VERSION_FIELD_KEY, { maxResults: 100 })

  // Extract unique Target Version values
  const releaseVersions = new Set()
  const featureCounts = new Map()

  for (const issue of issues) {
    const fixVersions = extractFixVersions(issue)
    for (const version of fixVersions) {
      releaseVersions.add(version)
      featureCounts.set(version, (featureCounts.get(version) || 0) + 1)
    }
  }

  // Load metadata from storage
  const metadata = storage.readFromStorage('releases/delivery/releases-metadata.json') || {}

  // Build releases array with metadata
  const releases = []
  for (const version of releaseVersions) {
    const meta = metadata[version] || {}
    releases.push({
      productName: meta.productName || version.split('-')[0] || 'Unknown',
      releaseNumber: version,
      dueDate: meta.dueDate || null,
      codeFreezeDate: meta.codeFreezeDate || null,
      featureFreezeDate: meta.featureFreezeDate || null,
      featureCount: featureCounts.get(version) || 0
    })
  }

  return releases
}

async function fetchOpenReleases(storage, config) {
  // Priority 1: Jira-discovered releases with metadata
  if (config.targetVersionJqlFragment) {
    try {
      const releases = await discoverReleasesFromJira(storage, config)
      if (releases.length > 0) {
        return releases
      }
    } catch (err) {
      console.error('[releases/delivery] Jira release discovery failed:', err.message)
    }
    // Fall through to other methods on failure
  }

  // Priority 2: product shortnames configured
  if (config.productPagesProductShortnames?.length) {
    try {
      const releases = await fetchProductsByShortname(config.productPagesProductShortnames, config)
      if (releases.length > 0) {
        storage.writeToStorage('releases/delivery/product-pages-releases-cache.json', {
          source: 'api',
          fetchedAt: new Date().toISOString(),
          releases
        })
        return releases
      }
    } catch (err) {
      console.error('[releases/delivery] Product Pages fetch by shortname failed:', err.message)
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
        codeFreezeDate: toIsoDate(r.codeFreezeDate || r.code_freeze_date || r.codeFreeze || r.code_freeze) || null,
        featureFreezeDate: toIsoDate(r.featureFreezeDate || r.feature_freeze_date || r.featureFreeze || r.feature_freeze) || null
      }))
      .filter(r => r.productName && r.releaseNumber && r.dueDate)
    storage.writeToStorage('releases/delivery/product-pages-releases-cache.json', {
      source: 'api',
      fetchedAt: new Date().toISOString(),
      releases
    })
    return releases
  }

  // Fallback cache. This lets teams load MCP-fetched release snapshots into storage.
  const cached = storage.readFromStorage('releases/delivery/product-pages-releases-cache.json')
  if (cached?.releases && Array.isArray(cached.releases)) {
    return cached.releases
  }
  return []
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
    FIX_VERSION_FIELD_KEY,
    'customfield_10855' // Target Version - used by RHAISTRAT Features
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

/**
 * Cards are keyed by Product Pages or Jira Fix Version name. Names often differ only by
 * punctuation/spacing (e.g. rhoai-3.4.EA2 vs rhoai-3.4 EA2). Match exact normalized text first, then
 * alphanumeric-only key.
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
    // Normalize release number to remove z-stream notation
    const normalizedReleaseNumber = normalizeReleaseNumber(r.releaseNumber)

    const entry = {
      productName: r.productName,
      releaseNumber: normalizedReleaseNumber,
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
    releaseByText.set(normalizeText(normalizedReleaseNumber), entry)
    const k = normalizeKey(normalizedReleaseNumber)
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
        console.warn(`[releases/delivery] Could not fetch sprints for board ${boardId}: ${err.message}`)
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
    console.warn(`[releases/delivery] Sprint detection failed, using calendar fallback: ${err.message}`)
    return fallback
  }
}

/**
 * Fetches all issue keys belonging to a specific sprint.
 * Used to identify Scrum-tracked issues for differentiated throughput.
 */
async function fetchSprintIssueKeys(sprintId) {
  if (!sprintId) return new Set()
  const sanitizedId = parseInt(sprintId, 10)
  if (!Number.isFinite(sanitizedId)) return new Set()
  try {
    const issues = await fetchAllJqlResults(
      jiraRequest,
      `sprint = ${sanitizedId}`,
      'key',
      { maxResults: 100 }
    )
    return new Set((issues || []).map(i => i.key))
  } catch (err) {
    console.warn(`[releases/delivery] Could not fetch sprint ${sprintId} issues: ${err.message}`)
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
 * Counted issue types: Story, Task, Bug, Spike, Sub-task.
 */
async function fetchHistoricalComponentVelocity(config) {
  const weeksBack = Math.ceil((VELOCITY_MONTHS * 30) / 7)
  const dateClause = `resolutiondate >= -${weeksBack}w AND statusCategory = Done`
  const typeList = VELOCITY_WORK_TYPES.map(t => `"${t}"`).join(',')

  let jql
  if (config.jiraAllProjects) {
    jql = `issuetype in (${typeList}) AND ${dateClause} ORDER BY resolutiondate DESC`
  } else {
    if (!config.projectKeys.length) return {}
    jql = `project in (${config.projectKeys.join(',')}) AND issuetype in (${typeList}) AND ${dateClause} ORDER BY resolutiondate DESC`
  }

  let allIssues
  try {
    allIssues = (await fetchAllJqlResults(jiraRequest, jql, 'components,resolutiondate,project', { maxResults: 100 })) || []
  } catch (err) {
    console.warn(`[releases/delivery] Historical velocity fetch failed: ${err.message}`)
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

  const velocity = {}
  for (const [comp, count] of Object.entries(compCounts)) {
    velocity[comp] = {
      resolved6m: count,
      windows: Math.round(numWindows * 10) / 10,
      velocity: Math.floor(count / numWindows)
    }
  }
  return velocity
}

/**
 * Fetches unclosed (statusCategory != Done) work-item issues per component
 * that have a fixVersion assigned. Returns a map of
 * { componentName: { totalOpen, openByVersion: { versionName: count } } }.
 *
 * "Other Open Work" on a release card = totalOpen − currentReleaseOpen,
 * i.e. versioned open work on other releases.
 */
async function fetchComponentGlobalWorkload(config) {
  const typeList = VELOCITY_WORK_TYPES.map(t => `"${t}"`).join(',')

  let jql
  if (config.jiraAllProjects) {
    jql = `issuetype in (${typeList}) AND statusCategory != Done AND fixVersion is not EMPTY ORDER BY key ASC`
  } else {
    if (!config.projectKeys.length) return {}
    jql = `project in (${config.projectKeys.join(',')}) AND issuetype in (${typeList}) AND statusCategory != Done AND fixVersion is not EMPTY ORDER BY key ASC`
  }

  let allIssues
  try {
    allIssues = (await fetchAllJqlResults(jiraRequest, jql, `components,${FIX_VERSION_FIELD_KEY}`, { maxResults: 100 })) || []
  } catch (err) {
    console.warn(`[releases/delivery] Global workload fetch failed: ${err.message}`)
    return {}
  }

  const workload = {}
  for (const issue of allIssues) {
    const components = (issue.fields?.components || [])
      .map(c => String(c.name || '').trim())
      .filter(Boolean)
    if (!components.length) continue

    const versions = extractFixVersions(issue)
    if (!versions.length) continue

    const versionLabel = versions[0]

    for (const comp of components) {
      if (!workload[comp]) workload[comp] = { totalOpen: 0, openByVersion: {} }
      workload[comp].totalOpen++
      workload[comp].openByVersion[versionLabel] = (workload[comp].openByVersion[versionLabel] || 0) + 1
    }
  }
  return workload
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

  const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/
  await Promise.all(batches.map(async (batch, idx) => {
    const safeBatch = batch.filter(k => JIRA_KEY_RE.test(k))
    if (!safeBatch.length) return
    const keysStr = safeBatch.join(', ')
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
      console.warn(`[releases/delivery] Could not fetch children for deliverables batch ${idx}: ${err.message}`)
    }
  }))
  return counts
}

async function runFullAnalysis(storage, config) {
  const releases = await fetchOpenReleases(storage, config)

  let issues = []
  let fieldMeta = { id: null, name: '', schemaCustom: '' }
  let jiraWarning = null
  let sprintWindow = null
  let componentVelocity = {}
  let componentGlobalWorkload = {}
  try {
    const [jiraResult, unreleasedJiraFixVersionData, detectedWindow, historicalVelocity, globalWorkload] = await Promise.all([
      fetchIssuesFromJira(config),
      fetchUnreleasedJiraFixVersions(config),
      detectSprintWindow(config),
      fetchHistoricalComponentVelocity(config),
      fetchComponentGlobalWorkload(config)
    ])
    sprintWindow = detectedWindow
    issues = jiraResult.issues
    fieldMeta = jiraResult.fieldMeta
    componentVelocity = historicalVelocity
    componentGlobalWorkload = globalWorkload
    if (unreleasedJiraFixVersionData.warnings.length) {
      jiraWarning = unreleasedJiraFixVersionData.warnings.join(' | ')
    }
  } catch (err) {
    jiraWarning = `Jira data unavailable: ${err.message}`
  }

  if (!releases.length) {
    throw new Error(
      'No releases found. Ensure Target Version JQL fragment is configured or Product Pages product shortnames are set in Release Analysis settings.'
    )
  }

  const result = buildAnalysis(releases, issues, fieldMeta, config)
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
      console.warn(`[releases/delivery] Sprint issue key fetch failed: ${err.message}`)
    }
  }
  result.sprintWindow.sprintIssueKeys = sprintIssueKeys
  result.componentVelocity = componentVelocity
  result.componentGlobalWorkload = componentGlobalWorkload

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
      console.warn(`[releases/delivery] Deliverable children enrichment failed: ${err.message}`)
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
  // Initialize product-pages with secrets
  if (context.secrets) productPages.init(context.secrets)

  // Override module-level jira vars with factory client when available
  if (context.jira) {
    jiraRequest = context.jira.jiraRequest
    JIRA_HOST = context.jira.JIRA_HOST
  }

  registerConformaRoutes(router, context)

  const { storage, requireAuth, requireAdmin, requireScope } = context
  const { readFromStorage, writeToStorage } = storage

  let refreshState = { running: false, lastResult: null }

  async function runDeliveryRefresh() {
    if (refreshState.running) return { status: 'already_running' }
    refreshState = { running: true, startedAt: new Date().toISOString(), lastResult: refreshState.lastResult }
    try {
      const config = getConfig(readFromStorage)
      const result = await runFullAnalysis(storage, config)
      writeToStorage('releases/delivery/analysis-cache.json', {
        cachedAt: new Date().toISOString(),
        data: result
      })
      refreshState.lastResult = {
        status: 'success',
        message: `Analysis generated with ${result.releases?.length || 0} release(s)`,
        completedAt: new Date().toISOString()
      }
      return refreshState.lastResult
    } catch (err) {
      console.error('[releases/delivery] Background refresh failed:', err)
      refreshState.lastResult = {
        status: 'error',
        message: err.message,
        completedAt: new Date().toISOString()
      }
      throw err
    } finally {
      refreshState.running = false
    }
  }

  function triggerBackgroundRefresh() {
    if (refreshState.running) return
    runDeliveryRefresh().catch(function() {})
  }

  // --- Config routes ---

  /**
   * @openapi
   * /api/modules/releases/delivery/config:
   *   get:
   *     summary: Get delivery analysis configuration
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Configuration with source info
   */
  router.get('/config', requireAdmin, requireScope('releases:write'), function(req, res) {
    const saved = readFromStorage('releases/delivery/config.json')
    const hasStoredConfig = saved && typeof saved === 'object' && !saved._deleted
    const config = getConfig(readFromStorage)
    // Never expose featureWeightField fallback in stored form — show raw stored value
    if (hasStoredConfig && saved.featureWeightField === undefined) {
      config.featureWeightField = ''
    }
    res.json({ config, source: hasStoredConfig ? 'stored' : 'env' })
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/config:
   *   post:
   *     summary: Save delivery analysis configuration
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Configuration saved
   */
  router.post('/config', requireAdmin, requireScope('releases:write'), function(req, res) {
    try {
      saveConfig(writeToStorage, req.body)
      logAudit(readFromStorage, writeToStorage, {
        domain: 'delivery',
        action: 'config_save',
        user: req.userEmail || 'unknown',
        summary: 'Updated delivery analysis configuration',
        details: { projectKeys: req.body.projectKeys }
      })
      res.json({ status: 'saved' })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/config:
   *   delete:
   *     summary: Reset delivery analysis configuration to defaults
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Configuration reset to defaults
   */
  router.delete('/config', requireAdmin, requireScope('releases:write'), function(req, res) {
    deleteConfig(writeToStorage)
    const config = getConfig(readFromStorage)
    res.json({ config, source: 'env' })
  })

  // --- Product Pages routes ---

  /**
   * @openapi
   * /api/modules/releases/delivery/product-pages/products:
   *   get:
   *     summary: List available Product Pages products
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Product list with auth status
   */
  router.get('/product-pages/products', requireAdmin, requireScope('releases:write'), async function(req, res) {
    try {
      const config = getConfig(readFromStorage)
      const authStatus = getAuthStatus()
      const products = await fetchAllProducts(config)
      res.json({ products, authStatus })
    } catch (err) {
      console.error('[releases/delivery] product-pages/products error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  // --- Refresh routes ---

  /**
   * @openapi
   * /api/modules/releases/delivery/refresh/status:
   *   get:
   *     summary: Get delivery analysis refresh status
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Current refresh state
   */
  router.get('/refresh/status', requireAuth, requireScope('releases:read'), function(req, res) {
    res.json(refreshState)
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/refresh:
   *   post:
   *     summary: Trigger delivery analysis data refresh
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Refresh started or already running
   */
  router.post('/refresh', requireAdmin, requireScope('releases:write'), function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' })
    }
    if (refreshState.running || (context.isRefreshRunning && context.isRefreshRunning())) {
      return res.json({ status: 'already_running' })
    }
    logAudit(readFromStorage, writeToStorage, {
      domain: 'delivery',
      action: 'manual_refresh',
      user: req.userEmail || 'unknown',
      summary: 'Manual delivery analysis data refresh triggered'
    })
    triggerBackgroundRefresh()
    res.json({ status: 'started' })
  })

  // --- Analysis route (stale-while-revalidate) ---

  /**
   * @openapi
   * /api/modules/releases/delivery/analysis:
   *   get:
   *     summary: Get delivery release analysis data (stale-while-revalidate)
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Analysis data (possibly stale, with refresh indicators)
   */
  router.get('/analysis', requireAuth, requireScope('releases:read'), function(req, res) {
    try {
      const forceRefresh = req.query.refresh === 'true'
      const cached = readFromStorage('releases/delivery/analysis-cache.json')
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
      console.error('[releases/delivery] analysis error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/commitment/{version}/{phase}:
   *   get:
   *     tags: ['Releases: Delivery']
   *     summary: Get commitment tracking data for a release phase
   *     description: Compare committed features at planning freeze vs. current delivery status
   *     parameters:
   *       - in: path
   *         name: version
   *         required: true
   *         schema: { type: string }
   *         description: Release version (e.g., "3.5")
   *       - in: path
   *         name: phase
   *         required: true
   *         schema: { type: string, enum: [EA1, EA2, GA] }
   *         description: Release phase
   *     responses:
   *       200:
   *         description: Commitment tracking metrics and feature lists
   *       400:
   *         description: Invalid phase
   *       404:
   *         description: No snapshot found for this version/phase
   */
  router.get('/commitment/:version/:phase', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      const { version, phase } = req.params

      // Validate phase
      const validPhases = ['EA1', 'EA2', 'GA']
      if (!validPhases.includes(phase)) {
        return res.status(400).json({ error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` })
      }

      // Validate version format (e.g. "3.5", "3.10") to prevent regex injection and path traversal
      if (!/^\d+\.\d+$/.test(version)) {
        return res.status(400).json({ error: 'Invalid version format. Expected X.Y (e.g., "3.5")' })
      }

      // Load committed snapshot
      const snapshotPath = `releases/planning/committed-snapshot-${version}-${phase}.json`
      const snapshot = readFromStorage(snapshotPath)

      if (!snapshot) {
        return res.status(404).json({ error: `No snapshot found for ${version} ${phase}. Use the "Create Snapshot" button above.` })
      }

      // Query Jira directly for current state (independent of delivery analysis cache)
      const config = getConfig(readFromStorage)
      const commitmentJql = config.commitmentTrackingJql || 'cf[10855] is not EMPTY'

      const projectsFilter = config.jiraAllProjects
        ? ''
        : `project in (${config.projectKeys.map(k => `"${k}"`).join(', ')}) AND `

      const jql = `${projectsFilter}issuetype = Feature AND ${commitmentJql} ORDER BY key ASC`

      console.log(`[releases/delivery] Fetching current feature status for commitment tracking comparison`)

      const allFeatures = await fetchAllJqlResults(
        jiraRequest,
        jql,
        'summary,status,components,customfield_10855,customfield_18834',
        { maxResults: 100 }
      )

      // Filter to features matching this version + phase
      const [basePattern, dotPhasePattern, spacePhasePattern] = buildPhaseVersionPatterns(version, phase)

      const deliveryIssues = []
      const seenKeys = new Set()

      for (const issue of allFeatures) {
        const targetVersions = issue.fields?.customfield_10855 || []
        const hasMatchingVersion = targetVersions.some(v => {
          const val = v?.name || v?.value || ''
          return basePattern.test(val) || dotPhasePattern.test(val) || spacePhasePattern.test(val)
        })

        if (hasMatchingVersion && !seenKeys.has(issue.key)) {
          const components = (issue.fields?.components || []).map(c => c.name).filter(Boolean)
          const deliveryOwner = issue.fields?.customfield_18834?.displayName || null
          const status = issue.fields?.status?.name || 'Unknown'
          const statusBucket = statusCategoryBucket(issue.fields?.status)

          deliveryIssues.push({
            key: issue.key,
            summary: issue.fields?.summary || '',
            status,
            statusBucket,
            components,
            deliveryOwner,
            fixVersion: targetVersions[0]?.name || targetVersions[0]?.value || null
          })
          seenKeys.add(issue.key)
        }
      }

      // Build feature maps
      const committedKeys = new Set(snapshot.featureKeys)

      // Categorize features
      const delivered = []
      const inProgress = []
      const notStarted = []
      const added = []
      const removed = []

      // Process committed features
      for (const featureKey of snapshot.featureKeys) {
        const deliveryFeature = deliveryIssues.find(i => i.key === featureKey)

        if (deliveryFeature) {
          const enriched = {
            key: deliveryFeature.key,
            summary: deliveryFeature.summary,
            components: deliveryFeature.components,
            deliveryOwner: deliveryFeature.deliveryOwner,
            status: deliveryFeature.status,
            statusBucket: deliveryFeature.statusBucket,
            fixVersions: deliveryFeature.fixVersion ? [deliveryFeature.fixVersion] : []
          }

          if (deliveryFeature.statusBucket === 'done') {
            delivered.push(enriched)
          } else if (deliveryFeature.statusBucket === 'doing') {
            inProgress.push(enriched)
          } else {
            notStarted.push(enriched)
          }
        } else {
          // Committed but not in delivery data = removed
          removed.push({
            key: featureKey,
            summary: 'Feature removed from delivery scope',
            components: [],
            deliveryOwner: null,
            status: 'Removed',
            statusBucket: 'removed',
            fixVersions: []
          })
        }
      }

      // Process added features (in delivery but not committed)
      for (const issue of deliveryIssues) {
        if (!committedKeys.has(issue.key)) {
          added.push({
            key: issue.key,
            summary: issue.summary,
            components: issue.components,
            deliveryOwner: issue.deliveryOwner,
            status: issue.status,
            statusBucket: issue.statusBucket,
            fixVersions: issue.fixVersion ? [issue.fixVersion] : []
          })
        }
      }

      // Compute metrics
      const committed = snapshot.featureKeys.length
      const deliveredCount = delivered.length
      const percentDelivered = committed > 0 ? Math.round((deliveredCount / committed) * 100) : 0

      res.json({
        version,
        phase,
        snapshot: {
          snapshotAt: snapshot.snapshotAt,
          trigger: snapshot.snapshotTrigger
        },
        metrics: {
          committed,
          delivered: deliveredCount,
          percentDelivered,
          inProgress: inProgress.length,
          notStarted: notStarted.length,
          added: added.length,
          removed: removed.length
        },
        features: {
          delivered,
          inProgress,
          notStarted,
          added,
          removed
        }
      })
    } catch (error) {
      console.error('[releases/delivery] commitment tracking error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/commitment/versions:
   *   get:
   *     summary: Get available versions for commitment tracking
   *     description: Discovers versions from Jira using commitmentTrackingJql (independent of delivery analysis)
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: List of available versions
   */
  router.get('/commitment/versions', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      const config = getConfig(readFromStorage)
      const commitmentJql = config.commitmentTrackingJql || 'cf[10855] is not EMPTY'

      // Build project filter
      const projectsFilter = config.jiraAllProjects
        ? ''
        : `project in (${config.projectKeys.map(k => `"${k}"`).join(', ')}) AND `

      // Query Jira for all Features with Target Version
      const jql = `${projectsFilter}issuetype = Feature AND ${commitmentJql} ORDER BY key ASC`

      console.log(`[releases/delivery] Discovering versions with commitment tracking JQL: ${commitmentJql}`)

      const allFeatures = await fetchAllJqlResults(
        jiraRequest,
        jql,
        'key,customfield_10855',
        { maxResults: 100 }
      )

      console.log(`[releases/delivery] Fetched ${allFeatures.length} features from Jira`)

      // Extract unique version numbers (X.Y format)
      const uniqueVersions = new Set()

      for (const issue of allFeatures) {
        const targetVersions = issue.fields?.customfield_10855 || []

        for (const v of targetVersions) {
          // Target Version field returns Jira version objects with 'name' property
          const val = v?.name || v?.value || ''
          // Extract X.Y version number
          const match = val.match(/(\d+\.\d+)/)
          if (match) {
            const version = match[1]
            const [major, minor] = version.split('.').map(Number)
            // Only include 3.4 and above
            if (major > 3 || (major === 3 && minor >= 4)) {
              uniqueVersions.add(version)
            }
          }
        }
      }

      // Convert to sorted array
      const versions = Array.from(uniqueVersions)
        .sort((a, b) => {
          const [aMajor, aMinor] = a.split('.').map(Number)
          const [bMajor, bMinor] = b.split('.').map(Number)
          return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor
        })
        .map(version => ({ version }))

      console.log(`[releases/delivery] Found ${versions.length} versions for commitment tracking: ${versions.map(v => v.version).join(', ')}`)

      res.json({ versions })
    } catch (error) {
      console.error('[releases/delivery] commitment versions discovery error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/commitment/snapshot/{version}/{phase}:
   *   post:
   *     summary: Create commitment snapshot by querying Jira directly
   *     tags: [Releases - Delivery]
   *     parameters:
   *       - in: path
   *         name: version
   *         required: true
   *         schema:
   *           type: string
   *         description: Release version (e.g., "3.5")
   *       - in: path
   *         name: phase
   *         required: true
   *         schema:
   *           type: string
   *           enum: [EA1, EA2, GA]
   *         description: Release phase
   *     responses:
   *       200:
   *         description: Snapshot created successfully
   *       400:
   *         description: Invalid parameters
   *       404:
   *         description: No features found for the given version
   */
  router.post('/commitment/snapshot/:version/:phase', requireAdmin, requireScope('releases:write'), async function(req, res) {
    try {
      const { version, phase } = req.params

      console.log(`[releases/delivery] Creating commitment tracking snapshot for ${version} ${phase}`)

      // Validate phase
      const validPhases = ['EA1', 'EA2', 'GA']
      if (!validPhases.includes(phase)) {
        console.warn(`[releases/delivery] Invalid phase: ${phase}`)
        return res.status(400).json({ error: `Invalid phase. Must be one of: ${validPhases.join(', ')}` })
      }

      // Validate version format
      if (!/^\d+\.\d+$/.test(version)) {
        console.warn(`[releases/delivery] Invalid version format: ${version}`)
        return res.status(400).json({ error: 'Invalid version format. Expected X.Y (e.g., "3.5")' })
      }

      // Load config for commitment tracking JQL (separate from delivery analysis)
      const config = getConfig(readFromStorage)
      const commitmentJql = config.commitmentTrackingJql || 'cf[10855] is not EMPTY'

      // Build project filter
      const projectsFilter = config.jiraAllProjects
        ? ''
        : `project in (${config.projectKeys.map(k => `"${k}"`).join(', ')}) AND `

      // Query Jira directly for Features (commitment tracking has its own JQL, independent of delivery analysis)
      const jql = `${projectsFilter}issuetype = Feature AND ${commitmentJql} ORDER BY key ASC`

      console.log(`[releases/delivery] Querying Jira with commitment tracking JQL: ${commitmentJql}`)

      const allFeatures = await fetchAllJqlResults(
        jiraRequest,
        jql,
        'summary,status,components,customfield_10855,customfield_18834',
        { maxResults: 100 }
      )

      if (!allFeatures || allFeatures.length === 0) {
        console.warn(`[releases/delivery] No features found with commitment tracking JQL`)
        return res.status(404).json({ error: 'No features found. Check commitment tracking JQL in config.' })
      }

      console.log(`[releases/delivery] Found ${allFeatures.length} total features`)

      // Filter to features matching this version + phase (via Target Version field cf[10855])
      const [basePattern, dotPhasePattern, spacePhasePattern] = buildPhaseVersionPatterns(version, phase)

      const features = []
      const seenKeys = new Set()

      for (const issue of allFeatures) {
        const targetVersions = issue.fields?.customfield_10855 || []
        const hasMatchingVersion = targetVersions.some(v => {
          // Target Version field returns Jira version objects with 'name' property
          const val = v?.name || v?.value || ''
          return basePattern.test(val) || dotPhasePattern.test(val) || spacePhasePattern.test(val)
        })

        if (hasMatchingVersion && !seenKeys.has(issue.key)) {
          const components = (issue.fields?.components || []).map(c => c.name).filter(Boolean)
          const deliveryOwner = issue.fields?.customfield_18834?.displayName || null

          features.push({
            key: issue.key,
            summary: issue.fields?.summary || '',
            status: issue.fields?.status?.name || 'Unknown',
            components,
            deliveryOwner
          })
          seenKeys.add(issue.key)
        }
      }

      if (features.length === 0) {
        console.warn(`[releases/delivery] No features found matching version ${version}`)
        return res.status(404).json({ error: `No features found for version ${version}. Check that features are tagged with Target Version containing "${version}".` })
      }

      console.log(`[releases/delivery] Found ${features.length} features for version ${version}`)

      // Create snapshot
      const snapshotData = {
        version,
        phase,
        snapshotAt: new Date().toISOString(),
        snapshotTrigger: 'manual',
        featureKeys: Array.from(seenKeys),
        featureCount: seenKeys.size,
        features
      }

      // Write to storage
      const snapshotPath = `releases/planning/committed-snapshot-${version}-${phase}.json`
      writeToStorage(snapshotPath, snapshotData)

      console.log(`[releases/delivery] Created snapshot for ${version} ${phase}: ${seenKeys.size} features`)

      res.json({
        phase,
        featureCount: seenKeys.size,
        snapshotAt: snapshotData.snapshotAt
      })
    } catch (error) {
      console.error('[releases/delivery] snapshot creation error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // --- Startup cache seeding ---
  // Warm the cache in the background so the first user request is instant
  if (!DEMO_MODE) {
    const existing = readFromStorage('releases/delivery/analysis-cache.json')
    const hasFreshCache = existing?.data && existing.cachedAt &&
      (Date.now() - new Date(existing.cachedAt).getTime()) < CACHE_MAX_AGE_MS
    if (!hasFreshCache) {
      console.log('[releases/delivery] No fresh cache found — seeding analysis in background')
      setTimeout(() => triggerBackgroundRefresh(), 10000)
    }
  }

  /**
   * @openapi
   * /api/modules/releases/delivery/admin/releases:
   *   post:
   *     summary: Manually upload release data
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Releases uploaded and analysis triggered
   */
  router.post('/admin/releases', requireAdmin, requireScope('releases:write'), function(req, res) {
    try {
      const releases = Array.isArray(req.body?.releases) ? req.body.releases : null
      if (!releases || releases.length === 0) {
        return res.status(400).json({ error: 'Request must include non-empty releases array' })
      }
      const normalized = releases.map(r => ({
        productName: r.productName,
        releaseNumber: r.releaseNumber,
        dueDate: toIsoDate(r.dueDate),
        codeFreezeDate: toIsoDate(r.codeFreezeDate) || null,
        featureFreezeDate: toIsoDate(r.featureFreezeDate) || null
      })).filter(r => r.productName && r.releaseNumber && r.dueDate)

      if (normalized.length === 0) {
        return res.status(400).json({ error: 'No valid releases after normalization' })
      }

      writeToStorage('releases/delivery/product-pages-releases-cache.json', {
        source: 'manual',
        fetchedAt: new Date().toISOString(),
        releases: normalized
      })
      res.json({ success: true, count: normalized.length })
    } catch (error) {
      console.error('[releases/delivery] save releases error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // --- Quality (Post-Release Defects) routes ---

  const { fetchVersions: fetchQualityVersions, fetchBugs, fetchBugCounts } = require('./quality/data-fetcher.js')
  const { computeCumulativeBugData } = require('./quality/calculations.js')

  // In-memory cache for loadAllBugs() with 5-minute TTL
  let bugsCache = { data: null, timestamp: 0, projectsKey: '' }
  const BUGS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  function loadAllBugs(projects) {
    const projectsKey = projects.join(',')
    const now = Date.now()

    // Return cached data if valid and for the same project set
    if (
      bugsCache.data &&
      bugsCache.projectsKey === projectsKey &&
      (now - bugsCache.timestamp) < BUGS_CACHE_TTL_MS
    ) {
      return bugsCache.data
    }

    // Cache miss or stale - read from storage
    const allBugs = []
    for (const project of projects) {
      const bugs = readFromStorage(`releases/delivery/quality/bugs-${project}.json`) || []
      allBugs.push(...bugs)
    }

    // Update cache
    bugsCache = { data: allBugs, timestamp: now, projectsKey }
    return allBugs
  }

  /**
   * @openapi
   * /api/modules/releases/delivery/quality/versions:
   *   get:
   *     tags: ['Releases: Quality']
   *     summary: List release versions with pre-computed bug counts
   *     responses:
   *       200:
   *         description: Versions sorted by bug count
   */
  router.get('/quality/versions', requireAuth, requireScope('releases:read'), function(req, res) {
    try {
      const versions = readFromStorage('releases/delivery/quality/versions.json') || []

      const sorted = [...versions].sort((a, b) => (b.bugCount || 0) - (a.bugCount || 0))

      res.json(sorted)
    } catch (error) {
      console.error('[releases/quality] Read versions error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/quality/bugs:
   *   get:
   *     tags: ['Releases: Quality']
   *     summary: Get cumulative bug data for selected versions
   *     parameters:
   *       - in: query
   *         name: versions
   *         required: true
   *         schema: { type: string }
   *         description: Comma-separated version names
   *       - in: query
   *         name: component
   *         schema: { type: string }
   *         description: Filter by component
   *     responses:
   *       200:
   *         description: Chart data with labels and datasets
   */
  router.get('/quality/bugs', requireAuth, requireScope('releases:read'), function(req, res) {
    try {
      const config = getConfig(readFromStorage)
      const versions = (req.query.versions || '').split(',').filter(Boolean)
      const component = req.query.component || null

      if (versions.length === 0) {
        return res.json({ labels: [], datasets: [] })
      }

      const allBugs = loadAllBugs(config.projectKeys)

      const versionSet = new Set(versions)
      let filteredBugs = allBugs.filter(bug =>
        bug.affectedVersions.some(v => versionSet.has(v))
      )

      if (component) {
        filteredBugs = filteredBugs.filter(bug =>
          bug.components.includes(component)
        )
      }

      const allVersions = readFromStorage('releases/delivery/quality/versions.json') || []
      const versionReleaseMap = new Map(allVersions.map(v => [v.name, v.releaseDate]))

      const chartData = computeCumulativeBugData(filteredBugs, versions, versionReleaseMap)
      res.json(chartData)
    } catch (error) {
      console.error('[releases/quality] Read bugs error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/quality/components:
   *   get:
   *     tags: ['Releases: Quality']
   *     summary: List components with bug counts
   *     responses:
   *       200:
   *         description: Components sorted by bug count
   */
  router.get('/quality/components', requireAuth, requireScope('releases:read'), function(req, res) {
    try {
      const config = getConfig(readFromStorage)
      const allBugs = loadAllBugs(config.projectKeys)

      const componentCounts = {}
      for (const bug of allBugs) {
        for (const comp of bug.components) {
          componentCounts[comp] = (componentCounts[comp] || 0) + 1
        }
      }

      const componentsWithCounts = Object.entries(componentCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      res.json(componentsWithCounts)
    } catch (error) {
      console.error('[releases/quality] Read components error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/quality/refresh:
   *   post:
   *     tags: ['Releases: Quality']
   *     summary: Refresh quality data from Jira (admin)
   *     responses:
   *       200:
   *         description: Refresh completed
   *       403:
   *         description: Admin required
   */
  router.post('/quality/refresh', requireAdmin, requireScope('releases:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' })
    }
    try {
      const config = getConfig(readFromStorage)
      const versions = await fetchQualityVersions(config.projectKeys)

      const bugCounts = await fetchBugCounts(config.projectKeys, versions)
      const versionsWithCounts = versions.map(v => ({
        ...v,
        bugCount: bugCounts.get(v.name) || 0
      }))
      writeToStorage('releases/delivery/quality/versions.json', versionsWithCounts)

      for (const project of config.projectKeys) {
        const bugs = await fetchBugs(project, versions)
        writeToStorage(`releases/delivery/quality/bugs-${project}.json`, bugs)
      }

      bugsCache = { data: null, timestamp: 0, projectsKey: '' }
      res.json({ success: true, fetchedAt: new Date().toISOString() })
    } catch (error) {
      console.error('[releases/quality] Refresh error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/quality/debug:
   *   get:
   *     tags: ['Releases: Quality']
   *     summary: Debug endpoint for diagnosing bug count issues (admin only)
   *     responses:
   *       200:
   *         description: Diagnostic information about bug data and version matching
   */
  router.get('/quality/debug', requireAdmin, requireScope('releases:read'), function(req, res) {
    try {
      const config = getConfig(readFromStorage)
      const versions = readFromStorage('releases/delivery/quality/versions.json') || []

      const cacheSnapshot = {
        projectsKey: bugsCache.projectsKey,
        cached: bugsCache.data !== null,
        cacheSize: bugsCache.data ? bugsCache.data.length : 0,
        cacheAge: bugsCache.timestamp ? Date.now() - bugsCache.timestamp : null
      }

      const allBugs = loadAllBugs(config.projectKeys)

      const bugsByProject = {}
      for (const project of config.projectKeys) {
        const bugs = readFromStorage(`releases/delivery/quality/bugs-${project}.json`) || []
        bugsByProject[project] = bugs.length
      }

      const sampleBugs = allBugs.slice(0, 5).map(b => ({
        key: b.key,
        affectedVersions: b.affectedVersions,
        components: b.components,
        created: b.created,
        releaseDate: b.releaseDate
      }))

      const sampleVersions = versions.slice(0, 10).map(v => ({
        name: v.name,
        releaseDate: v.releaseDate,
        project: v.project
      }))

      // Find unique affected version names from bugs
      const affectedVersionSet = new Set()
      allBugs.forEach(bug => {
        bug.affectedVersions.forEach(v => affectedVersionSet.add(v))
      })
      const uniqueAffectedVersions = Array.from(affectedVersionSet).sort().slice(0, 20)

      // Find version names from versions.json
      const versionNameSet = new Set(versions.map(v => v.name))
      const versionNames = Array.from(versionNameSet).sort().slice(0, 20)

      res.json({
        config: {
          projectKeys: config.projectKeys
        },
        counts: {
          totalVersions: versions.length,
          totalBugs: allBugs.length,
          bugsByProject
        },
        sampleBugs,
        sampleVersions,
        uniqueAffectedVersions,
        versionNames,
        cacheInfo: cacheSnapshot
      })
    } catch (error) {
      console.error('[releases/quality] Debug error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/discover-releases:
   *   post:
   *     tags: ['Releases: Delivery']
   *     summary: Discover releases from Jira Target Version field
   *     description: Queries Jira using configured Target Version JQL and returns unique release versions with feature counts
   *     responses:
   *       200:
   *         description: List of discovered releases
   */
  router.post('/discover-releases', requireAdmin, requireScope('releases:write'), async function(req, res) {
    try {
      const config = getConfig(readFromStorage)
      const releases = await discoverReleasesFromJira(storage, config)
      res.json({ releases })
    } catch (error) {
      console.error('[releases/delivery] Discover releases error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/releases-metadata:
   *   get:
   *     tags: ['Releases: Delivery']
   *     summary: Get releases metadata
   *     description: Returns stored metadata for releases (product names, dates)
   *     responses:
   *       200:
   *         description: Releases metadata object
   */
  router.get('/releases-metadata', requireAuth, requireScope('releases:read'), function(req, res) {
    try {
      const metadata = readFromStorage('releases/delivery/releases-metadata.json') || {}
      res.json(metadata)
    } catch (error) {
      console.error('[releases/delivery] Get metadata error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/releases-metadata:
   *   post:
   *     tags: ['Releases: Delivery']
   *     summary: Save releases metadata
   *     description: Stores metadata for releases (product names, dates)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties:
   *               type: object
   *               properties:
   *                 productName:
   *                   type: string
   *                 dueDate:
   *                   type: string
   *                   format: date
   *                 codeFreezeDate:
   *                   type: string
   *                   format: date
   *     responses:
   *       200:
   *         description: Metadata saved successfully
   */
  router.post('/releases-metadata', requireAdmin, requireScope('releases:write'), function(req, res) {
    try {
      const metadata = req.body
      if (typeof metadata !== 'object' || Array.isArray(metadata)) {
        return res.status(400).json({ error: 'Metadata must be an object' })
      }
      writeToStorage('releases/delivery/releases-metadata.json', metadata)
      res.json({ success: true })
    } catch (error) {
      console.error('[releases/delivery] Save metadata error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('delivery', {
      order: 70,
      timeout: 600000,
      handler: async function() {
        if (DEMO_MODE) return { status: 'skipped', message: 'Refresh disabled in demo mode' }
        return runDeliveryRefresh()
      }
    })
  }
}
