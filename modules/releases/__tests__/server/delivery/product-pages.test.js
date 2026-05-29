import { describe, it, expect } from 'vitest'
import * as productPages from '../../../server/delivery/product-pages.js'

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

  describe('extractReleaseDueDate', () => {
    it('extracts EA1 date from milestones for an EA-specific release', () => {
      const release = {
        shortname: 'rhoai-3.5.EA1',
        major_milestones: [
          { name: 'rhoai-3.5 EA1 release', date_finish: '2026-06-17' },
          { name: 'rhoai-3.5 GA', date_finish: '2026-08-20' }
        ]
      }
      expect(productPages.extractReleaseDueDate(release)).toBe('2026-06-17')
    })

    it('extracts EA2 date from milestones for an EA2-specific release', () => {
      const release = {
        shortname: 'rhoai-3.5.EA2',
        major_milestones: [
          { name: 'rhoai-3.5 EA1 release', date_finish: '2026-06-17' },
          { name: 'rhoai-3.5 EA2 release', date_finish: '2026-07-16' },
          { name: 'rhoai-3.5 GA', date_finish: '2026-08-20' }
        ]
      }
      expect(productPages.extractReleaseDueDate(release)).toBe('2026-07-16')
    })

    it('falls back to ga_date for EA releases with no matching milestone', () => {
      const release = {
        shortname: 'rhoai-3.5.EA1',
        major_milestones: [],
        ga_date: '2026-06-17'
      }
      expect(productPages.extractReleaseDueDate(release)).toBe('2026-06-17')
    })

    it('skips draft milestones for EA releases', () => {
      const release = {
        shortname: 'rhoai-3.5.EA1',
        major_milestones: [
          { name: 'rhoai-3.5 EA1 release', date_finish: '2026-06-17', draft: true }
        ],
        ga_date: '2026-06-20'
      }
      expect(productPages.extractReleaseDueDate(release)).toBe('2026-06-20')
    })

    it('falls back to all_ga_tasks when no milestone matches for EA release', () => {
      const release = {
        shortname: 'rhoai-3.5.EA1',
        major_milestones: [],
        all_ga_tasks: [
          { name: 'EA1 target', date_finish: '2026-06-17' }
        ]
      }
      expect(productPages.extractReleaseDueDate(release)).toBe('2026-06-17')
    })

    it('delegates to extractGaDate for GA releases (no EA in shortname)', () => {
      const release = {
        shortname: 'rhoai-3.5',
        major_milestones: [
          { name: 'rhoai-3.5 GA', date_finish: '2026-08-20' }
        ]
      }
      expect(productPages.extractReleaseDueDate(release)).toBe('2026-08-20')
    })

    it('returns null when no date can be found for GA release', () => {
      const release = { shortname: 'rhoai-3.5' }
      expect(productPages.extractReleaseDueDate(release)).toBeNull()
    })
  })

  describe('expandReleaseMilestones', () => {
    it('expands EA + GA milestones into separate entries (rhelai style)', () => {
      const release = {
        shortname: 'rhelai-3.5',
        major_milestones: [
          { name: 'rhelai-3.5 EA1 release', date_finish: '2026-06-18' },
          { name: 'rhelai-3.5 EA2 release', date_finish: '2026-07-16' },
          { name: 'rhelai-3.5 GA', date_finish: '2026-08-20' }
        ]
      }
      const result = productPages.expandReleaseMilestones(release, 'RHELAI')
      expect(result).toHaveLength(3)
      expect(result.map(r => r.releaseNumber)).toEqual([
        'rhelai-3.5.EA1', 'rhelai-3.5.EA2', 'rhelai-3.5'
      ])
    })

    it('expands "GA Release" milestone names (RHAII style)', () => {
      const release = {
        shortname: 'RHAII-3.5',
        major_milestones: [
          { name: 'RHAI-3.5 EA1 Release', date_finish: '2026-06-17' },
          { name: 'RHAI-3.5 EA2 Release', date_finish: '2026-07-16' },
          { name: 'RHAI-3.5 GA Release', date_finish: '2026-08-20' }
        ]
      }
      const result = productPages.expandReleaseMilestones(release, 'RHAII')
      expect(result).toHaveLength(3)
      const ga = result.find(r => r.releaseNumber === 'RHAII-3.5')
      expect(ga).toBeTruthy()
      expect(ga.dueDate).toBe('2026-08-20')
    })

    it('excludes noise milestones that happen to mention GA', () => {
      const release = {
        shortname: 'RHAII-3.5',
        major_milestones: [
          { name: 'RHAI-3.5 EA1 Release', date_finish: '2026-06-17' },
          { name: 'rpms release 1 month before the 3.5 GA', date_finish: '2026-07-20' },
          { name: 'RHAII-3.5 GA final RC available', date_finish: '2026-08-06' },
          { name: 'RHAI-3.5 GA Release', date_finish: '2026-08-20' }
        ]
      }
      const result = productPages.expandReleaseMilestones(release, 'RHAII')
      const releaseNumbers = result.map(r => r.releaseNumber)
      expect(releaseNumbers).toContain('RHAII-3.5.EA1')
      expect(releaseNumbers).toContain('RHAII-3.5')
      expect(releaseNumbers).not.toContain('RHAII-3.5.GA')
    })

    it('skips draft milestones', () => {
      const release = {
        shortname: 'rhelai-3.5',
        major_milestones: [
          { name: 'rhelai-3.5 EA1 release', date_finish: '2026-06-18' },
          { name: 'rhelai-3.5 GA', date_finish: '2026-08-20', draft: true }
        ]
      }
      const result = productPages.expandReleaseMilestones(release, 'RHELAI')
      expect(result).toBeNull()
    })

    it('returns null when only one milestone exists', () => {
      const release = {
        shortname: 'rhelai-3.5',
        major_milestones: [
          { name: 'rhelai-3.5 GA', date_finish: '2026-08-20' }
        ]
      }
      expect(productPages.expandReleaseMilestones(release, 'RHELAI')).toBeNull()
    })

    it('returns null when no milestones match EA/GA pattern', () => {
      const release = {
        shortname: 'rhelai-3.5',
        major_milestones: [
          { name: 'Code Freeze', date_finish: '2026-07-15' }
        ]
      }
      expect(productPages.expandReleaseMilestones(release, 'RHELAI')).toBeNull()
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
