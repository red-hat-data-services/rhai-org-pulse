import { describe, it, expect, vi } from 'vitest'
const { reorderBigRocks } = require('../../server/config')

function createStorage(configReleases, releaseFiles) {
  const store = {
    'release-planning/config.json': { releases: configReleases || {} }
  }
  if (releaseFiles) {
    for (const v in releaseFiles) {
      store['release-planning/releases/' + v + '.json'] = releaseFiles[v]
    }
  }
  return {
    readFromStorage: vi.fn(function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    }),
    writeToStorage: vi.fn(function(key, data) {
      store[key] = JSON.parse(JSON.stringify(data))
    })
  }
}

function makeRock(name, priority) {
  return {
    priority: priority,
    name: name,
    fullName: '',
    pillar: '',
    state: '',
    owner: '',
    outcomeKeys: [],
    notes: '',
    description: ''
  }
}

describe('reorderBigRocks', () => {
  it('reorders Big Rocks to match the provided name list', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('A', 1), makeRock('B', 2), makeRock('C', 3)] } }
    )

    const result = reorderBigRocks(readFromStorage, writeToStorage, '3.5', ['C', 'A', 'B'])

    expect(result.bigRocks.map(r => r.name)).toEqual(['C', 'A', 'B'])
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/releases/3.5.json', expect.any(Object))
  })

  it('renumbers priorities sequentially after reorder', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('X', 1), makeRock('Y', 2), makeRock('Z', 3)] } }
    )

    const result = reorderBigRocks(readFromStorage, writeToStorage, '3.5', ['Z', 'X', 'Y'])

    expect(result.bigRocks[0].priority).toBe(1)
    expect(result.bigRocks[0].name).toBe('Z')
    expect(result.bigRocks[1].priority).toBe(2)
    expect(result.bigRocks[1].name).toBe('X')
    expect(result.bigRocks[2].priority).toBe(3)
    expect(result.bigRocks[2].name).toBe('Y')
  })

  it('fails with a missing name', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('A', 1), makeRock('B', 2), makeRock('C', 3)] } }
    )

    expect(() => {
      reorderBigRocks(readFromStorage, writeToStorage, '3.5', ['A', 'B'])
    }).toThrow('Order list does not match')
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('fails with an extra name', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('A', 1), makeRock('B', 2)] } }
    )

    expect(() => {
      reorderBigRocks(readFromStorage, writeToStorage, '3.5', ['A', 'B', 'C'])
    }).toThrow('Order list does not match')
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('fails with duplicate names in the order list', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('A', 1), makeRock('B', 2)] } }
    )

    expect(() => {
      reorderBigRocks(readFromStorage, writeToStorage, '3.5', ['A', 'A'])
    }).toThrow('duplicate name')
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('fails for a non-existent release', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [] } }
    )

    expect(() => {
      reorderBigRocks(readFromStorage, writeToStorage, '9.9', ['A'])
    }).toThrow('Release 9.9 not found')
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('succeeds with an empty Big Rocks list and empty order', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [] } }
    )

    const result = reorderBigRocks(readFromStorage, writeToStorage, '3.5', [])

    expect(result.bigRocks).toEqual([])
    expect(writeToStorage).toHaveBeenCalled()
  })

  it('sets statusCode 409 on mismatch errors', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('A', 1), makeRock('B', 2)] } }
    )

    try {
      reorderBigRocks(readFromStorage, writeToStorage, '3.5', ['A', 'C'])
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.statusCode).toBe(409)
    }
  })

  it('includes expected names in mismatch error message', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('Alpha', 1), makeRock('Beta', 2)] } }
    )

    try {
      reorderBigRocks(readFromStorage, writeToStorage, '3.5', ['Alpha', 'Gamma'])
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.message).toContain('Alpha')
      expect(err.message).toContain('Beta')
    }
  })
})
