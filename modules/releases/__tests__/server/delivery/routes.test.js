import { describe, it, expect } from 'vitest'
import { filterMajorReleasesFrom34 } from '../../../server/delivery/routes.js'

describe('filterMajorReleasesFrom34 - version and z-stream filtering', () => {
  describe('includes 3.5+ major releases', () => {
    it('includes 3.5 GA releases', () => {
      const releases = [
        { releaseNumber: 'rhoai-3.5' },
        { releaseNumber: 'rhelai-3.5' },
        { releaseNumber: 'rhaiis-3.5' },
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(3)
    })

    it('includes 3.5 EA releases', () => {
      const releases = [
        { releaseNumber: 'rhoai-3.5.EA1' },
        { releaseNumber: 'rhoai-3.5.EA2' },
        { releaseNumber: 'rhelai-3.5.EA1' },
        { releaseNumber: 'rhelai-3.5.EA2' },
        { releaseNumber: 'rhaiis-3.5.EA1' },
        { releaseNumber: 'rhaiis-3.5.EA2' },
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(6)
    })

    it('includes 3.5, 3.6, and future releases', () => {
      const releases = [
        { releaseNumber: 'rhoai-3.4' },      // Exclude (too old)
        { releaseNumber: 'rhoai-3.5' },
        { releaseNumber: 'rhoai-3.6' },
        { releaseNumber: 'rhoai-3.7' },      // Include (future version)
        { releaseNumber: 'rhoai-3.8.EA1' },  // Include (future version)
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(4)
      expect(result.map(r => r.releaseNumber)).toEqual(['rhoai-3.5', 'rhoai-3.6', 'rhoai-3.7', 'rhoai-3.8.EA1'])
    })
  })

  describe('filters out pre-3.5 releases', () => {
    it('includes 3.5+, excludes 3.4 and earlier', () => {
      const releases = [
        { releaseNumber: 'rhoai-2.16' },  // Exclude (too old)
        { releaseNumber: 'rhoai-3.0' },   // Exclude (too old)
        { releaseNumber: 'rhoai-3.3' },   // Exclude (too old)
        { releaseNumber: 'rhoai-3.4' },   // Exclude (too old)
        { releaseNumber: 'rhoai-3.4.EA1' },  // Exclude (too old)
        { releaseNumber: 'rhoai-3.5' },   // Include
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(1)
      expect(result[0].releaseNumber).toBe('rhoai-3.5')
    })

    it('excludes version 1.x, 2.x, and 3.0-3.4', () => {
      const releases = [
        { releaseNumber: 'rhoai-1.0' },
        { releaseNumber: 'rhoai-2.0' },
        { releaseNumber: 'rhoai-2.16' },
        { releaseNumber: 'rhoai-3.0' },
        { releaseNumber: 'rhoai-3.3' },
        { releaseNumber: 'rhoai-3.4' },
        { releaseNumber: 'rhoai-3.5' },
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(1)
      expect(result[0].releaseNumber).toBe('rhoai-3.5')
    })
  })

  describe('filters out z-stream/patch releases', () => {
    it('excludes z-stream releases (3.5.1, 3.5.2) but includes major versions (3.5, 3.6)', () => {
      const releases = [
        { releaseNumber: 'rhoai-3.4' },    // exclude (too old)
        { releaseNumber: 'rhoai-3.5' },    // include
        { releaseNumber: 'rhoai-3.5.1' },  // z-stream - exclude
        { releaseNumber: 'rhoai-3.5.2' },  // z-stream - exclude
        { releaseNumber: 'rhoai-3.6' },    // include
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.releaseNumber)).toEqual(['rhoai-3.5', 'rhoai-3.6'])
    })

    it('excludes patch releases but keeps EA releases', () => {
      const releases = [
        { releaseNumber: 'rhoai-3.5.EA1' },  // Keep
        { releaseNumber: 'rhoai-3.5' },      // Keep
        { releaseNumber: 'rhoai-3.5.1' },    // Exclude (z-stream)
        { releaseNumber: 'rhoai-3.5.EA2' },  // Keep
        { releaseNumber: 'rhoai-3.5.2' },    // Exclude (z-stream)
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(3)
      expect(result.map(r => r.releaseNumber)).toEqual([
        'rhoai-3.5.EA1',
        'rhoai-3.5',
        'rhoai-3.5.EA2',
      ])
    })

    it('excludes multi-digit z-stream releases (3.5.10, 3.5.11)', () => {
      const releases = [
        { releaseNumber: 'rhoai-3.5' },
        { releaseNumber: 'rhoai-3.5.10' },   // z-stream
        { releaseNumber: 'rhoai-3.5.11' },   // z-stream
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(1)
      expect(result[0].releaseNumber).toBe('rhoai-3.5')
    })
  })

  describe('handles all three RHAI products', () => {
    it('filters all three products consistently', () => {
      const releases = [
        // 3.5 releases - should all pass
        { releaseNumber: 'rhoai-3.5.EA1' },
        { releaseNumber: 'rhelai-3.5.EA1' },
        { releaseNumber: 'rhaiis-3.5.EA1' },
        // 3.4 releases - should all be filtered out (pre-3.5)
        { releaseNumber: 'rhoai-3.4' },
        { releaseNumber: 'rhelai-3.4' },
        { releaseNumber: 'rhaiis-3.4' },
        // Z-streams - should all be filtered out
        { releaseNumber: 'rhoai-3.5.1' },
        { releaseNumber: 'rhelai-3.5.1' },
        { releaseNumber: 'rhaiis-3.5.1' },
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(3) // 3 × 3.5.EA1 only

      // Verify all are 3.5.EA1
      expect(result.every(r => r.releaseNumber.includes('3.5.EA1'))).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('handles both version-only and product-version formats', () => {
      const releases = [
        { releaseNumber: '3.0' },           // version-only format (excluded - too old)
        { releaseNumber: '3.4' },           // version-only format (excluded - too old)
        { releaseNumber: '3.5.EA1' },       // version-only with EA
        { releaseNumber: 'rhoai-3.5' },     // product-version format
        { releaseNumber: 'rhelai-3.5.EA2' }, // product-version with EA
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(3) // 3.0 and 3.4 excluded
    })

    it('handles missing releaseNumber field', () => {
      const releases = [
        { releaseNumber: null },
        { releaseNumber: '' },
        { releaseNumber: undefined },
        { releaseNumber: 'rhoai-3.5' },
        { releaseNumber: '3.5' },  // version-only format
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(2)
    })

    it('handles malformed release numbers', () => {
      const releases = [
        { releaseNumber: 'invalid' },
        { releaseNumber: 'rhoai' },
        { releaseNumber: '3.4' },          // valid format but excluded (too old)
        { releaseNumber: '3.5' },          // valid version-only format
        { releaseNumber: 'rhoai-3.5' },    // valid product-version format
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(2) // Both 3.5 and rhoai-3.5 are valid
      expect(result.map(r => r.releaseNumber)).toEqual(['3.5', 'rhoai-3.5'])
    })

    it('handles case-insensitive product names', () => {
      const releases = [
        { releaseNumber: 'RHOAI-3.5' },
        { releaseNumber: 'rhoai-3.5' },
        { releaseNumber: 'RhOaI-3.5' },
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(3)
    })

    it('handles EA without digit (EA vs EA1)', () => {
      const releases = [
        { releaseNumber: 'rhoai-3.5.EA' },
        { releaseNumber: 'rhoai-3.5.EA1' },
        { releaseNumber: 'rhoai-3.5.EA2' },
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(3)
    })
  })

  describe('comprehensive scenario - 3.5+ releases', () => {
    it('includes 3.5+ major releases, excludes 3.4 and earlier', () => {
      const releases = [
        // 3.5 releases (9 total)
        { releaseNumber: 'rhoai-3.5.EA1' },
        { releaseNumber: 'rhoai-3.5.EA2' },
        { releaseNumber: 'rhoai-3.5' },
        { releaseNumber: 'rhelai-3.5.EA1' },
        { releaseNumber: 'rhelai-3.5.EA2' },
        { releaseNumber: 'rhelai-3.5' },
        { releaseNumber: 'rhaiis-3.5.EA1' },
        { releaseNumber: 'rhaiis-3.5.EA2' },
        { releaseNumber: 'rhaiis-3.5' },
        // 3.6 releases (9 total)
        { releaseNumber: 'rhoai-3.6.EA1' },
        { releaseNumber: 'rhoai-3.6.EA2' },
        { releaseNumber: 'rhoai-3.6' },
        { releaseNumber: 'rhelai-3.6.EA1' },
        { releaseNumber: 'rhelai-3.6.EA2' },
        { releaseNumber: 'rhelai-3.6' },
        { releaseNumber: 'rhaiis-3.6.EA1' },
        { releaseNumber: 'rhaiis-3.6.EA2' },
        { releaseNumber: 'rhaiis-3.6' },
        // 3.7 releases (9 total) - should be included
        { releaseNumber: 'rhoai-3.7.EA1' },
        { releaseNumber: 'rhoai-3.7.EA2' },
        { releaseNumber: 'rhoai-3.7' },
        { releaseNumber: 'rhelai-3.7.EA1' },
        { releaseNumber: 'rhelai-3.7.EA2' },
        { releaseNumber: 'rhelai-3.7' },
        { releaseNumber: 'rhaiis-3.7.EA1' },
        { releaseNumber: 'rhaiis-3.7.EA2' },
        { releaseNumber: 'rhaiis-3.7' },
        // Noise - should be filtered out
        { releaseNumber: 'rhoai-2.16' },     // too old
        { releaseNumber: 'rhoai-3.3' },      // too old
        { releaseNumber: 'rhoai-3.4' },      // too old
        { releaseNumber: 'rhoai-3.5.1' },    // z-stream
      ]
      const result = filterMajorReleasesFrom34(releases)
      expect(result).toHaveLength(27) // 9 releases × 3 versions (3.5, 3.6, 3.7)

      // Verify all three products are present
      const products = new Set(result.map(r => r.releaseNumber.split('-')[0]))
      expect(products).toEqual(new Set(['rhoai', 'rhelai', 'rhaiis']))

      // Verify all versions 3.5-3.7 are present
      const versions = new Set(result.map(r => {
        const match = r.releaseNumber.match(/-(\d+\.\d+)/)
        return match ? match[1] : null
      }))
      expect(versions).toEqual(new Set(['3.5', '3.6', '3.7']))
    })
  })
})
