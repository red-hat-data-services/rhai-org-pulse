/**
 * Tests for PM Hub summary card click-to-filter and blocked percentage.
 *
 * Exercises the toggle logic, ring-class bindings, blocked percentage
 * computation, and filter persistence for the click-to-filter feature
 * added to the Requested, Committed, and Blocked summary cards.
 *
 * Same inlined-function pattern as the other PM Hub test files.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Inline toggle helpers from ComponentReleaseLoadReport.vue
// ---------------------------------------------------------------------------

function toggleInArray(arr, value) {
  var idx = arr.indexOf(value)
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else {
    arr.push(value)
  }
  return arr
}

function toggleFilter(filterRefs, filterName, value) {
  var arr = filterRefs[filterName]
  if (arr) toggleInArray(arr, value)
}

// ---------------------------------------------------------------------------
// Inline totalFeatures + blockedPercent from ComponentReleaseLoadReport.vue
// ---------------------------------------------------------------------------

function computeTotalFeatures(groups) {
  var seen = {}
  var count = 0
  for (var gi = 0; gi < groups.length; gi++) {
    var comps = groups[gi].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      var lists = [comps[ci].requestedFeatures || [], comps[ci].committedFeatures || []]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var key = lists[li][fi].key
          if (!seen[key]) {
            seen[key] = true
            count++
          }
        }
      }
    }
  }
  return count
}

function computeBlockedPercent(totalBlocked, totalFeatures) {
  if (totalFeatures === 0) return null
  return Math.round((totalBlocked / totalFeatures) * 100)
}

// ---------------------------------------------------------------------------
// Ring class helpers — mirrors the :class bindings on the cards
// ---------------------------------------------------------------------------

function requestedCardRingClass(filterType) {
  return filterType.indexOf('requested') >= 0
    ? 'ring-2 ring-blue-300 dark:ring-blue-700'
    : 'hover:shadow-md'
}

function committedCardRingClass(filterType) {
  return filterType.indexOf('committed') >= 0
    ? 'ring-2 ring-emerald-300 dark:ring-emerald-700'
    : 'hover:shadow-md'
}

function blockedCardRingClass(filterBlocked) {
  return filterBlocked === true
    ? 'ring-2 ring-red-300 dark:ring-red-700'
    : 'hover:shadow-md'
}

// ---------------------------------------------------------------------------
// Persistence helpers (from pm-hub-filter-persistence.test.js)
// ---------------------------------------------------------------------------

var STORAGE_KEY = 'pm-hub-filters'

function saveFilters(state) {
  try {
    var payload = {
      pillars: state.pillars || [],
      components: state.components || [],
      versions: state.versions || [],
      product: state.product || [],
      type: state.type || [],
      releaseType: state.releaseType || [],
      status: state.status || [],
      blocked: state.blocked !== undefined ? state.blocked : null,
      delOwner: state.delOwner || [],
      pmOwner: state.pmOwner || [],
      sort: state.sort || { column: null, direction: 'asc' }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch { return false }
}

function restoreFilters() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    var state = JSON.parse(raw)
    var result = {}
    if (state.pillars && Array.isArray(state.pillars)) result.pillars = state.pillars
    if (state.components && Array.isArray(state.components)) result.components = state.components
    if (state.versions && Array.isArray(state.versions)) result.versions = state.versions
    if (state.product && Array.isArray(state.product)) result.product = state.product
    if (state.type && Array.isArray(state.type)) result.type = state.type
    if (state.releaseType && Array.isArray(state.releaseType)) result.releaseType = state.releaseType
    if (state.status && Array.isArray(state.status)) result.status = state.status
    if (state.blocked !== undefined) result.blocked = state.blocked
    if (state.delOwner && Array.isArray(state.delOwner)) result.delOwner = state.delOwner
    if (state.pmOwner && Array.isArray(state.pmOwner)) result.pmOwner = state.pmOwner
    if (state.sort && typeof state.sort === 'object') result.sort = state.sort
    return result
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeFeature(overrides) {
  return Object.assign({
    key: 'RHAIENG-1',
    summary: 'Test feature',
    status: 'In Progress',
    colorStatus: 'Green',
    statusSummary: '<p>On track</p>',
    releaseType: 'Feature',
    priority: 'Major',
    isBlocked: false,
    components: ['Dashboard'],
    fixVersions: ['rhoai-3.5'],
    targetVersions: ['rhoai-3.5'],
    assignee: 'Alice',
    pmOwner: 'Bob'
  }, overrides)
}

function makeGroup(version, componentName, reqFeatures, comFeatures) {
  var req = reqFeatures || []
  var com = comFeatures !== undefined ? comFeatures : req
  return {
    version: version,
    components: [{
      component: componentName,
      requestedFeatures: req,
      committedFeatures: com,
      requestedCount: req.length,
      committedCount: com.length,
      blockedCount: com.filter(function (f) { return f.isBlocked }).length
    }],
    requestedCount: req.length,
    committedCount: com.length,
    blockedCount: com.filter(function (f) { return f.isBlocked }).length
  }
}

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

var store = {}

beforeEach(function () {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: function (key) { return store[key] || null },
    setItem: function (key, val) { store[key] = String(val) },
    removeItem: function (key) { delete store[key] }
  })
})

// ---------------------------------------------------------------------------
// Requested card click-to-filter
// ---------------------------------------------------------------------------

describe('Requested card click-to-filter', function () {
  it('clicking adds requested to filterType', function () {
    var filterType = []
    toggleInArray(filterType, 'requested')
    expect(filterType).toEqual(['requested'])
  })

  it('clicking again removes requested from filterType', function () {
    var filterType = ['requested']
    toggleInArray(filterType, 'requested')
    expect(filterType).toEqual([])
  })

  it('shows blue ring when requested filter is active', function () {
    expect(requestedCardRingClass(['requested'])).toBe('ring-2 ring-blue-300 dark:ring-blue-700')
  })

  it('shows hover shadow when requested filter is inactive', function () {
    expect(requestedCardRingClass([])).toBe('hover:shadow-md')
  })

  it('ring persists when both requested and committed are active', function () {
    expect(requestedCardRingClass(['requested', 'committed'])).toBe('ring-2 ring-blue-300 dark:ring-blue-700')
  })
})

// ---------------------------------------------------------------------------
// Committed card click-to-filter
// ---------------------------------------------------------------------------

describe('Committed card click-to-filter', function () {
  it('clicking adds committed to filterType', function () {
    var filterType = []
    toggleInArray(filterType, 'committed')
    expect(filterType).toEqual(['committed'])
  })

  it('clicking again removes committed from filterType', function () {
    var filterType = ['committed']
    toggleInArray(filterType, 'committed')
    expect(filterType).toEqual([])
  })

  it('shows emerald ring when committed filter is active', function () {
    expect(committedCardRingClass(['committed'])).toBe('ring-2 ring-emerald-300 dark:ring-emerald-700')
  })

  it('shows hover shadow when committed filter is inactive', function () {
    expect(committedCardRingClass([])).toBe('hover:shadow-md')
  })
})

// ---------------------------------------------------------------------------
// Blocked card click-to-filter
// ---------------------------------------------------------------------------

describe('Blocked card click-to-filter', function () {
  it('clicking when null sets filterBlocked to true', function () {
    var filterBlocked = null
    filterBlocked = filterBlocked === true ? null : true
    expect(filterBlocked).toBe(true)
  })

  it('clicking when true sets filterBlocked to null', function () {
    var filterBlocked = true
    filterBlocked = filterBlocked === true ? null : true
    expect(filterBlocked).toBeNull()
  })

  it('never cycles through false — null toggles straight to true', function () {
    var filterBlocked = null
    var states = []
    for (var i = 0; i < 6; i++) {
      filterBlocked = filterBlocked === true ? null : true
      states.push(filterBlocked)
    }
    expect(states).toEqual([true, null, true, null, true, null])
    expect(states.indexOf(false)).toBe(-1)
  })

  it('shows red ring when blocked filter is active', function () {
    expect(blockedCardRingClass(true)).toBe('ring-2 ring-red-300 dark:ring-red-700')
  })

  it('shows hover shadow when blocked filter is null', function () {
    expect(blockedCardRingClass(null)).toBe('hover:shadow-md')
  })

  it('shows hover shadow when blocked filter is false', function () {
    expect(blockedCardRingClass(false)).toBe('hover:shadow-md')
  })
})

// ---------------------------------------------------------------------------
// toggleFilter via filterRefs (simulates card @click through toggleFilter)
// ---------------------------------------------------------------------------

describe('toggleFilter via filterRefs', function () {
  it('Requested card click path toggles filterType correctly', function () {
    var filterRefs = { filterType: [] }
    toggleFilter(filterRefs, 'filterType', 'requested')
    expect(filterRefs.filterType).toEqual(['requested'])
    toggleFilter(filterRefs, 'filterType', 'requested')
    expect(filterRefs.filterType).toEqual([])
  })

  it('Committed card click path toggles filterType correctly', function () {
    var filterRefs = { filterType: [] }
    toggleFilter(filterRefs, 'filterType', 'committed')
    expect(filterRefs.filterType).toEqual(['committed'])
    toggleFilter(filterRefs, 'filterType', 'committed')
    expect(filterRefs.filterType).toEqual([])
  })

  it('clicking both cards adds both values', function () {
    var filterRefs = { filterType: [] }
    toggleFilter(filterRefs, 'filterType', 'requested')
    toggleFilter(filterRefs, 'filterType', 'committed')
    expect(filterRefs.filterType).toEqual(['requested', 'committed'])
  })

  it('ignores unknown filter names', function () {
    var filterRefs = { filterType: [] }
    toggleFilter(filterRefs, 'unknownFilter', 'value')
    expect(filterRefs.filterType).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Blocked percentage
// ---------------------------------------------------------------------------

describe('blocked percentage', function () {
  it('computes correct percentage (2 of 10 = 20%)', function () {
    expect(computeBlockedPercent(2, 10)).toBe(20)
  })

  it('computes 100% when all features are blocked', function () {
    expect(computeBlockedPercent(5, 5)).toBe(100)
  })

  it('computes 0% when no features are blocked', function () {
    expect(computeBlockedPercent(0, 10)).toBe(0)
  })

  it('returns null when total features is zero', function () {
    expect(computeBlockedPercent(0, 0)).toBeNull()
  })

  it('rounds to nearest integer (1 of 3 = 33%)', function () {
    expect(computeBlockedPercent(1, 3)).toBe(33)
  })

  it('rounds up at 0.5 (1 of 6 ≈ 17%)', function () {
    expect(computeBlockedPercent(1, 6)).toBe(17)
  })

  it('handles single feature blocked (1 of 1 = 100%)', function () {
    expect(computeBlockedPercent(1, 1)).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// totalFeatures deduplication
// ---------------------------------------------------------------------------

describe('totalFeatures deduplication', function () {
  it('counts unique features across requested and committed', function () {
    var feat1 = makeFeature({ key: 'X-1' })
    var feat2 = makeFeature({ key: 'X-2' })
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Dashboard',
        requestedFeatures: [feat1, feat2],
        committedFeatures: [feat1, feat2],
        requestedCount: 2,
        committedCount: 2,
        blockedCount: 0
      }]
    }]
    expect(computeTotalFeatures(groups)).toBe(2)
  })

  it('deduplicates features appearing in both requested and committed', function () {
    var feat = makeFeature({ key: 'X-1' })
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Dashboard',
        requestedFeatures: [feat],
        committedFeatures: [feat],
        requestedCount: 1,
        committedCount: 1,
        blockedCount: 0
      }]
    }]
    expect(computeTotalFeatures(groups)).toBe(1)
  })

  it('deduplicates features across multiple version groups', function () {
    var feat = makeFeature({ key: 'X-1' })
    var groups = [
      makeGroup('rhoai-3.5', 'Dashboard', [feat]),
      makeGroup('rhoai-3.6', 'Dashboard', [feat])
    ]
    expect(computeTotalFeatures(groups)).toBe(1)
  })

  it('deduplicates features across multiple components', function () {
    var feat = makeFeature({ key: 'X-1' })
    var groups = [{
      version: 'rhoai-3.5',
      components: [
        { component: 'Dashboard', requestedFeatures: [feat], committedFeatures: [] },
        { component: 'Inference', requestedFeatures: [feat], committedFeatures: [] }
      ]
    }]
    expect(computeTotalFeatures(groups)).toBe(1)
  })

  it('counts distinct features across components', function () {
    var feat1 = makeFeature({ key: 'X-1' })
    var feat2 = makeFeature({ key: 'X-2' })
    var groups = [{
      version: 'rhoai-3.5',
      components: [
        { component: 'Dashboard', requestedFeatures: [feat1], committedFeatures: [] },
        { component: 'Inference', requestedFeatures: [feat2], committedFeatures: [] }
      ]
    }]
    expect(computeTotalFeatures(groups)).toBe(2)
  })

  it('returns zero for empty groups', function () {
    expect(computeTotalFeatures([])).toBe(0)
  })

  it('returns zero for groups with empty components', function () {
    expect(computeTotalFeatures([{ version: 'rhoai-3.5', components: [] }])).toBe(0)
  })

  it('handles missing requestedFeatures/committedFeatures', function () {
    var groups = [{
      version: 'rhoai-3.5',
      components: [{ component: 'Dashboard' }]
    }]
    expect(computeTotalFeatures(groups)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// End-to-end: blocked percentage from group data
// ---------------------------------------------------------------------------

describe('blocked percentage from group data', function () {
  it('computes correct percentage for mixed blocked/unblocked', function () {
    var groups = [makeGroup('rhoai-3.5', 'Dashboard', [
      makeFeature({ key: 'X-1', isBlocked: true }),
      makeFeature({ key: 'X-2', isBlocked: true }),
      makeFeature({ key: 'X-3', isBlocked: false }),
      makeFeature({ key: 'X-4', isBlocked: false }),
      makeFeature({ key: 'X-5', isBlocked: false })
    ])]
    var totalFeatures = computeTotalFeatures(groups)
    var totalBlocked = 2
    expect(computeBlockedPercent(totalBlocked, totalFeatures)).toBe(40)
  })

  it('returns null when no features exist', function () {
    var totalFeatures = computeTotalFeatures([])
    expect(computeBlockedPercent(0, totalFeatures)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Filter persistence for card-click state
// ---------------------------------------------------------------------------

describe('filter persistence for card-click state', function () {
  it('saves and restores filterType set by Requested card click', function () {
    saveFilters({ type: ['requested'] })
    var restored = restoreFilters()
    expect(restored.type).toEqual(['requested'])
  })

  it('saves and restores filterType set by Committed card click', function () {
    saveFilters({ type: ['committed'] })
    var restored = restoreFilters()
    expect(restored.type).toEqual(['committed'])
  })

  it('saves and restores both Requested and Committed active', function () {
    saveFilters({ type: ['requested', 'committed'] })
    var restored = restoreFilters()
    expect(restored.type).toEqual(['requested', 'committed'])
  })

  it('saves and restores filterBlocked=true set by Blocked card click', function () {
    saveFilters({ blocked: true })
    var restored = restoreFilters()
    expect(restored.blocked).toBe(true)
  })

  it('saves and restores filterBlocked=null after Blocked card toggle off', function () {
    saveFilters({ blocked: null })
    var restored = restoreFilters()
    expect(restored.blocked).toBeNull()
  })

  it('round-trips a full card-click scenario', function () {
    saveFilters({ type: ['requested'], blocked: true })
    var restored = restoreFilters()
    expect(restored.type).toEqual(['requested'])
    expect(restored.blocked).toBe(true)

    saveFilters({ type: [], blocked: null })
    restored = restoreFilters()
    expect(restored.type).toEqual([])
    expect(restored.blocked).toBeNull()
  })
})
