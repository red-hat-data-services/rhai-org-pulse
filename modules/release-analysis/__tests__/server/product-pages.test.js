import { describe, it, expect } from 'vitest'
import * as productPages from '../../server/product-pages.js'

describe('product-pages', () => {
  describe('extractGaDate', () => {
    it('extracts GA date from major_milestones with GA (not EA) in name', () => {
      const release = {
        major_milestones: [
          { name: 'RHAI 3.5 EA1', date_finish: '2026-05-01' },
          { name: 'RHAI 3.5 GA', date_finish: '2026-08-01' }
        ]
      }
      expect(productPages.extractGaDate(release)).toBe('2026-08-01')
    })

    it('ignores EA milestones when extracting GA date', () => {
      const release = {
        major_milestones: [
          { name: 'RHAI 3.5 EA1 release', date_finish: '2026-05-01' }
        ],
        ga_date: '2026-08-01'
      }
      expect(productPages.extractGaDate(release)).toBe('2026-08-01')
    })

    it('falls back to ga_date field when no GA milestone exists', () => {
      const release = {
        ga_date: '2026-08-01'
      }
      expect(productPages.extractGaDate(release)).toBe('2026-08-01')
    })

    it('returns null when no GA date can be found', () => {
      const release = {}
      expect(productPages.extractGaDate(release)).toBeNull()
    })
  })

  describe('extractCodeFreezeDate', () => {
    it('extracts code freeze date from major_milestones', () => {
      const release = {
        major_milestones: [
          { name: 'Code Freeze', date_finish: '2026-07-15' },
          { name: 'RHAI 3.5 GA', date_finish: '2026-08-01' }
        ]
      }
      expect(productPages.extractCodeFreezeDate(release)).toBe('2026-07-15')
    })

    it('prefers EA-scoped code freeze when eaTag is provided', () => {
      const release = {
        major_milestones: [
          { name: 'EA1 Code Freeze', date_finish: '2026-05-01' },
          { name: 'Code Freeze', date_finish: '2026-07-15' }
        ]
      }
      expect(productPages.extractCodeFreezeDate(release, 'EA1')).toBe('2026-05-01')
    })

    it('handles various code freeze name formats', () => {
      const release = {
        major_milestones: [
          { name: 'Code-Freeze', date_finish: '2026-07-15' }
        ]
      }
      expect(productPages.extractCodeFreezeDate(release)).toBe('2026-07-15')
    })

    it('returns null when no code freeze milestone exists', () => {
      const release = {
        major_milestones: [
          { name: 'RHAI 3.5 GA', date_finish: '2026-08-01' }
        ]
      }
      expect(productPages.extractCodeFreezeDate(release)).toBeNull()
    })
  })
})
