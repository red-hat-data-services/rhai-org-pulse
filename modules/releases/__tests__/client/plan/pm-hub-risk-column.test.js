/**
 * Tests for PM Hub risk column, at-risk counts, and fetchedAt timestamp.
 *
 * Covers:
 * - computeRiskLevel() server-side logic (inlined from routes.js)
 * - At-risk count in component group headers
 * - totalAtRisk summary card computation
 * - formattedFetchedAt computed property
 * - riskLevel sort ordering
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inlined from modules/releases/server/pm-hub/routes.js
// ---------------------------------------------------------------------------

function computeRiskLevel(f, targetVersions) {
  var hasFixVersion = f.fixVersions && f.fixVersions.length > 0
  var hasTargetVersion = targetVersions && targetVersions.length > 0
  if (!hasFixVersion && hasTargetVersion) return 'high'
  if (hasFixVersion) {
    var cs = (f.colorStatus || '').toLowerCase()
    if (f.isBlocked || cs === 'red' || cs === 'yellow') return 'medium'
  }
  return 'low'
}

// ---------------------------------------------------------------------------
// Inlined from ComponentReleaseLoadTable.vue
// ---------------------------------------------------------------------------

var RISK_ORDER = { 'high': 0, 'medium': 1, 'low': 2 }

function getRiskSortValue(feature) {
  var ro = RISK_ORDER[(feature.riskLevel || '').toLowerCase()]
  return ro !== undefined ? ro : 99
}

function computeAtRiskCount(features) {
  var count = 0
  for (var i = 0; i < features.length; i++) {
    if (features[i].riskLevel === 'high' || features[i].riskLevel === 'medium') count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Inlined from ComponentReleaseLoadReport.vue
// ---------------------------------------------------------------------------

function computeTotalAtRisk(groups) {
  var count = 0
  for (var i = 0; i < groups.length; i++) {
    var comps = groups[i].components || []
    for (var ci = 0; ci < comps.length; ci++) count += comps[ci].atRiskCount || 0
  }
  return count
}

function formatFetchedAt(isoString) {
  if (!isoString) return null
  try {
    var d = new Date(isoString)
    if (isNaN(d.getTime())) return null
    return d.toLocaleString()
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
    releaseType: 'Feature',
    priority: 'Major',
    isBlocked: false,
    components: ['Dashboard'],
    fixVersions: ['rhoai-3.5'],
    targetVersions: ['rhoai-3.5'],
    riskLevel: 'low',
    assignee: 'Alice',
    pmOwner: 'Bob'
  }, overrides)
}

function makeComponentGroup(features) {
  return {
    component: 'TestComp',
    requestedFeatures: features,
    committedFeatures: features,
    requestedCount: features.length,
    committedCount: features.length,
    blockedCount: features.filter(function (f) { return f.isBlocked }).length,
    atRiskCount: computeAtRiskCount(features)
  }
}

// ---------------------------------------------------------------------------
// computeRiskLevel
// ---------------------------------------------------------------------------

describe('computeRiskLevel', function () {
  it('returns high when no fix version but has target version', function () {
    var f = { fixVersions: [], colorStatus: 'Green', isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('high')
  })

  it('returns high when fixVersions is null and target exists', function () {
    var f = { fixVersions: null, colorStatus: 'Green', isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('high')
  })

  it('returns medium when committed but blocked', function () {
    var f = { fixVersions: ['rhoai-3.5'], colorStatus: 'Green', isBlocked: true }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('medium')
  })

  it('returns medium when committed but red status', function () {
    var f = { fixVersions: ['rhoai-3.5'], colorStatus: 'Red', isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('medium')
  })

  it('returns medium when committed but yellow status', function () {
    var f = { fixVersions: ['rhoai-3.5'], colorStatus: 'Yellow', isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('medium')
  })

  it('returns medium when committed, blocked, and red', function () {
    var f = { fixVersions: ['rhoai-3.5'], colorStatus: 'Red', isBlocked: true }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('medium')
  })

  it('returns low when committed and green', function () {
    var f = { fixVersions: ['rhoai-3.5'], colorStatus: 'Green', isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('low')
  })

  it('returns low when no fix version and no target version', function () {
    var f = { fixVersions: [], colorStatus: 'Green', isBlocked: false }
    expect(computeRiskLevel(f, [])).toBe('low')
  })

  it('returns low when no fix version and target is null', function () {
    var f = { fixVersions: [], colorStatus: 'Green', isBlocked: false }
    expect(computeRiskLevel(f, null)).toBe('low')
  })

  it('is case-insensitive for colorStatus', function () {
    var f = { fixVersions: ['rhoai-3.5'], colorStatus: 'RED', isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('medium')
  })

  it('handles missing colorStatus gracefully', function () {
    var f = { fixVersions: ['rhoai-3.5'], colorStatus: null, isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('low')
  })

  it('handles undefined colorStatus', function () {
    var f = { fixVersions: ['rhoai-3.5'], isBlocked: false }
    expect(computeRiskLevel(f, ['rhoai-3.5'])).toBe('low')
  })
})

// ---------------------------------------------------------------------------
// Risk sort ordering
// ---------------------------------------------------------------------------

describe('riskLevel sort ordering', function () {
  it('sorts high before medium before low', function () {
    expect(getRiskSortValue({ riskLevel: 'high' })).toBe(0)
    expect(getRiskSortValue({ riskLevel: 'medium' })).toBe(1)
    expect(getRiskSortValue({ riskLevel: 'low' })).toBe(2)
  })

  it('returns 99 for missing riskLevel', function () {
    expect(getRiskSortValue({})).toBe(99)
    expect(getRiskSortValue({ riskLevel: null })).toBe(99)
    expect(getRiskSortValue({ riskLevel: '' })).toBe(99)
  })

  it('is case-insensitive', function () {
    expect(getRiskSortValue({ riskLevel: 'HIGH' })).toBe(0)
    expect(getRiskSortValue({ riskLevel: 'Medium' })).toBe(1)
    expect(getRiskSortValue({ riskLevel: 'LOW' })).toBe(2)
  })

  it('returns 99 for unknown values', function () {
    expect(getRiskSortValue({ riskLevel: 'critical' })).toBe(99)
    expect(getRiskSortValue({ riskLevel: 'none' })).toBe(99)
  })
})

// ---------------------------------------------------------------------------
// At-risk count in component groups
// ---------------------------------------------------------------------------

describe('at-risk count in component groups', function () {
  it('counts high and medium risk features', function () {
    var features = [
      makeFeature({ key: 'X-1', riskLevel: 'high' }),
      makeFeature({ key: 'X-2', riskLevel: 'medium' }),
      makeFeature({ key: 'X-3', riskLevel: 'low' })
    ]
    var group = makeComponentGroup(features)
    expect(group.atRiskCount).toBe(2)
  })

  it('returns 0 when all features are low risk', function () {
    var features = [
      makeFeature({ key: 'X-1', riskLevel: 'low' }),
      makeFeature({ key: 'X-2', riskLevel: 'low' })
    ]
    var group = makeComponentGroup(features)
    expect(group.atRiskCount).toBe(0)
  })

  it('returns 0 for empty feature list', function () {
    var group = makeComponentGroup([])
    expect(group.atRiskCount).toBe(0)
  })

  it('counts all features when all are at risk', function () {
    var features = [
      makeFeature({ key: 'X-1', riskLevel: 'high' }),
      makeFeature({ key: 'X-2', riskLevel: 'medium' }),
      makeFeature({ key: 'X-3', riskLevel: 'high' })
    ]
    var group = makeComponentGroup(features)
    expect(group.atRiskCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// totalAtRisk summary computation
// ---------------------------------------------------------------------------

describe('totalAtRisk summary card', function () {
  it('sums atRiskCount across all components in all groups', function () {
    var groups = [
      {
        version: 'rhoai-3.5',
        components: [
          { component: 'CompA', atRiskCount: 2 },
          { component: 'CompB', atRiskCount: 1 }
        ]
      },
      {
        version: 'rhoai-3.6',
        components: [
          { component: 'CompC', atRiskCount: 3 }
        ]
      }
    ]
    expect(computeTotalAtRisk(groups)).toBe(6)
  })

  it('returns 0 when no components have at-risk features', function () {
    var groups = [
      {
        version: 'rhoai-3.5',
        components: [
          { component: 'CompA', atRiskCount: 0 },
          { component: 'CompB', atRiskCount: 0 }
        ]
      }
    ]
    expect(computeTotalAtRisk(groups)).toBe(0)
  })

  it('returns 0 for empty groups', function () {
    expect(computeTotalAtRisk([])).toBe(0)
  })

  it('handles missing atRiskCount gracefully', function () {
    var groups = [
      {
        version: 'rhoai-3.5',
        components: [
          { component: 'CompA' }
        ]
      }
    ]
    expect(computeTotalAtRisk(groups)).toBe(0)
  })

  it('handles groups with empty components array', function () {
    var groups = [{ version: 'rhoai-3.5', components: [] }]
    expect(computeTotalAtRisk(groups)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// formattedFetchedAt
// ---------------------------------------------------------------------------

describe('formattedFetchedAt', function () {
  it('formats a valid ISO string', function () {
    var result = formatFetchedAt('2025-06-28T14:30:00.000Z')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns null for null input', function () {
    expect(formatFetchedAt(null)).toBeNull()
  })

  it('returns null for undefined input', function () {
    expect(formatFetchedAt(undefined)).toBeNull()
  })

  it('returns null for empty string', function () {
    expect(formatFetchedAt('')).toBeNull()
  })

  it('returns null for invalid date string', function () {
    expect(formatFetchedAt('not-a-date')).toBeNull()
  })

  it('returns null for nonsense string', function () {
    expect(formatFetchedAt('abc123xyz')).toBeNull()
  })

  it('formats a date-only string', function () {
    var result = formatFetchedAt('2025-06-28')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })
})
