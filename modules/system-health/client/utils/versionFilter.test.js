import { describe, expect, it } from 'vitest'
import {
  cleanVer,
  collectVersionsFromComponents,
  isZStream,
  versionMatches,
  vrKeyMatches,
  yStreamList,
  yStreamVer,
  zStreamList
} from './versionFilter.js'

describe('versionFilter', () => {
  it('collapses patch .0 to y-stream', () => {
    expect(cleanVer('3.5.0')).toBe('3.5')
    expect(cleanVer('3.5')).toBe('3.5')
    expect(cleanVer('3.5.2')).toBe('3.5.2')
    expect(cleanVer('3.5.0-ea.1')).toBe('3.5')
  })

  it('matches exactly: 3.5 ≡ 3.5.0, 3.5 ≠ 3.5.2', () => {
    expect(versionMatches('3.5.0', '3.5')).toBe(true)
    expect(versionMatches('3.5', '3.5.0')).toBe(true)
    expect(versionMatches('3.5.2', '3.5')).toBe(false)
    expect(versionMatches('3.5', '3.5.2')).toBe(false)
  })

  it('detects z-stream after .0 collapse', () => {
    expect(isZStream('3.5.0')).toBe(false)
    expect(isZStream('3.5')).toBe(false)
    expect(isZStream('3.5.2')).toBe(true)
  })

  it('builds y/z lists without duplicate 3.5.0', () => {
    const versions = ['3.5', '3.5.0', '3.5.1', '3.5.2', '3.6']
    const cleaned = versions.map(cleanVer)
    const unique = [...new Set(cleaned)]
    expect(unique).toEqual(['3.5', '3.5.1', '3.5.2', '3.6'])
    expect(yStreamList(unique)).toEqual(['3.5', '3.6'])
    expect(zStreamList(unique, '3.5')).toEqual(['3.5.2', '3.5.1', '3.5'])
  })

  it('matches by_vr keys exactly', () => {
    expect(vrKeyMatches('3.5.2|GA', '3.5.2', 'GA')).toBe(true)
    expect(vrKeyMatches('3.5.2|GA', '3.5', 'All')).toBe(false)
    expect(vrKeyMatches('3.5.0|GA', '3.5', 'GA')).toBe(true)
  })

  it('collects versions from heatmap components', () => {
    const comps = [{
      component: 'Dashboard',
      days: {
        '2026-11-01': {
          by_vr: {
            '3.5|GA': { total: 1 },
            '3.5.0|GA': { total: 1 },
            '3.5.2|GA': { total: 1 },
            'unknown|GA': { total: 1 }
          }
        }
      }
    }]
    expect(collectVersionsFromComponents(comps)).toEqual(['3.5', '3.5.2'])
  })

  it('maps z-stream to y-stream for Jira family keys', () => {
    expect(yStreamVer('3.5.2')).toBe('3.5')
    expect(yStreamVer('3.5.0')).toBe('3.5')
  })
})
