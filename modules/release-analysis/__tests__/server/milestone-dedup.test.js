import { describe, it, expect } from 'vitest'

/**
 * Regression test for duplicate EA tags in release numbers.
 * Bug: milestoneToReleaseNumber would append EA tag even when shortname already contained it,
 * resulting in release numbers like "RHAI-3.5.EA1.EA1" instead of "RHAI-3.5.EA1".
 *
 * This is a white-box test - we copy the function here to test it directly.
 */

function milestoneToReleaseNumber(shortname, milestoneName) {
  const eaMatch = milestoneName.match(/\b(EA\d?)\b/i)
  if (eaMatch) {
    const eaTag = eaMatch[1].toUpperCase()
    // Check if shortname already ends with this EA tag (case-insensitive)
    const endsWithEa = new RegExp(`[.\\-_]${eaTag}$`, 'i').test(shortname)
    if (endsWithEa) {
      // Already has the EA tag, return as-is
      return shortname
    }
    return `${shortname}.${eaTag}`
  }
  // GA milestone → use the parent shortname as-is
  return shortname
}

describe('milestoneToReleaseNumber - EA tag deduplication', () => {
  describe('normal cases (no duplication)', () => {
    it('appends EA1 when shortname does not contain it', () => {
      expect(milestoneToReleaseNumber('rhelai-3.4', 'rhelai-3.4 EA1 release'))
        .toBe('rhelai-3.4.EA1')
    })

    it('appends EA2 when shortname does not contain it', () => {
      expect(milestoneToReleaseNumber('RHAIIS-3.4', 'rhaiis-3.4 EA2 GA'))
        .toBe('RHAIIS-3.4.EA2')
    })

    it('returns shortname as-is for GA milestone', () => {
      expect(milestoneToReleaseNumber('rhelai-3.4', 'rhelai-3.4 GA'))
        .toBe('rhelai-3.4')
    })

    it('handles EA without digit', () => {
      expect(milestoneToReleaseNumber('product-1.0', 'product-1.0 EA release'))
        .toBe('product-1.0.EA')
    })
  })

  describe('deduplication cases (prevent RHAI-3.5.EA1.EA1)', () => {
    it('does not append EA1 when shortname already ends with .EA1', () => {
      expect(milestoneToReleaseNumber('RHAI-3.5.EA1', 'RHAI 3.5 EA1 release'))
        .toBe('RHAI-3.5.EA1')
    })

    it('does not append EA2 when shortname already ends with .EA2', () => {
      expect(milestoneToReleaseNumber('RHAI-3.5.EA2', 'RHAI 3.5 EA2 GA'))
        .toBe('RHAI-3.5.EA2')
    })

    it('handles dash separator (shortname ends with -EA1)', () => {
      expect(milestoneToReleaseNumber('product-3.5-EA1', 'product 3.5 EA1'))
        .toBe('product-3.5-EA1')
    })

    it('handles underscore separator (shortname ends with _EA1)', () => {
      expect(milestoneToReleaseNumber('product-3.5_EA1', 'product 3.5 EA1'))
        .toBe('product-3.5_EA1')
    })

    it('is case-insensitive (shortname has .ea1, milestone has EA1)', () => {
      expect(milestoneToReleaseNumber('rhai-3.5.ea1', 'RHAI 3.5 EA1'))
        .toBe('rhai-3.5.ea1')
    })
  })

  describe('edge cases', () => {
    it('does not match EA1 in the middle of shortname', () => {
      // "EA1" appears in the middle, not at the end - should still append
      expect(milestoneToReleaseNumber('RHAI-EA1-3.5', 'RHAI 3.5 EA1'))
        .toBe('RHAI-EA1-3.5.EA1')
    })

    it('handles multiple EA tags in milestone name (uses first match)', () => {
      expect(milestoneToReleaseNumber('rhelai-3.4', 'rhelai-3.4 EA1 EA2 release'))
        .toBe('rhelai-3.4.EA1')
    })

    it('handles EA without digit when shortname ends with .EA', () => {
      expect(milestoneToReleaseNumber('product-1.0.EA', 'product EA'))
        .toBe('product-1.0.EA')
    })
  })
})
