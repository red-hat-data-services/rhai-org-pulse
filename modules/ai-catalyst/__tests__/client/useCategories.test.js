import { describe, it, expect } from 'vitest'
import { useCategories } from '../../client/composables/useCategories.js'

describe('useCategories', () => {
  it('uses the server color for known data science pillars', () => {
    const { normalizePillar } = useCategories()

    expect(normalizePillar({ pillarKey: 'data-science-engineering' }).color).toBe('#06b6d4')
  })

  it('uses unsigned server-compatible hashing for unknown pillars', () => {
    const { getCategoryMeta } = useCategories()

    // JavaScript's signed 32-bit hash for this key is negative. The server
    // converts it to unsigned before selecting its deterministic palette slot.
    expect(getCategoryMeta('future-pillar').color).toBe('#22c55e')
  })

  it('registers showcase strategy pillar keys from candidate-like entries', () => {
    const { getPillarRegistry } = useCategories()

    expect(getPillarRegistry([], [{ strategyPillarKey: 'data-science-engineering' }]))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ pillarKey: 'data-science-engineering', color: '#06b6d4' })
      ]))
  })

  it('does not read "Disapprove" or "Not approved" as approved', () => {
    const { getDecisionStatus } = useCategories()

    expect(getDecisionStatus({ pmDecision: 'Approve' })).toBe('approved')
    expect(getDecisionStatus({ pmDecision: 'Approved' })).toBe('approved')
    expect(getDecisionStatus({ pmDecision: 'Disapprove' })).toBe('declined')
    expect(getDecisionStatus({ pmDecision: 'Not approved' })).toBe('declined')
    expect(getDecisionStatus({ pmDecision: 'Decline' })).toBe('declined')
  })

  it('labels the feed source "hackernews" as well as the legacy "hn"', () => {
    const { getSourceLabel } = useCategories()

    expect(getSourceLabel('hackernews')).toBe('Hacker News')
    expect(getSourceLabel('hn')).toBe('Hacker News')
  })
})
