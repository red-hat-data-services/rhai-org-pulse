/**
 * Client helpers for TV/FV Delta alignment categories (PM Hub).
 * Keep labels/help in sync with server tv-fv-delta/alignment.js and TvFvDeltaView COLUMN_HELP.
 */

export var ALIGNMENT_CATEGORY_PRIORITY = {
  misaligned: 5,
  after_requested: 4,
  tv_only: 3,
  fv_only: 2,
  aligned_late: 1,
  aligned_on_time: 0
}

export var ALIGNMENT_CATEGORY_LABELS = {
  aligned_on_time: 'Early or as requested',
  aligned_late: 'After requested',
  after_requested: 'After requested',
  misaligned: 'Different products',
  tv_only: 'TV only',
  fv_only: 'FV only'
}

export var ALIGNMENT_CATEGORY_HELP = {
  aligned_on_time: 'Fix Version is the same milestone as Target Version, or an earlier one.',
  aligned_late: 'Fix Version is a later milestone than Target Version, and the committed version freeze has passed. Green. Counts in Align % for that committed release.',
  after_requested: 'Fix Version is a later milestone than Target Version, and the committed version freeze has not passed. Yellow. Does not count in Align % yet.',
  misaligned: 'Target Version and Fix Version are different products, or the version names cannot be compared.',
  tv_only: 'Target Version is set for this release; Fix Version is empty. Requested, not committed.',
  fv_only: 'Fix Version is set for this release; Target Version is empty.'
}

/** Hub tiles and legend — After requested is one label covering yellow and green. */
export var ALIGNMENT_DISPLAY_KEYS = [
  'aligned_on_time',
  'after_requested',
  'tv_only',
  'fv_only',
  'misaligned'
]

export var ALIGNMENT_LEGEND_NOTES = [
  'These labels compare Target Version (PM request) to Fix Version (engineering commitment). They are not calendar on-schedule or overdue flags.',
  'After requested is yellow until the committed (Fix Version) freeze, then green. Hub Align % follows selected releases that are still before freeze. After a requested release freeze, features that moved later are left out of that release Align %.',
  'Hub tiles count each issue once. Component chips count unique keys in that component only. A feature on two components appears in both headers.'
]

export function categoriesForDisplayKey(displayKey) {
  if (displayKey === 'after_requested') return ['after_requested', 'aligned_late']
  return [displayKey]
}

export function isAfterRequestedCategory(category) {
  return category === 'after_requested' || category === 'aligned_late'
}

export function displayKeySelected(displayKey, selected) {
  var cats = categoriesForDisplayKey(displayKey)
  var cur = selected || []
  for (var i = 0; i < cats.length; i++) {
    if (cur.indexOf(cats[i]) === -1) return false
  }
  return cats.length > 0
}

export function toggleDisplayKeyInSelection(displayKey, selected) {
  var cats = categoriesForDisplayKey(displayKey)
  var current = (selected || []).slice()
  if (displayKeySelected(displayKey, current)) {
    return current.filter(function(c) { return cats.indexOf(c) === -1 })
  }
  for (var i = 0; i < cats.length; i++) {
    if (current.indexOf(cats[i]) === -1) current.push(cats[i])
  }
  return current
}

export function categorySetsEqual(a, b) {
  var left = (a || []).slice().sort()
  var right = (b || []).slice().sort()
  if (left.length !== right.length) return false
  for (var i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

export function alignmentLegendEntries() {
  return ALIGNMENT_DISPLAY_KEYS.map(function(key) {
    if (key === 'after_requested') {
      return {
        key: key,
        label: 'After requested',
        help: 'Fix Version is a later milestone than Target Version. Yellow until the committed version freeze; green after that freeze. Yellow does not count in Align %. After a requested release freeze, these features are left out of that release Align %.',
        chipClass: alignmentCategoryChipClass('after_requested'),
        secondaryChipClass: alignmentCategoryChipClass('aligned_late')
      }
    }
    return {
      key: key,
      label: alignmentCategoryLabel(key),
      help: alignmentCategoryHelp(key),
      chipClass: alignmentCategoryChipClass(key)
    }
  })
}

export function isAlignedCategory(category) {
  return category === 'aligned_on_time' || category === 'aligned_late'
}

export function alignmentCategoryLabel(category) {
  if (!category) return '—'
  return ALIGNMENT_CATEGORY_LABELS[category] || category
}

export function alignmentCategoryHelp(category) {
  if (!category) return 'No Target Version or Fix Version in this release scope.'
  return ALIGNMENT_CATEGORY_HELP[category] || ''
}

export function worseAlignmentCategory(a, b) {
  if (!a) return b || null
  if (!b) return a
  var ra = ALIGNMENT_CATEGORY_PRIORITY[a]
  var rb = ALIGNMENT_CATEGORY_PRIORITY[b]
  if (ra === undefined) return b
  if (rb === undefined) return a
  return ra >= rb ? a : b
}

export function alignmentCategoryChipClass(category) {
  switch (category) {
    case 'aligned_on_time':
      return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    case 'aligned_late':
      return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
    case 'after_requested':
      return 'bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200'
    case 'misaligned':
      return 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200'
    case 'tv_only':
      return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
    case 'fv_only':
      return 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
  }
}

var RELEASE_PATTERN = /^(rhoai|rhelai|rhaii)[- _](\d+)\.(\d+)(?:\.EA(\d+))?$/i
var JIRA_RELEASE_PATTERN = /^(\d+)\.(\d+)(?:\s+(EA\d+|GA))?\s+(RHOAI|RHAII|RHELAI)(?:\s+RELEASE)?$/i
var PRODUCT_DISPLAY = { rhoai: 'RHOAI', rhelai: 'RHELAI', rhaii: 'RHAII' }

function parseReleaseName(name) {
  if (!name) return null
  var s = String(name).trim()
  var m = RELEASE_PATTERN.exec(s)
  if (m) {
    var eaNum = m[4] ? parseInt(m[4], 10) : 0
    return {
      product: m[1].toLowerCase(),
      major: parseInt(m[2], 10),
      minor: parseInt(m[3], 10),
      milestone: eaNum ? 'EA' + eaNum : 'GA',
      milestoneOrder: eaNum || 99,
      raw: name
    }
  }
  var jm = JIRA_RELEASE_PATTERN.exec(s)
  if (jm) {
    var product = jm[4].toLowerCase()
    var phaseLabel = jm[3] ? String(jm[3]).toUpperCase() : 'GA'
    var eaFromJira = /^EA(\d+)$/.test(phaseLabel) ? parseInt(phaseLabel.slice(2), 10) : 0
    return {
      product: product,
      major: parseInt(jm[1], 10),
      minor: parseInt(jm[2], 10),
      milestone: eaFromJira ? 'EA' + eaFromJira : 'GA',
      milestoneOrder: eaFromJira || 99,
      raw: name
    }
  }
  return null
}

function joinEnglish(parts) {
  if (!parts || parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] + ' and ' + parts[1]
  return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]
}

function compareParsed(a, b) {
  if (a.product !== b.product) return a.product.localeCompare(b.product)
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.milestoneOrder - b.milestoneOrder
}

function uniqueMilestoneLabels(names, includeProduct) {
  var items = []
  var seen = {}
  for (var i = 0; i < names.length; i++) {
    var raw = names[i]
    if (!raw) continue
    var parsed = parseReleaseName(raw)
    var label
    if (parsed) {
      label = includeProduct
        ? (PRODUCT_DISPLAY[parsed.product] || parsed.product.toUpperCase()) + ' ' + parsed.milestone
        : parsed.milestone
    } else {
      label = String(raw)
    }
    if (seen[label]) continue
    seen[label] = true
    items.push({ label: label, parsed: parsed })
  }
  items.sort(function(a, b) {
    if (a.parsed && b.parsed) return compareParsed(a.parsed, b.parsed)
    if (a.parsed) return -1
    if (b.parsed) return 1
    return a.label.localeCompare(b.label)
  })
  return items.map(function(item) { return item.label })
}

function listVersions(feature) {
  var tvs = Array.isArray(feature && feature.targetVersions) ? feature.targetVersions.slice() : []
  var fvs = Array.isArray(feature && feature.fixVersions) && feature.fixVersions.length > 0
    ? feature.fixVersions.slice()
    : (feature && feature.fixVersion ? [feature.fixVersion] : [])
  return { tvs: tvs, fvs: fvs }
}

/**
 * Plain-language requested vs committed summary for the Align popup.
 * Example: "Requested for EA1, committed for EA2."
 */
export function buildAlignmentDetail(feature) {
  var lists = listVersions(feature || {})
  var tvs = lists.tvs
  var fvs = lists.fvs
  var parsedAll = tvs.concat(fvs).map(parseReleaseName).filter(Boolean)
  var products = {}
  for (var i = 0; i < parsedAll.length; i++) products[parsedAll[i].product] = true
  var includeProduct = Object.keys(products).length > 1
  var requestedLabels = uniqueMilestoneLabels(tvs, includeProduct)
  var committedLabels = uniqueMilestoneLabels(fvs, includeProduct)
  var category = feature && feature.alignmentCategory
  var summary
  if (requestedLabels.length === 0 && committedLabels.length === 0) {
    summary = 'No Target Version or Fix Version.'
  } else if (requestedLabels.length > 0 && committedLabels.length === 0) {
    summary = 'Requested for ' + joinEnglish(requestedLabels) + ', not committed.'
  } else if (requestedLabels.length === 0 && committedLabels.length > 0) {
    summary = 'Committed for ' + joinEnglish(committedLabels) + ', no Target Version.'
  } else if (
    requestedLabels.length === committedLabels.length &&
    requestedLabels.join('\0') === committedLabels.join('\0')
  ) {
    summary = 'Requested and committed for ' + joinEnglish(requestedLabels) + '.'
  } else {
    summary = 'Requested for ' + joinEnglish(requestedLabels) +
      ', committed for ' + joinEnglish(committedLabels) + '.'
  }
  return {
    summary: summary,
    categoryLabel: alignmentCategoryLabel(category),
    categoryHelp: alignmentCategoryHelp(category),
    requested: tvs,
    committed: fvs
  }
}
