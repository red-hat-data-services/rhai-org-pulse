/**
 * Feature Tracking routes for the releases module.
 *
 * Queries Jira directly by fixVersion (e.g. fixVersion = "rhoai-3.5.EA1")
 * to list all features committed to a release. Uses the Jira changelog to
 * detect when fixVersion was applied — features added after the Feature
 * Freeze date are flagged as "Late Additions".
 *
 * Grouped by portfolio release (e.g. 3.5.EA1) across products (RHOAI,
 * RHAIIS, RHELAI). Uses the JQL WAS operator to detect features that
 * previously had a fixVersion but no longer do (dropped features).
 */

const { readRegistry } = require('../registry')
const { fetchProductsByShortname } = require('../delivery/product-pages')
const { CUSTOM_FIELDS, transformIssue } = require('../hygiene/jira-fetch')

const PP_CACHE_FILE = 'releases/delivery/product-pages-releases-cache.json'
const PLANNING_CONFIG_FILE = 'releases/planning/config.json'
const TRACKING_CACHE_PREFIX = 'releases/execution/tracking-data-'
const CACHE_TTL_MS = 10 * 60 * 1000
const DEFAULT_PRODUCTS = ['rhoai', 'rhelai', 'RHAII']
const DEFAULT_PROJECTS = ['RHAISTRAT', 'RHOAIENG', 'AIPCC', 'RHAIENG', 'INFERENG']
const DEFAULT_ISSUE_TYPES = ['Feature', 'Initiative']

var EXCLUDE_VERSION_RE = /^\d+\.\d+\.\d+$/

var FIELDS_TO_FETCH = [
  'summary', 'status', 'issuetype', 'assignee', 'fixVersions', 'versions',
  'components', 'labels', 'issuelinks',
  CUSTOM_FIELDS.team,
  CUSTOM_FIELDS.statusSummary,
  CUSTOM_FIELDS.colorStatus,
  CUSTOM_FIELDS.productManager
].join(',')

function cacheKey(portfolioVersion) {
  return TRACKING_CACHE_PREFIX + portfolioVersion + '.json'
}

/**
 * Extract the product prefix from a release number.
 * e.g. "rhoai-3.5.EA1" → "rhoai", "RHAII-3.5" → "rhaii"
 */
function extractProduct(releaseNumber) {
  var s = (releaseNumber || '').toLowerCase()
  var dash = s.indexOf('-')
  return dash > 0 ? s.slice(0, dash) : s
}

/**
 * Normalize a version string for comparison: lowercase, strip separators
 * between version number and EA/GA tag, and strip trailing suffixes like
 * "release". Handles all observed naming conventions:
 *   "rhoai-3.5.EA2"            → "rhoai-3.5ea2"
 *   "RHAII-3.5 EA2"            → "rhaii-3.5ea2"
 *   "rhelai-3.5EA2"            → "rhelai-3.5ea2"
 *   "rhelai-3.5 EA2 release"   → "rhelai-3.5ea2"
 *   "RHELAI-3.4 EA-1"          → "rhelai-3.4ea1"
 */
function normalizeVersionName(name) {
  var s = (name || '').toLowerCase()
  s = s.replace(/\s+release\s*$/i, '')
  s = s.replace(/(\d)[\s._-]+(?=ea|ga)/gi, '$1')
  s = s.replace(/(ea)-?(\d)/gi, 'ea$2')
  return s
}

var jiraVersionsCache = { versions: null, fetchedAt: 0 }
var VERSIONS_CACHE_TTL_MS = 15 * 60 * 1000

/**
 * Resolve a portfolio version (e.g. "3.5.EA1") to actual Jira fixVersion
 * names by querying the Jira project versions API. Handles different naming
 * conventions across products, collecting ALL matching fixVersions per product
 * (e.g. both "rhelai-3.5EA2" and "rhelai-3.5 EA2 release" for rhelai).
 */
async function resolveProductVersionsFromJira(portfolioVersion, jiraRequestFn) {
  var { fetchProjectVersions } = require('../../../../shared/server/jira')

  if (!jiraVersionsCache.versions || Date.now() - jiraVersionsCache.fetchedAt > VERSIONS_CACHE_TTL_MS) {
    jiraVersionsCache.versions = await fetchProjectVersions(jiraRequestFn, DEFAULT_PROJECTS)
    jiraVersionsCache.fetchedAt = Date.now()
  }

  var allVersions = jiraVersionsCache.versions
  var normalizedPortfolio = normalizeVersionName(portfolioVersion)

  var productMap = {}

  for (var i = 0; i < allVersions.length; i++) {
    var v = allVersions[i]
    var product = extractProduct(v.name)
    if (!product) continue

    var normalizedName = normalizeVersionName(v.name)
    var versionPart = normalizedName.replace(/^[a-z]+-/, '')

    if (versionPart === normalizedPortfolio) {
      if (!productMap[product]) {
        productMap[product] = {
          product: product,
          fixVersions: []
        }
      }
      if (productMap[product].fixVersions.indexOf(v.name) === -1) {
        productMap[product].fixVersions.push(v.name)
      }
    }
  }

  var matched = []
  var keys = Object.keys(productMap)
  for (var ki = 0; ki < keys.length; ki++) {
    var entry = productMap[keys[ki]]
    matched.push({
      product: entry.product,
      releaseNumber: entry.fixVersions[0],
      fixVersions: entry.fixVersions
    })
  }

  if (matched.length > 0) return matched

  var products = DEFAULT_PRODUCTS
  var result = []
  for (var pi = 0; pi < products.length; pi++) {
    var fv = products[pi] + '-' + portfolioVersion
    result.push({
      product: products[pi].toLowerCase(),
      releaseNumber: fv,
      fixVersions: [fv]
    })
  }
  return result
}

/**
 * Fetch features from Jira by fixVersion(s) with changelog.
 * Accepts an array of fixVersion names to handle naming variants
 * (e.g. ["rhelai-3.5EA2", "rhelai-3.5 EA2 release"]).
 * Deduplicates by issue key. Returns transformed feature objects.
 */
async function fetchFeaturesByFixVersion(fixVersions, jiraRequestFn, fetchAllJqlResultsFn) {
  var versions = Array.isArray(fixVersions) ? fixVersions : [fixVersions]
  var projects = DEFAULT_PROJECTS
  var issueTypes = DEFAULT_ISSUE_TYPES

  var sanitized = versions.map(function (v) {
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  })

  var fixVersionFilter = sanitized.length === 1
    ? 'fixVersion = ' + sanitized[0]
    : 'fixVersion IN (' + sanitized.join(', ') + ')'

  var jql = 'project IN (' + projects.join(', ') + ')' +
    ' AND issuetype IN (' + issueTypes.join(', ') + ')' +
    ' AND ' + fixVersionFilter

  var rawIssues = await fetchAllJqlResultsFn(jiraRequestFn, jql, FIELDS_TO_FETCH, {
    expand: 'renderedFields,changelog'
  })

  var seen = {}
  var features = []
  for (var i = 0; i < rawIssues.length; i++) {
    var raw = rawIssues[i]
    if (seen[raw.key]) continue
    seen[raw.key] = true
    var transformed = transformIssue(raw, {})
    transformed.fixVersionAddedAt = findFixVersionAddedDate(raw.changelog, versions)
    features.push(transformed)
  }

  return features
}

/**
 * Parse changelog to find when a fixVersion was added to the issue.
 * Accepts a single version name or an array of names to match against
 * (handles naming variants like "rhelai-3.5EA2" / "rhelai-3.5 EA2 release").
 * Returns ISO timestamp string or null if not found in changelog.
 */
function findFixVersionAddedDate(changelog, fixVersionNames) {
  if (!changelog || !Array.isArray(changelog.histories)) return null

  var targets = Array.isArray(fixVersionNames) ? fixVersionNames : [fixVersionNames]
  var normalizedTargets = {}
  for (var ti = 0; ti < targets.length; ti++) {
    normalizedTargets[targets[ti].toLowerCase()] = true
  }

  for (var i = 0; i < changelog.histories.length; i++) {
    var history = changelog.histories[i]
    var items = history.items || []

    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      if (item.field !== 'Fix Version' && item.fieldId !== 'fixVersions') continue
      var toString = (item.toString || '').toLowerCase()
      if (normalizedTargets[toString]) {
        return history.created
      }
    }
  }

  return null
}

/**
 * Classify a feature as late addition based on changelog date vs freeze date.
 */
function classifyFeature(feature, featureFreezeDate) {
  if (!featureFreezeDate) return null

  if (feature.fixVersionAddedAt) {
    var addedDate = feature.fixVersionAddedAt.split('T')[0]
    if (addedDate > featureFreezeDate) {
      return 'added'
    }
  }

  return null
}

/**
 * Fetch features that previously had a fixVersion but no longer do,
 * using the JQL WAS operator. Only checks issuetype = Feature.
 * Returns transformed feature objects marked as dropped, with the date
 * the fixVersion was removed (fixVersionRemovedAt).
 */
async function fetchDroppedFeatures(fixVersions, jiraRequestFn, fetchAllJqlResultsFn, currentKeys) {
  var versions = Array.isArray(fixVersions) ? fixVersions : [fixVersions]
  var projects = DEFAULT_PROJECTS

  var sanitized = versions.map(function (v) {
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  })

  // Build WAS clause: (fixVersion WAS "v1" OR fixVersion WAS "v2")
  var wasClauses = sanitized.map(function (v) { return 'fixVersion WAS ' + v })
  var wasFilter = wasClauses.length === 1
    ? wasClauses[0]
    : '(' + wasClauses.join(' OR ') + ')'

  // Build NOT IN clause to exclude issues that still have the fixVersion
  var notInFilter = sanitized.length === 1
    ? 'fixVersion != ' + sanitized[0]
    : 'fixVersion NOT IN (' + sanitized.join(', ') + ')'

  var jql = wasFilter +
    ' AND ' + notInFilter +
    ' AND issuetype = Feature' +
    ' AND project IN (' + projects.join(', ') + ')'

  try {
    var rawIssues = await fetchAllJqlResultsFn(jiraRequestFn, jql, FIELDS_TO_FETCH, {
      expand: 'renderedFields,changelog'
    })

    var dropped = []
    for (var i = 0; i < rawIssues.length; i++) {
      var raw = rawIssues[i]
      if (currentKeys[raw.key]) continue
      var transformed = transformIssue(raw, {})
      transformed.scopeChange = 'dropped'
      transformed.fixVersionRemovedAt = findFixVersionRemovedDate(raw.changelog, versions)
      dropped.push(transformed)
    }

    return dropped
  } catch (err) {
    console.warn('[feature-tracking] WAS query failed (may not be supported):', err.message)
    return []
  }
}

/**
 * Parse changelog to find when a fixVersion was removed from the issue.
 * Looks for Fix Version changelog entries where fromString matches one of
 * the version names (meaning it was taken away).
 */
function findFixVersionRemovedDate(changelog, fixVersionNames) {
  if (!changelog || !Array.isArray(changelog.histories)) return null

  var targets = Array.isArray(fixVersionNames) ? fixVersionNames : [fixVersionNames]
  var normalizedTargets = {}
  for (var ti = 0; ti < targets.length; ti++) {
    normalizedTargets[targets[ti].toLowerCase()] = true
  }

  var mostRecent = null

  for (var i = 0; i < changelog.histories.length; i++) {
    var history = changelog.histories[i]
    var items = history.items || []

    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      if (item.field !== 'Fix Version' && item.fieldId !== 'fixVersions') continue
      var fromString = (item.fromString || '').toLowerCase()
      if (normalizedTargets[fromString]) {
        if (!mostRecent || history.created > mostRecent) {
          mostRecent = history.created
        }
      }
    }
  }

  return mostRecent
}

/**
 * Get Feature Freeze dates from PP cache, keyed by product release number.
 * Returns a map: { "rhoai-3.5.EA1": "2026-05-15", "rhelai-3.5.EA1": "2026-04-17", ... }
 * Also returns the earliest date across products as a portfolio-level fallback.
 */
function getFeatureFreezeDatesFromCache(portfolioVersion, readFromStorage) {
  var ppCache = readFromStorage(PP_CACHE_FILE)
  var ppReleases = Array.isArray(ppCache) ? ppCache : (ppCache && ppCache.releases) || []

  var normalizedPortfolio = normalizeVersionName(portfolioVersion)
  var byProduct = {}
  var earliest = null

  for (var i = 0; i < ppReleases.length; i++) {
    var rel = ppReleases[i]
    var relVersion = normalizeVersionName(rel.releaseNumber).replace(/^[a-z]+-/, '')
    if (relVersion === normalizedPortfolio && rel.featureFreezeDate) {
      byProduct[normalizeVersionName(rel.releaseNumber)] = rel.featureFreezeDate
      if (!earliest || rel.featureFreezeDate < earliest) {
        earliest = rel.featureFreezeDate
      }
    }
  }

  return { byProduct: byProduct, earliest: earliest }
}

/**
 * @openapi
 * /api/modules/releases/execution/tracking/data:
 *   get:
 *     summary: Get feature tracking data by querying Jira fixVersion directly
 *     tags: [Releases - Feature Tracking]
 *     parameters:
 *       - in: query
 *         name: version
 *         required: true
 *         schema: { type: string }
 *         description: Portfolio version (e.g. 3.5.EA1)
 *       - in: query
 *         name: refresh
 *         schema: { type: boolean }
 *         description: Force fresh fetch from Jira (skip cache)
 *     responses:
 *       200:
 *         description: Feature tracking data with scope change annotations
 *       400:
 *         description: Missing version parameter
 */

/**
 * @openapi
 * /api/modules/releases/execution/tracking/versions:
 *   get:
 *     summary: List available portfolio versions for feature tracking
 *     tags: [Releases - Feature Tracking]
 *     responses:
 *       200:
 *         description: Array of portfolio versions
 */

module.exports = function registerFeatureTrackingRoutes(router, context) {
  var storage = context.storage
  var requireAuth = context.requireAuth
  var requireScope = context.requireScope

  // GET /tracking/versions
  router.get('/tracking/versions', requireAuth, requireScope('releases:read'), function (req, res) {
    var versionMap = {}

    function addVersion(releaseNumber) {
      var product = extractProduct(releaseNumber)
      var versionPart = (releaseNumber || '').replace(/^[a-z]+-/i, '')
      if (!versionPart || !product) return
      if (EXCLUDE_VERSION_RE.test(versionPart)) return
      if (!versionMap[versionPart]) {
        versionMap[versionPart] = { version: versionPart, products: [] }
      }
      if (versionMap[versionPart].products.indexOf(product) === -1) {
        versionMap[versionPart].products.push(product)
      }
    }

    var registry = readRegistry(storage.readFromStorage)
    var registryReleases = registry.releases || []
    for (var ri = 0; ri < registryReleases.length; ri++) {
      var rel = registryReleases[ri]
      if (rel.state === 'archived') continue
      addVersion(rel.displayName || rel.id || '')
    }

    var ppCache = storage.readFromStorage(PP_CACHE_FILE)
    var ppReleases = Array.isArray(ppCache) ? ppCache : (ppCache && ppCache.releases) || []
    for (var pi = 0; pi < ppReleases.length; pi++) {
      if (ppReleases[pi].releaseNumber) addVersion(ppReleases[pi].releaseNumber)
    }

    var planningConfig = storage.readFromStorage(PLANNING_CONFIG_FILE)
    if (planningConfig && planningConfig.releases) {
      var configVersions = Object.keys(planningConfig.releases)
      for (var ci = 0; ci < configVersions.length; ci++) {
        var cv = configVersions[ci]
        if (!versionMap[cv] && !EXCLUDE_VERSION_RE.test(cv)) {
          versionMap[cv] = { version: cv, products: [] }
        }
      }
    }

    var versions = Object.keys(versionMap).map(function (k) { return versionMap[k] })

    // Enrich with earliest feature freeze date per portfolio version
    for (var vi = 0; vi < versions.length; vi++) {
      var fd = getFeatureFreezeDatesFromCache(versions[vi].version, storage.readFromStorage)
      versions[vi].featureFreezeDate = fd.earliest || null
    }

    // Sort by feature freeze date (earliest first); versions without a date go last
    versions.sort(function (a, b) {
      if (a.featureFreezeDate && b.featureFreezeDate) return a.featureFreezeDate.localeCompare(b.featureFreezeDate)
      if (a.featureFreezeDate && !b.featureFreezeDate) return -1
      if (!a.featureFreezeDate && b.featureFreezeDate) return 1
      return b.version.localeCompare(a.version)
    })

    res.json({ versions: versions })
  })

  // GET /tracking/data — query Jira by fixVersion
  router.get('/tracking/data', requireAuth, requireScope('releases:read'), async function (req, res) {
    var version = req.query.version
    if (!version) {
      return res.status(400).json({ error: 'version query parameter is required' })
    }

    var forceRefresh = req.query.refresh === 'true'

    try {
      // Check server-side cache
      if (!forceRefresh) {
        var cached = storage.readFromStorage(cacheKey(version))
        if (cached && cached.fetchedAt) {
          var age = Date.now() - new Date(cached.fetchedAt).getTime()
          if (age < CACHE_TTL_MS) {
            return res.json(cached)
          }
        }
      }

      var jira = require('../../../../shared/server/jira')
      var jiraRequest = jira.jiraRequest
      var fetchAllJqlResults = jira.fetchAllJqlResults

      var productVersions = await resolveProductVersionsFromJira(version, jiraRequest)
      var freezeDates = getFeatureFreezeDatesFromCache(version, storage.readFromStorage)

      // Try live PP API if cache doesn't have any freeze dates
      if (!freezeDates.earliest) {
        try {
          var ppConfig = {
            productPagesBaseUrl: process.env.PRODUCT_PAGES_BASE_URL || 'https://productpages.redhat.com',
            productPagesProductShortnames: DEFAULT_PRODUCTS
          }
          var livePPReleases = await fetchProductsByShortname(ppConfig.productPagesProductShortnames, ppConfig)
          var normalizedPV = version.replace(/\s+/g, '.').toLowerCase()
          for (var pri = 0; pri < livePPReleases.length; pri++) {
            var pr = livePPReleases[pri]
            var prVersion = (pr.releaseNumber || '').replace(/^[a-z]+-/i, '').toLowerCase()
            if (prVersion === normalizedPV && pr.featureFreezeDate) {
              freezeDates.byProduct[(pr.releaseNumber || '').toLowerCase()] = pr.featureFreezeDate
              if (!freezeDates.earliest || pr.featureFreezeDate < freezeDates.earliest) {
                freezeDates.earliest = pr.featureFreezeDate
              }
            }
          }
        } catch {
          // PP API not available — continue without freeze dates
        }
      }

      var groups = []
      for (var i = 0; i < productVersions.length; i++) {
        var pv = productVersions[i]

        var features = await fetchFeaturesByFixVersion(pv.fixVersions, jiraRequest, fetchAllJqlResults)

        // Classify late additions using per-product freeze date
        var productFreezeDate = freezeDates.byProduct[normalizeVersionName(pv.fixVersions[0])] || null
        for (var fi = 0; fi < features.length; fi++) {
          features[fi].scopeChange = classifyFeature(features[fi], productFreezeDate)
        }

        // Detect dropped features via JQL WAS operator
        var currentKeys = {}
        for (var ki = 0; ki < features.length; ki++) {
          currentKeys[features[ki].key] = true
        }
        var dropped = await fetchDroppedFeatures(pv.fixVersions, jiraRequest, fetchAllJqlResults, currentKeys)
        features = features.concat(dropped)

        features.sort(function (a, b) {
          if (a.scopeChange === 'dropped' && b.scopeChange !== 'dropped') return 1
          if (a.scopeChange !== 'dropped' && b.scopeChange === 'dropped') return -1
          return a.key.localeCompare(b.key)
        })

        groups.push({
          label: pv.product.toUpperCase() + ': ' + pv.releaseNumber,
          product: pv.product,
          releaseNumber: pv.releaseNumber,
          featureFreezeDate: productFreezeDate,
          featureCount: features.filter(function (f) { return f.scopeChange !== 'dropped' }).length,
          features: features.map(function (f) {
            return {
              key: f.key,
              summary: f.summary || '',
              colorStatus: f.colorStatus || null,
              statusSummary: f.statusSummary || null,
              isBlocked: f.isBlocked || false,
              components: f.components || [],
              assignee: f.assignee || null,
              pmOwner: f.pmOwner || null,
              status: f.status || null,
              scopeChange: f.scopeChange || null,
              fixVersionAddedAt: f.fixVersionAddedAt || null,
              fixVersionRemovedAt: f.fixVersionRemovedAt || null
            }
          })
        })
      }

      var responseData = {
        portfolioVersion: version,
        featureFreezeDate: freezeDates.earliest,
        fetchedAt: new Date().toISOString(),
        groups: groups
      }

      // Cache the response
      storage.writeToStorage(cacheKey(version), responseData)

      res.json(responseData)
    } catch (err) {
      console.error('[feature-tracking] Error loading tracking data:', err.message)
      res.status(500).json({ error: 'Failed to load tracking data: ' + err.message })
    }
  })

}

module.exports.findFixVersionAddedDate = findFixVersionAddedDate
module.exports.findFixVersionRemovedDate = findFixVersionRemovedDate
module.exports.classifyFeature = classifyFeature
module.exports.extractProduct = extractProduct
module.exports.normalizeVersionName = normalizeVersionName
module.exports.resolveProductVersionsFromJira = resolveProductVersionsFromJira
