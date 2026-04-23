import { describe, it, expect, vi } from 'vitest'
const { saveBigRock, deleteBigRock } = require('../../server/config')

function createStorageWithConfig(config) {
  const stored = { ...config }
  return {
    readFromStorage: vi.fn().mockReturnValue(stored),
    writeToStorage: vi.fn()
  }
}

function makeConfig(bigRocks, version) {
  version = version || '3.5'
  const releases = {}
  releases[version] = { release: version, bigRocks: bigRocks || [] }
  return { releases }
}

describe('saveBigRock', () => {
  describe('creating a new Big Rock', () => {
    it('adds a new Big Rock to the end of the list', () => {
      const config = makeConfig([
        { priority: 1, name: 'Existing', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, {
        name: 'New Rock',
        pillar: 'Platform'
      })

      expect(result.bigRock.name).toBe('New Rock')
      expect(result.bigRock.pillar).toBe('Platform')
      expect(result.bigRock.priority).toBe(2)
      expect(result.bigRocks).toHaveLength(2)
      expect(writeToStorage).toHaveBeenCalledWith('release-planning/config.json', expect.any(Object))
    })

    it('assigns priority 1 to the first Big Rock', () => {
      const config = makeConfig([])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, {
        name: 'First Rock'
      })

      expect(result.bigRock.priority).toBe(1)
      expect(result.bigRocks).toHaveLength(1)
    })

    it('defaults optional fields to empty strings/arrays', () => {
      const config = makeConfig([])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

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
      const config = makeConfig([])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, {
        name: '  Spaced Name  '
      })

      expect(result.bigRock.name).toBe('Spaced Name')
    })
  })

  describe('updating an existing Big Rock', () => {
    it('updates fields of an existing Big Rock by name', () => {
      const config = makeConfig([
        { priority: 1, name: 'MaaS', fullName: 'Old', pillar: 'Inference', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 2, name: 'Other', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

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
      const config = makeConfig([
        { priority: 1, name: 'OldName', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', 'OldName', {
        name: 'NewName'
      })

      expect(result.bigRock.name).toBe('NewName')
      expect(result.bigRocks[0].name).toBe('NewName')
    })

    it('throws when the original name is not found', () => {
      const config = makeConfig([
        { priority: 1, name: 'MaaS', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      expect(() => {
        saveBigRock(readFromStorage, writeToStorage, '3.5', 'NonExistent', { name: 'X' })
      }).toThrow("'NonExistent' not found")
    })

    it('preserves priority during update', () => {
      const config = makeConfig([
        { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 3, name: 'C', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', 'B', {
        name: 'B',
        pillar: 'Updated'
      })

      expect(result.bigRocks[1].priority).toBe(2)
      expect(result.bigRocks[1].pillar).toBe('Updated')
    })
  })

  describe('release validation', () => {
    it('throws when the release does not exist', () => {
      const config = makeConfig([], '3.5')
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      expect(() => {
        saveBigRock(readFromStorage, writeToStorage, '9.9', null, { name: 'X' })
      }).toThrow('Release 9.9 not found')
    })
  })

  describe('priority renumbering', () => {
    it('renumbers priorities sequentially after save', () => {
      const config = makeConfig([
        { priority: 5, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
        { priority: 10, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
      ])
      const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

      const result = saveBigRock(readFromStorage, writeToStorage, '3.5', null, { name: 'C' })

      expect(result.bigRocks[0].priority).toBe(1)
      expect(result.bigRocks[1].priority).toBe(2)
      expect(result.bigRocks[2].priority).toBe(3)
    })
  })
})

describe('deleteBigRock', () => {
  it('deletes a Big Rock by name', () => {
    const config = makeConfig([
      { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
      { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
      { priority: 3, name: 'C', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
    ])
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = deleteBigRock(readFromStorage, writeToStorage, '3.5', 'B')

    expect(result.deleted).toBe('B')
    expect(result.bigRocks).toHaveLength(2)
    expect(result.bigRocks.map(r => r.name)).toEqual(['A', 'C'])
  })

  it('renumbers priorities after deletion', () => {
    const config = makeConfig([
      { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
      { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
      { priority: 3, name: 'C', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
    ])
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = deleteBigRock(readFromStorage, writeToStorage, '3.5', 'A')

    expect(result.bigRocks[0].priority).toBe(1)
    expect(result.bigRocks[0].name).toBe('B')
    expect(result.bigRocks[1].priority).toBe(2)
    expect(result.bigRocks[1].name).toBe('C')
  })

  it('allows deleting the last Big Rock', () => {
    const config = makeConfig([
      { priority: 1, name: 'Only', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
    ])
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = deleteBigRock(readFromStorage, writeToStorage, '3.5', 'Only')

    expect(result.deleted).toBe('Only')
    expect(result.bigRocks).toHaveLength(0)
  })

  it('throws when the Big Rock name is not found', () => {
    const config = makeConfig([
      { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
    ])
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    expect(() => {
      deleteBigRock(readFromStorage, writeToStorage, '3.5', 'NonExistent')
    }).toThrow("'NonExistent' not found")
  })

  it('throws when the release does not exist', () => {
    const config = makeConfig([], '3.5')
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    expect(() => {
      deleteBigRock(readFromStorage, writeToStorage, '9.9', 'A')
    }).toThrow('Release 9.9 not found')
  })

  it('writes the updated config to storage', () => {
    const config = makeConfig([
      { priority: 1, name: 'A', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' },
      { priority: 2, name: 'B', fullName: '', pillar: '', state: '', owner: '', outcomeKeys: [], notes: '', description: '' }
    ])
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    deleteBigRock(readFromStorage, writeToStorage, '3.5', 'A')

    expect(writeToStorage).toHaveBeenCalledWith('release-planning/config.json', expect.objectContaining({
      releases: expect.objectContaining({
        '3.5': expect.objectContaining({
          bigRocks: expect.arrayContaining([
            expect.objectContaining({ name: 'B', priority: 1 })
          ])
        })
      })
    }))
  })
})
