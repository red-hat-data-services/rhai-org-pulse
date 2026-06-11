import { describe, it, expect } from 'vitest'

const {
  mergeFeatureData,
  writeFeatures,
  rebuildIndex
} = require('../../../server/execution/feature-store')

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

describe('mergeFeatureData', () => {
  it('Jira-owned fields win over existing when jiraData provided', () => {
    const existing = { key: 'X-1', status: 'New', metrics: { health: 'GREEN' } }
    const jira = { key: 'X-1', status: 'In Progress', summary: 'Updated' }
    const result = mergeFeatureData(existing, null, jira)
    expect(result.status).toBe('In Progress')
    expect(result.metrics).toEqual({ health: 'GREEN' })
  })

  it('preserves existing Jira fields when jiraData is null', () => {
    const existing = { key: 'X-1', status: 'In Progress', colorStatus: 'Green' }
    const result = mergeFeatureData(existing, null, null)
    expect(result.status).toBe('In Progress')
    expect(result.colorStatus).toBe('Green')
  })

  it('pipeline-owned fields overwrite existing', () => {
    const existing = { key: 'X-1', metrics: { health: 'YELLOW' } }
    const pipeline = { key: 'X-1', metrics: { health: 'GREEN' } }
    const result = mergeFeatureData(existing, pipeline, null)
    expect(result.metrics).toEqual({ health: 'GREEN' })
  })

  it('pipeline-index-only fields are preserved across Jira syncs', () => {
    const existing = { key: 'X-1', architect: 'Bob', parentKey: 'X-0' }
    const jira = { key: 'X-1', status: 'Done' }
    const result = mergeFeatureData(existing, null, jira)
    expect(result.architect).toBe('Bob')
    expect(result.parentKey).toBe('X-0')
  })

  it('sets _sources timestamps correctly', () => {
    const result = mergeFeatureData(null, { key: 'X-1' }, { key: 'X-1' })
    expect(result._sources.pipeline).toBeDefined()
    expect(result._sources.jira).toBeDefined()
  })

  it('only sets pipeline _source when no jiraData', () => {
    const result = mergeFeatureData(null, { key: 'X-1' }, null)
    expect(result._sources.pipeline).toBeDefined()
    expect(result._sources.jira).toBeUndefined()
  })

  it('picks latest updated timestamp', () => {
    const existing = { key: 'X-1' }
    const pipeline = { key: 'X-1', updated: '2026-01-01T00:00:00Z' }
    const jira = { key: 'X-1', updated: '2026-06-01T00:00:00Z' }
    const result = mergeFeatureData(existing, pipeline, jira)
    expect(result.updated).toBe('2026-06-01T00:00:00Z')
  })

  it('Jira is source of truth for created timestamp', () => {
    const existing = { key: 'X-1', created: '2025-01-01T00:00:00Z' }
    const pipeline = { key: 'X-1', created: '2025-01-01T00:00:00Z' }
    const jira = { key: 'X-1', created: '2025-06-01T00:00:00Z' }
    const result = mergeFeatureData(existing, pipeline, jira)
    expect(result.created).toBe('2025-06-01T00:00:00Z')
  })

  it('falls back to pipeline created when Jira has none', () => {
    const pipeline = { key: 'X-1', created: '2025-03-01T00:00:00Z' }
    const result = mergeFeatureData(null, pipeline, null)
    expect(result.created).toBe('2025-03-01T00:00:00Z')
  })

  it('Jira-only discovery populates created', () => {
    const jira = { key: 'X-1', created: '2025-06-01T00:00:00Z' }
    const result = mergeFeatureData(null, null, jira)
    expect(result.created).toBe('2025-06-01T00:00:00Z')
  })

  it('handles all null inputs gracefully', () => {
    const result = mergeFeatureData(null, null, null)
    expect(result).toBeDefined()
    expect(result._sources).toEqual({})
  })

  it('writes both colorStatus and ownerStatusColor for backward compat', () => {
    const jira = { key: 'X-1', colorStatus: 'Green', ownerStatusColor: 'Green' }
    const result = mergeFeatureData(null, null, jira)
    expect(result.colorStatus).toBe('Green')
    expect(result.ownerStatusColor).toBe('Green')
  })
})

describe('rebuildIndex', () => {
  it('builds index from feature files', async () => {
    const storage = makeStorage({
      'releases/execution/features/X-1.json': {
        key: 'X-1', summary: 'Feature 1', status: 'New',
        statusCategory: 'To Do', priority: 'Normal',
        assignee: { displayName: 'Alice', accountId: 'a-1' },
        fixVersions: ['3.5'], labels: ['core'],
        metrics: { completionPct: 50, totalEpics: 2, totalIssues: 10, blockerCount: 1, health: 'YELLOW' },
        updated: '2026-01-01', colorStatus: 'Green'
      },
      'releases/execution/features/X-2.json': {
        key: 'X-2', summary: 'Feature 2', status: 'Done',
        assignee: 'Bob',
        metrics: null
      }
    })

    await rebuildIndex(storage)

    const index = storage._files['releases/execution/index.json']
    expect(index.featureCount).toBe(2)
    expect(index.features[0].assignee).toBe('Alice') // object -> string for index
    expect(index.features[0].completionPct).toBe(50)
    expect(index.features[0].health).toBe('YELLOW')
    expect(index.features[0].colorStatus).toBe('Green')
    expect(index.features[0].ownerStatusColor).toBe('Green')
    expect(index.features[1].assignee).toBe('Bob') // already string
  })

  it('writes empty index when no feature files exist', async () => {
    const storage = makeStorage({})
    await rebuildIndex(storage)

    const index = storage._files['releases/execution/index.json']
    expect(index.featureCount).toBe(0)
    expect(index.features).toEqual([])
  })
})

describe('writeFeatures', () => {
  it('writes feature files and rebuilds index', async () => {
    const storage = makeStorage({})
    await writeFeatures(storage, [
      { key: 'X-1', summary: 'F1', status: 'New' },
      { key: 'X-2', summary: 'F2', status: 'Done' }
    ])

    expect(storage._files['releases/execution/features/X-1.json']).toBeDefined()
    expect(storage._files['releases/execution/features/X-2.json']).toBeDefined()
    expect(storage._files['releases/execution/index.json'].featureCount).toBe(2)
  })

  it('skips features without key', async () => {
    const storage = makeStorage({})
    await writeFeatures(storage, [
      { summary: 'No key' },
      { key: 'X-1', summary: 'Has key' }
    ])

    expect(storage._files['releases/execution/features/X-1.json']).toBeDefined()
    expect(storage._files['releases/execution/index.json'].featureCount).toBe(1)
  })
})
