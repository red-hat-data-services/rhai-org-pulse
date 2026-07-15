import { describe, it, expect, vi } from 'vitest'
const { parseDocId, executeDocImport } = require('../../../server/planning/doc-import')

function createStorage(configReleases, releaseFiles) {
  const store = {
    'releases/planning/config.json': { releases: configReleases || {} }
  }
  if (releaseFiles) {
    for (const v in releaseFiles) {
      store['releases/planning/releases/' + v + '.json'] = releaseFiles[v]
    }
  }
  return {
    readFromStorage: vi.fn(async function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    }),
    writeToStorage: vi.fn(async function(key, data) {
      store[key] = JSON.parse(JSON.stringify(data))
    }),
    _store: store
  }
}

function makeReleaseFile(bigRocks, version) {
  version = version || '3.5'
  return { release: version, bigRocks: bigRocks || [] }
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
    it('replaces all existing Big Rocks', async () => {
      const storage = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          makeRock('Old Rock A', ['RHAISTRAT-100']),
          makeRock('Old Rock B', ['RHAISTRAT-200'])
        ]) }
      )
      const parsedDoc = makeParsedDoc([
        makeRock('New Rock 1', ['RHAISTRAT-300']),
        makeRock('New Rock 2', ['RHAISTRAT-400'])
      ])

      const result = await executeDocImport(
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
    it('adds new rocks after existing ones', async () => {
      const storage = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          makeRock('Existing', ['RHAISTRAT-100'])
        ]) }
      )
      const parsedDoc = makeParsedDoc([
        makeRock('New Rock', ['RHAISTRAT-200'])
      ])

      const result = await executeDocImport(
        storage.readFromStorage, storage.writeToStorage,
        '3.5', 'test-doc-id', 'append', parsedDoc
      )

      expect(result.imported).toBe(1)
      expect(result.skipped).toBe(0)
      expect(result.mode).toBe('append')
      expect(result.bigRocks).toHaveLength(2)
    })

    it('skips duplicate names', async () => {
      const storage = createStorage(
        { '3.5': { release: '3.5' } },
        { '3.5': makeReleaseFile([
          makeRock('MaaS', ['RHAISTRAT-100'])
        ]) }
      )
      const parsedDoc = makeParsedDoc([
        makeRock('MaaS', ['RHAISTRAT-200']),
        makeRock('New Rock', ['RHAISTRAT-300'])
      ])

      const result = await executeDocImport(
        storage.readFromStorage, storage.writeToStorage,
        '3.5', 'test-doc-id', 'append', parsedDoc
      )

      expect(result.imported).toBe(1)
      expect(result.skipped).toBe(1)
      expect(result.skippedNames).toEqual(['MaaS'])
      expect(result.bigRocks).toHaveLength(2)
    })
  })

  it('throws when no Big Rocks are parsed', async () => {
    const storage = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([]) }
    )
    const parsedDoc = makeParsedDoc([])

    await expect(executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'replace', parsedDoc
    )).rejects.toThrow('No Big Rocks could be extracted')
  })

  it('throws when release version not found', async () => {
    const storage = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([]) }
    )
    const parsedDoc = makeParsedDoc([makeRock('Test')])

    await expect(executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '9.9', 'test-doc-id', 'replace', parsedDoc
    )).rejects.toThrow('Release 9.9 not found')
  })

  it('skips rocks that fail validation', async () => {
    const storage = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([]) }
    )
    const longName = 'A'.repeat(101)
    const parsedDoc = makeParsedDoc([
      makeRock(longName),
      makeRock('Valid Rock', ['RHAISTRAT-100'])
    ])

    const result = await executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'replace', parsedDoc
    )

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.validationErrors).toHaveLength(1)
    expect(result.validationErrors[0].name).toBe(longName)
  })

  it('writes per-release file exactly once in replace mode', async () => {
    const storage = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([
        makeRock('Old A', ['RHAISTRAT-100']),
        makeRock('Old B', ['RHAISTRAT-200']),
        makeRock('Old C', ['RHAISTRAT-300'])
      ]) }
    )
    const parsedDoc = makeParsedDoc([
      makeRock('New 1', ['RHAISTRAT-400']),
      makeRock('New 2', ['RHAISTRAT-500'])
    ])

    await executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'replace', parsedDoc
    )

    expect(storage.writeToStorage).toHaveBeenCalledTimes(1)
    expect(storage.writeToStorage).toHaveBeenCalledWith(
      'releases/planning/releases/3.5.json',
      expect.any(Object)
    )
  })

  it('writes per-release file exactly once in append mode', async () => {
    const storage = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([
        makeRock('Existing', ['RHAISTRAT-100'])
      ]) }
    )
    const parsedDoc = makeParsedDoc([
      makeRock('New A', ['RHAISTRAT-200']),
      makeRock('New B', ['RHAISTRAT-300'])
    ])

    await executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'append', parsedDoc
    )

    expect(storage.writeToStorage).toHaveBeenCalledTimes(1)
    expect(storage.writeToStorage).toHaveBeenCalledWith(
      'releases/planning/releases/3.5.json',
      expect.any(Object)
    )
  })

  it('renumbers priorities sequentially', async () => {
    const storage = createStorage(
      { '3.5': { release: '3.5' } },
      { '3.5': makeReleaseFile([]) }
    )
    const parsedDoc = makeParsedDoc([
      makeRock('Rock A'),
      makeRock('Rock B'),
      makeRock('Rock C')
    ])

    const result = await executeDocImport(
      storage.readFromStorage, storage.writeToStorage,
      '3.5', 'test-doc-id', 'replace', parsedDoc
    )

    expect(result.bigRocks[0].priority).toBe(1)
    expect(result.bigRocks[1].priority).toBe(2)
    expect(result.bigRocks[2].priority).toBe(3)
  })
})
