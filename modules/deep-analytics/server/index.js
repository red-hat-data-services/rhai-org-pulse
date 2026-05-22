const { jiraRequest, JIRA_HOST, fetchAllJqlResults } = require('../../../shared/server/jira')

const JIRA_BROWSE = JIRA_HOST + '/browse'
const JIRA_SEARCH = JIRA_HOST + '/issues/?jql='
const CACHE_KEY = 'deep-analytics/tv-fv-delta.json'
const CACHE_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

// Default releases — EA1, EA2, then GA (timeline order)
const DEFAULT_RELEASES = ['rhoai-3.5.EA1', 'rhoai-3.5.EA2', 'rhoai-3.5']

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
  if (v.startsWith('RHOAI_')) {
    v = 'rhoai-' + v.replace('RHOAI_', '').replace('.0', '').replace(/_/g, '-')
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
  return fixVersions.map(function(v) { return v.name || '' }).join(', ')
}

// ---------------------------------------------------------------------------
// Fetch all components from Jira project
// ---------------------------------------------------------------------------

async function fetchAllComponents() {
  try {
    var response = await jiraRequest('/rest/api/2/project/RHAISTRAT/components')
    if (!Array.isArray(response)) return []
    return response.map(function(c) { return c.name }).filter(Boolean).sort()
  } catch (err) {
    console.error('[deep-analytics] Failed to fetch components:', err.message)
    return []
  }
}

// ---------------------------------------------------------------------------
// JQL URL builder
// ---------------------------------------------------------------------------

function jqlUrl(jql) {
  return JIRA_SEARCH + encodeURIComponent(jql)
}

// ---------------------------------------------------------------------------
// Issue normalisation
// ---------------------------------------------------------------------------

function normalizeIssue(issue) {
  var fields = issue.fields || {}

  // Target version — may be string or array-of-objects
  var tvRaw = fields[CF_TARGET_VERSION]
  var tvStr = ''
  if (Array.isArray(tvRaw)) {
    tvStr = tvRaw.map(function(v) { return typeof v === 'object' ? (v.name || v.value || '') : String(v) }).join(', ')
  } else if (tvRaw && typeof tvRaw === 'object') {
    tvStr = tvRaw.name || tvRaw.value || ''
  } else if (tvRaw) {
    tvStr = String(tvRaw)
  }

  // Fix versions
  var fvStr = extractVersionNames(fields.fixVersions)

  // Components
  var components = []
  if (Array.isArray(fields.components)) {
    components = fields.components.map(function(c) { return c.name || '' }).filter(Boolean)
  }

  // Color status — may be string or object with value
  var csRaw = fields[CF_COLOR_STATUS]
  var colorStatus = ''
  if (csRaw) {
    colorStatus = typeof csRaw === 'object' ? (csRaw.value || '') : String(csRaw)
  }

  // Product manager — may be user object or string
  var pmRaw = fields[CF_PRODUCT_MANAGER]
  var pm = ''
  if (pmRaw) {
    pm = typeof pmRaw === 'object' ? (pmRaw.displayName || pmRaw.name || '') : String(pmRaw)
  }

  // Assignee
  var assigneeRaw = fields.assignee
  var assignee = ''
  if (assigneeRaw) {
    assignee = assigneeRaw.displayName || assigneeRaw.name || ''
  }

  // Status
  var status = ''
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
  var classifications = []

  for (var ri = 0; ri < releases.length; ri++) {
    var release = releases[ri]
    var relNorm = normVer(release)

    for (var fi = 0; fi < features.length; fi++) {
      var feat = features[fi]
      var tvMatch = feat.tv_set.has(relNorm)
      var fvMatch = feat.fv_set.has(relNorm)

      if (!tvMatch && !fvMatch) continue

      var cat
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

function buildExport(classifications, releases, fetchTimestamp, allComponents) {
  var baseJql = 'project = RHAISTRAT AND issuetype = Feature'

  var executiveSummary = []
  var releaseBuckets = {}

  for (var ri = 0; ri < releases.length; ri++) {
    var release = releases[ri]
    var items = classifications.filter(function(c) { return c.release === release })
    var nTotal = items.length

    var cats = { aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0 }
    for (var i = 0; i < items.length; i++) {
      cats[items[i].category]++
    }

    var alignPct = nTotal > 0 ? Math.round(1000 * cats.aligned / nTotal) / 10 : 0

    executiveSummary.push({
      release: release,
      total: nTotal,
      total_jql: jqlUrl(baseJql + ' AND ("Target Version" in (' + release + ') OR fixVersion in (' + release + '))'),
      aligned: cats.aligned,
      aligned_jql: jqlUrl(baseJql + ' AND "Target Version" in (' + release + ') AND fixVersion in (' + release + ')'),
      tv_only: cats.tv_only,
      tv_only_jql: jqlUrl(baseJql + ' AND "Target Version" in (' + release + ') AND (fixVersion is EMPTY OR fixVersion not in (' + release + '))'),
      fv_only: cats.fv_only,
      fv_only_jql: jqlUrl(baseJql + ' AND fixVersion in (' + release + ') AND ("Target Version" is EMPTY OR "Target Version" not in (' + release + '))'),
      mismatched: cats.mismatched,
      mismatched_jql: jqlUrl(baseJql + ' AND "Target Version" in (' + release + ') AND fixVersion is not EMPTY AND fixVersion not in (' + release + ')'),
      alignment_pct: alignPct
    })

    // Per-release feature lists
    var bucket = { aligned: [], tv_only: [], fv_only: [], mismatched: [] }
    for (var ci = 0; ci < items.length; ci++) {
      var item = items[ci]
      var row = {
        key: item.key,
        url: item.url,
        summary: item.summary,
        status: item.status,
        color_status: item.color_status,
        product_manager: item.product_manager,
        assignee: item.assignee,
        team: item.team,
        component: item.component,
        target_version: item.target_version,
        fix_versions: item.fix_versions
      }
      bucket[item.category].push(row)
    }
    releaseBuckets[release] = bucket
  }

  // Component breakdown
  var compMap = {}
  for (var ki = 0; ki < classifications.length; ki++) {
    var cl = classifications[ki]
    var comps = cl.components || []
    if (comps.length === 0) continue
    for (var cj = 0; cj < comps.length; cj++) {
      var compName = comps[cj]
      if (!compMap[compName]) {
        compMap[compName] = { keys: new Set(), aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0 }
      }
      if (!compMap[compName].keys.has(cl.key + ':' + cl.category)) {
        compMap[compName].keys.add(cl.key + ':' + cl.category)
        compMap[compName][cl.category]++
      }
    }
  }

  // Build component breakdown from ALL Jira components (even if 0 features)
  var allCompNames = allComponents && allComponents.length > 0 ? allComponents : Object.keys(compMap).sort()
  var componentBreakdown = []

  for (var cn = 0; cn < allCompNames.length; cn++) {
    var name = allCompNames[cn]
    var data = compMap[name]
    var uniqueKeys = new Set()
    var total = 0
    var aligned = 0
    var tv_only = 0
    var fv_only = 0
    var mismatched = 0

    if (data) {
      data.keys.forEach(function(k) { uniqueKeys.add(k.split(':')[0]) })
      total = uniqueKeys.size
      aligned = data.aligned || 0
      tv_only = data.tv_only || 0
      fv_only = data.fv_only || 0
      mismatched = data.mismatched || 0
    }

    var compQ = '"' + name + '"'
    componentBreakdown.push({
      component: name,
      total: total,
      total_jql: jqlUrl(baseJql + ' AND component = ' + compQ + ' AND "Target Version" in (' + releases.join(', ') + ')'),
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

async function fetchAndClassify(releases, storage) {
  var fetchTimestamp = new Date().toISOString()

  // Fetch all components from Jira (for complete breakdown)
  console.log('[deep-analytics] Fetching all components from RHAISTRAT')
  var allComponents = await fetchAllComponents()
  console.log('[deep-analytics] Fetched ' + allComponents.length + ' components from Jira')

  // Build JQL: features that have TV or FV in any of the target releases
  var releaseList = releases.join(', ')
  var jql = 'project = RHAISTRAT AND issuetype = Feature AND ("Target Version" in (' + releaseList + ') OR fixVersion in (' + releaseList + '))'

  console.log('[deep-analytics] Fetching features: ' + jql)
  var issues = await fetchAllJqlResults(jiraRequest, jql, JQL_FIELDS)
  console.log('[deep-analytics] Fetched ' + issues.length + ' issues from Jira')

  // Normalise
  var features = issues.map(normalizeIssue)

  // Classify
  var classifications = classifyFeatures(features, releases)
  console.log('[deep-analytics] Classified ' + classifications.length + ' feature-release pairs')

  // Build export
  var result = buildExport(classifications, releases, fetchTimestamp, allComponents)

  // Cache
  storage.writeToStorage(CACHE_KEY, result)
  console.log('[deep-analytics] Cached TV/FV delta (' + JSON.stringify(result).length + ' bytes)')

  return result
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

module.exports = function registerRoutes(router, context) {
  var storage = context.storage
  var requireAuth = context.requireAuth
  var requireAdmin = context.requireAdmin

  // Refresh state tracking
  var refreshState = { running: false, lastResult: null, startedAt: null }

  function triggerBackgroundRefresh(releases) {
    if (refreshState.running) return
    refreshState.running = true
    refreshState.startedAt = new Date().toISOString()

    console.log('[deep-analytics] Background refresh started')
    fetchAndClassify(releases, storage)
      .then(function(result) {
        refreshState.running = false
        refreshState.lastResult = {
          status: 'success',
          message: result.metadata.total_features + ' feature-release pairs classified',
          completedAt: new Date().toISOString()
        }
        console.log('[deep-analytics] Background refresh completed')
      })
      .catch(function(err) {
        refreshState.running = false
        refreshState.lastResult = {
          status: 'error',
          message: err.message,
          completedAt: new Date().toISOString()
        }
        console.error('[deep-analytics] Background refresh failed:', err.message)
      })
  }

  var REQUIRED_KEYS = {
    'tv-fv-delta': ['metadata', 'executive_summary', 'releases'],
    'release-healthcheck': ['metadata', 'executive_summary', 'features'],
  }

  /**
   * @openapi
   * /api/modules/deep-analytics/tv-fv-delta:
   *   get:
   *     tags: ['Deep Analytics']
   *     summary: Get TV vs FV delta analysis
   *     description: Returns cached data with stale-while-revalidate. Triggers background refresh if cache is stale.
   *     responses:
   *       200:
   *         description: TV/FV delta data with per-release breakdowns
   *       404:
   *         description: No data available — trigger a refresh
   */
  router.get('/tv-fv-delta', requireAuth, function (req, res) {
    var data = storage.readFromStorage(CACHE_KEY)

    if (data) {
      // Check staleness
      var cachedAt = data.metadata && data.metadata.generated_at
      if (cachedAt) {
        var age = Date.now() - new Date(cachedAt).getTime()
        if (age >= CACHE_MAX_AGE_MS) {
          triggerBackgroundRefresh(data.metadata.releases || DEFAULT_RELEASES)
        }
      }
      return res.json({
        ...data,
        _refreshing: refreshState.running
      })
    }

    // No cache — trigger first fetch
    triggerBackgroundRefresh(DEFAULT_RELEASES)
    res.status(202).json({
      _refreshing: true,
      _noCache: true,
      message: 'Data pipeline is running for the first time. Refresh the page in a few moments.'
    })
  })

  /**
   * @openapi
   * /api/modules/deep-analytics/tv-fv-delta/refresh:
   *   post:
   *     tags: ['Deep Analytics']
   *     summary: Trigger a refresh of TV/FV delta data from Jira
   *     security: [{ admin: [] }]
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
  router.post('/tv-fv-delta/refresh', requireAdmin, function (req, res) {
    if (refreshState.running) {
      return res.json({ status: 'already_running', startedAt: refreshState.startedAt })
    }
    var releases = (req.body && Array.isArray(req.body.releases) && req.body.releases.length > 0)
      ? req.body.releases
      : DEFAULT_RELEASES

    // Validate each release string to prevent JQL injection
    var jqlSafePattern = /^[a-zA-Z0-9._-]+$/
    for (var i = 0; i < releases.length; i++) {
      if (typeof releases[i] !== 'string' || !jqlSafePattern.test(releases[i])) {
        return res.status(400).json({
          error: 'Invalid release name: ' + releases[i],
          detail: 'Release names must contain only alphanumeric characters, dots, underscores, and hyphens'
        })
      }
    }

    triggerBackgroundRefresh(releases)
    res.json({ status: 'started', releases: releases })
  })

  /**
   * @openapi
   * /api/modules/deep-analytics/tv-fv-delta/refresh/status:
   *   get:
   *     tags: ['Deep Analytics']
   *     summary: Check status of the TV/FV delta refresh
   *     responses:
   *       200:
   *         description: Refresh state
   */
  router.get('/tv-fv-delta/refresh/status', requireAuth, function (req, res) {
    res.json(refreshState)
  })

  /**
   * @openapi
   * /api/modules/deep-analytics/release-health:
   *   get:
   *     tags: ['Deep Analytics']
   *     summary: Get release healthcheck analysis
   *     responses:
   *       200:
   *         description: Release health data with hygiene, drift, and action items
   *       404:
   *         description: No data available — run the export pipeline
   */
  router.get('/release-health', requireAuth, function (req, res) {
    var data = storage.readFromStorage('deep-analytics/release-healthcheck.json')
    if (!data) {
      return res.status(404).json({ error: 'No release healthcheck data available. Run the export pipeline first.' })
    }
    res.json(data)
  })

  /**
   * @openapi
   * /api/modules/deep-analytics/status:
   *   get:
   *     tags: ['Deep Analytics']
   *     summary: Check data availability for all deep-analytics datasets
   *     responses:
   *       200:
   *         description: Availability and metadata for each dataset
   */
  router.get('/status', requireAuth, function (req, res) {
    var tvfv = storage.readFromStorage(CACHE_KEY)
    var health = storage.readFromStorage('deep-analytics/release-healthcheck.json')

    res.json({
      tv_fv_delta: tvfv
        ? { available: true, generated_at: tvfv.metadata?.generated_at, releases: tvfv.metadata?.releases }
        : { available: false },
      release_healthcheck: health
        ? { available: true, generated_at: health.metadata?.generated_at, target_version: health.metadata?.target_version }
        : { available: false },
      refresh: refreshState
    })
  })

  /**
   * @openapi
   * /api/modules/deep-analytics/ingest/{type}:
   *   post:
   *     tags: ['Deep Analytics']
   *     summary: Ingest JSON payload from external export pipeline
   *     security: [{ admin: [] }]
   *     parameters:
   *       - in: path
   *         name: type
   *         required: true
   *         schema:
   *           type: string
   *           enum: [tv-fv-delta, release-healthcheck]
   *         description: Dataset type to ingest
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Ingestion successful
   *       400:
   *         description: Invalid type or missing required keys
   */
  router.post('/ingest/:type', requireAdmin, function (req, res) {
    var type = req.params.type
    var validTypes = ['tv-fv-delta', 'release-healthcheck']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be one of: ' + validTypes.join(', ') })
    }

    var required = REQUIRED_KEYS[type]
    var missing = required.filter(function(k) { return !(k in req.body) })
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required keys: ' + missing.join(', ') })
    }

    var filename = type === 'tv-fv-delta' ? 'tv-fv-delta.json' : 'release-healthcheck.json'
    storage.writeToStorage('deep-analytics/' + filename, req.body)
    res.json({ success: true, type: type, size: JSON.stringify(req.body).length })
  })

  // Diagnostics hook
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function () {
      var tvfv = storage.readFromStorage(CACHE_KEY)
      var health = storage.readFromStorage('deep-analytics/release-healthcheck.json')
      return {
        tvFvDelta: tvfv ? { generatedAt: tvfv.metadata?.generated_at, releases: tvfv.metadata?.releases } : null,
        releaseHealth: health ? { generatedAt: health.metadata?.generated_at } : null,
        refresh: refreshState
      }
    })
  }
}
