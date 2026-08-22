import { describe, it, expect } from 'vitest'
import { sprintMatchesFilter } from '../../../client/services/allocation-api'

describe('sprintMatchesFilter', () => {
  it('includes everything when the filter is blank', () => {
    expect(sprintMatchesFilter('Anything', '')).toBe(true)
    expect(sprintMatchesFilter('Anything', '   ')).toBe(true)
    expect(sprintMatchesFilter('Anything', null)).toBe(true)
  })

  it('matches on case-insensitive substring', () => {
    expect(sprintMatchesFilter('AI Hub Sprint 26-13', 'ai hub')).toBe(true)
    expect(sprintMatchesFilter('AI Hub Sprint 26-13', 'HUB')).toBe(true)
    expect(sprintMatchesFilter('Other Team Sprint 5', 'AI Hub')).toBe(false)
  })

  it('handles missing sprint names', () => {
    expect(sprintMatchesFilter(null, 'ai')).toBe(false)
    expect(sprintMatchesFilter(undefined, 'ai')).toBe(false)
  })
})
