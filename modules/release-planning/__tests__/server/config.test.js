import { describe, it, expect } from 'vitest'
const { getConfig, loadBigRocks, loadFieldMapping, getConfiguredReleases, DEFAULT_CONFIG } = require('../../server/config')

function makeStorage(data) {
  const store = {}
  if (data) {
    for (const k in data) store[k] = data[k]
  }
  return function(key) {
    return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
  }
}

describe('getConfig', () => {
  it('returns default config when storage is empty', () => {
    const config = getConfig(makeStorage())
    expect(config.fieldMapping).toEqual(DEFAULT_CONFIG.fieldMapping)
    expect(config.customFieldIds).toEqual(DEFAULT_CONFIG.customFieldIds)
    expect(config.releases).toEqual({})
  })

  it('merges stored config with defaults', () => {
    const readFromStorage = makeStorage({
      'release-planning/config.json': {
        releases: { '3.5': { release: '3.5' } },
        fieldMapping: { team: 'customfield_12345' }
      }
    })

    const config = getConfig(readFromStorage)
    expect(config.releases['3.5']).toBeDefined()
    expect(config.fieldMapping.team).toBe('customfield_12345')
    expect(config.fieldMapping.rfeLinkType).toBe('is required by')
    expect(config.customFieldIds.targetVersion).toBe('customfield_10855')
  })

  it('handles non-object storage values', () => {
    const readFromStorage = makeStorage({ 'release-planning/config.json': 'invalid' })
    const config = getConfig(readFromStorage)
    expect(config).toEqual(DEFAULT_CONFIG)
  })
})

describe('loadBigRocks', () => {
  it('returns empty array when release not found', () => {
    const readFromStorage = makeStorage({
      'release-planning/config.json': { releases: {} }
    })
    const rocks = loadBigRocks(readFromStorage, '3.5')
    expect(rocks).toEqual([])
  })

  it('returns big rocks from per-release file', () => {
    const readFromStorage = makeStorage({
      'release-planning/config.json': { releases: { '3.5': { release: '3.5' } } },
      'release-planning/releases/3.5.json': {
        release: '3.5',
        bigRocks: [
          { priority: 1, name: 'MaaS', outcomeKeys: ['RHAISTRAT-1513'] },
          { priority: 2, name: 'Gen AI Studio', outcomeKeys: ['RHAISTRAT-1312'] }
        ]
      }
    })

    const rocks = loadBigRocks(readFromStorage, '3.5')
    expect(rocks).toHaveLength(2)
    expect(rocks[0].name).toBe('MaaS')
    expect(rocks[1].name).toBe('Gen AI Studio')
  })
})

describe('loadFieldMapping', () => {
  it('returns default mapping when storage is empty', () => {
    const mapping = loadFieldMapping(makeStorage())
    expect(mapping.rfeLinkType).toBe('is required by')
  })

  it('returns stored mapping', () => {
    const readFromStorage = makeStorage({
      'release-planning/config.json': {
        fieldMapping: { team: 'customfield_99999', rfeLinkType: 'blocks' }
      }
    })
    const mapping = loadFieldMapping(readFromStorage)
    expect(mapping.team).toBe('customfield_99999')
    expect(mapping.rfeLinkType).toBe('blocks')
  })
})

describe('getConfiguredReleases', () => {
  it('returns empty array when no releases configured', () => {
    const releases = getConfiguredReleases(makeStorage())
    expect(releases).toEqual([])
  })

  it('returns release list with rock counts from per-release files', () => {
    const readFromStorage = makeStorage({
      'release-planning/config.json': {
        releases: { '3.5': { release: '3.5' }, '3.4': { release: '3.4' } }
      },
      'release-planning/releases/3.5.json': {
        release: '3.5',
        bigRocks: [{ name: 'A' }, { name: 'B' }]
      },
      'release-planning/releases/3.4.json': {
        release: '3.4',
        bigRocks: [{ name: 'C' }]
      }
    })
    const releases = getConfiguredReleases(readFromStorage)
    expect(releases).toHaveLength(2)

    const r35 = releases.find(r => r.version === '3.5')
    expect(r35.bigRockCount).toBe(2)

    const r34 = releases.find(r => r.version === '3.4')
    expect(r34.bigRockCount).toBe(1)
  })
})
