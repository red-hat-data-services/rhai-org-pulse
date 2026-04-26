import { describe, it, expect, vi } from 'vitest'
const { saveBigRock, deleteBigRock } = require('../../server/config')

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
    }),
    _store: store
  }
}

function makeReleaseFile(bigRocks, version) {
  version = version || '3.5'
  return { release: version, bigRocks: bigRocks || [] }
}

describe('saveBigRock', () => {
  describe('creating a new Big Rock', () => {
    it('adds a new Big Rock to the end of the list', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          { priority: 1, name: 'Existing', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
        ]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, {
        name: 'New Rock',
        pillar: 'Platform'
      })

      expect(result.bigRock.name).toBe('New Rock')
      expect(result.bigRock.pillar).toBe('Platform')
      expect(result.bigRock.priority).toBe(2)
      expect(result.bigRocks).toHaveLength(2)
      expect(writeToStorage).toHaveBeenCalledWith('release-planning/releases/3.5.json', expect.any(Object))
    })

    it('assigns priority 1 to the first Big Rock', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, {
        name: 'First Rock'
      })

      expect(result.bigRock.priority).toBe(1)
      expect(result.bigRocks).toHaveLength(1)
    })

    it('defaults optional fields to empty strings/arrays', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, {
        name: 'Minimal Rock'
      })

      expect(result.bigRock.fullName).toBe('')
      expect(result.bigRock.pillar).toBe('')
      expect(result.bigRock.state).toBe('')
      expect(result.bigRock.owner).toBe('')
      expect(result.bigRock.outcomeKeys).toEqual([])
      expect(result.bigRock.notes).toBe('')
      expect(result.bigRock.description).toBe('')
    })

    it('trims the name', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, {
        name: '  Spaced Name  '
      })

      expect(result.bigRock.name).toBe('Spaced Name')
    })
  })

  describe('updating an existing Big Rock', () => {
    it('updates fields of an existing Big Rock by name', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          { priority: 1, name: 'MaaS', fullName: 'Old', pillar: 'Inference', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
          { priority: 2, name: 'Other', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
        ]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', 'MaaS', {
        name: 'MaaS',
        fullName: 'Updated Name',
        pillar: 'New Pillar',
        outcomeKeys: ['KEY-1']
      })

      expect(result.bigRock.fullName).toBe('Updated Name')
      expect(result.bigRock.pillar).toBe('New Pillar')
      expect(result.bigRock.outcomeKeys).toEqual(['KEY-1'])
      expect(result.bigRocks).toHaveLength(2)
    })

    it('allows renaming a Big Rock', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          { priority: 1, name: 'OldName', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
        ]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', 'OldName', {
        name: 'NewName'
      })

      expect(result.bigRock.name).toBe('NewName')
      expect(result.bigRocks[0].name).toBe('NewName')
    })

    it('throws when the original name is not found', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          { priority: 1, name: 'MaaS', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
        ]) }
      )

      expect(() => {
        saveBigRock(readFromStorage, writeToStorage, '3.5', 'NonExistent', { name: 'X' })
      }).toThrow("'NonExistent' not found")
    })

    it('preserves priority during update', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
          { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
          { priority: 3, name: 'C', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
        ]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', 'B', {
        name: 'B',
        pillar: 'Updated'
      })

      expect(result.bigRocks[1].priority).toBe(2)
      expect(result.bigRocks[1].pillar).toBe('Updated')
    })
  })

  describe('priority renumbering', () => {
    it('renumbers priorities sequentially after save', () => {
      const { readFromStorage, writeToStorage } = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          { priority: 5, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
          { priority: 10, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
        ]) }
      )

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, { name: 'C' })

      expect(result.bigRocks[0].priority).toBe(1)
      expect(result.bigRocks[1].priority).toBe(2)
      expect(result.bigRocks[2].priority).toBe(3)
    })
  })
})

describe('deleteBigRock', () => {
  it('deletes a Big Rock by name', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([
        { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 3, name: 'C', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ]) }
    )

    const result = deleteBigRock(readFromStorage, writeToStorage, '3.5', 'B')

    expect(result.deleted).toBe('B')
    expect(result.bigRocks).toHaveLength(2)
    expect(result.bigRocks.map(r => r.name)).toEqual(['A', 'C'])
  })

  it('renumbers priorities after deletion', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([
        { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 3, name: 'C', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ]) }
    )

    const result = deleteBigRock(readFromStorage, writeToStorage, '3.5', 'A')

    expect(result.bigRocks[0].priority).toBe(1)
    expect(result.bigRocks[0].name).toBe('B')
    expect(result.bigRocks[1].priority).toBe(2)
    expect(result.bigRocks[1].name).toBe('C')
  })

  it('allows deleting the last Big Rock', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([
        { priority: 1, name: 'Only', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ]) }
    )

    const result = deleteBigRock(readFromStorage, writeToStorage, '3.5', 'Only')

    expect(result.deleted).toBe('Only')
    expect(result.bigRocks).toHaveLength(0)
  })

  it('throws when the Big Rock name is not found', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([
        { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ]) }
    )

    expect(() => {
      deleteBigRock(readFromStorage, writeToStorage, '3.5', 'NonExistent')
    }).toThrow("'NonExistent' not found")
  })

  it('writes the updated release file to storage', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([
        { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ]) }
    )

    deleteBigRock(readFromStorage, writeToStorage, '3.5', 'A')

    expect(writeToStorage).toHaveBeenCalledWith('release-planning/releases/3.5.json', expect.objectContaining({
      bigRocks: expect.arrayContaining([
        expect.objectContaining({ name: 'B', priority: 1 })
      ])
    }))
  })
})
