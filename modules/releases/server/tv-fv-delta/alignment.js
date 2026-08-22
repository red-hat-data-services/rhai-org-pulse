/**
 * Shared TV/FV alignment helpers for PM Hub and (later) Features List.
 *
 * Wraps the TV vs FV Delta 5-category classifier so Plan views use the same
 * semantics as Reports → TV vs FV Delta.
 */

const {
  classifyFeatures,
  buildReleaseDatesMap,
  parseVersions,
  isReleaseFrozen
} = require('./routes')

var CATEGORY_PRIORITY = {
  misaligned: 5,
  after_requested: 4,
  tv_only: 3,
  fv_only: 2,
  aligned_late: 1,
  aligned_on_time: 0
}

var ALIGNED_CATEGORIES = {
  aligned_on_time: true,
  aligned_late: true
}

var CATEGORY_LABELS = {
  aligned_on_time: 'Early or as requested',
  aligned_late: 'After requested',
  after_requested: 'After requested',
  misaligned: 'Different products',
  tv_only: 'TV only',
  fv_only: 'FV only'
}

var CATEGORY_HELP = {
  aligned_on_time: 'Fix Version is the same milestone as Target Version, or an earlier one.',
  aligned_late: 'Fix Version is a later milestone than Target Version, and that committed version freeze has passed. Green After requested. Counts in Align % for the committed release.',
  after_requested: 'Fix Version is a later milestone than Target Version, and that committed version freeze has not passed. Yellow. Does not count in Align % yet.',
  misaligned: 'Target Version and Fix Version are different products, or the version names cannot be compared.',
  tv_only: 'Target Version is set for this release; Fix Version is empty. Requested, not committed.',
  fv_only: 'Fix Version is set for this release; Target Version is empty.'
}

/**
 * @param {string[]} names
 * @returns {string}
 */
function joinVersionNames(names) {
  if (!Array.isArray(names) || names.length === 0) return ''
  var out = []
  for (var i = 0; i < names.length; i++) {
    if (names[i]) out.push(String(names[i]).trim())
  }
  return out.join(', ')
}

/**
 * Minimal feature shape for classifyFeatures().
 * @param {string[]} targetVersions
 * @param {string[]} fixVersions
 * @returns {object}
 */
function buildClassifyFeature(targetVersions, fixVersions) {
  var tvStr = joinVersionNames(targetVersions)
  var fvStr = joinVersionNames(fixVersions)
  return {
    key: '',
    url: '',
    summary: '',
    status: '',
    target_version: tvStr,
    fix_versions: fvStr,
    tv_set: parseVersions(tvStr),
    fv_set: parseVersions(fvStr),
    color_status: '',
    product_manager: '',
    assignee: '',
    components: [],
    component: ''
  }
}

/**
 * Classify a single issue for one release (same rules as TV/FV Delta).
 * @param {string[]} targetVersions
 * @param {string[]} fixVersions
 * @param {string} release
 * @param {object} [releaseDates]
 * @returns {string|null} category or null if release is not on TV or FV
 */
function classifyForRelease(targetVersions, fixVersions, release, releaseDates) {
  if (!release) return null
  var rows = classifyFeatures(
    [buildClassifyFeature(targetVersions, fixVersions)],
    [release],
    releaseDates || {}
  )
  if (!rows || rows.length === 0) return null
  return rows[0].category || null
}

/**
 * Worst category across all releases that appear on TV or FV.
 * @param {string[]} targetVersions
 * @param {string[]} fixVersions
 * @param {object} [releaseDates]
 * @returns {string|null}
 */
function classifyOverall(targetVersions, fixVersions, releaseDates) {
  var tvs = Array.isArray(targetVersions) ? targetVersions : []
  var fvs = Array.isArray(fixVersions) ? fixVersions : []
  var seen = {}
  var releases = []
  var lists = [tvs, fvs]
  for (var li = 0; li < lists.length; li++) {
    for (var i = 0; i < lists[li].length; i++) {
      var name = lists[li][i]
      if (!name || seen[name]) continue
      seen[name] = true
      releases.push(name)
    }
  }
  if (releases.length === 0) return null
  var rows = classifyFeatures(
    [buildClassifyFeature(tvs, fvs)],
    releases,
    releaseDates || {}
  )
  return worstCategory(rows.map(function(r) { return r.category }))
}

/**
 * @param {string[]} categories
 * @returns {string|null}
 */
function worstCategory(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return null
  var worst = null
  var worstRank = -1
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i]
    if (!cat) continue
    var rank = CATEGORY_PRIORITY[cat]
    if (rank === undefined) continue
    if (rank > worstRank) {
      worstRank = rank
      worst = cat
    }
  }
  return worst
}

/**
 * PM/DO "aligned" for KPIs: Early or as requested, plus green After requested.
 * @param {string|null} category
 * @returns {boolean}
 */
function isAlignedCategory(category) {
  return !!(category && ALIGNED_CATEGORIES[category])
}

function isAfterRequestedCategory(category) {
  return category === 'after_requested' || category === 'aligned_late'
}

/**
 * @param {string|null} category
 * @returns {string}
 */
function categoryLabel(category) {
  if (!category) return '—'
  return CATEGORY_LABELS[category] || category
}

/**
 * @param {string|null} category
 * @returns {string}
 */
function categoryHelp(category) {
  if (!category) return 'No Target Version or Fix Version in this release scope.'
  return CATEGORY_HELP[category] || ''
}

/**
 * Load Product Pages freeze/GA dates used by the Delta classifier.
 * @param {{ readFromStorage: Function }} storage
 * @returns {Promise<object>}
 */
async function loadReleaseDatesMap(storage) {
  if (!storage || typeof storage.readFromStorage !== 'function') return {}
  try {
    var ppCache = await storage.readFromStorage('releases/delivery/product-pages-releases-cache.json')
    return buildReleaseDatesMap(ppCache && ppCache.releases)
  } catch (err) {
    console.warn('[releases/tv-fv-alignment] Failed to load Product Pages cache:', err.message)
    return {}
  }
}

module.exports = {
  CATEGORY_PRIORITY,
  ALIGNED_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_HELP,
  classifyForRelease,
  classifyOverall,
  worstCategory,
  isAlignedCategory,
  isAfterRequestedCategory,
  isReleaseFrozen,
  categoryLabel,
  categoryHelp,
  loadReleaseDatesMap,
  buildReleaseDatesMap
}
