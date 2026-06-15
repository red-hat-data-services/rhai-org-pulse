/**
 * Tests for ComponentReleaseLoadTable logic.
 *
 * Vue component mounting is broken project-wide (vue plugin / vitest compat).
 * These tests exercise the core data-transformation logic that the component's
 * computed properties and helper functions rely on, using the same algorithms
 * inlined from the component source.
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inline the pure functions from ComponentReleaseLoadTable.vue so we can
// test them without mounting the component.
// ---------------------------------------------------------------------------

function extractProduct(versionName) {
  if (!versionName) return versionName
  var lower = versionName.toLowerCase()
  if (lower.startsWith('rhoai')) return 'RHOAI'
  if (lower.startsWith('rhelai')) return 'RHELAI'
  if (lower.startsWith('rhaii')) return 'RHAII'
  return versionName.split('-')[0] || versionName
}

function colorStatusClass(colorStatus) {
  var s = (colorStatus || '').toLowerCase()
  if (s === 'green') return 'bg-emerald-500'
  if (s === 'yellow') return 'bg-amber-400'
  if (s === 'red') return 'bg-red-500'
  return 'bg-gray-300 dark:bg-gray-600'
}

function colorStatusRing(colorStatus) {
  var s = (colorStatus || '').toLowerCase()
  if (s === 'green') return 'ring-emerald-200 dark:ring-emerald-800'
  if (s === 'yellow') return 'ring-amber-200 dark:ring-amber-800'
  if (s === 'red') return 'ring-red-200 dark:ring-red-800'
  return 'ring-gray-200 dark:ring-gray-700'
}

function productBadgeClass(product) {
  var p = (product || '').toUpperCase()
  if (p === 'RHOAI') return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
  if (p === 'RHELAI') return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
  if (p === 'RHAII') return 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
  return 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-400'
}

function getLeads(componentName, componentLeads) {
  var lower = (componentName || '').toLowerCase()
  if (componentLeads[lower]) return componentLeads[lower]
  var keys = Object.keys(componentLeads)
  for (var i = 0; i < keys.length; i++) {
    if (lower.includes(keys[i]) || keys[i].includes(lower)) return componentLeads[keys[i]]
  }
  return null
}

/**
 * This is the core algorithm from componentGroups computed property.
 * It transforms server response groups into component-centric view with
 * deduplicated features.
 */
function buildComponentGroups(groups) {
  var compMap = {}

  for (var gi = 0; gi < groups.length; gi++) {
    var group = groups[gi]
    var version = group.version

    for (var ci = 0; ci < group.components.length; ci++) {
      var comp = group.components[ci]
      var cName = comp.component

      if (!compMap[cName]) {
        compMap[cName] = { component: cName, features: {} }
      }

      var cg = compMap[cName]
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

      for (var ai = 0; ai < allFeatures.length; ai++) {
        var feat = allFeatures[ai]
        var isReq = !!reqKeys[feat.key]
        var isCom = !!comKeys[feat.key]

        if (!cg.features[feat.key]) {
          cg.features[feat.key] = {
            key: feat.key,
            summary: feat.summary,
            status: feat.status,
            colorStatus: feat.colorStatus,
            statusSummary: feat.statusSummary,
            releaseType: feat.releaseType,
            priority: feat.priority,
            isBlocked: feat.isBlocked,
            components: feat.components,
            fixVersions: feat.fixVersions || [],
            targetVersions: feat.targetVersions || [],
            assignee: feat.assignee,
            pmOwner: feat.pmOwner,
            products: [],
            isRequested: false,
            isCommitted: false
          }
        }

        var entry = cg.features[feat.key]
        var product = extractProduct(version)
        if (entry.products.indexOf(product) === -1) {
          entry.products.push(product)
        }
        if (isReq) entry.isRequested = true
        if (isCom) entry.isCommitted = true
      }
    }
  }

  var result = []
  var compNames = Object.keys(compMap).sort()
  for (var ni = 0; ni < compNames.length; ni++) {
    var cm = compMap[compNames[ni]]
    var featureList = Object.values(cm.features)
    if (featureList.length === 0) continue

    var reqCount = 0
    var comCount = 0
    var blkCount = 0
    for (var fli = 0; fli < featureList.length; fli++) {
      if (featureList[fli].isRequested) reqCount++
      if (featureList[fli].isCommitted) comCount++
      if (featureList[fli].isBlocked) blkCount++
    }

    result.push({
      component: cm.component,
      features: featureList,
      requestedCount: reqCount,
      committedCount: comCount,
      blockedCount: blkCount
    })
  }

  return result
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

function makeGroup(version, componentName, features, opts) {
  var reqFeatures = (opts && opts.committedOnly) ? [] : features
  var comFeatures = (opts && opts.requestedOnly) ? [] : features
  return {
    version: version,
    components: [{
      component: componentName,
      requestedFeatures: reqFeatures,
      committedFeatures: comFeatures,
      requestedCount: reqFeatures.length,
      committedCount: comFeatures.length,
      blockedCount: features.filter(function (f) { return f.isBlocked }).length
    }],
    requestedCount: reqFeatures.length,
    committedCount: comFeatures.length,
    blockedCount: features.filter(function (f) { return f.isBlocked }).length
  }
}

// ---------------------------------------------------------------------------
// extractProduct
// ---------------------------------------------------------------------------

describe('extractProduct', function () {
  it('detects RHOAI from version name', function () {
    expect(extractProduct('rhoai-3.5')).toBe('RHOAI')
  })

  it('detects RHELAI from version name', function () {
    expect(extractProduct('rhelai-3.5')).toBe('RHELAI')
  })

  it('detects RHAII from version name', function () {
    expect(extractProduct('RHAII-3.5')).toBe('RHAII')
  })

  it('case-insensitive detection', function () {
    expect(extractProduct('RHOAI-3.5.EA1')).toBe('RHOAI')
    expect(extractProduct('Rhelai-3.6')).toBe('RHELAI')
  })

  it('falls back to splitting on dash', function () {
    expect(extractProduct('custom-3.5')).toBe('custom')
  })

  it('returns null/undefined for null/undefined input', function () {
    expect(extractProduct(null)).toBeNull()
    expect(extractProduct(undefined)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// colorStatusClass
// ---------------------------------------------------------------------------

describe('colorStatusClass', function () {
  it('returns emerald for Green', function () {
    expect(colorStatusClass('Green')).toBe('bg-emerald-500')
  })

  it('returns amber for Yellow', function () {
    expect(colorStatusClass('Yellow')).toBe('bg-amber-400')
  })

  it('returns red for Red', function () {
    expect(colorStatusClass('Red')).toBe('bg-red-500')
  })

  it('is case-insensitive', function () {
    expect(colorStatusClass('green')).toBe('bg-emerald-500')
    expect(colorStatusClass('RED')).toBe('bg-red-500')
  })

  it('returns gray for null', function () {
    expect(colorStatusClass(null)).toBe('bg-gray-300 dark:bg-gray-600')
  })

  it('returns gray for unknown status', function () {
    expect(colorStatusClass('Purple')).toBe('bg-gray-300 dark:bg-gray-600')
  })
})

// ---------------------------------------------------------------------------
// colorStatusRing
// ---------------------------------------------------------------------------

describe('colorStatusRing', function () {
  it('returns emerald ring for Green', function () {
    expect(colorStatusRing('Green')).toContain('emerald')
  })

  it('returns amber ring for Yellow', function () {
    expect(colorStatusRing('Yellow')).toContain('amber')
  })

  it('returns red ring for Red', function () {
    expect(colorStatusRing('Red')).toContain('red')
  })

  it('returns gray ring for null', function () {
    expect(colorStatusRing(null)).toContain('gray')
  })
})

// ---------------------------------------------------------------------------
// productBadgeClass
// ---------------------------------------------------------------------------

describe('productBadgeClass', function () {
  it('returns indigo for RHOAI', function () {
    expect(productBadgeClass('RHOAI')).toContain('indigo')
  })

  it('returns orange for RHELAI', function () {
    expect(productBadgeClass('RHELAI')).toContain('orange')
  })

  it('returns teal for RHAII', function () {
    expect(productBadgeClass('RHAII')).toContain('teal')
  })

  it('is case-insensitive', function () {
    expect(productBadgeClass('rhoai')).toContain('indigo')
  })

  it('returns gray for unknown product', function () {
    expect(productBadgeClass('Unknown')).toContain('gray')
  })
})

// ---------------------------------------------------------------------------
// getLeads
// ---------------------------------------------------------------------------

describe('getLeads', function () {
  var leads = {
    dashboard: { pmLead: 'Alice', engLead: 'Bob' },
    inference: { pmLead: 'Charlie', engLead: 'Diana' }
  }

  it('returns exact match (case-insensitive)', function () {
    expect(getLeads('Dashboard', leads)).toEqual({ pmLead: 'Alice', engLead: 'Bob' })
  })

  it('returns fuzzy match via includes', function () {
    expect(getLeads('AI Dashboard Extended', leads)).toEqual({ pmLead: 'Alice', engLead: 'Bob' })
  })

  it('returns null when no match', function () {
    expect(getLeads('Unknown Component', leads)).toBeNull()
  })

  it('handles null component name by fuzzy matching (empty string is substring of any key)', function () {
    // null → '' → ''.includes('dashboard') is false, but 'dashboard'.includes('') is true
    // So it returns the first matching entry via the fuzzy loop
    expect(getLeads(null, leads)).not.toBeNull()
  })

  it('handles empty leads map', function () {
    expect(getLeads('Dashboard', {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildComponentGroups — core computed property logic
// ---------------------------------------------------------------------------

describe('buildComponentGroups', function () {
  it('groups features by component across versions', function () {
    var groups = [
      makeGroup('rhoai-3.5', 'Dashboard', [makeFeature({ key: 'X-1' })]),
      makeGroup('rhoai-3.5', 'Inference', [makeFeature({ key: 'X-2' })])
    ]
    var result = buildComponentGroups(groups)
    expect(result).toHaveLength(2)
    expect(result[0].component).toBe('Dashboard')
    expect(result[1].component).toBe('Inference')
  })

  it('deduplicates features appearing in multiple version groups', function () {
    var feat = makeFeature({ key: 'RHAIENG-1' })
    var groups = [
      makeGroup('rhoai-3.5', 'Dashboard', [feat]),
      makeGroup('rhoai-3.6', 'Dashboard', [feat])
    ]
    var result = buildComponentGroups(groups)
    expect(result).toHaveLength(1)
    expect(result[0].features).toHaveLength(1)
  })

  it('aggregates products from different versions', function () {
    var feat = makeFeature({ key: 'X-1' })
    var groups = [
      makeGroup('rhoai-3.5', 'Dash', [feat]),
      makeGroup('rhelai-3.5', 'Dash', [feat])
    ]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].products).toEqual(['RHOAI', 'RHELAI'])
  })

  it('sets isRequested and isCommitted flags correctly', function () {
    var feat = makeFeature({ key: 'X-1' })
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Dash',
        requestedFeatures: [feat],
        committedFeatures: [],
        requestedCount: 1,
        committedCount: 0,
        blockedCount: 0
      }]
    }]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].isRequested).toBe(true)
    expect(result[0].features[0].isCommitted).toBe(false)
  })

  it('counts requested, committed, and blocked correctly', function () {
    var feats = [
      makeFeature({ key: 'X-1', isBlocked: false }),
      makeFeature({ key: 'X-2', isBlocked: true })
    ]
    var groups = [makeGroup('rhoai-3.5', 'Dash', feats)]
    var result = buildComponentGroups(groups)
    expect(result[0].requestedCount).toBe(2)
    expect(result[0].committedCount).toBe(2)
    expect(result[0].blockedCount).toBe(1)
  })

  it('skips components with no features', function () {
    var groups = [{
      version: 'rhoai-3.5',
      components: [{
        component: 'Empty',
        requestedFeatures: [],
        committedFeatures: [],
        requestedCount: 0,
        committedCount: 0,
        blockedCount: 0
      }]
    }]
    var result = buildComponentGroups(groups)
    expect(result).toHaveLength(0)
  })

  it('sorts components alphabetically', function () {
    var groups = [
      makeGroup('rhoai-3.5', 'Zebra', [makeFeature({ key: 'Z-1' })]),
      makeGroup('rhoai-3.5', 'Alpha', [makeFeature({ key: 'A-1' })])
    ]
    var result = buildComponentGroups(groups)
    expect(result[0].component).toBe('Alpha')
    expect(result[1].component).toBe('Zebra')
  })

  it('returns empty array for empty input', function () {
    expect(buildComponentGroups([])).toEqual([])
  })

  // --- New field preservation tests ---

  it('preserves fixVersions on features', function () {
    var feat = makeFeature({ key: 'X-1', fixVersions: ['rhoai-3.5', 'rhoai-3.6'] })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].fixVersions).toEqual(['rhoai-3.5', 'rhoai-3.6'])
  })

  it('preserves targetVersions on features', function () {
    var feat = makeFeature({ key: 'X-1', targetVersions: ['rhoai-3.5', 'rhelai-3.5'] })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].targetVersions).toEqual(['rhoai-3.5', 'rhelai-3.5'])
  })

  it('defaults fixVersions to empty array when missing', function () {
    var feat = makeFeature({ key: 'X-1' })
    delete feat.fixVersions
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].fixVersions).toEqual([])
  })

  it('defaults targetVersions to empty array when missing', function () {
    var feat = makeFeature({ key: 'X-1' })
    delete feat.targetVersions
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].targetVersions).toEqual([])
  })

  it('preserves status (Jira workflow status) on features', function () {
    var feat = makeFeature({ key: 'X-1', status: 'Code Review' })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].status).toBe('Code Review')
  })

  it('preserves colorStatus on features', function () {
    var feat = makeFeature({ key: 'X-1', colorStatus: 'Red' })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].colorStatus).toBe('Red')
  })

  it('preserves all fields through deduplication', function () {
    var feat = makeFeature({
      key: 'X-1',
      status: 'In Progress',
      colorStatus: 'Yellow',
      fixVersions: ['rhoai-3.5'],
      targetVersions: ['rhoai-3.5', 'rhelai-3.5'],
      releaseType: 'Enhancement',
      assignee: 'Charlie',
      pmOwner: 'Diana'
    })
    var groups = [
      makeGroup('rhoai-3.5', 'Dash', [feat]),
      makeGroup('rhelai-3.5', 'Dash', [feat])
    ]
    var result = buildComponentGroups(groups)
    var f = result[0].features[0]
    expect(f.status).toBe('In Progress')
    expect(f.colorStatus).toBe('Yellow')
    expect(f.fixVersions).toEqual(['rhoai-3.5'])
    expect(f.targetVersions).toEqual(['rhoai-3.5', 'rhelai-3.5'])
    expect(f.releaseType).toBe('Enhancement')
    expect(f.assignee).toBe('Charlie')
    expect(f.pmOwner).toBe('Diana')
  })

  it('handles features with empty fixVersions and targetVersions', function () {
    var feat = makeFeature({ key: 'X-1', fixVersions: [], targetVersions: [] })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].fixVersions).toEqual([])
    expect(result[0].features[0].targetVersions).toEqual([])
  })

  it('preserves priority on features', function () {
    var feat = makeFeature({ key: 'X-1', priority: 'Critical' })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].priority).toBe('Critical')
  })

  it('preserves null priority on features', function () {
    var feat = makeFeature({ key: 'X-1', priority: null })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].priority).toBeNull()
  })

  it('preserves priority through deduplication', function () {
    var feat = makeFeature({ key: 'X-1', priority: 'Blocker' })
    var groups = [
      makeGroup('rhoai-3.5', 'Dash', [feat]),
      makeGroup('rhelai-3.5', 'Dash', [feat])
    ]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].priority).toBe('Blocker')
  })

  it('handles features with multiple fixVersions', function () {
    var feat = makeFeature({ key: 'X-1', fixVersions: ['rhoai-3.5', 'rhoai-3.6', 'rhelai-3.5'] })
    var groups = [makeGroup('rhoai-3.5', 'Dash', [feat])]
    var result = buildComponentGroups(groups)
    expect(result[0].features[0].fixVersions).toHaveLength(3)
  })
})
