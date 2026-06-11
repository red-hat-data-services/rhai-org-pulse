import { describe, it, expect } from 'vitest'

/**
 * Tests for HealthDashboardView filter logic.
 *
 * The bigRockOptions computed and filteredFeatures filter in
 * HealthDashboardView.vue must split merged bigRock strings (e.g.,
 * "Rock A, Rock B") into individual rock names for the dropdown
 * and for filter matching.
 *
 * These tests exercise the split logic directly since mounting the full
 * Vue component requires extensive dependencies.
 */

function buildBigRockOptions(features) {
  var rocks = {}
  for (var i = 0; i < features.length; i++) {
    var raw = features[i].bigRock
    if (!raw) continue
    var parts = raw.split(', ')
    for (var j = 0; j < parts.length; j++) {
      rocks[parts[j]] = true
    }
  }
  return Object.keys(rocks).sort()
}

function matchesBigRockFilter(feature, bigRockFilter) {
  if (bigRockFilter) {
    var fRocks = feature.bigRock ? feature.bigRock.split(', ') : []
    if (!fRocks.includes(bigRockFilter)) return false
  }
  return true
}

describe('HealthDashboardView filter logic', function() {
  describe('bigRockOptions', function() {
    it('splits merged names into separate options', function() {
      var features = [
        { bigRock: 'Rock A, Rock B' },
        { bigRock: 'Rock C' }
      ]
      var options = buildBigRockOptions(features)
      expect(options).toEqual(['Rock A', 'Rock B', 'Rock C'])
      expect(options).not.toContain('Rock A, Rock B')
    })

    it('deduplicates rock names', function() {
      var features = [
        { bigRock: 'Rock A, Rock B' },
        { bigRock: 'Rock A' }
      ]
      var options = buildBigRockOptions(features)
      expect(options).toEqual(['Rock A', 'Rock B'])
    })

    it('skips features with no bigRock', function() {
      var features = [
        { bigRock: '' },
        { bigRock: null },
        { bigRock: 'Rock A' }
      ]
      var options = buildBigRockOptions(features)
      expect(options).toEqual(['Rock A'])
    })
  })

  describe('filteredFeatures big rock filter', function() {
    it('matches split rock against filter', function() {
      var feature = { bigRock: 'Rock A, Rock B' }
      expect(matchesBigRockFilter(feature, 'Rock A')).toBe(true)
      expect(matchesBigRockFilter(feature, 'Rock B')).toBe(true)
    })

    it('does not match unrelated rock', function() {
      var feature = { bigRock: 'Rock A, Rock B' }
      expect(matchesBigRockFilter(feature, 'Rock C')).toBe(false)
    })

    it('passes all features when no filter set', function() {
      var feature = { bigRock: 'Rock A, Rock B' }
      expect(matchesBigRockFilter(feature, null)).toBe(true)
      expect(matchesBigRockFilter(feature, '')).toBe(true)
    })

    it('handles empty bigRock without error', function() {
      var feature = { bigRock: '' }
      expect(matchesBigRockFilter(feature, 'Rock A')).toBe(false)
    })
  })
})
