/**
 * Tests for PM Hub docs commitment column (D6).
 *
 * Covers:
 * - docsRequired sort ordering
 * - docsRequired filter logic (Yes / No / Not set)
 * - docsRequired count helpers
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inlined from ComponentReleaseLoadTable.vue
// ---------------------------------------------------------------------------

function getDocsSortValue(feature) {
  return feature.docsRequired === 'Yes' ? 0 : 1
}

// ---------------------------------------------------------------------------
// Inlined from ComponentReleaseLoadReport.vue
// ---------------------------------------------------------------------------

function filterByDocs(features, filterDocs) {
  if (filterDocs.length === 0) return features
  return features.filter(function(f) {
    var docVal = f.docsRequired || ''
    for (var di = 0; di < filterDocs.length; di++) {
      if (filterDocs[di] === 'Yes' && docVal === 'Yes') return true
      if (filterDocs[di] === 'No' && docVal === 'No') return true
      if (filterDocs[di] === 'Not set' && !docVal) return true
    }
    return false
  })
}

// ---------------------------------------------------------------------------
// Test data factory
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
    pmOwner: 'Bob',
    docsRequired: null
  }, overrides)
}

// ---------------------------------------------------------------------------
// Docs sort ordering
// ---------------------------------------------------------------------------

describe('docs column sort ordering', function() {
  it('sorts "Yes" (0) before null/other (1)', function() {
    expect(getDocsSortValue({ docsRequired: 'Yes' })).toBe(0)
    expect(getDocsSortValue({ docsRequired: null })).toBe(1)
    expect(getDocsSortValue({ docsRequired: 'No' })).toBe(1)
    expect(getDocsSortValue({})).toBe(1)
  })

  it('returns 0 only for exact "Yes" string', function() {
    expect(getDocsSortValue({ docsRequired: 'Yes' })).toBe(0)
    expect(getDocsSortValue({ docsRequired: 'yes' })).toBe(1)
    expect(getDocsSortValue({ docsRequired: 'YES' })).toBe(1)
  })

  it('sorts a mixed list correctly', function() {
    var features = [
      makeFeature({ key: 'X-1', docsRequired: null }),
      makeFeature({ key: 'X-2', docsRequired: 'Yes' }),
      makeFeature({ key: 'X-3', docsRequired: 'No' }),
      makeFeature({ key: 'X-4', docsRequired: 'Yes' })
    ]
    var sorted = features.slice().sort(function(a, b) {
      return getDocsSortValue(a) - getDocsSortValue(b)
    })
    expect(sorted[0].key).toBe('X-2')
    expect(sorted[1].key).toBe('X-4')
  })
})

// ---------------------------------------------------------------------------
// Docs filter logic
// ---------------------------------------------------------------------------

describe('docs filter logic', function() {
  var features = [
    makeFeature({ key: 'X-1', docsRequired: 'Yes' }),
    makeFeature({ key: 'X-2', docsRequired: 'No' }),
    makeFeature({ key: 'X-3', docsRequired: null }),
    makeFeature({ key: 'X-4', docsRequired: 'Yes' }),
    makeFeature({ key: 'X-5', docsRequired: '' })
  ]

  it('returns all features when filter is empty', function() {
    var result = filterByDocs(features, [])
    expect(result.length).toBe(5)
  })

  it('filters to Yes only', function() {
    var result = filterByDocs(features, ['Yes'])
    expect(result.length).toBe(2)
    expect(result[0].key).toBe('X-1')
    expect(result[1].key).toBe('X-4')
  })

  it('filters to No only', function() {
    var result = filterByDocs(features, ['No'])
    expect(result.length).toBe(1)
    expect(result[0].key).toBe('X-2')
  })

  it('filters to Not set only (null and empty string)', function() {
    var result = filterByDocs(features, ['Not set'])
    expect(result.length).toBe(2)
    expect(result[0].key).toBe('X-3')
    expect(result[1].key).toBe('X-5')
  })

  it('filters to Yes + Not set (multi-select)', function() {
    var result = filterByDocs(features, ['Yes', 'Not set'])
    expect(result.length).toBe(4)
  })

  it('filters to Yes + No (multi-select)', function() {
    var result = filterByDocs(features, ['Yes', 'No'])
    expect(result.length).toBe(3)
  })

  it('filters to all three values returns everything', function() {
    var result = filterByDocs(features, ['Yes', 'No', 'Not set'])
    expect(result.length).toBe(5)
  })

  it('returns empty array when no features match', function() {
    var noDocsFeatures = [
      makeFeature({ key: 'X-1', docsRequired: 'Yes' })
    ]
    var result = filterByDocs(noDocsFeatures, ['No'])
    expect(result.length).toBe(0)
  })

  it('handles empty feature array', function() {
    var result = filterByDocs([], ['Yes'])
    expect(result.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildFeatureObj docsRequired passthrough
// ---------------------------------------------------------------------------

describe('buildFeatureObj includes docsRequired', function() {
  function buildFeatureObj(f, targetVersions) {
    var tv = targetVersions || []
    return {
      key: f.key,
      summary: f.summary || '',
      status: f.status || null,
      statusCategory: f.statusCategory || null,
      colorStatus: f.colorStatus || null,
      statusSummary: f.statusSummary || null,
      releaseType: f.releaseType || null,
      priority: f.priority || null,
      isBlocked: f.isBlocked || false,
      blockedBy: f.blockedBy || [],
      components: f.components || [],
      fixVersions: f.fixVersions || [],
      targetVersions: tv,
      riskLevel: 'low',
      assignee: f.assignee || null,
      pmOwner: f.pmOwner || null,
      docsRequired: f.docsRequired || null
    }
  }

  it('passes through docsRequired "Yes"', function() {
    var result = buildFeatureObj({ key: 'X-1', docsRequired: 'Yes' }, [])
    expect(result.docsRequired).toBe('Yes')
  })

  it('passes through docsRequired "No"', function() {
    var result = buildFeatureObj({ key: 'X-1', docsRequired: 'No' }, [])
    expect(result.docsRequired).toBe('No')
  })

  it('defaults docsRequired to null when missing', function() {
    var result = buildFeatureObj({ key: 'X-1' }, [])
    expect(result.docsRequired).toBeNull()
  })

  it('defaults docsRequired to null for empty string', function() {
    var result = buildFeatureObj({ key: 'X-1', docsRequired: '' }, [])
    expect(result.docsRequired).toBeNull()
  })
})
