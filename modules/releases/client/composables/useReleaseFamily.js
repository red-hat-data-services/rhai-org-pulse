import { ref, computed } from 'vue'
import { countUniqueCategoryTotals } from './mergeReleaseDetails'

// ═══ RELEASE NAME PARSING ═══

/** Legacy: rhoai-3.6.EA1, RHELAI-3.2 */
var LEGACY_PATTERN = /^(rhoai|rhelai|rhaii|rhai)[- _](\d+)\.(\d+)(?:\.EA(\d+))?$/i

/** Product-family Jira names: "3.6 EA1 RHOAI RELEASE", "3.5 GA RHELAI RELEASE" */
var PRODUCT_FAMILY_PATTERN = /^(\d+)\.(\d+)\s+(EA(\d+)|GA)\s+(RHOAI|RHAII|RHELAI|RHAI)\s+RELEASE$/i

var PRODUCT_ORDER = { rhoai: 0, rhaii: 1, rhelai: 2, rhai: 3 }
var PRODUCT_LABELS = { rhoai: 'RHOAI', rhelai: 'RHELAI', rhaii: 'RHAII', rhai: 'RHAI' }

/**
 * Parse a release name into structured parts.
 * Supports legacy (rhoai-3.6.EA1) and product-family (3.6 EA1 RHOAI RELEASE) names.
 */
function parseReleaseName(name) {
  if (!name) return null

  var pf = PRODUCT_FAMILY_PATTERN.exec(name)
  if (pf) {
    var pfEa = pf[3] && String(pf[3]).toUpperCase() !== 'GA' ? parseInt(pf[4], 10) : 0
    return {
      product: pf[5].toLowerCase(),
      major: parseInt(pf[1], 10),
      minor: parseInt(pf[2], 10),
      milestone: pfEa ? 'EA' + pfEa : 'GA',
      milestoneOrder: pfEa || 99,
      raw: name,
    }
  }

  var m = LEGACY_PATTERN.exec(name)
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
 * Order: cycle desc → milestone EA1/EA2/GA (chronological) → product RHOAI/RHAII/RHELAI.
 */
function compareReleases(a, b) {
  var pa = parseReleaseName(a)
  var pb = parseReleaseName(b)
  if (!pa && !pb) return String(a || '').localeCompare(String(b || ''))
  if (!pa) return 1
  if (!pb) return -1

  if (pa.major !== pb.major) return pb.major - pa.major
  if (pa.minor !== pb.minor) return pb.minor - pa.minor
  // EA1 before EA2 before GA
  if (pa.milestoneOrder !== pb.milestoneOrder) return pa.milestoneOrder - pb.milestoneOrder
  var oa = PRODUCT_ORDER[pa.product] != null ? PRODUCT_ORDER[pa.product] : 99
  var ob = PRODUCT_ORDER[pb.product] != null ? PRODUCT_ORDER[pb.product] : 99
  if (oa !== ob) return oa - ob
  return pa.product.localeCompare(pb.product)
}

/**
 * Sort a comma-separated version list into EA1 → EA2 → GA (within each cycle).
 * @param {string} value
 * @returns {string}
 */
function formatSortedVersions(value) {
  if (value == null || value === '') return ''
  var parts = String(value).split(/,\s*/).map(function (s) { return s.trim() }).filter(Boolean)
  if (parts.length <= 1) return parts[0] || String(value)
  return parts.slice().sort(compareReleases).join(', ')
}

/**
 * Extract the product prefix from a release name.
 * Returns lowercase: "rhoai", "rhelai", "rhaii", or null.
 */
function extractProduct(name) {
  var parsed = parseReleaseName(name)
  if (parsed) return parsed.product
  var m = /^(rhoai|rhelai|rhaii|rhai)/i.exec(name)
  return m ? m[1].toLowerCase() : null
}

function productLabel(product) {
  return PRODUCT_LABELS[product] || product
}

/**
 * Release cycle key: "3.6", "3.5"
 */
function extractCycle(name) {
  var parsed = parseReleaseName(name)
  if (parsed) return parsed.major + '.' + parsed.minor
  var m = /(\d+)\.(\d+)/.exec(name)
  return m ? m[1] + '.' + m[2] : null
}

/**
 * Milestone group key within a cycle: "3.6-GA", "3.6-EA1"
 */
function extractMilestoneGroup(name) {
  var parsed = parseReleaseName(name)
  if (!parsed) return null
  return parsed.major + '.' + parsed.minor + '-' + parsed.milestone
}

function cycleLabel(cycleKey) {
  return cycleKey + ' Release Cycle'
}

function milestoneGroupLabel(groupKey) {
  var m = /^(\d+\.\d+)-(EA\d+|GA)$/.exec(groupKey)
  if (m) return m[1] + ' ' + m[2] + ' Release'
  return groupKey
}

// ═══ TARGET ALIGNMENT THRESHOLDS ═══

var ALIGNMENT_TARGETS = [
  { maxDays: 30, target: 100, label: '100%*' },
  { maxDays: 60, target: 95, label: '95%*' },
  { maxDays: 90, target: 90, label: '90%*' },
]

/**
 * Get the target alignment percentage for a given number of days (to planning freeze or GA).
 * Returns { target, label } or null if no target applies (>90 days out).
 */
function getAlignmentTarget(days) {
  if (days === null || days === undefined) return null
  if (days <= 0) return { target: 100, label: '100%*', maxDays: 0 }
  for (var i = 0; i < ALIGNMENT_TARGETS.length; i++) {
    if (days <= ALIGNMENT_TARGETS[i].maxDays) return ALIGNMENT_TARGETS[i]
  }
  return null
}

// ═══ FAMILY (product + cycle) — kept for legacy callers ═══

/**
 * Extract the release family key from a release name.
 * e.g. "rhoai-3.6.EA1" / "3.6 EA1 RHOAI RELEASE" → "rhoai-3.6"
 */
function extractFamily(name) {
  var parsed = parseReleaseName(name)
  if (parsed) return parsed.product + '-' + parsed.major + '.' + parsed.minor
  var m = /^(rhoai|rhelai|rhaii|rhai)[- _](\d+\.\d+)/i.exec(name)
  if (m) return m[1].toLowerCase() + '-' + m[2]
  return name.toLowerCase()
}

function familyLabel(familyKey) {
  var m = /^(rhoai|rhelai|rhaii|rhai)-(.+)$/.exec(familyKey)
  if (m) return PRODUCT_LABELS[m[1]] + ' ' + m[2]
  return familyKey
}

function sumRows(rows) {
  var total = 0
  var alignedOnTime = 0
  var alignedLate = 0
  var afterRequested = 0
  var tvOnly = 0
  var fvOnly = 0
  var misaligned = 0
  var pending = 0
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    if (r._pending) {
      pending++
      continue
    }
    total += r.total || 0
    // Prefer 5-category fields; fall back to pre-migration `aligned` / `mismatched`
    alignedOnTime += r.aligned_on_time != null ? r.aligned_on_time : (r.aligned || 0)
    alignedLate += r.aligned_late || 0
    afterRequested += r.after_requested || 0
    tvOnly += r.tv_only || 0
    fvOnly += r.fv_only || 0
    misaligned += r.misaligned != null ? r.misaligned : (r.mismatched || 0)
  }
  var alignmentPct = total > 0 ? Math.round((1000 * (alignedOnTime + alignedLate)) / total) / 10 : 0
  return {
    total: total,
    aligned_on_time: alignedOnTime,
    aligned_late: alignedLate,
    after_requested: afterRequested,
    tv_only: tvOnly,
    fv_only: fvOnly,
    misaligned: misaligned,
    alignment_pct: alignmentPct,
    _allPending: pending > 0 && pending === rows.length,
  }
}

function compareCycleKeys(a, b) {
  var pa = a.split('.').map(Number)
  var pb = b.split('.').map(Number)
  if (pa[0] !== pb[0]) return pb[0] - pa[0]
  return pb[1] - pa[1]
}

function compareMilestoneKeys(a, b) {
  // "3.6-GA" / "3.6-EA2" — EA1 first, then EA2, then GA
  var ma = /-(EA(\d+)|GA)$/.exec(a)
  var mb = /-(EA(\d+)|GA)$/.exec(b)
  var oa = ma && ma[1] === 'GA' ? 99 : (ma ? parseInt(ma[2], 10) : 0)
  var ob = mb && mb[1] === 'GA' ? 99 : (mb ? parseInt(mb[2], 10) : 0)
  return oa - ob
}

/**
 * Group version name strings into cycle → milestone → names (numeric desc).
 * Used by the release selector chips and add-release dropdown.
 *
 * @param {string[]} names
 * @returns {{ key: string, label: string, milestones: { key: string, label: string, names: string[] }[] }[]}
 */
function buildNameRollup(names) {
  var list = (names || []).slice().sort(compareReleases)
  var cycleMap = {}
  var cycleOrder = []

  for (var i = 0; i < list.length; i++) {
    var name = list[i]
    var cycle = extractCycle(name) || 'other'
    var milestone = extractMilestoneGroup(name) || (cycle + '-other')

    if (!cycleMap[cycle]) {
      cycleMap[cycle] = {
        key: cycle,
        label: cycle === 'other' ? 'Other' : cycleLabel(cycle),
        milestones: {},
        milestoneOrder: [],
      }
      cycleOrder.push(cycle)
    }
    var c = cycleMap[cycle]
    if (!c.milestones[milestone]) {
      c.milestones[milestone] = {
        key: milestone,
        label: milestone.endsWith('-other') ? 'Other' : milestoneGroupLabel(milestone),
        names: [],
      }
      c.milestoneOrder.push(milestone)
    }
    c.milestones[milestone].names.push(name)
  }

  cycleOrder.sort(function (a, b) {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return compareCycleKeys(a, b)
  })

  return cycleOrder.map(function (cycleKey) {
    var c = cycleMap[cycleKey]
    c.milestoneOrder.sort(function (a, b) {
      if (a.endsWith('-other')) return 1
      if (b.endsWith('-other')) return -1
      return compareMilestoneKeys(a, b)
    })
    return {
      key: c.key,
      label: c.label,
      milestones: c.milestoneOrder.map(function (mk) {
        return c.milestones[mk]
      }),
    }
  })
}

/**
 * Composable for cycle filtering and hierarchical rollup on the executive summary.
 *
 * @param {Ref} filteredSummary — version-picker-filtered summary rows
 * @param {Ref} data — full API response (used to discover all available cycles)
 */
export function useReleaseFamily(filteredSummary, data) {
  var selectedFamily = ref('all')

  /** Unique release cycles (3.6, 3.5, …) for filter chips — numerically descending */
  var availableFamilies = computed(function () {
    var seen = {}
    var cycles = []
    var rows = (data && data.value && data.value.executive_summary) || []
    if (!rows.length) rows = filteredSummary.value || []
    for (var i = 0; i < rows.length; i++) {
      var cycle = extractCycle(rows[i].release)
      if (cycle && !seen[cycle]) {
        seen[cycle] = true
        cycles.push({ key: cycle, label: cycle })
      }
    }
    // Also include cycles from the filtered selection (pending versions not yet in data)
    var filtered = filteredSummary.value || []
    for (var fi = 0; fi < filtered.length; fi++) {
      var fc = extractCycle(filtered[fi].release)
      if (fc && !seen[fc]) {
        seen[fc] = true
        cycles.push({ key: fc, label: fc })
      }
    }
    cycles.sort(function (a, b) { return compareCycleKeys(a.key, b.key) })
    return cycles
  })

  /** Summary rows filtered by selected release cycle */
  var productFilteredSummary = computed(function () {
    var rows = filteredSummary.value || []
    if (selectedFamily.value === 'all') return rows
    return rows.filter(function (row) {
      return extractCycle(row.release) === selectedFamily.value
    })
  })

  // ── Sort state ──

  var sortColumn = ref(null)
  var sortDirection = ref('asc')

  function toggleSummarySort(column) {
    if (sortColumn.value === column) {
      if (sortDirection.value === 'asc') {
        sortDirection.value = 'desc'
      } else {
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

  function sortRows(rows) {
    var list = rows.slice()
    if (!sortColumn.value) {
      list.sort(function (a, b) { return compareReleases(a.release, b.release) })
      return list
    }

    var col = sortColumn.value
    var dir = sortDirection.value === 'asc' ? 1 : -1

    list.sort(function (a, b) {
      var va, vb
      if (col === 'release') {
        return compareReleases(a.release, b.release) * dir
      }
      if (col === 'alignment_pct' || col === 'total' || col === 'aligned_on_time' || col === 'aligned_late' ||
          col === 'after_requested' || col === 'tv_only' || col === 'fv_only' || col === 'misaligned') {
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
    return list
  }

  /** Flat sorted rows (legacy consumers / tests) */
  var sortedSummary = computed(function () {
    return sortRows(productFilteredSummary.value)
  })

  /**
   * Hierarchical rollup:
   *   3.6 Release Cycle
   *     3.6 GA Release → product rows
   *     3.6 EA2 Release → …
   *     3.6 EA1 Release → …
   */
  var summaryRollup = computed(function () {
    var rows = sortRows(productFilteredSummary.value)
    var cycleMap = {}
    var cycleOrder = []

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i]
      var cycle = extractCycle(row.release) || 'other'
      var milestone = extractMilestoneGroup(row.release) || (cycle + '-other')

      if (!cycleMap[cycle]) {
        cycleMap[cycle] = { key: cycle, label: cycle === 'other' ? 'Other' : cycleLabel(cycle), milestones: {}, milestoneOrder: [] }
        cycleOrder.push(cycle)
      }
      var c = cycleMap[cycle]
      if (!c.milestones[milestone]) {
        c.milestones[milestone] = {
          key: milestone,
          label: milestone.endsWith('-other') ? 'Other' : milestoneGroupLabel(milestone),
          rows: [],
        }
        c.milestoneOrder.push(milestone)
      }
      c.milestones[milestone].rows.push(row)
    }

    cycleOrder.sort(function (a, b) {
      if (a === 'other') return 1
      if (b === 'other') return -1
      return compareCycleKeys(a, b)
    })

    return cycleOrder.map(function (cycleKey) {
      var c = cycleMap[cycleKey]
      c.milestoneOrder.sort(function (a, b) {
        if (a.endsWith('-other')) return 1
        if (b.endsWith('-other')) return -1
        return compareMilestoneKeys(a, b)
      })

      var releasesMap = data && data.value && data.value.releases

      var milestones = c.milestoneOrder.map(function (mk) {
        var ms = c.milestones[mk]
        var names = ms.rows.map(function (r) { return r.release })
        // Prefer unique-key totals from detail buckets so multi-product features
        // are not double-counted (matches all-products section counts).
        var uniqueTotals = countUniqueCategoryTotals(releasesMap, names)
        var totals = uniqueTotals || sumRows(ms.rows)
        return {
          key: ms.key,
          label: ms.label,
          rows: ms.rows,
          totals: totals,
        }
      })

      var allRows = []
      var allNames = []
      for (var mi = 0; mi < milestones.length; mi++) {
        allRows = allRows.concat(milestones[mi].rows)
        for (var ri = 0; ri < milestones[mi].rows.length; ri++) {
          allNames.push(milestones[mi].rows[ri].release)
        }
      }

      var cycleUnique = countUniqueCategoryTotals(releasesMap, allNames)
      return {
        key: c.key,
        label: c.label,
        milestones: milestones,
        totals: cycleUnique || sumRows(allRows),
      }
    })
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
    summaryRollup,
    // Expose utilities for testing
    parseReleaseName,
    compareReleases,
    extractProduct,
    extractFamily,
    extractCycle,
    extractMilestoneGroup,
    cycleLabel,
    milestoneGroupLabel,
    familyLabel,
    productLabel,
    getAlignmentTarget,
    buildNameRollup,
    formatSortedVersions,
  }
}

// Named exports for direct use / testing
export {
  parseReleaseName,
  compareReleases,
  extractProduct,
  extractFamily,
  extractCycle,
  extractMilestoneGroup,
  cycleLabel,
  milestoneGroupLabel,
  familyLabel,
  productLabel,
  getAlignmentTarget,
  buildNameRollup,
  formatSortedVersions,
  ALIGNMENT_TARGETS,
}
