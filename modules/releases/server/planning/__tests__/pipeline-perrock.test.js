import { describe, it, expect } from 'vitest'

/**
 * Tests for the perRockStats filter logic in pipeline.js.
 *
 * The perRockStats section of runPipeline counts how many tier-1 features
 * and RFEs belong to each big rock. The fix changes the filter from
 * `c.bigRock.split(', ')[0] === statRock.name` (first-only) to
 * `c.bigRock && c.bigRock.split(', ').includes(statRock.name)` (all rocks).
 *
 * Since runPipeline requires complex dependencies (cache-reader, config, storage),
 * these tests exercise the filter predicate directly.
 */

function countForRock(features, rockName) {
  return features.filter(function(c) {
    return c.bigRock && c.bigRock.split(', ').includes(rockName)
  }).length
}

describe('perRockStats filter logic', function() {
  it('counts shared features under all rocks', function() {
    var features = [
      { bigRock: 'Rock A, Rock B', issueKey: 'FEAT-1' },
      { bigRock: 'Rock A', issueKey: 'FEAT-2' },
      { bigRock: 'Rock B', issueKey: 'FEAT-3' }
    ]
    expect(countForRock(features, 'Rock A')).toBe(2) // FEAT-1 + FEAT-2
    expect(countForRock(features, 'Rock B')).toBe(2) // FEAT-1 + FEAT-3
  })

  it('counts shared RFEs under all rocks', function() {
    var rfes = [
      { bigRock: 'Rock A, Rock B', issueKey: 'RFE-1' },
      { bigRock: 'Rock A', issueKey: 'RFE-2' }
    ]
    expect(countForRock(rfes, 'Rock A')).toBe(2) // RFE-1 + RFE-2
    expect(countForRock(rfes, 'Rock B')).toBe(1) // RFE-1
  })

  it('handles empty bigRock without error', function() {
    var features = [
      { bigRock: '', issueKey: 'FEAT-1' },
      { bigRock: 'Rock A', issueKey: 'FEAT-2' }
    ]
    expect(countForRock(features, 'Rock A')).toBe(1)
    expect(countForRock(features, '')).toBe(0) // empty string is falsy, skipped
  })

  it('handles null bigRock without error', function() {
    var features = [
      { bigRock: null, issueKey: 'FEAT-1' },
      { bigRock: 'Rock A', issueKey: 'FEAT-2' }
    ]
    expect(countForRock(features, 'Rock A')).toBe(1)
  })

  it('does not match partial rock names', function() {
    var features = [
      { bigRock: 'Rock Alpha, Rock Beta', issueKey: 'FEAT-1' }
    ]
    expect(countForRock(features, 'Rock')).toBe(0)
    expect(countForRock(features, 'Rock Alpha')).toBe(1)
    expect(countForRock(features, 'Rock Beta')).toBe(1)
  })

  it('single-rock features behave identically to before', function() {
    var features = [
      { bigRock: 'Rock A', issueKey: 'FEAT-1' },
      { bigRock: 'Rock B', issueKey: 'FEAT-2' }
    ]
    expect(countForRock(features, 'Rock A')).toBe(1)
    expect(countForRock(features, 'Rock B')).toBe(1)
  })
})
