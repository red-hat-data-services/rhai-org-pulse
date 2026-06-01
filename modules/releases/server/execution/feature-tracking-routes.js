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

const EXCLUDE_VERSION_RE = /^\d+\.\d+\.\d+$/

const FIELDS_TO_FETCH = [
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
  const s = (releaseNumber || '').toLowerCase()
  const dash = s.indexOf('-')
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
function stripZStream(value) {
  if (!value) return value
  return String(value).replace(/\.z\b/gi, '')
}

function normalizeVersionName(name) {
  let s = (name || '').toLowerCase()
  s = stripZStream(s)
  if (s.endsWith(' release')) s = s.slice(0, -8)
  s = s.trimEnd()

  const SEPS = ' ._-'
  let result = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]

    if (SEPS.includes(ch) && i > 0 && s.charCodeAt(i - 1) >= 48 && s.charCodeAt(i - 1) <= 57) {
      let j = i
      while (j < s.length && SEPS.includes(s[j])) j++
      const tag = s.slice(j, j + 2)
      if (tag === 'ea' || tag === 'ga') {
        i = j
        continue
      }
    }

    if (ch === 'e' && i + 3 < s.length && s[i + 1] === 'a' && s[i + 2] === '-' && s.charCodeAt(i + 3) >= 48 && s.charCodeAt(i + 3) <= 57) {
      result += 'ea'
      i += 3
      continue
    }

    result += s[i]
    i++
  }
  return result
}

const jiraVersionsCache = { versions: null, fetchedAt: 0 }
const VERSIONS_CACHE_TTL_MS = 15 * 60 * 1000

/**
 * Resolve a portfolio version (e.g. "3.5.EA1") to actual Jira fixVersion
 * names by querying the Jira project versions API. Handles different naming
 * conventions across products, collecting ALL matching fixVersions per product
 * (e.g. both "rhelai-3.5EA2" and "rhelai-3.5 EA2 release" for rhelai).
 */
async function resolveProductVersionsFromJira(portfolioVersion, jiraRequestFn) {
  const { fetchProjectVersions } = require('../../../../shared/server/jira')

  if (!jiraVersionsCache.versions || Date.now() - jiraVersionsCache.fetchedAt > VERSIONS_CACHE_TTL_MS) {
    jiraVersionsCache.versions = await fetchProjectVersions(jiraRequestFn, DEFAULT_PROJECTS)
    jiraVersionsCache.fetchedAt = Date.now()
  }

  const allVersions = jiraVersionsCache.versions
  const normalizedPortfolio = normalizeVersionName(portfolioVersion)

  const productMap = {}

  for (let i = 0; i < allVersions.length; i++) {
    const v = allVersions[i]
    const product = extractProduct(v.name)
    if (!product) continue

    const normalizedName = normalizeVersionName(v.name)
    const versionPart = normalizedName.replace(/^[a-z]+-/, '')

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

  const matched = []
  const keys = Object.keys(productMap)
  for (let ki = 0; ki < keys.length; ki++) {
    const entry = productMap[keys[ki]]
    matched.push({
      product: entry.product,
      releaseNumber: entry.fixVersions[0],
      fixVersions: entry.fixVersions
    })
  }

  if (matched.length > 0) return matched

  const products = DEFAULT_PRODUCTS
  const result = []
  for (let pi = 0; pi < products.length; pi++) {
    const fv = products[pi] + '-' + portfolioVersion
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
  const versions = Array.isArray(fixVersions) ? fixVersions : [fixVersions]
  const projects = DEFAULT_PROJECTS
  const issueTypes = DEFAULT_ISSUE_TYPES

  const sanitized = versions.map(function (v) {
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  })

  const fixVersionFilter = sanitized.length === 1
    ? 'fixVersion = ' + sanitized[0]
    : 'fixVersion IN (' + sanitized.join(', ') + ')'

  const jql = 'project IN (' + projects.join(', ') + ')' +
    ' AND issuetype IN (' + issueTypes.join(', ') + ')' +
    ' AND ' + fixVersionFilter

  const rawIssues = await fetchAllJqlResultsFn(jiraRequestFn, jql, FIELDS_TO_FETCH, {
    expand: 'renderedFields,changelog'
  })

  const seen = {}
  const features = []
  for (let i = 0; i < rawIssues.length; i++) {
    const raw = rawIssues[i]
    if (seen[raw.key]) continue
    seen[raw.key] = true
    const transformed = transformIssue(raw, {})
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

  const targets = Array.isArray(fixVersionNames) ? fixVersionNames : [fixVersionNames]
  const normalizedTargets = {}
  for (let ti = 0; ti < targets.length; ti++) {
    normalizedTargets[targets[ti].toLowerCase()] = true
  }

  for (let i = 0; i < changelog.histories.length; i++) {
    const history = changelog.histories[i]
    const items = history.items || []

    for (let j = 0; j < items.length; j++) {
      const item = items[j]
      if (item.field !== 'Fix Version' && item.fieldId !== 'fixVersions') continue
      const toString = (item.toString || '').toLowerCase()
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
    const addedDate = feature.fixVersionAddedAt.split('T')[0]
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
  const versions = Array.isArray(fixVersions) ? fixVersions : [fixVersions]
  const projects = DEFAULT_PROJECTS

  const sanitized = versions.map(function (v) {
    return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  })

  const wasClauses = sanitized.map(function (v) { return 'fixVersion WAS ' + v })
  const wasFilter = wasClauses.length === 1
    ? wasClauses[0]
    : '(' + wasClauses.join(' OR ') + ')'

  const notInFilter = sanitized.length === 1
    ? 'fixVersion != ' + sanitized[0]
    : 'fixVersion NOT IN (' + sanitized.join(', ') + ')'

  const jql = wasFilter +
    ' AND ' + notInFilter +
    ' AND issuetype = Feature' +
    ' AND project IN (' + projects.join(', ') + ')'

  try {
    const rawIssues = await fetchAllJqlResultsFn(jiraRequestFn, jql, FIELDS_TO_FETCH, {
      expand: 'renderedFields,changelog'
    })

    const dropped = []
    for (let i = 0; i < rawIssues.length; i++) {
      const raw = rawIssues[i]
      if (currentKeys[raw.key]) continue
      const transformed = transformIssue(raw, {})
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

  const targets = Array.isArray(fixVersionNames) ? fixVersionNames : [fixVersionNames]
  const normalizedTargets = {}
  for (let ti = 0; ti < targets.length; ti++) {
    normalizedTargets[targets[ti].toLowerCase()] = true
  }

  let mostRecent = null

  for (let i = 0; i < changelog.histories.length; i++) {
    const history = changelog.histories[i]
    const items = history.items || []

    for (let j = 0; j < items.length; j++) {
      const item = items[j]
      if (item.field !== 'Fix Version' && item.fieldId !== 'fixVersions') continue
      const fromString = (item.fromString || '').toLowerCase()
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
  const ppCache = readFromStorage(PP_CACHE_FILE)
  const ppReleases = Array.isArray(ppCache) ? ppCache : (ppCache && ppCache.releases) || []

  const normalizedPortfolio = normalizeVersionName(portfolioVersion)
  const byProduct = {}
  let earliest = null

  for (let i = 0; i < ppReleases.length; i++) {
    const rel = ppReleases[i]
    const relVersion = normalizeVersionName(rel.releaseNumber).replace(/^[a-z]+-/, '')
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
  const storage = context.storage
  const requireAuth = context.requireAuth
  const requireScope = context.requireScope

  // GET /tracking/versions
  router.get('/tracking/versions', requireAuth, requireScope('releases:read'), function (req, res) {
    const versionMap = {}

    function addVersion(releaseNumber) {
      const normalized = stripZStream(releaseNumber)
      const product = extractProduct(normalized)
      const versionPart = (normalized || '').replace(/^[a-z]+-/i, '')
      if (!versionPart || !product) return
      if (EXCLUDE_VERSION_RE.test(versionPart)) return
      if (!versionMap[versionPart]) {
        versionMap[versionPart] = { version: versionPart, products: [] }
      }
      if (versionMap[versionPart].products.indexOf(product) === -1) {
        versionMap[versionPart].products.push(product)
      }
    }

    const registry = readRegistry(storage.readFromStorage)
    const registryReleases = registry.releases || []
    for (let ri = 0; ri < registryReleases.length; ri++) {
      const rel = registryReleases[ri]
      if (rel.state === 'archived') continue
      addVersion(rel.displayName || rel.id || '')
    }

    const ppCache = storage.readFromStorage(PP_CACHE_FILE)
    const ppReleases = Array.isArray(ppCache) ? ppCache : (ppCache && ppCache.releases) || []
    for (let pi = 0; pi < ppReleases.length; pi++) {
      if (ppReleases[pi].releaseNumber) addVersion(ppReleases[pi].releaseNumber)
    }

    const planningConfig = storage.readFromStorage(PLANNING_CONFIG_FILE)
    if (planningConfig && planningConfig.releases) {
      const configVersions = Object.keys(planningConfig.releases)
      for (let ci = 0; ci < configVersions.length; ci++) {
        const cv = configVersions[ci]
        if (!versionMap[cv] && !EXCLUDE_VERSION_RE.test(cv)) {
          versionMap[cv] = { version: cv, products: [] }
        }
      }
    }

    const versions = Object.keys(versionMap).map(function (k) { return versionMap[k] })

    for (let vi = 0; vi < versions.length; vi++) {
      const fd = getFeatureFreezeDatesFromCache(versions[vi].version, storage.readFromStorage)
      versions[vi].featureFreezeDate = fd.earliest || null
    }

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
    const version = req.query.version
    if (!version) {
      return res.status(400).json({ error: 'version query parameter is required' })
    }

    const forceRefresh = req.query.refresh === 'true'

    try {
      if (!forceRefresh) {
        const cached = storage.readFromStorage(cacheKey(version))
        if (cached && cached.fetchedAt) {
          const age = Date.now() - new Date(cached.fetchedAt).getTime()
          if (age < CACHE_TTL_MS) {
            return res.json(cached)
          }
        }
      }

      const jira = require('../../../../shared/server/jira')
      const jiraRequest = jira.jiraRequest
      const fetchAllJqlResults = jira.fetchAllJqlResults

      const productVersions = await resolveProductVersionsFromJira(version, jiraRequest)
      const freezeDates = getFeatureFreezeDatesFromCache(version, storage.readFromStorage)

      if (!freezeDates.earliest) {
        try {
          const ppConfig = {
            productPagesBaseUrl: process.env.PRODUCT_PAGES_BASE_URL || 'https://productpages.redhat.com',
            productPagesProductShortnames: DEFAULT_PRODUCTS
          }
          const livePPReleases = await fetchProductsByShortname(ppConfig.productPagesProductShortnames, ppConfig)
          const normalizedPV = version.replace(/\s+/g, '.').toLowerCase()
          for (let pri = 0; pri < livePPReleases.length; pri++) {
            const pr = livePPReleases[pri]
            const prVersion = (pr.releaseNumber || '').replace(/^[a-z]+-/i, '').toLowerCase()
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

      const groups = []
      for (let i = 0; i < productVersions.length; i++) {
        const pv = productVersions[i]

        let features = await fetchFeaturesByFixVersion(pv.fixVersions, jiraRequest, fetchAllJqlResults)

        const productFreezeDate = freezeDates.byProduct[normalizeVersionName(pv.fixVersions[0])] || null
        for (let fi = 0; fi < features.length; fi++) {
          features[fi].scopeChange = classifyFeature(features[fi], productFreezeDate)
        }

        const currentKeys = {}
        for (let ki = 0; ki < features.length; ki++) {
          currentKeys[features[ki].key] = true
        }
        const dropped = await fetchDroppedFeatures(pv.fixVersions, jiraRequest, fetchAllJqlResults, currentKeys)
        features = features.concat(dropped)

        const STATUS_ORDER = { red: 0, yellow: 1, green: 2 }
        features.sort(function (a, b) {
          if (a.scopeChange === 'dropped' && b.scopeChange !== 'dropped') return 1
          if (a.scopeChange !== 'dropped' && b.scopeChange === 'dropped') return -1
          const aColor = STATUS_ORDER[(a.colorStatus || '').toLowerCase()]
          const bColor = STATUS_ORDER[(b.colorStatus || '').toLowerCase()]
          const aRank = aColor !== undefined ? aColor : 3
          const bRank = bColor !== undefined ? bColor : 3
          if (aRank !== bRank) return aRank - bRank
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

      const responseData = {
        portfolioVersion: version,
        featureFreezeDate: freezeDates.earliest,
        fetchedAt: new Date().toISOString(),
        groups: groups
      }

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
