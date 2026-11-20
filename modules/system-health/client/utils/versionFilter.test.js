import { describe, expect, it } from 'vitest'
import {
  cleanVer,
  collectReleasesFromComponents,
  collectVersionsFromComponents,
  filterGateDayByVersionRelease,
  isKnownRelease,
  isKnownVersion,
  isZStream,
  urlMatchesRelease,
  urlMatchesVersion,
  versionMatches,
  vrKeyMatches,
  yStreamList,
  yStreamVer,
  zStreamList
} from './versionFilter.js'

const URL_36_EA1 = 'https://jenkins.example.com/job/rhoai/job/3.6-ea.1/job/rhoai-smoke/2/'
const URL_36_GA = 'https://jenkins.example.com/job/rhoai/job/3.6/job/selfmanaged/job/rhoai-smoke/10/'
const URL_352 = 'https://jenkins.example.com/job/rhoai/job/3.5.2/job/selfmanaged/job/rhoai-smoke/5/'
const URL_25 = 'https://jenkins.example.com/job/rhoai/job/2.25/job/selfmanaged/job/cli/job/rhoai-smoke/108/'

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

  it('collects versions/releases and never surfaces ingest unknown', () => {
    const comps = [{
      component: 'Dashboard',
      days: {
        '2026-11-01': {
          by_vr: {
            '3.5|GA': { total: 1 },
            '3.5.0|GA': { total: 1 },
            '3.5.2|GA': { total: 1 },
            '3.6|EA1': { total: 1 },
            'unknown|unknown': { total: 1 },
            'Unknown|Unknown': { total: 1 }
          }
        }
      }
    }]
    expect(isKnownVersion('unknown')).toBe(false)
    expect(isKnownVersion('Unknown')).toBe(false)
    expect(isKnownRelease('unknown')).toBe(false)
    expect(collectVersionsFromComponents(comps)).toEqual(['3.5', '3.5.2', '3.6'])
    expect(collectReleasesFromComponents(comps)).toEqual(['EA1', 'GA'])
  })

  it('maps z-stream to y-stream for Jira family keys', () => {
    expect(yStreamVer('3.5.2')).toBe('3.5')
    expect(yStreamVer('3.5.0')).toBe('3.5')
  })

  it('matches Jenkins URL folder segments exactly by version', () => {
    expect(urlMatchesVersion(URL_36_EA1, '3.6')).toBe(true)
    expect(urlMatchesVersion(URL_36_GA, '3.6')).toBe(true)
    expect(urlMatchesVersion(URL_36_GA, '3.6.0')).toBe(true)
    expect(urlMatchesVersion(URL_352, '3.5')).toBe(false)
    expect(urlMatchesVersion(URL_352, '3.5.2')).toBe(true)
    expect(urlMatchesVersion(URL_25, '3.6')).toBe(false)
    expect(urlMatchesVersion(URL_25, 'All')).toBe(true)
  })

  it('matches Jenkins URL release milestones', () => {
    expect(urlMatchesRelease(URL_36_EA1, 'EA1')).toBe(true)
    expect(urlMatchesRelease(URL_36_EA1, 'GA')).toBe(false)
    expect(urlMatchesRelease(URL_36_GA, 'GA')).toBe(true)
    expect(urlMatchesRelease(URL_36_GA, 'EA1')).toBe(false)
    expect(urlMatchesRelease(URL_36_EA1, 'All')).toBe(true)
  })

  it('filters quality-gate day executions and recalculates totals', () => {
    const day = {
      passed: 30,
      failed: 2,
      skipped: 0,
      total: 32,
      executions: [
        { jenkins_url: URL_36_EA1, passed: 10, failed: 1, skipped: 0, total: 11 },
        { jenkins_url: URL_25, passed: 20, failed: 1, skipped: 0, total: 21 }
      ]
    }
    const filtered = filterGateDayByVersionRelease(day, '3.6', 'All')
    expect(filtered.executions).toHaveLength(1)
    expect(filtered.executions[0].jenkins_url).toBe(URL_36_EA1)
    expect(filtered).toMatchObject({ passed: 10, failed: 1, skipped: 0, total: 11 })

    expect(filterGateDayByVersionRelease(day, '3.5', 'All')).toBeNull()
    expect(filterGateDayByVersionRelease(day, '3.6', 'GA')).toBeNull()
    expect(filterGateDayByVersionRelease(day, '3.6', 'EA1').executions).toHaveLength(1)
    expect(filterGateDayByVersionRelease(day, 'All', 'All')).toBe(day)
  })
})
