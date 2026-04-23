import { describe, it, expect, vi } from 'vitest'
const { createRelease, cloneRelease, deleteRelease } = require('../../server/config')

function createStorageWithConfig(config) {
  const stored = JSON.parse(JSON.stringify(config))
  return {
    readFromStorage: vi.fn().mockReturnValue(stored),
    writeToStorage: vi.fn()
  }
}

function makeConfig(releases) {
  return { releases: releases || {} }
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
    const config = makeConfig({ '3.5': { release: '3.5', bigRocks: [] } })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = createRelease(readFromStorage, writeToStorage, '3.6')

    expect(result.version).toBe('3.6')
    expect(result.bigRockCount).toBe(0)
    expect(writeToStorage).toHaveBeenCalledWith('release-planning/config.json', expect.objectContaining({
      releases: expect.objectContaining({
        '3.6': expect.objectContaining({
          release: '3.6',
          bigRocks: []
        })
      })
    }))
  })

  it('fails if version already exists (409)', () => {
    const config = makeConfig({ '3.5': { release: '3.5', bigRocks: [] } })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

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
    const config = makeConfig({})
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    expect(() => {
      createRelease(readFromStorage, writeToStorage, '')
    }).toThrow('Version is required')
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('creates the first release when config has no releases', () => {
    const config = makeConfig({})
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = createRelease(readFromStorage, writeToStorage, '3.5')

    expect(result.version).toBe('3.5')
    expect(result.bigRockCount).toBe(0)
    expect(writeToStorage).toHaveBeenCalled()
  })
})

describe('cloneRelease', () => {
  it('clones Big Rocks from an existing release', () => {
    const config = makeConfig({
      '3.5': {
        release: '3.5',
        bigRocks: [makeRock('A', 1), makeRock('B', 2)]
      }
    })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    expect(result.version).toBe('3.6')
    expect(result.bigRockCount).toBe(2)
    expect(writeToStorage).toHaveBeenCalled()
  })

  it('deep-copies Big Rocks so modifying clone does not affect source', () => {
    const sourceRocks = [makeRock('A', 1), makeRock('B', 2)]
    const config = makeConfig({
      '3.5': { release: '3.5', bigRocks: sourceRocks }
    })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    // Get the written config to check the cloned data
    const writtenConfig = writeToStorage.mock.calls[0][1]
    const clonedRocks = writtenConfig.releases['3.6'].bigRocks
    const originalRocks = writtenConfig.releases['3.5'].bigRocks

    // Modify the clone
    clonedRocks[0].name = 'MODIFIED'

    // Original should be unchanged
    expect(originalRocks[0].name).toBe('A')
    expect(clonedRocks[0].name).toBe('MODIFIED')
  })

  it('fails if source release does not exist', () => {
    const config = makeConfig({ '3.5': { release: '3.5', bigRocks: [] } })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

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
    const config = makeConfig({
      '3.5': { release: '3.5', bigRocks: [makeRock('A', 1)] },
      '3.6': { release: '3.6', bigRocks: [] }
    })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    try {
      cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err.statusCode).toBe(409)
    }
    expect(writeToStorage).not.toHaveBeenCalled()
  })

  it('clones from a release with empty Big Rocks', () => {
    const config = makeConfig({
      '3.5': { release: '3.5', bigRocks: [] }
    })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    expect(result.version).toBe('3.6')
    expect(result.bigRockCount).toBe(0)
  })

  it('preserves outcomeKeys as arrays in the clone', () => {
    const config = makeConfig({
      '3.5': {
        release: '3.5',
        bigRocks: [
          { ...makeRock('A', 1), outcomeKeys: ['KEY-1', 'KEY-2'] }
        ]
      }
    })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    cloneRelease(readFromStorage, writeToStorage, '3.6', '3.5')

    const writtenConfig = writeToStorage.mock.calls[0][1]
    const clonedRocks = writtenConfig.releases['3.6'].bigRocks
    expect(clonedRocks[0].outcomeKeys).toEqual(['KEY-1', 'KEY-2'])
    // Verify deep copy of nested array
    expect(clonedRocks[0].outcomeKeys).not.toBe(
      writtenConfig.releases['3.5'].bigRocks[0].outcomeKeys
    )
  })
})

describe('deleteRelease', () => {
  it('deletes an existing release', () => {
    const config = makeConfig({
      '3.5': { release: '3.5', bigRocks: [makeRock('A', 1)] },
      '3.6': { release: '3.6', bigRocks: [] }
    })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = deleteRelease(readFromStorage, writeToStorage, '3.5')

    expect(result.deleted).toBe('3.5')
    expect(writeToStorage).toHaveBeenCalled()
    const writtenConfig = writeToStorage.mock.calls[0][1]
    expect(writtenConfig.releases['3.5']).toBeUndefined()
    expect(writtenConfig.releases['3.6']).toBeDefined()
  })

  it('fails if release does not exist', () => {
    const config = makeConfig({ '3.5': { release: '3.5', bigRocks: [] } })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

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
    const config = makeConfig({
      '3.5': { release: '3.5', bigRocks: [] }
    })
    const { readFromStorage, writeToStorage } = createStorageWithConfig(config)

    const result = deleteRelease(readFromStorage, writeToStorage, '3.5')

    expect(result.deleted).toBe('3.5')
  })
})
