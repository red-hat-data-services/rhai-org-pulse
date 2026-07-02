/**
 * Tests for Big Rock outcome grouping logic.
 *
 * Covers:
 * - featuresByOutcome grouping (features split by parentKey)
 * - Unlinked features collected under "Other"
 * - Empty outcomes shown with zero count
 * - parentKey passthrough in mapToCandidate
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inlined from BigRockExpandedRow.vue
// ---------------------------------------------------------------------------

function groupFeaturesByOutcome(features, outcomeKeys, outcomeDescriptions) {
  if (!outcomeKeys || outcomeKeys.length === 0) return []
  var groups = []
  var used = {}
  for (var oi = 0; oi < outcomeKeys.length; oi++) {
    var oKey = outcomeKeys[oi]
    var feats = []
    for (var fi = 0; fi < features.length; fi++) {
      var f = features[fi]
      if (f.parentKey === oKey) {
        feats.push(f)
        used[f.key] = true
      }
    }
    groups.push({
      key: oKey,
      description: (outcomeDescriptions && outcomeDescriptions[oKey]) || '',
      features: feats
    })
  }
  var other = []
  for (var ui = 0; ui < features.length; ui++) {
    if (!used[features[ui].key]) {
      other.push(features[ui])
    }
  }
  if (other.length > 0) {
    groups.push({
      key: '_other',
      description: 'Other features',
      features: other
    })
  }
  return groups
}

// ---------------------------------------------------------------------------
// Inlined from cache-reader.js mapToCandidate
// ---------------------------------------------------------------------------

function extractParentKey(item) {
  return item.parentKey || (item._indexEntry && item._indexEntry.parentKey) || ''
}

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeFeature(overrides) {
  return Object.assign({
    key: 'RHAIENG-1',
    parentKey: '',
    level: 'green',
    summary: 'Test feature',
    status: 'In Progress',
    deliveryOwner: 'Alice',
    bigRock: 'Rock 1'
  }, overrides)
}

// ---------------------------------------------------------------------------
// Outcome grouping
// ---------------------------------------------------------------------------

describe('groupFeaturesByOutcome', function() {
  it('groups features under their parent outcome', function() {
    var features = [
      makeFeature({ key: 'F-1', parentKey: 'RHAISTRAT-100' }),
      makeFeature({ key: 'F-2', parentKey: 'RHAISTRAT-200' }),
      makeFeature({ key: 'F-3', parentKey: 'RHAISTRAT-100' })
    ]
    var outcomeKeys = ['RHAISTRAT-100', 'RHAISTRAT-200']
    var descriptions = { 'RHAISTRAT-100': 'Improve throughput', 'RHAISTRAT-200': 'Reduce latency' }
    var groups = groupFeaturesByOutcome(features, outcomeKeys, descriptions)

    expect(groups.length).toBe(2)
    expect(groups[0].key).toBe('RHAISTRAT-100')
    expect(groups[0].features.length).toBe(2)
    expect(groups[0].description).toBe('Improve throughput')
    expect(groups[1].key).toBe('RHAISTRAT-200')
    expect(groups[1].features.length).toBe(1)
    expect(groups[1].description).toBe('Reduce latency')
  })

  it('puts unlinked features in _other group', function() {
    var features = [
      makeFeature({ key: 'F-1', parentKey: 'RHAISTRAT-100' }),
      makeFeature({ key: 'F-2', parentKey: '' }),
      makeFeature({ key: 'F-3', parentKey: 'UNKNOWN-999' })
    ]
    var outcomeKeys = ['RHAISTRAT-100']
    var groups = groupFeaturesByOutcome(features, outcomeKeys, {})

    expect(groups.length).toBe(2)
    expect(groups[0].key).toBe('RHAISTRAT-100')
    expect(groups[0].features.length).toBe(1)
    expect(groups[1].key).toBe('_other')
    expect(groups[1].features.length).toBe(2)
  })

  it('shows outcomes with zero features', function() {
    var features = [
      makeFeature({ key: 'F-1', parentKey: 'RHAISTRAT-100' })
    ]
    var outcomeKeys = ['RHAISTRAT-100', 'RHAISTRAT-200']
    var groups = groupFeaturesByOutcome(features, outcomeKeys, {})

    expect(groups.length).toBe(2)
    expect(groups[0].features.length).toBe(1)
    expect(groups[1].key).toBe('RHAISTRAT-200')
    expect(groups[1].features.length).toBe(0)
  })

  it('no _other group when all features are linked', function() {
    var features = [
      makeFeature({ key: 'F-1', parentKey: 'RHAISTRAT-100' })
    ]
    var outcomeKeys = ['RHAISTRAT-100']
    var groups = groupFeaturesByOutcome(features, outcomeKeys, {})

    expect(groups.length).toBe(1)
    expect(groups[0].key).toBe('RHAISTRAT-100')
  })

  it('returns empty array when no outcome keys', function() {
    var features = [makeFeature({ key: 'F-1' })]
    expect(groupFeaturesByOutcome(features, [], {})).toEqual([])
    expect(groupFeaturesByOutcome(features, null, {})).toEqual([])
  })

  it('handles empty features array', function() {
    var outcomeKeys = ['RHAISTRAT-100']
    var groups = groupFeaturesByOutcome([], outcomeKeys, {})

    expect(groups.length).toBe(1)
    expect(groups[0].features.length).toBe(0)
  })

  it('preserves outcome key order', function() {
    var features = [
      makeFeature({ key: 'F-1', parentKey: 'RHAISTRAT-300' }),
      makeFeature({ key: 'F-2', parentKey: 'RHAISTRAT-100' })
    ]
    var outcomeKeys = ['RHAISTRAT-300', 'RHAISTRAT-100', 'RHAISTRAT-200']
    var groups = groupFeaturesByOutcome(features, outcomeKeys, {})

    expect(groups[0].key).toBe('RHAISTRAT-300')
    expect(groups[1].key).toBe('RHAISTRAT-100')
    expect(groups[2].key).toBe('RHAISTRAT-200')
  })

  it('handles missing descriptions gracefully', function() {
    var features = [makeFeature({ key: 'F-1', parentKey: 'RHAISTRAT-100' })]
    var outcomeKeys = ['RHAISTRAT-100']
    var groups = groupFeaturesByOutcome(features, outcomeKeys, undefined)

    expect(groups[0].description).toBe('')
  })
})

// ---------------------------------------------------------------------------
// parentKey extraction (mapToCandidate logic)
// ---------------------------------------------------------------------------

describe('extractParentKey', function() {
  it('returns parentKey directly from item', function() {
    expect(extractParentKey({ parentKey: 'RHAISTRAT-100' })).toBe('RHAISTRAT-100')
  })

  it('falls back to _indexEntry.parentKey', function() {
    expect(extractParentKey({ _indexEntry: { parentKey: 'RHAISTRAT-200' } })).toBe('RHAISTRAT-200')
  })

  it('returns empty string when no parentKey', function() {
    expect(extractParentKey({})).toBe('')
    expect(extractParentKey({ _indexEntry: {} })).toBe('')
  })

  it('prefers item.parentKey over _indexEntry', function() {
    expect(extractParentKey({ parentKey: 'A', _indexEntry: { parentKey: 'B' } })).toBe('A')
  })
})
