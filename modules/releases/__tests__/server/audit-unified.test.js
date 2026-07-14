import { describe, it, expect } from 'vitest'

const { logAudit, getAuditLog } = require('../../server/planning/audit-log')

function createMockStorage(initial = {}) {
  const store = { ...initial }
  return {
    async readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null },
    async writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)) },
    _store: store
  }
}

const STORAGE_KEY = 'releases/audit-log.json'

function makeEntry(overrides = {}) {
  return {
    action: 'create',
    user: 'alice@example.com',
    summary: 'Created item',
    ...overrides
  }
}

describe('logAudit', () => {
  it('creates entries with correct structure', async () => {
    const { readFromStorage, writeToStorage, _store } = createMockStorage()

    await logAudit(readFromStorage, writeToStorage, {
      domain: 'planning',
      version: '2.0',
      action: 'create',
      user: 'alice@example.com',
      summary: 'Created big rock',
      details: { key: 'BR-1' }
    })

    const log = _store[STORAGE_KEY]
    expect(log.entries).toHaveLength(1)
    const entry = log.entries[0]
    expect(entry.id).toMatch(/^audit-/)
    expect(entry.timestamp).toBeTruthy()
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp)
    expect(entry.domain).toBe('planning')
    expect(entry.version).toBe('2.0')
    expect(entry.action).toBe('create')
    expect(entry.user).toBe('alice@example.com')
    expect(entry.summary).toBe('Created big rock')
    expect(entry.details).toEqual({ key: 'BR-1' })
  })

  it('defaults domain to planning when not specified', async () => {
    const { readFromStorage, writeToStorage, _store } = createMockStorage()

    await logAudit(readFromStorage, writeToStorage, makeEntry())

    const entry = _store[STORAGE_KEY].entries[0]
    expect(entry.domain).toBe('planning')
  })

  it('supports cross-domain logging', async () => {
    const { readFromStorage, writeToStorage, _store } = createMockStorage()

    const domains = ['execution', 'delivery', 'registry']
    for (const domain of domains) {
      await logAudit(readFromStorage, writeToStorage, makeEntry({ domain }))
    }

    const entries = _store[STORAGE_KEY].entries
    expect(entries).toHaveLength(3)
    expect(entries[0].domain).toBe('execution')
    expect(entries[1].domain).toBe('delivery')
    expect(entries[2].domain).toBe('registry')
  })

  it('sets version to null when not specified', async () => {
    const { readFromStorage, writeToStorage, _store } = createMockStorage()

    await logAudit(readFromStorage, writeToStorage, makeEntry())

    expect(_store[STORAGE_KEY].entries[0].version).toBeNull()
  })

  it('sets details to null when not provided', async () => {
    const { readFromStorage, writeToStorage, _store } = createMockStorage()

    await logAudit(readFromStorage, writeToStorage, makeEntry())

    expect(_store[STORAGE_KEY].entries[0].details).toBeNull()
  })

  it('truncates entries to MAX_ENTRIES when exceeded', async () => {
    const existing = Array.from({ length: 5000 }, (_, i) => ({
      id: `audit-old-${i}`,
      timestamp: '2026-01-01T00:00:00.000Z',
      domain: 'planning',
      version: null,
      action: 'old',
      user: 'old@example.com',
      summary: `Old entry ${i}`,
      details: null
    }))

    const { readFromStorage, writeToStorage, _store } = createMockStorage({
      [STORAGE_KEY]: { entries: existing }
    })

    await logAudit(readFromStorage, writeToStorage, makeEntry({ summary: 'New entry' }))

    const log = _store[STORAGE_KEY]
    expect(log.entries).toHaveLength(5000)
    // Oldest entry should have been trimmed; newest should be last
    expect(log.entries[log.entries.length - 1].summary).toBe('New entry')
    expect(log.entries[0].id).toBe('audit-old-1')
  })

  it('handles empty/missing storage gracefully', async () => {
    const { readFromStorage, writeToStorage, _store } = createMockStorage()

    await logAudit(readFromStorage, writeToStorage, makeEntry())

    expect(_store[STORAGE_KEY].entries).toHaveLength(1)
  })
})

describe('getAuditLog', () => {
  function buildLog(entries) {
    return {
      [STORAGE_KEY]: {
        entries: entries.map((e, i) => ({
          id: `audit-${i}`,
          timestamp: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
          domain: 'planning',
          version: null,
          action: 'create',
          user: 'alice@example.com',
          summary: `Entry ${i}`,
          details: null,
          ...e
        }))
      }
    }
  }

  it('returns all entries when no filters specified', async () => {
    const { readFromStorage } = createMockStorage(buildLog([{}, {}, {}]))

    const result = await getAuditLog(readFromStorage)
    expect(result.entries).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it('filters by version', async () => {
    const { readFromStorage } = createMockStorage(buildLog([
      { version: '2.0' },
      { version: '3.0' },
      { version: '2.0' }
    ]))

    const result = await getAuditLog(readFromStorage, { version: '2.0' })
    expect(result.entries).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.entries.every(e => e.version === '2.0')).toBe(true)
  })

  it('filters by action', async () => {
    const { readFromStorage } = createMockStorage(buildLog([
      { action: 'create' },
      { action: 'delete' },
      { action: 'create' }
    ]))

    const result = await getAuditLog(readFromStorage, { action: 'delete' })
    expect(result.entries).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.entries[0].action).toBe('delete')
  })

  it('filters by domain', async () => {
    const { readFromStorage } = createMockStorage(buildLog([
      { domain: 'planning' },
      { domain: 'execution' },
      { domain: 'delivery' },
      { domain: 'execution' }
    ]))

    const result = await getAuditLog(readFromStorage, { domain: 'execution' })
    expect(result.entries).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.entries.every(e => e.domain === 'execution')).toBe(true)
  })

  it('supports pagination with limit and offset', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ summary: `Entry ${i}` }))
    const { readFromStorage } = createMockStorage(buildLog(items))

    const result = await getAuditLog(readFromStorage, { limit: 3, offset: 2 })
    expect(result.entries).toHaveLength(3)
    expect(result.total).toBe(10)
  })

  it('returns entries in reverse chronological order (newest first)', async () => {
    const { readFromStorage } = createMockStorage(buildLog([
      { summary: 'First' },
      { summary: 'Second' },
      { summary: 'Third' }
    ]))

    const result = await getAuditLog(readFromStorage)
    expect(result.entries[0].summary).toBe('Third')
    expect(result.entries[1].summary).toBe('Second')
    expect(result.entries[2].summary).toBe('First')
  })

  it('returns total count reflecting filters', async () => {
    const { readFromStorage } = createMockStorage(buildLog([
      { domain: 'planning' },
      { domain: 'execution' },
      { domain: 'planning' }
    ]))

    const result = await getAuditLog(readFromStorage, { domain: 'planning' })
    expect(result.total).toBe(2)
  })

  it('returns empty result for no data', async () => {
    const { readFromStorage } = createMockStorage()

    const result = await getAuditLog(readFromStorage)
    expect(result.entries).toEqual([])
    expect(result.total).toBe(0)
  })
})
