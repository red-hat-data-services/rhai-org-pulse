import { describe, it, expect, vi } from 'vitest'
const { createRelease, cloneRelease, deleteRelease } = require('../../server/config')

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

function makeRock(name, priority) {
  return {
    priority: priority,
    name: name,
    fullName: name + ' full',
    pillar: 'Test',
    state: 'new',
    owner: 'owner@test.com',
    outcomeKeys: ['KEY-' + priority],
    notes: '',
    description: ''
  }
}

describe('createRelease', () => {
  it('creates a blank release successfully', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [] } }
    )

    const result = createRelease(readFromStorage, writeToStorage, '3.6')

    expect(result.version).toBe('3.6')
    expect(result.bigRockCount).toBe(0)
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/config.json', expect.objectContaining({
      releases: expect.objectContaining({
        '3.6': { release: '3.6' }
      })
    }))
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/releases/3.6.json', {
      release: '3.6',
      bigRocks: []
    })
  })

  it('fails if version already exists (409)', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } }
    )

    try {
      createRelease(readFromStorage, writeToStorage, '3.5')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.message).toContain('already exists')
      expect(err.statusCode).toBe(409)
    }
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('fails if version is empty', () => {
    const { readFromStorage, writeToStorage } = createStorage({})

    expect(() => {
      createRelease(readFromStorage, writeToStorage, '')
    }).toThrow('Version is required')
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('creates the first release when config has no releases', () => {
    const { readFromStorage, writeToStorage } = createStorage({})

    const result = createRelease(readFromStorage, writeToStorage, '3.5')

    expect(result.version).toBe('3.5')
    expect(result.bigRockCount).toBe(0)
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/config.json', expect.any(Object))
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/releases/3.5.json', {
      release: '3.5',
      bigRocks: []
    })
  })
})

describe('cloneRelease', () => {
  it('clones Big Rocks from an existing release', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('A', 1), makeRock('B', 2)] } }
    )

    const result = cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    expect(result.version).toBe('3.6')
    expect(result.bigRockCount).toBe(2)
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/releases/3.6.json', expect.objectContaining({
      release: '3.6',
      bigRocks: expect.arrayContaining([
        expect.objectContaining({ name: 'A' }),
        expect.objectContaining({ name: 'B' })
      ])
    }))
  })

  it('deep-copies Big Rocks so modifying clone does not affect source', () => {
    const { readFromStorage, writeToStorage, _store } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [makeRock('A', 1), makeRock('B', 2)] } }
    )

    cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    const clonedData = _store['release-planning/releases/3.6.json']
    const sourceData = _store['release-planning/releases/3.5.json']

    clonedData.bigRocks[0].name = 'MODIFIED'
    expect(sourceData.bigRocks[0].name).toBe('A')
  })

  it('fails if source release does not exist', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [] } }
    )

    try {
      cloneRelease(readFromStorage, writeToStorage, '3.6', '9.9')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.message).toContain('9.9')
      expect(err.message).toContain('not found')
      expect(err.statusCode).toBe(404)
    }
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('fails if target version already exists', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      {
        '3.5': { release: '3.5' },
        '3.6': { release: '3.6' }
      },
      {
        '3.5': { release: '3.5', bigRocks: [makeRock('A', 1)] },
        '3.6': { release: '3.6', bigRocks: [] }
      }
    )

    try {
      cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.statusCode).toBe(409)
    }
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('clones from a release with empty Big Rocks', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': { release: '3.5', bigRocks: [] } }
    )

    const result = cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    expect(result.version).toBe('3.6')
    expect(result.bigRockCount).toBe(0)
  })

  it('preserves outcomeKeys as arrays in the clone', () => {
    const { readFromStorage, writeToStorage, _store } = createStorage(
      { '3.5': { release: '3.5' } },
      {
        '3.5': {
          release: '3.5',
          bigRocks: [{ ...makeRock('A', 1), outcomeKeys: ['KEY-1', 'KEY-2'] }]
        }
      }
    )

    cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    const clonedData = _store['release-planning/releases/3.6.json']
    expect(clonedData.bigRocks[0].outcomeKeys).toEqual(['KEY-1', 'KEY-2'])
    const sourceData = _store['release-planning/releases/3.5.json']
    expect(clonedData.bigRocks[0].outcomeKeys).not.toBe(sourceData.bigRocks[0].outcomeKeys)
  })
})

describe('deleteRelease', () => {
  it('deletes an existing release from config registry', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      {
        '3.5': { release: '3.5' },
        '3.6': { release: '3.6' }
      }
    )

    const result = deleteRelease(readFromStorage, writeToStorage, '3.5')

    expect(result.deleted).toBe('3.5')
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/config.json', expect.any(Object))
    const writtenConfig = writeToStorage.mock.calls[0][1]
    expect(writtenConfig.releases['3.5']).toBeUndefined()
    expect(writtenConfig.releases['3.6']).toBeDefined()
  })

  it('fails if release does not exist', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } }
    )

    try {
      deleteRelease(readFromStorage, writeToStorage, '9.9')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.message).toContain('9.9')
      expect(err.message).toContain('not found')
      expect(err.statusCode).toBe(404)
    }
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('returns the version name of the deleted release', () => {
    const { readFromStorage, writeToStorage } = createStorage(
      { '3.5': { release: '3.5' } }
    )

    const result = deleteRelease(readFromStorage, writeToStorage, '3.5')
    expect(result.deleted).toBe('3.5')
  })
})
