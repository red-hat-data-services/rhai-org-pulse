/**
 * Tests for PM Hub summary card totals.
 *
 * Exercises the logic that computes totalRequested, totalCommitted, and
 * totalBlocked from client-filtered groups — verifying that the summary
 * cards update when client-side filters (product, type, status, blocked,
 * delivery owner, PM owner) are applied.
 *
 * Same inlined-function pattern as the other PM Hub test files.
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inline helpers from ComponentReleaseLoadReport.vue
// ---------------------------------------------------------------------------

function extractProduct(versionName) {
  if (!versionName) return versionName
  var lower = versionName.toLowerCase()
  if (lower.startsWith('rhoai')) return 'RHOAI'
  if (lower.startsWith('rhelai')) return 'RHELAI'
  if (lower.startsWith('rhaii')) return 'RHAII'
  return versionName.split('-')[0] || versionName
}

/**
 * Client-side filtering logic from clientFilteredGroups computed property.
 * Applies client-side filters to server-returned groups and recomputes counts.
 */
function applyClientFilters(groups, filters) {
  var filterProduct = filters.product || []
  var filterType = filters.type || []
  var filterReleaseType = filters.releaseType || []
  var filterStatus = filters.status || []
  var filterBlocked = filters.blocked !== undefined ? filters.blocked : null
  var filterDelOwner = filters.delOwner || []
  var filterPmOwner = filters.pmOwner || []

  var hasFilters = filterProduct.length > 0 || filterType.length > 0 ||
    filterReleaseType.length > 0 || filterStatus.length > 0 ||
    filterBlocked !== null || filterDelOwner.length > 0 || filterPmOwner.length > 0

  if (!hasFilters) return groups

  return groups.map(function (g) {
    var version = g.version
    var product = extractProduct(version)

    if (filterProduct.length > 0 && filterProduct.indexOf(product) === -1) {
      return Object.assign({}, g, { components: [] })
    }

    var filteredComps = g.components.map(function (comp) {
      var reqList = comp.requestedFeatures || []
      var comList = comp.committedFeatures || []
      var reqKeys = {}
      var comKeys = {}
      for (var ri = 0; ri < reqList.length; ri++) reqKeys[reqList[ri].key] = true
      for (var cmi = 0; cmi < comList.length; cmi++) comKeys[comList[cmi].key] = true

      var allFeatures = []
      var seen = {}
      var lists = [reqList, comList]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!seen[f.key]) {
            seen[f.key] = true
            allFeatures.push(f)
          }
        }
      }

      var filtered = allFeatures.filter(function (f) {
        var isReq = !!reqKeys[f.key]
        var isCom = !!comKeys[f.key]

        if (filterType.length > 0) {
          var matches = false
          if (filterType.indexOf('requested') >= 0 && isReq) matches = true
          if (filterType.indexOf('committed') >= 0 && isCom) matches = true
          if (!matches) return false
        }
        if (filterReleaseType.length > 0 && filterReleaseType.indexOf(f.releaseType || '') === -1) return false
        if (filterStatus.length > 0) {
          var cs = (f.colorStatus || '').toLowerCase()
          var match = false
          for (var si = 0; si < filterStatus.length; si++) {
            if (filterStatus[si].toLowerCase() === cs) { match = true; break }
          }
          if (!match) return false
        }
        if (filterBlocked === true && !f.isBlocked) return false
        if (filterBlocked === false && f.isBlocked) return false
        if (filterDelOwner.length > 0 && filterDelOwner.indexOf(f.assignee || '') === -1) return false
        if (filterPmOwner.length > 0 && filterPmOwner.indexOf(f.pmOwner || '') === -1) return false
        return true
      })

      var newReq = []
      var newCom = []
      for (var nfi = 0; nfi < filtered.length; nfi++) {
        var ff = filtered[nfi]
        if (reqKeys[ff.key]) newReq.push(ff)
        if (comKeys[ff.key]) newCom.push(ff)
      }

      return Object.assign({}, comp, {
        requestedFeatures: newReq,
        committedFeatures: newCom,
        requestedCount: newReq.length,
        committedCount: newCom.length,
        blockedCount: filtered.filter(function (ff) { return ff.isBlocked }).length
      })
    }).filter(function (comp) {
      return (comp.requestedFeatures.length + comp.committedFeatures.length) > 0
    })

    return Object.assign({}, g, { components: filteredComps })
  }).filter(function (g) { return g.components.length > 0 })
}

/**
 * Compute summary totals from (filtered) groups — mirrors the fix where
 * totalRequested/totalCommitted/totalBlocked read from clientFilteredGroups.
 */
function computeTotals(groups) {
  var requested = 0
  var committed = 0
  var blocked = 0
  for (var i = 0; i < groups.length; i++) {
    var comps = groups[i].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      requested += comps[ci].requestedCount || 0
      committed += comps[ci].committedCount || 0
      blocked += comps[ci].blockedCount || 0
    }
  }
  return { requested: requested, committed: committed, blocked: blocked }
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
// computeTotals — basic behavior
// ---------------------------------------------------------------------------

describe('computeTotals', function () {
  it('sums counts across groups and components', function () {
    var groups = [
      makeGroup('rhoai-3.5', 'Dashboard', [makeFeature({ key: 'X-1' }), makeFeature({ key: 'X-2' })]),
      makeGroup('rhoai-3.5', 'Inference', [makeFeature({ key: 'X-3', isBlocked: true })])
    ]
    var totals = computeTotals(groups)
    expect(totals.requested).toBe(3)
    expect(totals.committed).toBe(3)
    expect(totals.blocked).toBe(1)
  })

  it('returns zeros for empty groups', function () {
    var totals = computeTotals([])
    expect(totals.requested).toBe(0)
    expect(totals.committed).toBe(0)
    expect(totals.blocked).toBe(0)
  })

  it('handles groups with no components', function () {
    var totals = computeTotals([{ version: 'rhoai-3.5', components: [] }])
    expect(totals.requested).toBe(0)
    expect(totals.committed).toBe(0)
    expect(totals.blocked).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Summary totals reflect client-side filtering (the core fix)
// ---------------------------------------------------------------------------

describe('summary totals reflect client-side filters', function () {
  var blockedFeat = makeFeature({ key: 'X-1', isBlocked: true, colorStatus: 'Red', assignee: 'Alice', pmOwner: 'Bob', releaseType: 'Feature' })
  var greenFeat = makeFeature({ key: 'X-2', isBlocked: false, colorStatus: 'Green', assignee: 'Charlie', pmOwner: 'Diana', releaseType: 'Enhancement' })
  var yellowFeat = makeFeature({ key: 'X-3', isBlocked: false, colorStatus: 'Yellow', assignee: 'Alice', pmOwner: 'Bob', releaseType: 'Feature' })

  var baseGroups = [
    makeGroup('rhoai-3.5', 'Dashboard', [blockedFeat, greenFeat, yellowFeat])
  ]

  it('without filters, totals match raw data', function () {
    var filtered = applyClientFilters(baseGroups, {})
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(3)
    expect(totals.committed).toBe(3)
    expect(totals.blocked).toBe(1)
  })

  it('blocked=true filter reduces totals to only blocked features', function () {
    var filtered = applyClientFilters(baseGroups, { blocked: true })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(1)
  })

  it('blocked=false filter excludes blocked features from totals', function () {
    var filtered = applyClientFilters(baseGroups, { blocked: false })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(2)
    expect(totals.committed).toBe(2)
    expect(totals.blocked).toBe(0)
  })

  it('status filter reduces totals', function () {
    var filtered = applyClientFilters(baseGroups, { status: ['Red'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(1)
  })

  it('multiple status filters sum correctly', function () {
    var filtered = applyClientFilters(baseGroups, { status: ['Green', 'Yellow'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(2)
    expect(totals.committed).toBe(2)
    expect(totals.blocked).toBe(0)
  })

  it('delivery owner filter reduces totals', function () {
    var filtered = applyClientFilters(baseGroups, { delOwner: ['Alice'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(2)
    expect(totals.committed).toBe(2)
    expect(totals.blocked).toBe(1)
  })

  it('PM owner filter reduces totals', function () {
    var filtered = applyClientFilters(baseGroups, { pmOwner: ['Diana'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(0)
  })

  it('release type filter reduces totals', function () {
    var filtered = applyClientFilters(baseGroups, { releaseType: ['Enhancement'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(0)
  })

  it('product filter excludes non-matching versions', function () {
    var multiProduct = [
      makeGroup('rhoai-3.5', 'Dashboard', [blockedFeat, greenFeat]),
      makeGroup('rhelai-3.5', 'Dashboard', [yellowFeat])
    ]
    var filtered = applyClientFilters(multiProduct, { product: ['RHOAI'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(2)
    expect(totals.committed).toBe(2)
    expect(totals.blocked).toBe(1)
  })

  it('product filter for non-matching product returns zeros', function () {
    var filtered = applyClientFilters(baseGroups, { product: ['RHELAI'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(0)
    expect(totals.committed).toBe(0)
    expect(totals.blocked).toBe(0)
  })

  it('combined filters intersect correctly', function () {
    var filtered = applyClientFilters(baseGroups, {
      status: ['Red', 'Yellow'],
      delOwner: ['Alice']
    })
    var totals = computeTotals(filtered)
    // X-1 (Red, Alice) and X-3 (Yellow, Alice) match
    expect(totals.requested).toBe(2)
    expect(totals.committed).toBe(2)
    expect(totals.blocked).toBe(1)
  })

  it('filter that excludes all features returns zeros', function () {
    var filtered = applyClientFilters(baseGroups, { delOwner: ['Nobody'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(0)
    expect(totals.committed).toBe(0)
    expect(totals.blocked).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Type filter (REQ / COM toggle)
// ---------------------------------------------------------------------------

describe('type filter affects totals', function () {
  var feat1 = makeFeature({ key: 'X-1', isBlocked: true })
  var feat2 = makeFeature({ key: 'X-2', isBlocked: false })

  it('type=requested shows only requested features', function () {
    // feat1 is requested-only, feat2 is committed-only
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Dashboard',
        requestedFeatures: [feat1],
        committedFeatures: [feat2],
        requestedCount: 1,
        committedCount: 1,
        blockedCount: 0
      }],
      requestedCount: 1,
      committedCount: 1,
      blockedCount: 0
    }]
    var filtered = applyClientFilters(groups, { type: ['requested'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(0)
    expect(totals.blocked).toBe(1)
  })

  it('type=committed shows only committed features', function () {
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Dashboard',
        requestedFeatures: [feat1],
        committedFeatures: [feat2],
        requestedCount: 1,
        committedCount: 1,
        blockedCount: 0
      }],
      requestedCount: 1,
      committedCount: 1,
      blockedCount: 0
    }]
    var filtered = applyClientFilters(groups, { type: ['committed'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(0)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(0)
  })

  it('type=[requested,committed] shows features in either bucket', function () {
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Dashboard',
        requestedFeatures: [feat1],
        committedFeatures: [feat2],
        requestedCount: 1,
        committedCount: 1,
        blockedCount: 0
      }],
      requestedCount: 1,
      committedCount: 1,
      blockedCount: 0
    }]
    var filtered = applyClientFilters(groups, { type: ['requested', 'committed'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', function () {
  it('features in both requested and committed are counted in both', function () {
    var feat = makeFeature({ key: 'X-1', isBlocked: true })
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Dashboard',
        requestedFeatures: [feat],
        committedFeatures: [feat],
        requestedCount: 1,
        committedCount: 1,
        blockedCount: 1
      }],
      requestedCount: 1,
      committedCount: 1,
      blockedCount: 1
    }]
    var filtered = applyClientFilters(groups, {})
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(1)
  })

  it('blocked filter + status filter intersect', function () {
    var blockedRed = makeFeature({ key: 'X-1', isBlocked: true, colorStatus: 'Red' })
    var blockedGreen = makeFeature({ key: 'X-2', isBlocked: true, colorStatus: 'Green' })
    var unblockedRed = makeFeature({ key: 'X-3', isBlocked: false, colorStatus: 'Red' })
    var groups = [makeGroup('rhoai-3.5', 'Dashboard', [blockedRed, blockedGreen, unblockedRed])]

    var filtered = applyClientFilters(groups, { blocked: true, status: ['Red'] })
    var totals = computeTotals(filtered)
    // Only X-1 matches both blocked=true AND status=Red
    expect(totals.requested).toBe(1)
    expect(totals.blocked).toBe(1)
  })

  it('multiple components in a single version group', function () {
    var feat1 = makeFeature({ key: 'X-1', isBlocked: true, assignee: 'Alice' })
    var feat2 = makeFeature({ key: 'X-2', isBlocked: false, assignee: 'Bob' })
    var groups = [{
      version: 'rhoai-3.5',
      components: [
        {
          component: 'Dashboard',
          requestedFeatures: [feat1],
          committedFeatures: [feat1],
          requestedCount: 1,
          committedCount: 1,
          blockedCount: 1
        },
        {
          component: 'Inference',
          requestedFeatures: [feat2],
          committedFeatures: [feat2],
          requestedCount: 1,
          committedCount: 1,
          blockedCount: 0
        }
      ],
      requestedCount: 2,
      committedCount: 2,
      blockedCount: 1
    }]

    var filtered = applyClientFilters(groups, { delOwner: ['Alice'] })
    var totals = computeTotals(filtered)
    expect(totals.requested).toBe(1)
    expect(totals.committed).toBe(1)
    expect(totals.blocked).toBe(1)
  })
})
