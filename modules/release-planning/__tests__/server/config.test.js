import { describe, it, expect } from 'vitest'
const { getConfig, loadBigRocks, loadFieldMapping, getConfiguredReleases, DEFAULT_CONFIG } = require('../../server/config')

describe('getConfig', () => {
  it('returns default config when storage is empty', () => {
    const readFromStorage = () => null
    const config = getConfig(readFromStorage)
    expect(config.fieldMapping).toEqual(DEFAULT_CONFIG.fieldMapping)
    expect(config.customFieldIds).toEqual(DEFAULT_CONFIG.customFieldIds)
    expect(config.releases).toEqual({})
  })

  it('merges stored config with defaults', () => {
    const stored = {
      releases: {
        '3.5': {
          release: '3.5',
          bigRocks: [{ priority: 1, name: 'TestRock', outcomeKeys: ['KEY-1'] }]
        }
      },
      fieldMapping: { team: 'customfield_12345' }
    }
    const readFromStorage = () => stored

    const config = getConfig(readFromStorage)
    expect(config.releases['3.5'].bigRocks).toHaveLength(1)
    expect(config.fieldMapping.team).toBe('customfield_12345')
    expect(config.fieldMapping.rfeLinkType).toBe('is required by')
    expect(config.customFieldIds.targetVersion).toBe('customfield_10855')
  })

  it('handles non-object storage values', () => {
    const readFromStorage = () => 'invalid'
    const config = getConfig(readFromStorage)
    expect(config).toEqual(DEFAULT_CONFIG)
  })
})

describe('loadBigRocks', () => {
  it('returns empty array when release not found', () => {
    const readFromStorage = () => ({ releases: {} })
    const rocks = loadBigRocks(readFromStorage, '3.5')
    expect(rocks).toEqual([])
  })

  it('returns big rocks for configured release', () => {
    const stored = {
      releases: {
        '3.5': {
          bigRocks: [
            { priority: 1, name: 'MaaS', outcomeKeys: ['RHAISTRAT-1513'] },
            { priority: 2, name: 'Gen AI Studio', outcomeKeys: ['RHAISTRAT-1312'] }
          ]
        }
      }
    }
    const readFromStorage = () => stored

    const rocks = loadBigRocks(readFromStorage, '3.5')
    expect(rocks).toHaveLength(2)
    expect(rocks[0].name).toBe('MaaS')
    expect(rocks[1].name).toBe('Gen AI Studio')
  })
})

describe('loadFieldMapping', () => {
  it('returns default mapping when storage is empty', () => {
    const readFromStorage = () => null
    const mapping = loadFieldMapping(readFromStorage)
    expect(mapping.rfeLinkType).toBe('is required by')
  })

  it('returns stored mapping', () => {
    const stored = {
      fieldMapping: { team: 'customfield_99999', rfeLinkType: 'blocks' }
    }
    const readFromStorage = () => stored
    const mapping = loadFieldMapping(readFromStorage)
    expect(mapping.team).toBe('customfield_99999')
    expect(mapping.rfeLinkType).toBe('blocks')
  })
})

describe('getConfiguredReleases', () => {
  it('returns empty array when no releases configured', () => {
    const readFromStorage = () => null
    const releases = getConfiguredReleases(readFromStorage)
    expect(releases).toEqual([])
  })

  it('returns release list with rock counts', () => {
    const stored = {
      releases: {
        '3.5': { bigRocks: [{ name: 'A' }, { name: 'B' }] },
        '3.4': { bigRocks: [{ name: 'C' }] }
      }
    }
    const readFromStorage = () => stored
    const releases = getConfiguredReleases(readFromStorage)
    expect(releases).toHaveLength(2)

    const r35 = releases.find(r => r.version === '3.5')
    expect(r35.bigRockCount).toBe(2)

    const r34 = releases.find(r => r.version === '3.4')
    expect(r34.bigRockCount).toBe(1)
  })
})
