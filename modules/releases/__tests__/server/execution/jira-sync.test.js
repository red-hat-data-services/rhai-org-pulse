import { describe, it, expect, vi } from 'vitest'

const {
  syncAllFeatures,
  discoverFromJira,
  reconcileTrackingData
} = require('../../../server/execution/jira-sync')

function makeStorage(initialFiles = {}) {
  const files = { ...initialFiles }
  return {
    readFromStorage(key) { return files[key] || null },
    writeToStorage(key, data) { files[key] = data },
    listStorageFiles(dir) {
      const prefix = dir + '/'
      return Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length))
        .filter(k => !k.includes('/'))
    },
    _files: files
  }
}

describe('syncAllFeatures', () => {
  it('enriches existing features and writes merged results', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': {
        key: 'X-1', summary: 'Old', status: 'New',
        metrics: { health: 'YELLOW' }
      }
    })

    const mockJiraRequest = vi.fn()
    const mockFetchAll = vi.fn()
    // enrichFeatures calls fetchAllJqlResults twice (main + epics)
    mockFetchAll.mockResolvedValueOnce([{
      key: 'X-1',
      fields: {
        summary: 'Updated',
        status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
        assignee: { displayName: 'Alice', accountId: 'a-1' },
        fixVersions: [], components: [], labels: [],
        priority: { name: 'Normal' },
        issuelinks: [], created: null, updated: '2026-06-01T00:00:00Z',
        parent: null,
        customfield_10001: null, customfield_10851: null, customfield_10814: null,
        customfield_10712: null, customfield_10665: null, customfield_10023: null,
        customfield_10469: null, customfield_10862: null, customfield_10836: null,
        customfield_10838: null, customfield_10637: null, customfield_10864: null
      },
      renderedFields: {}
    }])
    mockFetchAll.mockResolvedValueOnce([]) // epics

    const result = await syncAllFeatures(storage, mockJiraRequest, mockFetchAll)

    expect(result.status).toBe('success')
    expect(result.enrichedCount).toBe(1)

    const feature = storage._files['releases/execution/features/X-1.json']
    expect(feature.status).toBe('In Progress')
    expect(feature.metrics).toEqual({ health: 'YELLOW' }) // preserved
    expect(feature._sources.jira).toBeDefined()
  })

  it('returns skipped when no features exist', async () => {
    const storage = makeStorage({})
    const result = await syncAllFeatures(storage, vi.fn(), vi.fn())
    expect(result.status).toBe('skipped')
  })
})

describe('discoverFromJira', () => {
  it('creates new feature entries for undiscovered keys', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': { key: 'X-1' }
    })

    const mockJiraRequest = vi.fn()
    const mockFetchAll = vi.fn().mockResolvedValueOnce([
      {
        key: 'X-1',
        fields: {
          summary: 'Existing', status: { name: 'New', statusCategory: { name: 'To Do' } },
          assignee: null, fixVersions: [], components: [], labels: [],
          priority: { name: 'Normal' }, issuelinks: [], created: null, updated: null,
          parent: null,
          customfield_10001: null, customfield_10851: null, customfield_10814: null,
          customfield_10712: null, customfield_10665: null, customfield_10023: null,
          customfield_10469: null, customfield_10862: null, customfield_10836: null,
          customfield_10838: null, customfield_10637: null, customfield_10864: null
        },
        renderedFields: {}
      },
      {
        key: 'X-2',
        fields: {
          summary: 'New Feature', status: { name: 'New', statusCategory: { name: 'To Do' } },
          assignee: null, fixVersions: [], components: [], labels: [],
          priority: { name: 'Normal' }, issuelinks: [], created: null, updated: null,
          parent: null,
          customfield_10001: null, customfield_10851: null, customfield_10814: null,
          customfield_10712: null, customfield_10665: null, customfield_10023: null,
          customfield_10469: null, customfield_10862: null, customfield_10836: null,
          customfield_10838: null, customfield_10637: null, customfield_10864: null
        },
        renderedFields: {}
      }
    ])

    const result = await discoverFromJira(storage, mockJiraRequest, mockFetchAll, {})
    expect(result.newFeatures).toBe(1)
    expect(storage._files['releases/execution/features/X-2.json']).toBeDefined()
  })
})

describe('reconcileTrackingData', () => {
  it('creates stubs for tracking keys not in store', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': { key: 'X-1' },
      'releases/execution/tracking-data-3.5.json': {
        features: { 'X-1': { key: 'X-1' }, 'X-2': { key: 'X-2' } }
      }
    })

    const result = await reconcileTrackingData(storage)
    expect(result.newStubs).toBe(1)
    expect(storage._files['releases/execution/features/X-2.json']).toBeDefined()
    expect(storage._files['releases/execution/features/X-2.json'].key).toBe('X-2')
  })

  it('handles array-style features', async () => {
    const storage = makeStorage({
      'releases/execution/tracking-data-3.5.json': {
        features: [{ key: 'X-1' }, { key: 'X-2' }]
      }
    })

    const result = await reconcileTrackingData(storage)
    expect(result.newStubs).toBe(2)
  })

  it('returns zero stubs when all keys exist', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': { key: 'X-1' },
      'releases/execution/tracking-data-3.5.json': {
        features: { 'X-1': { key: 'X-1' } }
      }
    })

    const result = await reconcileTrackingData(storage)
    expect(result.newStubs).toBe(0)
  })
})
