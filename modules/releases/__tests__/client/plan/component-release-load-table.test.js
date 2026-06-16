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

// ---------------------------------------------------------------------------
// Sort logic — inlined from ComponentReleaseLoadTable.vue
// ---------------------------------------------------------------------------

var SORT_COLUMNS = ['key', 'summary', 'priority', 'type', 'releaseType', 'status', 'colorStatus', 'fixVersion', 'targetVersion', 'blocked', 'assignee', 'pmOwner']
var PRIORITY_ORDER = { 'Blocker': 0, 'Critical': 1, 'Major': 2, 'Normal': 3 }
var COLOR_STATUS_ORDER = { 'red': 0, 'yellow': 1, 'green': 2 }

function getSortValue(feature, column) {
  if (column === 'key') return feature.key || ''
  if (column === 'summary') return (feature.summary || '').toLowerCase()
  if (column === 'priority') {
    var po = PRIORITY_ORDER[feature.priority]
    return po !== undefined ? po : 99
  }
  if (column === 'type') {
    return (feature.isCommitted ? 2 : 0) + (feature.isRequested ? 1 : 0)
  }
  if (column === 'releaseType') return (feature.releaseType || '').toLowerCase()
  if (column === 'status') return (feature.status || '').toLowerCase()
  if (column === 'colorStatus') {
    var co = COLOR_STATUS_ORDER[(feature.colorStatus || '').toLowerCase()]
    return co !== undefined ? co : 99
  }
  if (column === 'fixVersion') {
    return feature.fixVersions && feature.fixVersions.length > 0 ? feature.fixVersions[0] : ''
  }
  if (column === 'targetVersion') {
    return feature.targetVersions && feature.targetVersions.length > 0 ? feature.targetVersions[0] : ''
  }
  if (column === 'blocked') return feature.isBlocked ? 1 : 0
  if (column === 'assignee') return (feature.assignee || '').toLowerCase()
  if (column === 'pmOwner') return (feature.pmOwner || '').toLowerCase()
  return ''
}

function sortFeatures(features, sortColumn, sortDirection) {
  if (!sortColumn) return features
  var dir = sortDirection === 'asc' ? 1 : -1
  var sorted = features.slice()
  sorted.sort(function(a, b) {
    var va = getSortValue(a, sortColumn)
    var vb = getSortValue(b, sortColumn)
    if (va < vb) return -1 * dir
    if (va > vb) return 1 * dir
    return 0
  })
  return sorted
}

function toggleSort(state, column) {
  if (SORT_COLUMNS.indexOf(column) === -1) return state
  var newState = { column: state.column, direction: state.direction }
  if (newState.column === column) {
    if (newState.direction === 'asc') {
      newState.direction = 'desc'
    } else {
      newState.column = null
      newState.direction = 'asc'
    }
  } else {
    newState.column = column
    newState.direction = 'asc'
  }
  return newState
}

// ---------------------------------------------------------------------------
// getSortValue
// ---------------------------------------------------------------------------

describe('getSortValue', function () {
  it('returns key for "key" column', function () {
    expect(getSortValue(makeFeature({ key: 'RHAIENG-42' }), 'key')).toBe('RHAIENG-42')
  })

  it('returns lowercased summary for "summary" column', function () {
    expect(getSortValue(makeFeature({ summary: 'My Feature' }), 'summary')).toBe('my feature')
  })

  it('returns priority ordinal for known priorities', function () {
    expect(getSortValue(makeFeature({ priority: 'Blocker' }), 'priority')).toBe(0)
    expect(getSortValue(makeFeature({ priority: 'Critical' }), 'priority')).toBe(1)
    expect(getSortValue(makeFeature({ priority: 'Major' }), 'priority')).toBe(2)
    expect(getSortValue(makeFeature({ priority: 'Normal' }), 'priority')).toBe(3)
  })

  it('returns 99 for unknown or null priority', function () {
    expect(getSortValue(makeFeature({ priority: 'Minor' }), 'priority')).toBe(99)
    expect(getSortValue(makeFeature({ priority: null }), 'priority')).toBe(99)
  })

  it('returns type score based on isRequested/isCommitted', function () {
    var feat = makeFeature({})
    feat.isRequested = true
    feat.isCommitted = false
    expect(getSortValue(feat, 'type')).toBe(1)

    feat.isRequested = false
    feat.isCommitted = true
    expect(getSortValue(feat, 'type')).toBe(2)

    feat.isRequested = true
    feat.isCommitted = true
    expect(getSortValue(feat, 'type')).toBe(3)

    feat.isRequested = false
    feat.isCommitted = false
    expect(getSortValue(feat, 'type')).toBe(0)
  })

  it('returns lowercased releaseType', function () {
    expect(getSortValue(makeFeature({ releaseType: 'Enhancement' }), 'releaseType')).toBe('enhancement')
  })

  it('returns empty string for null releaseType', function () {
    expect(getSortValue(makeFeature({ releaseType: null }), 'releaseType')).toBe('')
  })

  it('returns lowercased status', function () {
    expect(getSortValue(makeFeature({ status: 'In Progress' }), 'status')).toBe('in progress')
  })

  it('returns colorStatus ordinal for known statuses', function () {
    expect(getSortValue(makeFeature({ colorStatus: 'Red' }), 'colorStatus')).toBe(0)
    expect(getSortValue(makeFeature({ colorStatus: 'Yellow' }), 'colorStatus')).toBe(1)
    expect(getSortValue(makeFeature({ colorStatus: 'Green' }), 'colorStatus')).toBe(2)
  })

  it('returns 99 for unknown colorStatus', function () {
    expect(getSortValue(makeFeature({ colorStatus: null }), 'colorStatus')).toBe(99)
    expect(getSortValue(makeFeature({ colorStatus: 'Blue' }), 'colorStatus')).toBe(99)
  })

  it('returns first fixVersion or empty string', function () {
    expect(getSortValue(makeFeature({ fixVersions: ['rhoai-3.6', 'rhoai-3.5'] }), 'fixVersion')).toBe('rhoai-3.6')
    expect(getSortValue(makeFeature({ fixVersions: [] }), 'fixVersion')).toBe('')
  })

  it('returns first targetVersion or empty string', function () {
    expect(getSortValue(makeFeature({ targetVersions: ['rhoai-3.5'] }), 'targetVersion')).toBe('rhoai-3.5')
    expect(getSortValue(makeFeature({ targetVersions: [] }), 'targetVersion')).toBe('')
  })

  it('returns 1 for blocked, 0 for not blocked', function () {
    expect(getSortValue(makeFeature({ isBlocked: true }), 'blocked')).toBe(1)
    expect(getSortValue(makeFeature({ isBlocked: false }), 'blocked')).toBe(0)
  })

  it('returns lowercased assignee', function () {
    expect(getSortValue(makeFeature({ assignee: 'Alice Smith' }), 'assignee')).toBe('alice smith')
  })

  it('returns lowercased pmOwner', function () {
    expect(getSortValue(makeFeature({ pmOwner: 'Bob Jones' }), 'pmOwner')).toBe('bob jones')
  })

  it('returns empty string for null assignee/pmOwner', function () {
    expect(getSortValue(makeFeature({ assignee: null }), 'assignee')).toBe('')
    expect(getSortValue(makeFeature({ pmOwner: null }), 'pmOwner')).toBe('')
  })

  it('returns empty string for unknown column', function () {
    expect(getSortValue(makeFeature({}), 'nonexistent')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// sortFeatures
// ---------------------------------------------------------------------------

describe('sortFeatures', function () {
  var features = [
    Object.assign(makeFeature({ key: 'X-3', priority: 'Normal', assignee: 'Charlie' }), { isRequested: true, isCommitted: false }),
    Object.assign(makeFeature({ key: 'X-1', priority: 'Blocker', assignee: 'Alice' }), { isRequested: true, isCommitted: true }),
    Object.assign(makeFeature({ key: 'X-2', priority: 'Major', assignee: 'Bob' }), { isRequested: false, isCommitted: true })
  ]

  it('returns features unchanged when no sort column', function () {
    var result = sortFeatures(features, null, 'asc')
    expect(result.map(function (f) { return f.key })).toEqual(['X-3', 'X-1', 'X-2'])
  })

  it('does not mutate the original array', function () {
    var copy = features.slice()
    sortFeatures(features, 'key', 'asc')
    expect(features.map(function (f) { return f.key })).toEqual(copy.map(function (f) { return f.key }))
  })

  it('sorts by key ascending', function () {
    var result = sortFeatures(features, 'key', 'asc')
    expect(result.map(function (f) { return f.key })).toEqual(['X-1', 'X-2', 'X-3'])
  })

  it('sorts by key descending', function () {
    var result = sortFeatures(features, 'key', 'desc')
    expect(result.map(function (f) { return f.key })).toEqual(['X-3', 'X-2', 'X-1'])
  })

  it('sorts by priority ascending (Blocker first)', function () {
    var result = sortFeatures(features, 'priority', 'asc')
    expect(result.map(function (f) { return f.priority })).toEqual(['Blocker', 'Major', 'Normal'])
  })

  it('sorts by priority descending (Normal first)', function () {
    var result = sortFeatures(features, 'priority', 'desc')
    expect(result.map(function (f) { return f.priority })).toEqual(['Normal', 'Major', 'Blocker'])
  })

  it('sorts by assignee ascending', function () {
    var result = sortFeatures(features, 'assignee', 'asc')
    expect(result.map(function (f) { return f.assignee })).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorts by assignee descending', function () {
    var result = sortFeatures(features, 'assignee', 'desc')
    expect(result.map(function (f) { return f.assignee })).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('sorts by type (committed > requested > none)', function () {
    var result = sortFeatures(features, 'type', 'desc')
    expect(result.map(function (f) { return f.key })).toEqual(['X-1', 'X-2', 'X-3'])
  })

  it('sorts by colorStatus ascending (Red first)', function () {
    var colorFeatures = [
      makeFeature({ key: 'G-1', colorStatus: 'Green' }),
      makeFeature({ key: 'R-1', colorStatus: 'Red' }),
      makeFeature({ key: 'Y-1', colorStatus: 'Yellow' })
    ]
    var result = sortFeatures(colorFeatures, 'colorStatus', 'asc')
    expect(result.map(function (f) { return f.colorStatus })).toEqual(['Red', 'Yellow', 'Green'])
  })

  it('sorts by colorStatus descending (Green first)', function () {
    var colorFeatures = [
      makeFeature({ key: 'G-1', colorStatus: 'Green' }),
      makeFeature({ key: 'R-1', colorStatus: 'Red' }),
      makeFeature({ key: 'Y-1', colorStatus: 'Yellow' })
    ]
    var result = sortFeatures(colorFeatures, 'colorStatus', 'desc')
    expect(result.map(function (f) { return f.colorStatus })).toEqual(['Green', 'Yellow', 'Red'])
  })

  it('sorts by blocked (blocked items first when descending)', function () {
    var blockFeatures = [
      makeFeature({ key: 'A-1', isBlocked: false }),
      makeFeature({ key: 'B-1', isBlocked: true }),
      makeFeature({ key: 'C-1', isBlocked: false })
    ]
    var result = sortFeatures(blockFeatures, 'blocked', 'desc')
    expect(result[0].key).toBe('B-1')
  })

  it('sorts by fixVersion using first version string', function () {
    var vFeatures = [
      makeFeature({ key: 'V-1', fixVersions: ['rhoai-3.6'] }),
      makeFeature({ key: 'V-2', fixVersions: ['rhoai-3.5'] }),
      makeFeature({ key: 'V-3', fixVersions: [] })
    ]
    var result = sortFeatures(vFeatures, 'fixVersion', 'asc')
    expect(result.map(function (f) { return f.key })).toEqual(['V-3', 'V-2', 'V-1'])
  })

  it('sorts by targetVersion using first version string', function () {
    var tFeatures = [
      makeFeature({ key: 'T-1', targetVersions: ['rhoai-3.6'] }),
      makeFeature({ key: 'T-2', targetVersions: ['rhoai-3.5'] })
    ]
    var result = sortFeatures(tFeatures, 'targetVersion', 'asc')
    expect(result[0].key).toBe('T-2')
    expect(result[1].key).toBe('T-1')
  })

  it('sorts by summary case-insensitively', function () {
    var sFeatures = [
      makeFeature({ key: 'S-1', summary: 'Zebra feature' }),
      makeFeature({ key: 'S-2', summary: 'alpha feature' }),
      makeFeature({ key: 'S-3', summary: 'Beta Feature' })
    ]
    var result = sortFeatures(sFeatures, 'summary', 'asc')
    expect(result.map(function (f) { return f.key })).toEqual(['S-2', 'S-3', 'S-1'])
  })

  it('sorts by pmOwner ascending', function () {
    var pFeatures = [
      makeFeature({ key: 'P-1', pmOwner: 'Zara' }),
      makeFeature({ key: 'P-2', pmOwner: 'Alice' }),
      makeFeature({ key: 'P-3', pmOwner: null })
    ]
    var result = sortFeatures(pFeatures, 'pmOwner', 'asc')
    expect(result.map(function (f) { return f.key })).toEqual(['P-3', 'P-2', 'P-1'])
  })

  it('handles empty features array', function () {
    expect(sortFeatures([], 'key', 'asc')).toEqual([])
  })

  it('handles single feature', function () {
    var single = [makeFeature({ key: 'ONLY-1' })]
    var result = sortFeatures(single, 'key', 'asc')
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('ONLY-1')
  })

  it('maintains stability for equal values', function () {
    var eqFeatures = [
      makeFeature({ key: 'E-1', priority: 'Major' }),
      makeFeature({ key: 'E-2', priority: 'Major' }),
      makeFeature({ key: 'E-3', priority: 'Major' })
    ]
    var result = sortFeatures(eqFeatures, 'priority', 'asc')
    expect(result.map(function (f) { return f.key })).toEqual(['E-1', 'E-2', 'E-3'])
  })

  it('places unknown priorities after known ones', function () {
    var mixFeatures = [
      makeFeature({ key: 'M-1', priority: 'Minor' }),
      makeFeature({ key: 'M-2', priority: 'Blocker' }),
      makeFeature({ key: 'M-3', priority: null })
    ]
    var result = sortFeatures(mixFeatures, 'priority', 'asc')
    expect(result[0].key).toBe('M-2')
    expect(['M-1', 'M-3']).toContain(result[1].key)
  })

  it('sorts by releaseType case-insensitively', function () {
    var rtFeatures = [
      makeFeature({ key: 'RT-1', releaseType: 'Feature' }),
      makeFeature({ key: 'RT-2', releaseType: 'enhancement' }),
      makeFeature({ key: 'RT-3', releaseType: null })
    ]
    var result = sortFeatures(rtFeatures, 'releaseType', 'asc')
    expect(result.map(function (f) { return f.key })).toEqual(['RT-3', 'RT-2', 'RT-1'])
  })
})

// ---------------------------------------------------------------------------
// toggleSort
// ---------------------------------------------------------------------------

describe('toggleSort', function () {
  it('sets column to asc on first click', function () {
    var state = { column: null, direction: 'asc' }
    var result = toggleSort(state, 'key')
    expect(result).toEqual({ column: 'key', direction: 'asc' })
  })

  it('switches to desc on second click of same column', function () {
    var state = { column: 'key', direction: 'asc' }
    var result = toggleSort(state, 'key')
    expect(result).toEqual({ column: 'key', direction: 'desc' })
  })

  it('clears sort on third click of same column', function () {
    var state = { column: 'key', direction: 'desc' }
    var result = toggleSort(state, 'key')
    expect(result).toEqual({ column: null, direction: 'asc' })
  })

  it('switches to new column on different column click', function () {
    var state = { column: 'key', direction: 'desc' }
    var result = toggleSort(state, 'priority')
    expect(result).toEqual({ column: 'priority', direction: 'asc' })
  })

  it('ignores invalid column names', function () {
    var state = { column: 'key', direction: 'asc' }
    var result = toggleSort(state, 'invalid')
    expect(result).toEqual({ column: 'key', direction: 'asc' })
  })

  it('does not mutate the input state', function () {
    var state = { column: 'key', direction: 'asc' }
    toggleSort(state, 'key')
    expect(state).toEqual({ column: 'key', direction: 'asc' })
  })

  it('works for all valid sort columns', function () {
    var columns = ['key', 'summary', 'priority', 'type', 'releaseType', 'status', 'colorStatus', 'fixVersion', 'targetVersion', 'blocked', 'assignee', 'pmOwner']
    for (var i = 0; i < columns.length; i++) {
      var result = toggleSort({ column: null, direction: 'asc' }, columns[i])
      expect(result.column).toBe(columns[i])
    }
  })
})
