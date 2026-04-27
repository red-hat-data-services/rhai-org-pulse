import { describe, it, expect } from 'vitest'
import { passesPhaseFilter } from '../../client/utils/phase-filter'

describe('passesPhaseFilter', function() {
  it('returns true for all features when no phase is specified', function() {
    var feature = { fixVersions: 'rhoai-3.5.EA1, rhoai-3.5' }
    expect(passesPhaseFilter(feature, '3.5', null)).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', '')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', undefined)).toBe(true)
  })

  it('returns true when fixVersions contains matching version and phase', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.EA1' }, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter({ fixVersions: 'rhaiis-3.5.EA1' }, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5-EA2' }, '3.5', 'EA2')).toBe(true)
    expect(passesPhaseFilter({ fixVersions: 'RHOAI-3.5 GA' }, '3.5', 'GA')).toBe(true)
    expect(passesPhaseFilter({ fixVersions: 'RHAIIS-3.5EA1' }, '3.5', 'EA1')).toBe(true)
  })

  it('returns false when fixVersions has phase but wrong phase', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.EA1' }, '3.5', 'EA2')).toBe(false)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.EA1' }, '3.5', 'GA')).toBe(false)
  })

  it('returns false when fixVersions has no phase-specific version', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5' }, '3.5', 'EA1')).toBe(false)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5' }, '3.5', 'EA2')).toBe(false)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5' }, '3.5', 'GA')).toBe(false)
  })

  it('returns false when fixVersions is empty', function() {
    expect(passesPhaseFilter({ fixVersions: '' }, '3.5', 'EA1')).toBe(false)
  })

  it('returns false when fixVersions property is missing', function() {
    expect(passesPhaseFilter({}, '3.5', 'EA1')).toBe(false)
  })

  it('handles multiple comma-separated fixVersions', function() {
    var feature = { fixVersions: 'rhoai-3.5.EA1, rhoai-3.5.EA2' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA2')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'GA')).toBe(false)
  })

  it('is case insensitive', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.ea1' }, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter({ fixVersions: 'RHOAI-3.5.EA1' }, '3.5', 'ea1')).toBe(true)
  })

  it('does not match wrong version', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.4.EA1' }, '3.5', 'EA1')).toBe(false)
  })

  it('falls back to fixVersion field when fixVersions is absent', function() {
    expect(passesPhaseFilter({ fixVersion: 'rhoai-3.5.EA1' }, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter({ fixVersion: 'rhoai-3.5' }, '3.5', 'EA1')).toBe(false)
  })

  it('handles fixVersions without spaces after commas', function() {
    var feature = { fixVersions: 'rhoai-3.5.EA1,rhoai-3.5.EA2' }
    expect(passesPhaseFilter(feature, '3.5', 'EA1')).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA2')).toBe(true)
  })

  // strict=true is the default, tested above. Tests below cover strict=false (inclusive mode).

  it('inclusive: passes features with no phase-specific fix version', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5' }, '3.5', 'EA2', false)).toBe(true)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5' }, '3.5', 'GA', false)).toBe(true)
  })

  it('inclusive: passes features with matching phase fix version', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.EA2' }, '3.5', 'EA2', false)).toBe(true)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.GA' }, '3.5', 'GA', false)).toBe(true)
  })

  it('inclusive: excludes features tagged for a different phase', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.EA1' }, '3.5', 'EA2', false)).toBe(false)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.EA1' }, '3.5', 'GA', false)).toBe(false)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5.GA' }, '3.5', 'EA2', false)).toBe(false)
  })

  it('inclusive: passes when one fix version has no phase and another has a different phase', function() {
    var feature = { fixVersions: 'rhoai-3.5, rhoai-3.5.EA1' }
    expect(passesPhaseFilter(feature, '3.5', 'EA2', false)).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'GA', false)).toBe(true)
    expect(passesPhaseFilter(feature, '3.5', 'EA1', false)).toBe(true)
  })

  it('inclusive: excludes when all fix versions are for a different phase', function() {
    var feature = { fixVersions: 'rhoai-3.5.EA1, rhaiis-3.5.EA1' }
    expect(passesPhaseFilter(feature, '3.5', 'EA2', false)).toBe(false)
    expect(passesPhaseFilter(feature, '3.5', 'GA', false)).toBe(false)
  })

  it('inclusive: strict=true still rejects unphased fix versions', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5' }, '3.5', 'EA2', true)).toBe(false)
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.5' }, '3.5', 'GA', true)).toBe(false)
  })

  it('inclusive: returns false when fixVersions is empty', function() {
    expect(passesPhaseFilter({ fixVersions: '' }, '3.5', 'EA2', false)).toBe(false)
    expect(passesPhaseFilter({}, '3.5', 'EA2', false)).toBe(false)
  })

  it('inclusive: wrong version does not match', function() {
    expect(passesPhaseFilter({ fixVersions: 'rhoai-3.4' }, '3.5', 'EA2', false)).toBe(false)
  })
})
