import { describe, it, expect } from 'vitest'

const {
  sameReleaseCycle,
  filterCommittedFixVersions
} = require('../../../server/pm-hub/committed-definition')

describe('sameReleaseCycle', function () {
  it('true for same product + major.minor across naming styles', function () {
    expect(sameReleaseCycle('rhoai-3.6.EA1', '3.6 EA2 RHOAI RELEASE')).toBe(true)
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'rhoai-3.6')).toBe(true)
  })

  it('false for different minor, product, or unparseable', function () {
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'rhoai-3.5.EA1')).toBe(false)
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'rhelai-3.6.EA1')).toBe(false)
    expect(sameReleaseCycle('rhoai-3.6.EA1', 'not-a-version')).toBe(false)
  })
})

describe('filterCommittedFixVersions (FV-in-scope only)', function () {
  it('returns Fix Versions in scope regardless of Target Version', function () {
    expect(filterCommittedFixVersions(['rhoai-3.6.EA2'], ['rhoai-3.6.EA2'])).toEqual([
      'rhoai-3.6.EA2'
    ])
    expect(filterCommittedFixVersions(['rhoai-3.6.EA2'], [])).toEqual(['rhoai-3.6.EA2'])
    expect(filterCommittedFixVersions(['rhoai-3.6.EA2'], null)).toEqual(['rhoai-3.6.EA2'])
  })

  it('keeps FV-only (no TV) as committed', function () {
    expect(filterCommittedFixVersions(['3.6 EA2 RHOAI RELEASE'], [])).toEqual([
      '3.6 EA2 RHOAI RELEASE'
    ])
  })

  it('keeps late / cross-cycle FV when it is in the selected matching set', function () {
    // Caller already restricted matchingFv to selected scope; we do not re-filter by TV.
    expect(
      filterCommittedFixVersions(['rhoai-3.6.EA2'], ['rhoai-3.6.EA1'])
    ).toEqual(['rhoai-3.6.EA2'])
  })

  it('returns empty when no matching Fix Versions', function () {
    expect(filterCommittedFixVersions([], ['rhoai-3.6.EA1'])).toEqual([])
    expect(filterCommittedFixVersions(null, ['rhoai-3.6.EA1'])).toEqual([])
  })

  it('returns a copy of all matching FVs', function () {
    var matchingFv = ['rhoai-3.6.EA1', 'rhoai-3.6.EA2']
    expect(filterCommittedFixVersions(matchingFv, [])).toEqual([
      'rhoai-3.6.EA1',
      'rhoai-3.6.EA2'
    ])
    expect(filterCommittedFixVersions(matchingFv, [])).not.toBe(matchingFv)
  })
})
