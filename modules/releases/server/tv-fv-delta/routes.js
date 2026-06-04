const { jiraRequest, JIRA_HOST, fetchAllJqlResults, fetchProjectVersions } = require('../../../../shared/server/jira')

const JIRA_BROWSE = JIRA_HOST + '/browse'
const JIRA_SEARCH = JIRA_HOST + '/issues/?jql='
const CACHE_KEY = 'releases/tv-fv-delta.json'
const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour
const VERSIONS_CACHE_KEY = 'releases/tv-fv-delta-versions.json'
const VERSIONS_CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000 // 4 hours

// Default releases — EA1, EA2, then GA (timeline order)
// Fallback if Smartsheet/planning releases are not configured
const DEFAULT_RELEASES = ['rhoai-3.5.EA1', 'rhoai-3.5.EA2', 'rhoai-3.5']
const DEFAULT_JIRA_PROJECT = 'RHAISTRAT'

// JQL-safe release name pattern — allows spaces for version names like "RHAII-3.5 EA1"
// Injection is prevented by quoteRelease() wrapping names in double quotes for JQL
const jqlSafePattern = /^[a-zA-Z0-9._ -]+$/

// ---------------------------------------------------------------------------
// Fetch releases from planning module (Smartsheet SSOT)
// ---------------------------------------------------------------------------

/**
 * Fetch configured releases from planning module and expand to EA1, EA2, GA variants.
 * Returns array of release strings in timeline order: [...EA1s, ...EA2s, ...GAs]
 */
function fetchReleasesFromPlanning(storage) {
  try {
    // Try to read from planning module's config
    const planningData = storage.readFromStorage('releases/planning/config.json')
    if (!planningData || !planningData.releases) {
      console.warn('[releases/tv-fv-delta] No planning config found — falling back to DEFAULT_RELEASES. Update the constant if the current release has changed.')
      return { releases: DEFAULT_RELEASES, source: 'default' }
    }

    const baseVersions = Object.keys(planningData.releases).filter(function(v) { return jqlSafePattern.test(v) }).sort()
    if (baseVersions.length === 0) {
      console.warn('[releases/tv-fv-delta] No releases configured — falling back to DEFAULT_RELEASES. Update the constant if the current release has changed.')
      return { releases: DEFAULT_RELEASES, source: 'default' }
    }

    // Expand each base version to EA1, EA2, GA (timeline order: all EA1s, all EA2s, all GAs)
    const expanded = []
    for (const v of baseVersions) expanded.push(v + '.EA1')
    for (const v of baseVersions) expanded.push(v + '.EA2')
    for (const v of baseVersions) expanded.push(v)

    // Filter out any expanded versions that don't pass JQL safety validation
    const safeExpanded = expanded.filter(function(v) { return jqlSafePattern.test(v) })
    if (safeExpanded.length < expanded.length) {
      const dropped = expanded.filter(function(v) { return !jqlSafePattern.test(v) })
      console.warn('[releases/tv-fv-delta] Dropped ' + dropped.length + ' expanded releases that failed JQL safety validation: ' + dropped.join(', '))
    }

    console.log('[releases/tv-fv-delta] Fetched ' + baseVersions.length + ' base releases from planning, expanded to ' + safeExpanded.length + ' variants')
    return { releases: safeExpanded, source: 'planning' }
  } catch (err) {
    console.error('[releases/tv-fv-delta] Failed to fetch releases from planning:', err.message)
    console.warn('[releases/tv-fv-delta] Falling back to DEFAULT_RELEASES — data may be stale if current release has changed.')
    return { releases: DEFAULT_RELEASES, source: 'default' }
  }
}

// Jira custom field IDs
const CF_TARGET_VERSION = 'customfield_10855'
const CF_COLOR_STATUS = 'customfield_10712'
const CF_PRODUCT_MANAGER = 'customfield_10469'

// JQL fields to fetch
const JQL_FIELDS = [
  'summary', 'status', 'fixVersions', 'components', 'assignee',
  CF_TARGET_VERSION, CF_COLOR_STATUS, CF_PRODUCT_MANAGER
].join(',')

// ---------------------------------------------------------------------------
// Version normalisation
// ---------------------------------------------------------------------------

function normVer(v) {
  if (!v || v === 'null' || v === 'undefined') return null
  v = String(v).trim()
  const upper = v.toUpperCase()
  if (upper.startsWith('RHOAI_')) {
    v = 'rhoai-' + upper.slice(6).replace(/\.0(?=_|$)/g, '').replace(/_/g, '.')
  }
  return v.toLowerCase()
}

function parseVersions(vStr) {
  if (!vStr) return new Set()
  return new Set(
    String(vStr).split(',')
      .map(function(s) { return normVer(s.trim()) })
      .filter(Boolean)
  )
}

function extractVersionNames(fixVersions) {
  if (!Array.isArray(fixVersions)) return ''
  return fixVersions.map(function(v) { return v.name }).filter(Boolean).join(', ')
}

/**
 * Detect z-stream (patch) releases — e.g. rhoai-3.4.1, rhoai-3.5.2.
 * These carry bug fixes only, not features, so they don't belong in TV/FV analysis.
 * Pattern: rhoai-X.Y.Z where Z is purely numeric (vs EA1, EA2 which are feature milestones).
 */
function isZStream(versionName) {
  if (!versionName) return false
  // Match rhoai-<major>.<minor>.<patch> where patch is a number
  return /^rhoai-\d+\.\d+\.\d+$/i.test(versionName.trim())
}

// ---------------------------------------------------------------------------
// Fetch all components from Jira project
// ---------------------------------------------------------------------------

async function fetchAllComponents(jiraProject) {
  try {
    const response = await jiraRequest('/rest/api/2/project/' + jiraProject + '/components')
    if (!Array.isArray(response)) return []
    return response.map(function(c) { return c.name }).filter(Boolean).sort()
  } catch (err) {
    console.error('[releases/tv-fv-delta] Failed to fetch components:', err.message)
    return []
  }
}

// ---------------------------------------------------------------------------
// JQL URL builder
// ---------------------------------------------------------------------------

function jqlUrl(jql) {
  return JIRA_SEARCH + encodeURIComponent(jql)
}

/** Quote a release name for JQL (versions with dots/hyphens need quoting) */
function quoteRelease(name) {
  return '"' + name.replace(/"/g, '\\"') + '"'
}

// ---------------------------------------------------------------------------
// Issue normalisation
// ---------------------------------------------------------------------------

function normalizeIssue(issue) {
  const fields = issue.fields || {}

  // Target version — may be string or array-of-objects
  const tvRaw = fields[CF_TARGET_VERSION]
  let tvStr = ''
  if (Array.isArray(tvRaw)) {
    tvStr = tvRaw.map(function(v) { return typeof v === 'object' ? (v.name || v.value || '') : String(v) }).join(', ')
  } else if (tvRaw && typeof tvRaw === 'object') {
    tvStr = tvRaw.name || tvRaw.value || ''
  } else if (tvRaw) {
    tvStr = String(tvRaw)
  }

  // Fix versions
  const fvStr = extractVersionNames(fields.fixVersions)

  // Components
  let components = []
  if (Array.isArray(fields.components)) {
    components = fields.components.map(function(c) { return c.name || '' }).filter(Boolean)
  }

  // Color status — may be string or object with value
  const csRaw = fields[CF_COLOR_STATUS]
  let colorStatus = ''
  if (csRaw) {
    colorStatus = typeof csRaw === 'object' ? (csRaw.value || '') : String(csRaw)
  }

  // Product manager — may be user object or string
  const pmRaw = fields[CF_PRODUCT_MANAGER]
  let pm = ''
  if (pmRaw) {
    pm = typeof pmRaw === 'object' ? (pmRaw.displayName || pmRaw.name || '') : String(pmRaw)
  }

  // Assignee
  const assigneeRaw = fields.assignee
  let assignee = ''
  if (assigneeRaw) {
    assignee = assigneeRaw.displayName || assigneeRaw.name || ''
  }

  // Status
  let status = ''
  if (fields.status) {
    status = fields.status.name || ''
  }

  return {
    key: issue.key,
    url: JIRA_BROWSE + '/' + issue.key,
    summary: String(fields.summary || '').slice(0, 120),
    status: status,
    target_version: tvStr,
    fix_versions: fvStr,
    tv_set: parseVersions(tvStr),
    fv_set: parseVersions(fvStr),
    color_status: colorStatus,
    product_manager: pm,
    assignee: assignee,
    components: components,
    component: components.join(', ')
  }
}

// ---------------------------------------------------------------------------
// Classification engine
// ---------------------------------------------------------------------------

function classifyFeatures(features, releases) {
  const classifications = []

  for (let ri = 0; ri < releases.length; ri++) {
    const release = releases[ri]
    const relNorm = normVer(release)

    for (let fi = 0; fi < features.length; fi++) {
      const feat = features[fi]
      const tvMatch = feat.tv_set.has(relNorm)
      const fvMatch = feat.fv_set.has(relNorm)

      if (!tvMatch && !fvMatch) continue

      let cat
      if (tvMatch && fvMatch) {
        cat = 'aligned'
      } else if (tvMatch && !fvMatch) {
        cat = feat.fv_set.size > 0 ? 'mismatched' : 'tv_only'
      } else {
        cat = feat.tv_set.size > 0 ? 'mismatched' : 'fv_only'
      }

      classifications.push({
        release: release,
        category: cat,
        key: feat.key,
        url: feat.url,
        summary: feat.summary,
        status: feat.status,
        target_version: feat.target_version,
        fix_versions: feat.fix_versions,
        color_status: feat.color_status,
        product_manager: feat.product_manager,
        assignee: feat.assignee,
        team: '',  // team derivation requires org config — left empty for now
        components: feat.components,
        component: feat.component
      })
    }
  }

  return classifications
}

// ---------------------------------------------------------------------------
// Build export payload
// ---------------------------------------------------------------------------

function buildExport(classifications, releases, fetchTimestamp, allComponents, jiraProject) {
  const baseJql = 'project = ' + jiraProject + ' AND issuetype = Feature'

  const executiveSummary = []
  const releaseBuckets = {}

  for (let ri = 0; ri < releases.length; ri++) {
    const release = releases[ri]
    const items = classifications.filter(function(c) { return c.release === release })
    const nTotal = items.length

    const cats = { aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0 }
    for (let i = 0; i < items.length; i++) {
      cats[items[i].category]++
    }

    const alignPct = nTotal > 0 ? Math.round(1000 * cats.aligned / nTotal) / 10 : 0

    executiveSummary.push({
      release: release,
      total: nTotal,
      total_jql: jqlUrl(baseJql + ' AND ("Target Version" in (' + quoteRelease(release) + ') OR fixVersion in (' + quoteRelease(release) + '))'),
      aligned: cats.aligned,
      aligned_jql: jqlUrl(baseJql + ' AND "Target Version" in (' + quoteRelease(release) + ') AND fixVersion in (' + quoteRelease(release) + ')'),
      tv_only: cats.tv_only,
      tv_only_jql: jqlUrl(baseJql + ' AND "Target Version" in (' + quoteRelease(release) + ') AND fixVersion is EMPTY'),
      fv_only: cats.fv_only,
      fv_only_jql: jqlUrl(baseJql + ' AND fixVersion in (' + quoteRelease(release) + ') AND "Target Version" is EMPTY'),
      mismatched: cats.mismatched,
      mismatched_jql: jqlUrl(baseJql + ' AND (("Target Version" in (' + quoteRelease(release) + ') AND fixVersion is not EMPTY AND fixVersion not in (' + quoteRelease(release) + ')) OR (fixVersion in (' + quoteRelease(release) + ') AND "Target Version" is not EMPTY AND "Target Version" not in (' + quoteRelease(release) + ')))'),
      alignment_pct: alignPct
    })

    // Per-release feature lists
    const bucket = { aligned: [], tv_only: [], fv_only: [], mismatched: [] }
    for (let ci = 0; ci < items.length; ci++) {
      const item = items[ci]
      const row = {
        key: item.key,
        url: item.url,
        summary: item.summary,
        status: item.status,
        color_status: item.color_status,
        product_manager: item.product_manager,
        assignee: item.assignee,
        team: item.team,
        components: item.components,
        component: item.component,
        target_version: item.target_version,
        fix_versions: item.fix_versions
      }
      bucket[item.category].push(row)
    }
    releaseBuckets[release] = bucket
  }

  // Component breakdown — deduplicate by issue key per component
  // When a feature appears in multiple releases, pick the worst category:
  // mismatched > tv_only > fv_only > aligned (show the most actionable state)
  const CATEGORY_PRIORITY = { mismatched: 3, tv_only: 2, fv_only: 1, aligned: 0 }
  const compMap = {}
  for (let ki = 0; ki < classifications.length; ki++) {
    const cl = classifications[ki]
    const comps = cl.components || []
    if (comps.length === 0) continue
    for (let cj = 0; cj < comps.length; cj++) {
      const compName = comps[cj]
      if (!compMap[compName]) {
        compMap[compName] = {} // key -> category
      }
      const prev = compMap[compName][cl.key]
      if (!prev || CATEGORY_PRIORITY[cl.category] > CATEGORY_PRIORITY[prev]) {
        compMap[compName][cl.key] = cl.category
      }
    }
  }

  // Build component breakdown from ALL Jira components (even if 0 features)
  const allCompNames = allComponents && allComponents.length > 0 ? allComponents : Object.keys(compMap).sort()
  const componentBreakdown = []

  for (let cn = 0; cn < allCompNames.length; cn++) {
    const name = allCompNames[cn]
    const data = compMap[name]
    let total = 0
    let aligned = 0
    let tv_only = 0
    let fv_only = 0
    let mismatched = 0

    if (data) {
      const entries = Object.values(data)
      total = entries.length
      for (let ei = 0; ei < entries.length; ei++) {
        if (entries[ei] === 'aligned') aligned++
        else if (entries[ei] === 'tv_only') tv_only++
        else if (entries[ei] === 'fv_only') fv_only++
        else if (entries[ei] === 'mismatched') mismatched++
      }
    }

    const compQ = '"' + name.replace(/"/g, '\\"') + '"'
    componentBreakdown.push({
      component: name,
      total: total,
      total_jql: jqlUrl(baseJql + ' AND component = ' + compQ + ' AND ("Target Version" in (' + releases.map(quoteRelease).join(', ') + ') OR fixVersion in (' + releases.map(quoteRelease).join(', ') + '))'),
      aligned: aligned,
      tv_only: tv_only,
      fv_only: fv_only,
      mismatched: mismatched,
      alignment_pct: total > 0 ? Math.round(1000 * aligned / total) / 10 : 0
    })
  }
  componentBreakdown.sort(function(a, b) { return b.total - a.total || a.component.localeCompare(b.component) })

  return {
    metadata: {
      generated_at: new Date().toISOString(),
      data_timestamp: fetchTimestamp,
      releases: releases,
      total_features: classifications.length,
      all_components: allComponents || []
    },
    executive_summary: executiveSummary,
    releases: releaseBuckets,
    component_breakdown: componentBreakdown
  }
}

// ---------------------------------------------------------------------------
// Fetch + classify pipeline
// ---------------------------------------------------------------------------

async function fetchAndClassify(releases, storage, jiraProject) {
  const fetchTimestamp = new Date().toISOString()

  // Fetch all components from Jira (for complete breakdown)
  console.log('[releases/tv-fv-delta] Fetching all components from ' + jiraProject)
  const allComponents = await fetchAllComponents(jiraProject)
  console.log('[releases/tv-fv-delta] Fetched ' + allComponents.length + ' components from Jira')

  // Build JQL: features that have TV or FV in any of the target releases
  const releaseList = releases.map(quoteRelease).join(', ')
  const jql = 'project = ' + jiraProject + ' AND issuetype = Feature AND ("Target Version" in (' + releaseList + ') OR fixVersion in (' + releaseList + '))'

  console.log('[releases/tv-fv-delta] Fetching features: ' + jql)
  const issues = await fetchAllJqlResults(jiraRequest, jql, JQL_FIELDS)
  console.log('[releases/tv-fv-delta] Fetched ' + issues.length + ' issues from Jira')

  // Normalise
  const features = issues.map(normalizeIssue)

  // Classify
  const classifications = classifyFeatures(features, releases)
  console.log('[releases/tv-fv-delta] Classified ' + classifications.length + ' feature-release pairs')

  // Build export
  const result = buildExport(classifications, releases, fetchTimestamp, allComponents, jiraProject)

  // Cache
  storage.writeToStorage(CACHE_KEY, result)
  console.log('[releases/tv-fv-delta] Cached TV/FV delta (' + classifications.length + ' classifications, ' + (allComponents ? allComponents.length : 0) + ' components)')

  return result
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

// Exported for testing
module.exports = registerRoutes
module.exports.normVer = normVer
module.exports.parseVersions = parseVersions
module.exports.extractVersionNames = extractVersionNames
module.exports.isZStream = isZStream
module.exports.normalizeIssue = normalizeIssue
module.exports.classifyFeatures = classifyFeatures
module.exports.buildExport = buildExport
module.exports.DEFAULT_RELEASES = DEFAULT_RELEASES
module.exports.DEFAULT_JIRA_PROJECT = DEFAULT_JIRA_PROJECT
module.exports.jqlSafePattern = jqlSafePattern

function registerRoutes(router, context) {
  const storage = context.storage
  const requireAuth = context.requireAuth
  const requireScope = context.requireScope
  const config = context.config || {}
  const JIRA_PROJECT = config.jiraProject || DEFAULT_JIRA_PROJECT

  // Refresh state tracking
  const REFRESH_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
  const refreshState = { running: false, lastResult: null, startedAt: null, completedAt: null }

  function triggerBackgroundRefresh(releases, force) {
    if (refreshState.running) return
    if (!force && refreshState.completedAt) {
      const elapsed = Date.now() - new Date(refreshState.completedAt).getTime()
      if (elapsed < REFRESH_COOLDOWN_MS) return
    }

    // Validate all release names before starting (defense-in-depth)
    const safeReleases = releases.filter(function(r) { return typeof r === 'string' && jqlSafePattern.test(r) })
    if (safeReleases.length === 0) return
    releases = safeReleases

    refreshState.running = true
    refreshState.startedAt = new Date().toISOString()

    console.log('[releases/tv-fv-delta] Background refresh started')
    setImmediate(function() {
      fetchAndClassify(releases, storage, JIRA_PROJECT)
      .then(function(result) {
        refreshState.running = false
        refreshState.completedAt = new Date().toISOString()
        refreshState.lastResult = {
          status: 'success',
          message: result.metadata.total_features + ' feature-release pairs classified',
          completedAt: new Date().toISOString()
        }
        console.log('[releases/tv-fv-delta] Background refresh completed')
      })
      .catch(function(err) {
        refreshState.running = false
        refreshState.completedAt = new Date().toISOString()
        refreshState.lastResult = {
          status: 'error',
          message: err.message,
          completedAt: new Date().toISOString()
        }
        console.error('[releases/tv-fv-delta] Background refresh failed:', err.message)
      })
    })
  }

  /**
   * @openapi
   * /api/modules/releases/tv-fv-delta:
   *   get:
   *     tags: ['Releases']
   *     summary: Get TV vs FV delta analysis
   *     description: Returns cached data with stale-while-revalidate. Triggers background refresh if cache is stale.
   *     responses:
   *       200:
   *         description: TV/FV delta data with per-release breakdowns
   *       404:
   *         description: No data available — trigger a refresh
   */
  router.get('/', requireAuth, requireScope('releases:read'), function (req, res) {
    const data = storage.readFromStorage(CACHE_KEY)

    if (data) {
      // Check staleness
      const cachedAt = data.metadata && data.metadata.generated_at
      if (cachedAt) {
        const age = Date.now() - new Date(cachedAt).getTime()
        if (age >= CACHE_MAX_AGE_MS) {
          const cachedReleases = (data.metadata.releases || DEFAULT_RELEASES)
            .filter(function(r) { return typeof r === 'string' && jqlSafePattern.test(r) })
          triggerBackgroundRefresh(cachedReleases.length ? cachedReleases : DEFAULT_RELEASES)
        }
      }
      return res.json({
        ...data,
        _refreshing: refreshState.running
      })
    }

    // No cache — trigger first fetch using planning config if available
    triggerBackgroundRefresh(fetchReleasesFromPlanning(storage).releases)
    res.status(202).json({
      _refreshing: true,
      _noCache: true,
      message: 'Data pipeline is running for the first time. Refresh the page in a few moments.'
    })
  })

  /**
   * @openapi
   * /api/modules/releases/tv-fv-delta/refresh:
   *   post:
   *     tags: ['Releases']
   *     summary: Trigger a refresh of TV/FV delta data from Jira
   *     security: [{ auth: [] }]
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               releases:
   *                 type: array
   *                 items: { type: string }
   *                 description: Release versions to analyse (defaults to EA1, EA2, 3.5)
   *     responses:
   *       200:
   *         description: Refresh started or already running
   */
  router.post('/refresh', requireAuth, requireScope('releases:write'), function (req, res) {
    if (refreshState.running) {
      return res.json({ status: 'already_running', startedAt: refreshState.startedAt })
    }

    let releases
    if (req.body && Array.isArray(req.body.releases) && req.body.releases.length > 0) {
      // User-provided releases
      releases = req.body.releases
    } else {
      // Auto-discover from planning module (Smartsheet SSOT)
      releases = fetchReleasesFromPlanning(storage).releases
    }

    // Cap releases array to prevent excessive API load
    const MAX_RELEASES = 50
    if (releases.length > MAX_RELEASES) {
      return res.status(400).json({ error: 'Too many releases (max ' + MAX_RELEASES + ')' })
    }

    // Validate each release string to prevent JQL injection
    for (let i = 0; i < releases.length; i++) {
      if (typeof releases[i] !== 'string' || !jqlSafePattern.test(releases[i])) {
        return res.status(400).json({
          error: 'Invalid release name: ' + releases[i],
          detail: 'Release names must contain only alphanumeric characters, dots, underscores, hyphens, and spaces'
        })
      }
    }

    triggerBackgroundRefresh(releases, true)
    res.json({ status: 'started', releases: releases })
  })

  /**
   * @openapi
   * /api/modules/releases/tv-fv-delta/refresh/status:
   *   get:
   *     tags: ['Releases']
   *     summary: Check status of the TV/FV delta refresh
   *     responses:
   *       200:
   *         description: Refresh state
   */
  router.get('/refresh/status', requireAuth, requireScope('releases:read'), function (req, res) {
    res.json(refreshState)
  })

  /**
   * @openapi
   * /api/modules/releases/tv-fv-delta/releases:
   *   get:
   *     tags: ['Releases']
   *     summary: Get configured releases from planning module (Smartsheet SSOT)
   *     responses:
   *       200:
   *         description: Release list expanded to EA1, EA2, GA variants
   */
  router.get('/releases', requireAuth, requireScope('releases:read'), function (req, res) {
    try {
      const result = fetchReleasesFromPlanning(storage)
      res.json({
        releases: result.releases,
        source: result.source,
        fetchedAt: new Date().toISOString()
      })
    } catch (err) {
      console.error('[releases/tv-fv-delta] Failed to fetch releases:', err.message)
      res.status(500).json({ error: 'Failed to fetch releases' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/tv-fv-delta/versions:
   *   get:
   *     tags: ['Releases']
   *     summary: Get all fix versions from the Jira project
   *     responses:
   *       200:
   *         description: All project fix versions with release dates
   */
  router.get('/versions', requireAuth, requireScope('releases:read'), async function (req, res) {
    // Check cache first
    const cached = storage.readFromStorage(VERSIONS_CACHE_KEY)
    if (cached && cached.fetchedAt) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime()
      if (age < VERSIONS_CACHE_MAX_AGE_MS) {
        return res.json(cached)
      }
    }

    try {
      const allVersions = await fetchProjectVersions(jiraRequest, [JIRA_PROJECT])
      if (!Array.isArray(allVersions)) {
        const result = { versions: [], fetchedAt: new Date().toISOString() }
        storage.writeToStorage(VERSIONS_CACHE_KEY, result)
        return res.json(result)
      }
      const versions = allVersions
        .filter(function(v) { return !v.archived && !isZStream(v.name) })
        .sort(function(a, b) { return (a.name || '').localeCompare(b.name || '') })

      const result = { versions: versions, fetchedAt: new Date().toISOString() }
      storage.writeToStorage(VERSIONS_CACHE_KEY, result)
      res.json(result)
    } catch (err) {
      console.error('[releases/tv-fv-delta] Failed to fetch versions:', err.message)
      // Return stale cache if available
      if (cached) return res.json(cached)
      res.status(502).json({ error: 'Failed to fetch versions from Jira' })
    }
  })

  // Diagnostics hook
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function () {
      const tvfv = storage.readFromStorage(CACHE_KEY)
      return {
        tvFvDelta: tvfv ? { generatedAt: tvfv.metadata?.generated_at, releases: tvfv.metadata?.releases } : null,
        refresh: refreshState
      }
    })
  }
}
