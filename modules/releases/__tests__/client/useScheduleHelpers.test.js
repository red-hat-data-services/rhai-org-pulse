import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseDate,
  todayMidnight,
  daysFromNow,
  formatShort,
  getProduct,
  releasePhase,
  getStream,
  milestoneProgress
} from '../../client/composables/useScheduleHelpers.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-28T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('parseDate', () => {
  it('returns null for null', () => {
    expect(parseDate(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseDate(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(parseDate('not-a-date')).toBeNull()
  })

  it('returns a Date for valid ISO date', () => {
    const d = parseDate('2026-09-15')
    expect(d).toBeInstanceOf(Date)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(15)
  })

  it('parses date-only strings as local time, not UTC', () => {
    const d = parseDate('2026-07-29')
    expect(d.getDate()).toBe(29)
    expect(d.getHours()).toBe(0)
  })
})

describe('todayMidnight', () => {
  it('returns a Date with zeroed time components', () => {
    const d = todayMidnight()
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it('returns today\'s date', () => {
    const d = todayMidnight()
    const now = new Date()
    expect(d.getFullYear()).toBe(now.getFullYear())
    expect(d.getMonth()).toBe(now.getMonth())
    expect(d.getDate()).toBe(now.getDate())
  })
})

describe('daysFromNow', () => {
  it('returns null for null input', () => {
    expect(daysFromNow(null)).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(daysFromNow('garbage')).toBeNull()
  })

  it('returns 0 for today\'s date', () => {
    expect(daysFromNow('2026-07-28')).toBe(0)
  })

  it('returns positive value for future date', () => {
    expect(daysFromNow('2026-07-31')).toBe(3)
  })

  it('returns negative value for past date', () => {
    expect(daysFromNow('2026-07-25')).toBe(-3)
  })
})

describe('formatShort', () => {
  it('returns em-dash for null', () => {
    expect(formatShort(null)).toBe('—')
  })

  it('returns em-dash for undefined', () => {
    expect(formatShort(undefined)).toBe('—')
  })

  it('formats date without year by default', () => {
    expect(formatShort('2026-09-15')).toBe('Sep 15')
  })

  it('formats date with year when opts.year is true', () => {
    expect(formatShort('2026-09-15', { year: true })).toBe('Sep 15, 2026')
  })
})

describe('getProduct', () => {
  it('returns productPagesShortname when valid', () => {
    expect(getProduct({ productPagesShortname: 'rhoai', id: 'rhoai-3.5' })).toBe('rhoai')
  })

  it('rejects shortname with digits and falls back to id', () => {
    expect(getProduct({ productPagesShortname: '3.5rhoai', id: 'rhoai-3.5' })).toBe('rhoai')
    expect(getProduct({ productPagesShortname: '3.6-rhoai', id: 'rhoai-3.6.EA1' })).toBe('rhoai')
  })

  it('extracts product from reversed id format (version-product)', () => {
    expect(getProduct({ productPagesShortname: '3.5', id: '3.5rhoai' })).toBe('rhoai')
    expect(getProduct({ productPagesShortname: '3.6-rhoai', id: '3.6-rhoai' })).toBe('rhoai')
  })

  it('falls back to regex extraction from id', () => {
    expect(getProduct({ id: 'rhoai-3.5' })).toBe('rhoai')
  })

  it('normalizes to lowercase', () => {
    expect(getProduct({ id: 'RHOAI-3.5' })).toBe('rhoai')
  })

  it('returns full id when no 4+ letter sequence found', () => {
    expect(getProduct({ id: 'ab-1' })).toBe('ab-1')
  })
})

describe('getStream', () => {
  it('returns productPagesVersion when present', () => {
    expect(getStream({ productPagesVersion: '3.5', id: 'rhai-3.5-ga' })).toBe('3.5')
  })

  it('falls back to displayName', () => {
    expect(getStream({ displayName: 'RHAI 3.6 EA1', id: 'rhai-3.6-ea1' })).toBe('3.6')
  })

  it('falls back to id', () => {
    expect(getStream({ id: 'rhoai-3.5' })).toBe('3.5')
  })

  it('extracts version from full release number in productPagesVersion', () => {
    expect(getStream({ productPagesVersion: 'rhoai-3.5.EA1' })).toBe('3.5')
    expect(getStream({ productPagesVersion: 'rhaii-3.6' })).toBe('3.6')
    expect(getStream({ productPagesVersion: 'rhelai-3.5.EA2' })).toBe('3.5')
  })

  it('returns null when no version pattern found', () => {
    expect(getStream({ id: 'standalone' })).toBeNull()
  })
})

describe('releasePhase', () => {
  it('returns phaseIndex 0 (Planning) when all milestones are future', () => {
    const release = {
      milestones: {
        planningFreeze: '2026-08-01',
        featureFreeze: '2026-09-01',
        codeFreeze: '2026-10-01',
        ga: '2026-11-01'
      }
    }
    const { phaseIndex, phases } = releasePhase(release)
    expect(phaseIndex).toBe(0)
    expect(phases).toHaveLength(5)
    expect(phases[0].label).toBe('Planning')
  })

  it('returns phaseIndex 1 (Feature Dev) after planningFreeze', () => {
    const release = {
      milestones: {
        planningFreeze: '2026-07-01',
        featureFreeze: '2026-09-01',
        codeFreeze: '2026-10-01',
        ga: '2026-11-01'
      }
    }
    expect(releasePhase(release).phaseIndex).toBe(1)
  })

  it('returns phaseIndex 2 (Code Complete) after featureFreeze', () => {
    const release = {
      milestones: {
        planningFreeze: '2026-06-01',
        featureFreeze: '2026-07-01',
        codeFreeze: '2026-10-01',
        ga: '2026-11-01'
      }
    }
    expect(releasePhase(release).phaseIndex).toBe(2)
  })

  it('returns phaseIndex 3 (Release Prep) after codeFreeze', () => {
    const release = {
      milestones: {
        planningFreeze: '2026-05-01',
        featureFreeze: '2026-06-01',
        codeFreeze: '2026-07-01',
        ga: '2026-11-01'
      }
    }
    expect(releasePhase(release).phaseIndex).toBe(3)
  })

  it('returns phaseIndex 4 (Released) after ga', () => {
    const release = {
      milestones: {
        planningFreeze: '2026-04-01',
        featureFreeze: '2026-05-01',
        codeFreeze: '2026-06-01',
        ga: '2026-07-01'
      }
    }
    expect(releasePhase(release).phaseIndex).toBe(4)
  })

  it('handles EA release where featureFreeze is null', () => {
    const release = {
      milestones: {
        planningFreeze: '2026-07-01',
        featureFreeze: null,
        codeFreeze: '2026-10-01',
        ga: '2026-11-01'
      }
    }
    expect(releasePhase(release).phaseIndex).toBe(1)
  })

  it('handles release with no milestones', () => {
    const { phaseIndex } = releasePhase({ milestones: {} })
    expect(phaseIndex).toBe(0)
  })
})

describe('milestoneProgress', () => {
  it('returns null when currentDate is null', () => {
    expect(milestoneProgress(null, '2026-07-01')).toBeNull()
  })

  it('returns 100 when current date is in the past', () => {
    expect(milestoneProgress('2026-07-01', '2026-06-01')).toBe(100)
  })

  it('returns null when prevDate is null and current is future', () => {
    expect(milestoneProgress('2026-08-28', null)).toBeNull()
  })

  it('returns 0 when today is before prevDate', () => {
    expect(milestoneProgress('2026-09-28', '2026-08-28')).toBe(0)
  })

  it('returns correct percentage for in-progress milestone', () => {
    const pct = milestoneProgress('2026-08-07', '2026-07-18')
    expect(pct).toBeGreaterThanOrEqual(48)
    expect(pct).toBeLessThanOrEqual(52)
  })

  it('returns 100 for zero-duration range', () => {
    expect(milestoneProgress('2026-08-01', '2026-08-01')).toBe(100)
  })
})
