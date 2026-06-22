import { describe, it, expect } from 'vitest'
import {
  normalizeTargetRelease,
  targetReleaseBadgeCls,
  targetReleaseLabel,
  extractCategory,
  PERMANENT_TARGET
} from '../../../client/deliver/constants/conforma.js'

describe('normalizeTargetRelease', () => {
  it('returns null for falsy input', () => {
    expect(normalizeTargetRelease(null)).toBe(null)
    expect(normalizeTargetRelease('')).toBe(null)
    expect(normalizeTargetRelease('   ')).toBe(null)
  })

  it('normalizes "permanent" variants', () => {
    expect(normalizeTargetRelease('permanent')).toBe(PERMANENT_TARGET)
    expect(normalizeTargetRelease('Permanent')).toBe(PERMANENT_TARGET)
    expect(normalizeTargetRelease('PERMANENT')).toBe(PERMANENT_TARGET)
  })

  it('strips rhoai- prefix and re-adds it', () => {
    expect(normalizeTargetRelease('rhoai-3.5')).toBe('rhoai-3.5')
    expect(normalizeTargetRelease('3.5')).toBe('rhoai-3.5')
  })

  it('strips v prefix', () => {
    expect(normalizeTargetRelease('v3.5')).toBe('rhoai-3.5')
  })

  it('normalizes EA suffixes to .EA format', () => {
    expect(normalizeTargetRelease('rhoai-3.5-ea1')).toBe('rhoai-3.5.EA1')
    expect(normalizeTargetRelease('3.5-EA1')).toBe('rhoai-3.5.EA1')
    expect(normalizeTargetRelease('3.5.ea2')).toBe('rhoai-3.5.EA2')
    expect(normalizeTargetRelease('rhoai-3.5 ea 3')).toBe('rhoai-3.5.EA3')
  })
})

describe('targetReleaseBadgeCls', () => {
  it('returns empty string for falsy', () => {
    expect(targetReleaseBadgeCls(null)).toBe('')
    expect(targetReleaseBadgeCls('')).toBe('')
  })

  it('returns slate for permanent', () => {
    expect(targetReleaseBadgeCls(PERMANENT_TARGET)).toContain('bg-slate')
  })

  it('returns emerald for EA releases (both -ea and .EA forms)', () => {
    expect(targetReleaseBadgeCls('rhoai-3.5-ea1')).toContain('bg-emerald')
    expect(targetReleaseBadgeCls('rhoai-3.5.EA1')).toContain('bg-emerald')
  })

  it('returns blue for regular releases', () => {
    expect(targetReleaseBadgeCls('rhoai-3.5')).toContain('bg-blue')
  })
})

describe('targetReleaseLabel', () => {
  it('strips rhoai- prefix', () => {
    expect(targetReleaseLabel('rhoai-3.5')).toBe('3.5')
  })

  it('returns Permanent for permanent target', () => {
    expect(targetReleaseLabel(PERMANENT_TARGET)).toBe('Permanent')
  })
})

describe('extractCategory', () => {
  it('returns other for falsy', () => {
    expect(extractCategory(null)).toBe('other')
    expect(extractCategory('')).toBe('other')
  })

  it('detects fips by keyword', () => {
    expect(extractCategory('some.fips.check')).toBe('fips')
  })

  it('detects categories by prefix', () => {
    expect(extractCategory('hermetic_task.something')).toBe('hermetic_task')
    expect(extractCategory('test.something')).toBe('test')
    expect(extractCategory('cve.something')).toBe('cve')
  })

  it('returns other for unknown prefix', () => {
    expect(extractCategory('unknown.rule')).toBe('other')
  })
})
