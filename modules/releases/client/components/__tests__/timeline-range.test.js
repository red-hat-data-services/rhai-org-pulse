import { describe, expect, it } from 'vitest'
import {
  computeFullRange,
  capRange,
  computeDefaultRange,
  focusTimestamps,
  focusVisibleCount,
  computeFocusRange
} from '../timeline-range.js'

var DAY = 86400000
var today = Date.parse('2026-09-21T00:00:00')
var full = { min: today - 10 * DAY, max: today + 30 * DAY }

describe('timeline-range', function () {
  it('handles empty and invalid node collections', function () {
    expect(computeFullRange([], today, DAY)).toEqual({ min: 0, max: 1 })
    expect(computeFullRange([{ date: 'invalid' }], today, DAY)).toEqual({ min: 0, max: 1 })
  })

  it('includes today and pads a valid node range', function () {
    var result = computeFullRange([{ date: '2026-10-01' }, { date: '2026-08-01' }], today, DAY)
    expect(result.min).toBeLessThan(today)
    expect(result.max).toBeGreaterThan(today)
  })

  it('caps a range only when it exceeds the maximum', function () {
    expect(capRange({ min: 10, max: 20 }, { min: 0, max: 30 }, 180, DAY))
      .toEqual({ min: 10, max: 20 })
    var capped = capRange({ min: 0, max: 400 * DAY }, { min: 0, max: 400 * DAY }, 180, DAY)
    expect(capped.max - capped.min).toBe(180 * DAY)
    expect(capped.min).toBeGreaterThan(0)
  })

  it('computes past-hidden and centered default windows', function () {
    var defaults = { windowDays: 29, maxVisibleDays: 180 }
    var hidden = computeDefaultRange(full, today, true, defaults, DAY)
    var centered = computeDefaultRange(full, today, false, defaults, DAY)
    expect(hidden.min).toBeLessThan(today)
    expect(centered.min).toBeLessThan(today)
    expect(centered.max).toBeGreaterThan(today)
  })

  it('fits extreme defaults back through the capped full range', function () {
    var narrow = { min: today, max: today }
    var defaults = { windowDays: 29, maxVisibleDays: 180 }
    expect(computeDefaultRange(narrow, today, true, defaults, DAY).max).toBe(today)
    expect(computeDefaultRange(narrow, today, false, defaults, DAY).max).toBe(today)
  })

  it('finds focused release timestamps and visible counts', function () {
    var nodes = [
      { date: '2026-09-23', releases: [{ id: 'rhoai-3.6' }] },
      { date: '2026-10-01', releases: [{ id: 'other' }, null] },
      { date: 'invalid', releases: [{ id: 'rhoai-3.6' }] }
    ]
    var timestamps = focusTimestamps(nodes, ['rhoai-3.6'])
    expect(timestamps).toHaveLength(1)
    expect(focusTimestamps(nodes, [])).toEqual([])
    expect(focusVisibleCount(nodes, { min: today, max: today + 5 * DAY })).toBe(1)
  })

  it('computes focus ranges and rejects empty or inverted ranges', function () {
    expect(computeFocusRange([], today, full, { left: 7, right: 3 }, DAY)).toBe(null)
    var result = computeFocusRange([today + 10 * DAY, today + 5 * DAY], today, full, { left: 1, right: 1 }, DAY)
    expect(result.min).toBe(today - DAY)
    expect(result.max).toBe(today + 11 * DAY)
    expect(computeFocusRange([today], today, { min: today, max: today }, { left: 1, right: 1 }, DAY)).toBe(null)
  })
})
