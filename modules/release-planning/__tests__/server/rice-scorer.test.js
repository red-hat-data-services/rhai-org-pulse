import { describe, it, expect } from 'vitest'

const { computeRiceScore, buildRiceResult } = require('../../server/health/rice-scorer')

describe('computeRiceScore', function() {
  it('computes correct RICE score for valid inputs', function() {
    var result = computeRiceScore({ reach: 1000, impact: 2, confidence: 80, effort: 4 })
    expect(result).toBe(Math.round((1000 * 2 * 0.80) / 4))
    expect(result).toBe(400)
  })

  it('returns null when rice is null', function() {
    expect(computeRiceScore(null)).toBeNull()
  })

  it('returns null when rice is undefined', function() {
    expect(computeRiceScore(undefined)).toBeNull()
  })

  it('returns null when reach is missing', function() {
    expect(computeRiceScore({ impact: 2, confidence: 80, effort: 4 })).toBeNull()
  })

  it('returns null when impact is missing', function() {
    expect(computeRiceScore({ reach: 1000, confidence: 80, effort: 4 })).toBeNull()
  })

  it('returns null when confidence is missing', function() {
    expect(computeRiceScore({ reach: 1000, impact: 2, effort: 4 })).toBeNull()
  })

  it('returns null when effort is missing', function() {
    expect(computeRiceScore({ reach: 1000, impact: 2, confidence: 80 })).toBeNull()
  })

  it('returns null when effort is zero', function() {
    expect(computeRiceScore({ reach: 1000, impact: 2, confidence: 80, effort: 0 })).toBeNull()
  })

  it('returns null when a field is NaN', function() {
    expect(computeRiceScore({ reach: 'abc', impact: 2, confidence: 80, effort: 4 })).toBeNull()
  })

  it('handles fractional impact values', function() {
    var result = computeRiceScore({ reach: 500, impact: 0.25, confidence: 100, effort: 1 })
    expect(result).toBe(Math.round(500 * 0.25 * 1.0 / 1))
    expect(result).toBe(125)
  })

  it('rounds result to nearest integer', function() {
    var result = computeRiceScore({ reach: 100, impact: 1, confidence: 33, effort: 1 })
    expect(result).toBe(33)
    expect(Number.isInteger(result)).toBe(true)
  })
})

describe('buildRiceResult', function() {
  it('returns null when rice is null', function() {
    expect(buildRiceResult(null)).toBeNull()
  })

  it('returns null when rice is undefined', function() {
    expect(buildRiceResult(undefined)).toBeNull()
  })

  it('returns complete result with score for valid data', function() {
    var result = buildRiceResult({ reach: 1000, impact: 2, confidence: 80, effort: 4 })
    expect(result).toEqual({
      reach: 1000,
      impact: 2,
      confidence: 80,
      effort: 4,
      score: 400,
      complete: true
    })
  })

  it('returns incomplete result when data is missing', function() {
    var result = buildRiceResult({ reach: 1000, impact: null, confidence: 80, effort: 4 })
    expect(result.score).toBeNull()
    expect(result.complete).toBe(false)
    expect(result.reach).toBe(1000)
    expect(result.confidence).toBe(80)
  })

  it('preserves original field values in result', function() {
    var rice = { reach: 500, impact: 3, confidence: 90, effort: 2 }
    var result = buildRiceResult(rice)
    expect(result.reach).toBe(500)
    expect(result.impact).toBe(3)
    expect(result.confidence).toBe(90)
    expect(result.effort).toBe(2)
  })
})
