import { ref, computed } from 'vue'

// ═══ RELEASE NAME PARSING ═══

var RELEASE_PATTERN = /^(rhoai|rhelai|rhaii)[- _](\d+)\.(\d+)(?:\.EA(\d+))?$/i

/**
 * Parse a release name into structured parts.
 * e.g. "rhoai-3.6.EA1" → { product: "rhoai", major: 3, minor: 6, milestone: "EA1", milestoneOrder: 1 }
 * e.g. "rhoai-3.5"     → { product: "rhoai", major: 3, minor: 5, milestone: "GA",  milestoneOrder: 99 }
 */
function parseReleaseName(name) {
  var m = RELEASE_PATTERN.exec(name)
  if (!m) return null
  var eaNum = m[4] ? parseInt(m[4], 10) : 0
  return {
    product: m[1].toLowerCase(),
    major: parseInt(m[2], 10),
    minor: parseInt(m[3], 10),
    milestone: eaNum ? 'EA' + eaNum : 'GA',
    milestoneOrder: eaNum || 99,
    raw: name,
  }
}

/**
 * Compare two release names for sorting.
 * Order: product alpha → major desc → minor desc → milestone asc (EA1 < EA2 < GA).
 */
function compareReleases(a, b) {
  var pa = parseReleaseName(a)
  var pb = parseReleaseName(b)
  // Unparseable releases sort last, alphabetically
  if (!pa && !pb) return a.localeCompare(b)
  if (!pa) return 1
  if (!pb) return -1

  // Product alphabetical (rhelai < rhaii < rhoai)
  if (pa.product !== pb.product) return pa.product.localeCompare(pb.product)
  // Major descending (3.6 before 3.5)
  if (pa.major !== pb.major) return pb.major - pa.major
  // Minor descending
  if (pa.minor !== pb.minor) return pb.minor - pa.minor
  // Milestone ascending (EA1 before EA2 before GA)
  return pa.milestoneOrder - pb.milestoneOrder
}

/**
 * Extract the product prefix from a release name.
 * Returns lowercase: "rhoai", "rhelai", "rhaii", or null.
 */
function extractProduct(name) {
  var m = /^(rhoai|rhelai|rhaii)/i.exec(name)
  return m ? m[1].toLowerCase() : null
}

/**
 * Get display label for a product.
 */
var PRODUCT_LABELS = { rhoai: 'RHOAI', rhelai: 'RHELAI', rhaii: 'RHAII' }

function productLabel(product) {
  return PRODUCT_LABELS[product] || product
}

// ═══ TARGET ALIGNMENT THRESHOLDS ═══

var ALIGNMENT_TARGETS = [
  { maxDays: 30, target: 100, label: '100%*' },
  { maxDays: 60, target: 95, label: '95%*' },
  { maxDays: 90, target: 90, label: '90%*' },
]

/**
 * Get the target alignment percentage for a given number of days to GA.
 * Returns { target, label } or null if no target applies (>90 days out).
 */
function getAlignmentTarget(daysToGa) {
  if (daysToGa === null || daysToGa === undefined) return null
  if (daysToGa <= 0) return { target: 100, label: '100%*', maxDays: 0 }
  for (var i = 0; i < ALIGNMENT_TARGETS.length; i++) {
    if (daysToGa <= ALIGNMENT_TARGETS[i].maxDays) return ALIGNMENT_TARGETS[i]
  }
  return null
}

// ═══ COMPOSABLE ═══

/**
 * Extract the release family key from a release name.
 * e.g. "rhoai-3.6.EA1" → "rhoai-3.6", "RHELAI-3.2" → "rhelai-3.2"
 * Returns lowercase key for comparison, or the raw name if unparseable.
 */
function extractFamily(name) {
  var parsed = parseReleaseName(name)
  if (parsed) return parsed.product + '-' + parsed.major + '.' + parsed.minor
  // Fallback: try to extract product-major.minor pattern directly
  var m = /^(rhoai|rhelai|rhaii)[- _](\d+\.\d+)/i.exec(name)
  if (m) return m[1].toLowerCase() + '-' + m[2]
  return name.toLowerCase()
}

/**
 * Get display label for a release family.
 * e.g. "rhoai-3.6" → "RHOAI 3.6"
 */
function familyLabel(familyKey) {
  var m = /^(rhoai|rhelai|rhaii)-(.+)$/.exec(familyKey)
  if (m) return PRODUCT_LABELS[m[1]] + ' ' + m[2]
  return familyKey
}

/**
 * Composable for product filtering and release family sorting on the executive summary.
 *
 * @param {Ref} filteredSummary — version-picker-filtered summary rows
 * @param {Ref} data — full API response (used to discover all available families)
 */
export function useReleaseFamily(filteredSummary, data) {
  var selectedFamily = ref('all')

  /** Unique release families found across ALL data */
  var availableFamilies = computed(function () {
    var seen = {}
    var families = []
    var rows = (data && data.value && data.value.executive_summary) || []
    if (!rows.length) rows = filteredSummary.value || []
    for (var i = 0; i < rows.length; i++) {
      var fam = extractFamily(rows[i].release)
      if (!seen[fam]) {
        seen[fam] = true
        families.push({ key: fam, label: familyLabel(fam) })
      }
    }
    // Sort by parsed version (newer first), same as compareReleases
    families.sort(function (a, b) { return compareReleases(a.key, b.key) })
    return families
  })

  /** Summary rows filtered by selected release family */
  var productFilteredSummary = computed(function () {
    var rows = filteredSummary.value || []
    if (selectedFamily.value === 'all') return rows
    return rows.filter(function (row) {
      return extractFamily(row.release) === selectedFamily.value
    })
  })

  // ── Sort state ──

  var sortColumn = ref(null) // null = release family default
  var sortDirection = ref('asc')

  function toggleSummarySort(column) {
    if (sortColumn.value === column) {
      if (sortDirection.value === 'asc') {
        sortDirection.value = 'desc'
      } else {
        // Clear sort → back to release family default
        sortColumn.value = null
        sortDirection.value = 'asc'
      }
    } else {
      sortColumn.value = column
      sortDirection.value = 'asc'
    }
  }

  function summarySortIcon(column) {
    if (sortColumn.value !== column) return 'none'
    return sortDirection.value
  }

  /** Sorted + filtered summary rows */
  var sortedSummary = computed(function () {
    var rows = productFilteredSummary.value.slice()

    if (!sortColumn.value) {
      // Default: release family order
      rows.sort(function (a, b) { return compareReleases(a.release, b.release) })
      return rows
    }

    var col = sortColumn.value
    var dir = sortDirection.value === 'asc' ? 1 : -1

    rows.sort(function (a, b) {
      var va, vb
      if (col === 'release') {
        return compareReleases(a.release, b.release) * dir
      }
      if (col === 'alignment_pct' || col === 'total' || col === 'aligned' ||
          col === 'tv_only' || col === 'fv_only' || col === 'mismatched') {
        va = a[col] ?? 0
        vb = b[col] ?? 0
        return (va - vb) * dir
      }
      if (col === 'ga_date' || col === 'planning_freeze') {
        va = a[col] || ''
        vb = b[col] || ''
        return va.localeCompare(vb) * dir
      }
      va = a[col] ?? ''
      vb = b[col] ?? ''
      return String(va).localeCompare(String(vb)) * dir
    })

    return rows
  })

  return {
    selectedFamily,
    availableFamilies,
    productFilteredSummary,
    sortColumn,
    sortDirection,
    toggleSummarySort,
    summarySortIcon,
    sortedSummary,
    // Expose utilities for testing
    parseReleaseName,
    compareReleases,
    extractProduct,
    extractFamily,
    familyLabel,
    productLabel,
    getAlignmentTarget,
  }
}

// Named exports for direct use / testing
export {
  parseReleaseName,
  compareReleases,
  extractProduct,
  extractFamily,
  familyLabel,
  productLabel,
  getAlignmentTarget,
  ALIGNMENT_TARGETS,
}
