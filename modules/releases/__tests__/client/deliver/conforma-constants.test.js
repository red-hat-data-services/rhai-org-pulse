import { describe, it, expect } from 'vitest'
import {
  normalizeTargetRelease,
  targetReleaseBadgeCls,
  targetReleaseLabel,
  extractCategory,
  policyLabel,
  policyColor,
  sortPolicyFiles,
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

  it('preserves product prefix for rhoai', () => {
    expect(normalizeTargetRelease('rhoai-3.5')).toBe('rhoai-3.5')
  })

  it('preserves product prefix for rhel-ai', () => {
    expect(normalizeTargetRelease('rhel-ai-3.4')).toBe('rhel-ai-3.4')
  })

  it('preserves product prefix for base-images', () => {
    expect(normalizeTargetRelease('base-images-3.4')).toBe('base-images-3.4')
  })

  it('strips v prefix from bare versions', () => {
    expect(normalizeTargetRelease('v3.5')).toBe('3.5')
  })

  it('returns bare version when no product prefix', () => {
    expect(normalizeTargetRelease('3.5')).toBe('3.5')
  })

  it('normalizes EA suffixes for rhoai', () => {
    expect(normalizeTargetRelease('rhoai-3.5-ea1')).toBe('rhoai-3.5.EA1')
    expect(normalizeTargetRelease('rhoai-3.5.ea2')).toBe('rhoai-3.5.EA2')
  })

  it('normalizes EA suffixes for other products', () => {
    expect(normalizeTargetRelease('rhel-ai-3.4-ea1')).toBe('rhel-ai-3.4.EA1')
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
  it('returns version without product prefix', () => {
    expect(targetReleaseLabel('rhoai-3.5')).toBe('3.5')
    expect(targetReleaseLabel('rhel-ai-3.4')).toBe('3.4')
    expect(targetReleaseLabel('base-images-3.4')).toBe('3.4')
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

describe('policyLabel', () => {
  it('returns known labels', () => {
    expect(policyLabel('fbc')).toBe('FBC')
    expect(policyLabel('registry')).toBe('Components')
  })

  it('title-cases unknown keys', () => {
    expect(policyLabel('disk-images')).toBe('Disk Images')
    expect(policyLabel('modelcars')).toBe('Modelcars')
  })
})

describe('policyColor', () => {
  it('returns color for known position', () => {
    const color = policyColor('fbc', ['fbc', 'registry'])
    expect(color.bg).toContain('59,130,246')
  })

  it('returns second color for registry', () => {
    const color = policyColor('registry', ['fbc', 'registry'])
    expect(color.bg).toContain('16,185,129')
  })

  it('returns first color for unknown single-key list', () => {
    const color = policyColor('registry', ['registry'])
    expect(color.bg).toContain('59,130,246')
  })
})

describe('sortPolicyFiles', () => {
  it('puts fbc first, registry second', () => {
    expect(sortPolicyFiles(['registry', 'fbc'])).toEqual(['fbc', 'registry'])
  })

  it('sorts unknown keys alphabetically after known ones', () => {
    expect(sortPolicyFiles(['zeta', 'registry', 'alpha', 'fbc']))
      .toEqual(['fbc', 'registry', 'alpha', 'zeta'])
  })

  it('handles lists without known keys', () => {
    expect(sortPolicyFiles(['beta', 'alpha'])).toEqual(['alpha', 'beta'])
  })
})
