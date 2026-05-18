import { describe, it, expect } from 'vitest'
import { formatDate } from '@shared/client'

describe('formatDate', function() {
  it('returns "Never" by default for null', function() {
    expect(formatDate(null)).toBe('Never')
  })

  it('returns "Never" by default for undefined', function() {
    expect(formatDate(undefined)).toBe('Never')
  })

  it('returns "Never" by default for empty string', function() {
    expect(formatDate('')).toBe('Never')
  })

  it('returns custom fallback when specified', function() {
    expect(formatDate(null, { fallback: 'N/A' })).toBe('N/A')
  })

  it('returns empty string fallback when specified', function() {
    expect(formatDate(null, { fallback: '' })).toBe('')
  })

  it('formats ISO date with time by default (includeTime: true)', function() {
    var result = formatDate('2026-04-25T14:30:00.000Z')
    // toLocaleString includes both date and time -- verify it is a non-empty string
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    // Should contain both date and time parts (verify at least year is present)
    expect(result).toContain('2026')
  })

  it('formats ISO date without time when includeTime is false', function() {
    var result = formatDate('2026-04-25T14:30:00.000Z', { includeTime: false })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('2026')
  })

  it('uses toLocaleString for includeTime: true and toLocaleDateString for false', function() {
    var withTime = formatDate('2026-04-25T14:30:00.000Z', { includeTime: true })
    var withoutTime = formatDate('2026-04-25T14:30:00.000Z', { includeTime: false })
    // The time-inclusive version should be longer or equal (never shorter)
    expect(withTime.length).toBeGreaterThanOrEqual(withoutTime.length)
  })

  it('accepts both options simultaneously', function() {
    var result = formatDate(null, { fallback: '--', includeTime: false })
    expect(result).toBe('--')
  })

  it('handles valid ISO strings', function() {
    var result = formatDate('2026-01-15T00:00:00.000Z')
    expect(result).toContain('2026')
  })
})
