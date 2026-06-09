import { describe, it, expect } from 'vitest'

/**
 * Tests for FeatureReadinessView filter logic.
 *
 * The matchesFilters function and readyCounts computed in
 * FeatureReadinessView.vue must split merged bigRock strings
 * before comparing with the outcome filter value.
 *
 * These tests exercise the split logic directly.
 */

function matchesOutcomeFilter(feature, outcomeFilter) {
  if (outcomeFilter) {
    var featureRocks = feature.bigRock ? feature.bigRock.split(', ') : []
    if (!featureRocks.includes(outcomeFilter)) return false
  }
  return true
}

function countMatchingFeatures(features, outcomeFilter) {
  return features.filter(function(f) {
    if (outcomeFilter) {
      var countRocks = f.bigRock ? f.bigRock.split(', ') : []
      if (!countRocks.includes(outcomeFilter)) return false
    }
    return true
  }).length
}

describe('FeatureReadinessView filter logic', function() {
  describe('matchesFilters outcome', function() {
    it('matches split bigRock against outcome filter', function() {
      var feature = { bigRock: 'Rock A, Rock B' }
      expect(matchesOutcomeFilter(feature, 'Rock A')).toBe(true)
      expect(matchesOutcomeFilter(feature, 'Rock B')).toBe(true)
    })

    it('does not match unrelated outcome', function() {
      var feature = { bigRock: 'Rock A, Rock B' }
      expect(matchesOutcomeFilter(feature, 'Rock C')).toBe(false)
    })

    it('passes when no outcome filter set', function() {
      var feature = { bigRock: 'Rock A, Rock B' }
      expect(matchesOutcomeFilter(feature, null)).toBe(true)
    })

    it('handles empty bigRock', function() {
      var feature = { bigRock: '' }
      expect(matchesOutcomeFilter(feature, 'Rock A')).toBe(false)
    })

    it('handles null bigRock', function() {
      var feature = { bigRock: null }
      expect(matchesOutcomeFilter(feature, 'Rock A')).toBe(false)
    })

    it('single-rock features still match', function() {
      var feature = { bigRock: 'Rock A' }
      expect(matchesOutcomeFilter(feature, 'Rock A')).toBe(true)
      expect(matchesOutcomeFilter(feature, 'Rock B')).toBe(false)
    })
  })

  describe('readyCounts outcome filter', function() {
    it('includes split-matched features in count', function() {
      var features = [
        { bigRock: 'Rock A, Rock B' },
        { bigRock: 'Rock A' },
        { bigRock: 'Rock C' }
      ]
      expect(countMatchingFeatures(features, 'Rock A')).toBe(2) // shared + single
      expect(countMatchingFeatures(features, 'Rock B')).toBe(1) // shared only
      expect(countMatchingFeatures(features, 'Rock C')).toBe(1) // single only
    })

    it('counts all features when no filter', function() {
      var features = [
        { bigRock: 'Rock A, Rock B' },
        { bigRock: 'Rock C' }
      ]
      expect(countMatchingFeatures(features, null)).toBe(2)
    })
  })
})
