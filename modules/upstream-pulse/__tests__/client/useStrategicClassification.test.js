import { describe, it, expect } from 'vitest'
import {
  getEngagementStatus,
  getStrategicLabel,
  getStrategicBadgeClass,
  getStrategicDescription,
  getStrategicTier,
  matchesScope,
  TIER_CONFIG,
} from '../../client/composables/useStrategicClassification.js'

describe('useStrategicClassification', () => {
  describe('getEngagementStatus', () => {
    it('returns New Entrant when no contributions or governance', () => {
      const result = getEngagementStatus(0, 0, 0)
      expect(result.label).toBe('New Entrant')
      expect(result.classes).toContain('text-gray-600')
      expect(result.description).toBe('No contributions or governance positions yet')
    })

    it('returns Established Leader with 3+ leadership positions', () => {
      const result = getEngagementStatus(3, 0, 10)
      expect(result.label).toBe('Established Leader')
      expect(result.classes).toContain('text-blue-700')
      expect(result.description).toContain('3+ leadership positions')
    })

    it('returns Established Leader with 5+ maintainers', () => {
      const result = getEngagementStatus(0, 5, 10)
      expect(result.label).toBe('Established Leader')
      expect(result.classes).toContain('text-blue-700')
    })

    it('returns Core Contributor with any governance', () => {
      const result = getEngagementStatus(1, 0, 5)
      expect(result.label).toBe('Core Contributor')
      expect(result.classes).toContain('text-indigo-700')
      expect(result.description).toContain('leadership or maintainer positions')
    })

    it('returns Active with contributions but no governance', () => {
      const result = getEngagementStatus(0, 0, 50)
      expect(result.label).toBe('Active')
      expect(result.classes).toContain('text-gray-600')
      expect(result.description).toContain('Contributing code')
    })

    it('prioritizes high governance over contributions', () => {
      const result = getEngagementStatus(5, 0, 1000)
      expect(result.label).toBe('Established Leader')
    })

    it('returns Active when only contributions exist', () => {
      const result = getEngagementStatus(0, 0, 100)
      expect(result.label).toBe('Active')
    })
  })

  describe('getStrategicLabel', () => {
    it('returns correct label for evaluating_participation', () => {
      expect(getStrategicLabel('evaluating_participation')).toBe('Evaluating Participation')
    })

    it('returns correct label for sustaining_participation', () => {
      expect(getStrategicLabel('sustaining_participation')).toBe('Sustaining Participation')
    })

    it('returns correct label for increasing_participation', () => {
      expect(getStrategicLabel('increasing_participation')).toBe('Increasing Participation')
    })

    it('returns correct label for evaluating_leadership', () => {
      expect(getStrategicLabel('evaluating_leadership')).toBe('Evaluating Leadership')
    })

    it('returns correct label for sustaining_leadership', () => {
      expect(getStrategicLabel('sustaining_leadership')).toBe('Sustaining Leadership')
    })

    it('returns correct label for increasing_leadership', () => {
      expect(getStrategicLabel('increasing_leadership')).toBe('Increasing Leadership')
    })

    it('returns empty string for null/undefined', () => {
      expect(getStrategicLabel(null)).toBe('')
      expect(getStrategicLabel(undefined)).toBe('')
    })

    it('returns the input for unknown values', () => {
      expect(getStrategicLabel('unknown')).toBe('unknown')
    })
  })

  describe('getStrategicBadgeClass', () => {
    it('returns yellow classes for evaluating strategies', () => {
      expect(getStrategicBadgeClass('evaluating_participation')).toContain('bg-yellow-100')
      expect(getStrategicBadgeClass('evaluating_leadership')).toContain('bg-yellow-100')
    })

    it('returns blue classes for sustaining strategies', () => {
      expect(getStrategicBadgeClass('sustaining_participation')).toContain('bg-blue-100')
      expect(getStrategicBadgeClass('sustaining_leadership')).toContain('bg-blue-100')
    })

    it('returns green classes for increasing strategies', () => {
      expect(getStrategicBadgeClass('increasing_participation')).toContain('bg-green-100')
      expect(getStrategicBadgeClass('increasing_leadership')).toContain('bg-green-100')
    })

    it('returns default gray classes for unknown values', () => {
      expect(getStrategicBadgeClass('unknown')).toContain('bg-gray-100')
    })
  })

  describe('getStrategicDescription', () => {
    it('returns correct description for evaluating_participation', () => {
      const desc = getStrategicDescription('evaluating_participation')
      expect(desc).toContain('evaluating whether to increase participation')
    })

    it('returns correct description for sustaining_participation', () => {
      const desc = getStrategicDescription('sustaining_participation')
      expect(desc).toContain('sustaining current participation levels')
    })

    it('returns correct description for increasing_participation', () => {
      const desc = getStrategicDescription('increasing_participation')
      expect(desc).toContain('actively increasing participation')
    })

    it('returns correct description for evaluating_leadership', () => {
      const desc = getStrategicDescription('evaluating_leadership')
      expect(desc).toContain('evaluating whether to pursue leadership')
    })

    it('returns correct description for sustaining_leadership', () => {
      const desc = getStrategicDescription('sustaining_leadership')
      expect(desc).toContain('sustaining current leadership presence')
    })

    it('returns correct description for increasing_leadership', () => {
      const desc = getStrategicDescription('increasing_leadership')
      expect(desc).toContain('actively pursuing more leadership')
    })

    it('returns empty string for unknown values', () => {
      expect(getStrategicDescription('unknown')).toBe('')
    })
  })

  describe('TIER_CONFIG', () => {
    it('has config for all three tiers', () => {
      expect(TIER_CONFIG).toHaveProperty('increasing')
      expect(TIER_CONFIG).toHaveProperty('sustaining')
      expect(TIER_CONFIG).toHaveProperty('evaluating')
    })

    it('each tier has required class properties', () => {
      for (const tier of ['increasing', 'sustaining', 'evaluating']) {
        expect(TIER_CONFIG[tier]).toHaveProperty('label')
        expect(TIER_CONFIG[tier]).toHaveProperty('borderClass')
        expect(TIER_CONFIG[tier]).toHaveProperty('ringClass')
        expect(TIER_CONFIG[tier]).toHaveProperty('dotClass')
        expect(TIER_CONFIG[tier]).toHaveProperty('bgClass')
        expect(TIER_CONFIG[tier]).toHaveProperty('textClass')
      }
    })
  })

  describe('getStrategicTier', () => {
    it('returns increasing for increasing_participation', () => {
      expect(getStrategicTier({ strategicParticipation: 'increasing_participation' })).toBe('increasing')
    })

    it('returns increasing for increasing_leadership', () => {
      expect(getStrategicTier({ strategicLeadership: 'increasing_leadership' })).toBe('increasing')
    })

    it('returns sustaining for sustaining_participation', () => {
      expect(getStrategicTier({ strategicParticipation: 'sustaining_participation' })).toBe('sustaining')
    })

    it('returns sustaining for sustaining_leadership', () => {
      expect(getStrategicTier({ strategicLeadership: 'sustaining_leadership' })).toBe('sustaining')
    })

    it('returns evaluating for evaluating_participation', () => {
      expect(getStrategicTier({ strategicParticipation: 'evaluating_participation' })).toBe('evaluating')
    })

    it('returns evaluating for evaluating_leadership', () => {
      expect(getStrategicTier({ strategicLeadership: 'evaluating_leadership' })).toBe('evaluating')
    })

    it('returns null for org with no strategic tags', () => {
      expect(getStrategicTier({})).toBeNull()
      expect(getStrategicTier({ strategicParticipation: null, strategicLeadership: null })).toBeNull()
    })

    it('increasing takes precedence over sustaining (mixed tags)', () => {
      expect(getStrategicTier({
        strategicParticipation: 'sustaining_participation',
        strategicLeadership: 'increasing_leadership',
      })).toBe('increasing')
    })

    it('increasing takes precedence over evaluating (mixed tags)', () => {
      expect(getStrategicTier({
        strategicParticipation: 'evaluating_participation',
        strategicLeadership: 'increasing_leadership',
      })).toBe('increasing')
    })

    it('sustaining takes precedence over evaluating (mixed tags)', () => {
      expect(getStrategicTier({
        strategicParticipation: 'evaluating_participation',
        strategicLeadership: 'sustaining_leadership',
      })).toBe('sustaining')
    })
  })

  describe('matchesScope', () => {
    const increasingOrg = { strategicParticipation: 'increasing_participation' }
    const sustainingOrg = { strategicLeadership: 'sustaining_leadership' }
    const noStrategyOrg = {}

    it('returns true for strategic org with scope all', () => {
      expect(matchesScope(increasingOrg, 'all')).toBe(true)
      expect(matchesScope(sustainingOrg, 'all')).toBe(true)
    })

    it('returns false for non-strategic org with scope all', () => {
      expect(matchesScope(noStrategyOrg, 'all')).toBe(false)
    })

    it('returns true when tier matches scope', () => {
      expect(matchesScope(increasingOrg, 'increasing')).toBe(true)
      expect(matchesScope(sustainingOrg, 'sustaining')).toBe(true)
    })

    it('returns false when tier does not match scope', () => {
      expect(matchesScope(increasingOrg, 'sustaining')).toBe(false)
      expect(matchesScope(sustainingOrg, 'increasing')).toBe(false)
    })

    it('returns false for non-strategic org regardless of scope', () => {
      expect(matchesScope(noStrategyOrg, 'increasing')).toBe(false)
      expect(matchesScope(noStrategyOrg, 'sustaining')).toBe(false)
      expect(matchesScope(noStrategyOrg, 'evaluating')).toBe(false)
    })
  })
})
