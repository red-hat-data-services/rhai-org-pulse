import { describe, it, expect } from 'vitest'
import { passesPhaseFilter } from '../../client/utils/phase-filter'

describe('passesPhaseFilter', function() {
  it('returns true for all features when no phase is specified', function() {
    var feature = { fixVersion: 'rhoai-3.5-EA1, rhoai-3.5' }
    expect(passesPhaseFilter(feature, '3.5', null)).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', '')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', undefined)).toBe(true)
  })

  it('returns true when feature has matching phase fixVersion', function() {
    var feature = { fixVersion: 'rhoai-3.5-EA1' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
  })

  it('returns false when feature has phase fixVersion but different phase', function() {
    var feature = { fixVersion: 'rhoai-3.5-EA1' }
    expect(passesPhaseFilter(feature, '3.5', 'EA2')).toBe(false)
    expect(passesPhaseFilter(feature, '3.5', 'GA')).toBe(false)
  })

  it('returns true when feature has no phase-specific fixVersions', function() {
    var feature = { fixVersion: 'rhoai-3.5' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA2')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'GA')).toBe(true)
  })

  it('returns true when feature has empty fixVersion', function() {
    var feature = { fixVersion: '' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
  })

  it('returns true when feature has no fixVersion property', function() {
    var feature = {}
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
  })

  it('handles multiple comma-separated fixVersions', function() {
    var feature = { fixVersion: 'rhoai-3.5-EA1, rhoai-3.5-EA2' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA2')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'GA')).toBe(false)
  })

  it('is case insensitive for phase matching', function() {
    var feature = { fixVersion: 'rhoai-3.5-ea1' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'ea1')).toBe(true)
  })

  it('handles fixVersion with GA phase', function() {
    var feature = { fixVersion: 'rhoai-3.5-GA' }
    expect(passesPhaseFilter(feature, '3.5', 'GA')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(false)
  })

  it('handles mixed phase-specific and non-phase fixVersions', function() {
    var feature = { fixVersion: 'rhoai-3.5, rhoai-3.5-EA2' }
    // Has phase-specific, so it should only match EA2
    expect(passesPhaseFilter(feature, '3.5', 'EA2')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(false)
  })

  it('handles fixVersions without spaces after commas', function() {
    var feature = { fixVersion: 'rhoai-3.5-EA1,rhoai-3.5-EA2' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA2')).toBe(true)
  })
})
