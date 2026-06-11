import { describe, it, expect } from 'vitest'

import { avgPerRelease } from '../../../client/plan/utils/summary-stats'

describe('avgPerRelease', function () {
  it('returns dash when releaseCount is zero', function () {
    expect(avgPerRelease(10, 0)).toBe('—')
  })

  it('returns dash when releaseCount is negative', function () {
    expect(avgPerRelease(5, -1)).toBe('—')
  })

  it('returns dash when releaseCount is null', function () {
    expect(avgPerRelease(5, null)).toBe('—')
  })

  it('returns dash when releaseCount is undefined', function () {
    expect(avgPerRelease(5, undefined)).toBe('—')
  })

  it('returns whole number without decimal when evenly divisible', function () {
    expect(avgPerRelease(10, 2)).toBe('5')
  })

  it('rounds to one decimal place', function () {
    expect(avgPerRelease(10, 3)).toBe('3.3')
  })

  it('handles single release (identity)', function () {
    expect(avgPerRelease(7, 1)).toBe('7')
  })

  it('returns zero string when totalRequested is zero', function () {
    expect(avgPerRelease(0, 3)).toBe('0')
  })

  it('handles large numbers', function () {
    expect(avgPerRelease(1000, 7)).toBe('142.9')
  })
})
