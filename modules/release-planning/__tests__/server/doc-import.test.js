import { describe, it, expect, vi } from 'vitest'
const { parseDocId, executeDocImport } = require('../../server/doc-import')

function createStorageWithConfig(config) {
  let stored = JSON.parse(JSON.stringify(config))
  return {
    readFromStorage: vi.fn(function() { return stored }),
    writeToStorage: vi.fn(function(key, data) {
      stored = JSON.parse(JSON.stringify(data))
    })
  }
}

function makeConfig(bigRocks, version) {
  version = version || '3.5'
  const releases = {}
  releases[version] = { release: version, bigRocks: bigRocks || [] }
  return { releases: releases }
}

function makeParsedDoc(rocks) {
  return {
    title: 'Test Doc',
    bigRocks: rocks,
    warnings: []
  }
}

function makeRock(name, outcomeKeys) {
  return {
    priority: 1,
    name: name,
    fullName: name,
    pillar: '',
    state: '',
    owner: '',
    outcomeKeys: outcomeKeys || [],
    notes: '',
    description: ''
  }
}

describe('parseDocId', () => {
  it('extracts ID from a full Google Doc URL', () => {
    expect(parseDocId('https://docs.google.com/document/d/1yD6jDFmnP5prpo-wR3ikPInufCsQIa5GoZKxOBuQzGc/edit'))
      .toBe('1yD6jDFmnP5prpo-wR3ikPInufCsQIa5GoZKxOBuQzGc')
  })

  it('accepts a raw document ID', () => {
    expect(parseDocId('1yD6jDFmnP5prpo-wR3ikPInufCsQIa5GoZKxOBuQzGc'))
      .toBe('1yD6jDFmnP5prpo-wR3ikPInufCsQIa5GoZKxOBuQzGc')
  })

  it('trims whitespace', () => {
    expect(parseDocId('  1yD6jDFmnP5prpo-wR3ikPInufCsQIa5GoZKxOBuQzGc  '))
      .toBe('1yD6jDFmnP5prpo-wR3ikPInufCsQIa5GoZKxOBuQzGc')
  })

  it('returns null for empty input', () => {
    expect(parseDocId('')).toBe(null)
    expect(parseDocId(null)).toBe(null)
    expect(parseDocId(undefined)).toBe(null)
  })

  it('returns null for short strings', () => {
    expect(parseDocId('abc')).toBe(null)
  })

  it('returns null for non-string input', () => {
    expect(parseDocId(123)).toBe(null)
  })
})

describe('executeDocImport', () => {
  describe('replace mode', () => {
    it('replaces all existing Big Rocks', () => {
      const config = makeConfig([
        makeRock('Old Rock A', ['RHAISTRAT-100']),
        makeRock('Old Rock B', ['RHAISTRAT-200'])
      ])
      const storage = createStorageWithConfig(config)
      const parsedDoc = makeParsedDoc([
        makeRock('New Rock 1', ['RHAISTRAT-300']),
        makeRock('New Rock 2', ['RHAISTRAT-400'])
      ])

      const result = executeDocImport(
        storage.readFromStorage, storage.writeToStorage,
        '3.5', 'test-doc-id', 'replace', parsedDoc
      )

      expect(result.imported).toBe(2)
      expect(result.skipped).toBe(0)
      expect(result.mode).toBe('replace')
      expect(result.bigRocks).toHaveLength(2)
      expect(result.bigRocks[0].name).toBe('New Rock 1')
      expect(result.bigRocks[1].name).toBe('New Rock 2')
    })
  })

  describe('append mode', () => {
    it('adds new rocks after existing ones', () => {
      const config = makeConfig([
        makeRock('Existing', ['RHAISTRAT-100'])
      ])
      const storage = createStorageWithConfig(config)
      const parsedDoc = makeParsedDoc([
        makeRock('New Rock', ['RHAISTRAT-200'])
      ])

      const result = executeDocImport(
        storage.readFromStorage, storage.writeToStorage,
        '3.5', 'test-doc-id', 'append', parsedDoc
      )

      expect(result.imported).toBe(1)
      expect(result.skipped).toBe(0)
      expect(result.mode).toBe('append')
      expect(result.bigRocks).toHaveLength(2)
    })

    it('skips duplicate names', () => {
      const config = makeConfig([
        makeRock('MaaS', ['RHAISTRAT-100'])
      ])
      const storage = createStorageWithConfig(config)
      const parsedDoc = makeParsedDoc([
        makeRock('MaaS', ['RHAISTRAT-200']),
        makeRock('New Rock', ['RHAISTRAT-300'])
      ])

      const result = executeDocImport(
        storage.readFromStorage, storage.writeToStorage,
        '3.5', 'test-doc-id', 'append', parsedDoc
      )

      expect(result.imported).toBe(1)
      expect(result.skipped).toBe(1)
      expect(result.skippedNames).toEqual(['MaaS'])
      expect(result.bigRocks).toHaveLength(2)
    })
  })

  it('throws when no Big Rocks are parsed', () => {
    const config = makeConfig([])
    const storage = createStorageWithConfig(config)
    const parsedDoc = makeParsedDoc([])

    expect(function() {
      executeDocImport(
        storage.readFromStorage, storage.writeToStorage,
        '3.5', 'test-doc-id', 'replace', parsedDoc
      )
    }).toThrow('No Big Rocks could be extracted')
  })

  it('throws when release version not found', () => {
    const config = makeConfig([], '3.5')
    const storage = createStorageWithConfig(config)
    const parsedDoc = makeParsedDoc([makeRock('Test')])

    expect(function() {
      executeDocImport(
        storage.readFromStorage, storage.writeToStorage,
        '9.9', 'test-doc-id', 'replace', parsedDoc
      )
    }).toThrow('Release 9.9 not found')
  })

  it('skips rocks that fail validation', () => {
    const config = makeConfig([])
    const storage = createStorageWithConfig(config)
    // Name exceeding 100 chars
    const longName = 'A'.repeat(101)
    const parsedDoc = makeParsedDoc([
      makeRock(longName),
      makeRock('Valid Rock', ['RHAISTRAT-100'])
    ])

    const result = executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'replace', parsedDoc
    )

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.validationErrors).toHaveLength(1)
    expect(result.validationErrors[0].name).toBe(longName)
  })

  it('writes config exactly once in replace mode', () => {
    const config = makeConfig([
      makeRock('Old A', ['RHAISTRAT-100']),
      makeRock('Old B', ['RHAISTRAT-200']),
      makeRock('Old C', ['RHAISTRAT-300'])
    ])
    const storage = createStorageWithConfig(config)
    const parsedDoc = makeParsedDoc([
      makeRock('New 1', ['RHAISTRAT-400']),
      makeRock('New 2', ['RHAISTRAT-500'])
    ])

    executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'replace', parsedDoc
    )

    expect(storage.writeToStorage).toHaveBeenCalledTimes(1)
  })

  it('writes config exactly once in append mode', () => {
    const config = makeConfig([
      makeRock('Existing', ['RHAISTRAT-100'])
    ])
    const storage = createStorageWithConfig(config)
    const parsedDoc = makeParsedDoc([
      makeRock('New A', ['RHAISTRAT-200']),
      makeRock('New B', ['RHAISTRAT-300'])
    ])

    executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'append', parsedDoc
    )

    expect(storage.writeToStorage).toHaveBeenCalledTimes(1)
  })

  it('renumbers priorities sequentially', () => {
    const config = makeConfig([])
    const storage = createStorageWithConfig(config)
    const parsedDoc = makeParsedDoc([
      makeRock('Rock A'),
      makeRock('Rock B'),
      makeRock('Rock C')
    ])

    const result = executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'replace', parsedDoc
    )

    expect(result.bigRocks[0].priority).toBe(1)
    expect(result.bigRocks[1].priority).toBe(2)
    expect(result.bigRocks[2].priority).toBe(3)
  })
})
