import { describe, expect, it } from 'vitest'
import { computeWheelRange, computePanRange } from '../timeline-interactions.js'

var DAY = 86400000
var full = { min: 0, max: 400 * DAY }

describe('timeline-interactions', function () {
  it('caps a zoom-out at the full/max-visible range', function () {
    var result = computeWheelRange({ min: 0, max: 250 * DAY }, full, 125 * DAY, false, 180, DAY)
    expect(result.max - result.min).toBe(180 * DAY)
  })

  it('zooms around the pointer and clamps both edges', function () {
    var current = { min: 100 * DAY, max: 110 * DAY }
    var left = computeWheelRange(current, full, 100 * DAY, true, 180, DAY)
    var right = computeWheelRange(current, full, 110 * DAY, true, 180, DAY)
    expect(left.max - left.min).toBeLessThan(current.max - current.min)
    expect(left.min).toBeGreaterThanOrEqual(full.min)
    expect(right.max).toBeLessThanOrEqual(full.max)

    var leftEdge = computeWheelRange({ min: 1, max: 100 * DAY }, full, 100 * DAY, false, 180, DAY)
    var rightEdge = computeWheelRange({ min: 300 * DAY, max: 399 * DAY }, full, 300 * DAY, false, 180, DAY)
    expect(leftEdge.min).toBe(full.min)
    expect(rightEdge.max).toBe(full.max)
  })

  it('enforces the minimum zoom range', function () {
    var result = computeWheelRange({ min: 100 * DAY, max: 100.001 * DAY }, full, 100 * DAY, true, 180, DAY)
    expect(result.max - result.min).toBeGreaterThanOrEqual(1.8 * DAY)
  })

  it('clamps panning at the left and right boundaries', function () {
    var start = { min: 100 * DAY, max: 110 * DAY }
    var left = computePanRange(start, 3000, 100, full)
    var right = computePanRange(start, -3000, 100, full)
    expect(left.min).toBe(full.min)
    expect(right.max).toBe(full.max)
  })

  it('pans without changing range when there is no displacement', function () {
    var start = { min: 100 * DAY, max: 110 * DAY }
    expect(computePanRange(start, 0, 100, full)).toEqual(start)
  })
})
