import { describe, it, expect } from 'vitest'

const { deriveReleasePhaseMode } = require('../../../server/planning/health/health-pipeline')

describe('deriveReleasePhaseMode', function() {
  it('returns planning for Pre-EA1', function() {
    expect(deriveReleasePhaseMode('Pre-EA1')).toBe('planning')
  })

  it('returns planning for EA1 Freeze', function() {
    expect(deriveReleasePhaseMode('EA1 Freeze')).toBe('planning')
  })

  it('returns planning for Post-EA1', function() {
    expect(deriveReleasePhaseMode('Post-EA1')).toBe('planning')
  })

  it('returns planning for EA2 Freeze', function() {
    expect(deriveReleasePhaseMode('EA2 Freeze')).toBe('planning')
  })

  it('returns planning for Post-EA2', function() {
    expect(deriveReleasePhaseMode('Post-EA2')).toBe('planning')
  })

  it('returns execution for GA Freeze', function() {
    expect(deriveReleasePhaseMode('GA Freeze')).toBe('execution')
  })

  it('returns execution for Post-GA', function() {
    expect(deriveReleasePhaseMode('Post-GA')).toBe('execution')
  })

  it('returns unknown for Unknown', function() {
    expect(deriveReleasePhaseMode('Unknown')).toBe('unknown')
  })

  it('returns unknown for null', function() {
    expect(deriveReleasePhaseMode(null)).toBe('unknown')
  })

  it('returns unknown for undefined', function() {
    expect(deriveReleasePhaseMode(undefined)).toBe('unknown')
  })

  it('returns unknown for empty string', function() {
    expect(deriveReleasePhaseMode('')).toBe('unknown')
  })
})
