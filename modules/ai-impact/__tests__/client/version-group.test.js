import { describe, it, expect } from 'vitest'
import {
  extractVersionGroup,
  collectVersionGroups,
  formatVersionGroupLabel,
  matchesVersionGroups
} from '../../client/utils/version-group.js'

describe('extractVersionGroup', () => {
  it('merges alternate spellings of the same GA release', () => {
    expect(extractVersionGroup('rhoai-3.6')).toBe('3.6')
    expect(extractVersionGroup('3.6 GA RHOAI RELEASE')).toBe('3.6')
    expect(extractVersionGroup('RHOAI-3.6')).toBe('3.6')
  })

  it('merges alternate spellings of the same EA release', () => {
    expect(extractVersionGroup('rhoai-3.6.EA1')).toBe('3.6.EA1')
    expect(extractVersionGroup('3.6 EA1 RHOAI RELEASE')).toBe('3.6.EA1')
  })

  it('keeps GA / EA1 / EA2 as separate groups', () => {
    expect(extractVersionGroup('rhoai-3.5')).toBe('3.5')
    expect(extractVersionGroup('rhoai-3.5.EA1')).toBe('3.5.EA1')
    expect(extractVersionGroup('rhoai-3.5.EA2')).toBe('3.5.EA2')
  })

  it('works for arbitrary major.minor versions', () => {
    expect(extractVersionGroup('rhoai-2.21')).toBe('2.21')
    expect(extractVersionGroup('rhoai-3.7.EA2')).toBe('3.7.EA2')
    expect(extractVersionGroup('4.0')).toBe('4.0')
    expect(extractVersionGroup('4.0.EA1')).toBe('4.0.EA1')
  })

  it('strips .z suffix', () => {
    expect(extractVersionGroup('rhoai-3.5.z')).toBe('3.5')
  })

  it('returns null for empty or non-version strings', () => {
    expect(extractVersionGroup(null)).toBeNull()
    expect(extractVersionGroup('')).toBeNull()
    expect(extractVersionGroup('unknown')).toBeNull()
    expect(extractVersionGroup('main')).toBeNull()
    expect(extractVersionGroup('EA1')).toBeNull()
  })

  it('recognizes ODH build type values', () => {
    expect(extractVersionGroup('CI')).toBe('CI')
    expect(extractVersionGroup('ci')).toBe('CI')
    expect(extractVersionGroup('Release')).toBe('Release')
    expect(extractVersionGroup('release')).toBe('Release')
  })
})

describe('collectVersionGroups', () => {
  it('dedupes and sorts groups across naming formats', () => {
    expect(collectVersionGroups([
      'rhoai-3.5',
      '3.5 GA RHOAI RELEASE',
      'rhoai-3.5.EA1',
      '3.5 EA1 RHOAI RELEASE',
      'rhoai-3.6',
      'rhoai-2.21'
    ])).toEqual(['2.21', '3.5', '3.5.EA1', '3.6'])
  })

  it('places ODH build types after numeric versions', () => {
    expect(collectVersionGroups([
      'CI',
      'rhoai-3.5',
      'Release',
      'rhoai-3.6'
    ])).toEqual(['3.5', '3.6', 'CI', 'Release'])
  })
})

describe('formatVersionGroupLabel', () => {
  it('formats EA keys for display', () => {
    expect(formatVersionGroupLabel('3.6')).toBe('3.6')
    expect(formatVersionGroupLabel('3.6.EA1')).toBe('3.6 EA1')
  })
})

describe('matchesVersionGroups', () => {
  it('matches when no filter is selected', () => {
    expect(matchesVersionGroups('rhoai-3.6', [])).toBe(true)
  })

  it('matches only the selected group key', () => {
    expect(matchesVersionGroups('3.6 GA RHOAI RELEASE', ['3.6'])).toBe(true)
    expect(matchesVersionGroups('rhoai-3.6.EA1', ['3.6'])).toBe(false)
    expect(matchesVersionGroups('3.6 EA1 RHOAI RELEASE', ['3.6.EA1'])).toBe(true)
  })
})
