import { describe, it, expect } from 'vitest'
import { extractFeatureFreezeDate } from '../../../server/delivery/product-pages.js'

describe('extractFeatureFreezeDate', () => {
  it('extracts feature freeze date from major_milestones', () => {
    const release = {
      major_milestones: [
        { name: 'Feature Freeze', date_finish: '2026-05-15' },
        { name: 'RHAI 3.5 GA', date_finish: '2026-08-01' }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBe('2026-05-15')
  })

  it('prefers EA-scoped feature freeze when eaTag is provided', () => {
    const release = {
      major_milestones: [
        { name: 'EA1 Feature Freeze', date_finish: '2026-04-15' },
        { name: 'Feature Freeze', date_finish: '2026-07-01' }
      ]
    }
    expect(extractFeatureFreezeDate(release, 'EA1')).toBe('2026-04-15')
  })

  it('falls back to generic feature freeze when eaTag does not match', () => {
    const release = {
      major_milestones: [
        { name: 'Feature Freeze', date_finish: '2026-07-01' }
      ]
    }
    expect(extractFeatureFreezeDate(release, 'EA2')).toBe('2026-07-01')
  })

  it('handles "Feature-Freeze" hyphenated name', () => {
    const release = {
      major_milestones: [
        { name: 'Feature-Freeze', date_finish: '2026-05-15' }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBe('2026-05-15')
  })

  it('handles "Feature_Freeze" underscore name', () => {
    const release = {
      major_milestones: [
        { name: 'Feature_Freeze', date_finish: '2026-05-15' }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBe('2026-05-15')
  })

  it('handles "feature freeze" lowercase', () => {
    const release = {
      major_milestones: [
        { name: 'feature freeze', date_finish: '2026-05-15' }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBe('2026-05-15')
  })

  it('skips draft milestones', () => {
    const release = {
      major_milestones: [
        { name: 'Feature Freeze', date_finish: '2026-05-15', draft: true }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBeNull()
  })

  it('falls back to all_ga_tasks when no milestone matches', () => {
    const release = {
      major_milestones: [],
      all_ga_tasks: [
        { name: 'Feature Freeze', date_finish: '2026-05-20' }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBe('2026-05-20')
  })

  it('prefers EA-scoped task when eaTag is provided', () => {
    const release = {
      major_milestones: [],
      all_ga_tasks: [
        { name: 'EA1 Feature Freeze', date_finish: '2026-04-10' },
        { name: 'Feature Freeze', date_finish: '2026-06-01' }
      ]
    }
    expect(extractFeatureFreezeDate(release, 'EA1')).toBe('2026-04-10')
  })

  it('returns null when no feature freeze exists', () => {
    const release = {
      major_milestones: [
        { name: 'Code Freeze', date_finish: '2026-07-15' },
        { name: 'RHAI 3.5 GA', date_finish: '2026-08-01' }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBeNull()
  })

  it('returns null for empty release', () => {
    expect(extractFeatureFreezeDate({})).toBeNull()
  })

  it('does not match code freeze', () => {
    const release = {
      major_milestones: [
        { name: 'Code Freeze', date_finish: '2026-07-15' }
      ]
    }
    expect(extractFeatureFreezeDate(release)).toBeNull()
  })
})
