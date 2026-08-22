import { describe, it, expect, vi } from 'vitest'

const {
  fullJiraSync,
  detectStaleFeatures
} = require('../../../server/execution/jira-sync')

function makeStorage(initialFiles = {}) {
  const files = { ...initialFiles }
  return {
    async readFromStorage(key) { return files[key] || null },
    async writeToStorage(key, data) { files[key] = data },
    async listStorageFiles(dir) {
      const prefix = dir + '/'
      return Object.keys(files)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length))
        .filter(k => !k.includes('/'))
    },
    _files: files
  }
}

// Minimal Jira issue fixture for discoverFeatures/transformForEnrichment
function makeJiraIssue(key, overrides = {}) {
  return {
    key,
    fields: {
      summary: overrides.summary || 'Feature ' + key,
      status: { name: overrides.status || 'New', statusCategory: { name: overrides.statusCategory || 'To Do' } },
      issuetype: { name: 'Feature' },
      assignee: overrides.assignee || null,
      fixVersions: (overrides.fixVersions || []).map(v => ({ name: v })),
      components: [], labels: overrides.labels || [],
      priority: { name: 'Normal' },
      issuelinks: [], created: null, updated: overrides.updated || '2026-07-01T00:00:00Z',
      parent: null,
      customfield_10001: null, customfield_10851: null, customfield_10814: null,
      customfield_10712: null, customfield_10665: null, customfield_10023: null,
      customfield_10469: null, customfield_10855: null,
      customfield_10862: null, customfield_10836: null,
      customfield_10838: null, customfield_10637: null, customfield_10864: null,
      ...overrides.fields
    },
    renderedFields: {}
  }
}

describe('fullJiraSync', () => {
  it('creates new features for unknown keys', async () => {
    const storage = makeStorage({})

    const mockFetchAll = vi.fn()
    // discoverFeatures call
    mockFetchAll.mockResolvedValueOnce([
      makeJiraIssue('RHAISTRAT-1'),
      makeJiraIssue('RHAISTRAT-2')
    ])
    // fetchEpicsForFeatures call
    mockFetchAll.mockResolvedValueOnce([])

    const result = await fullJiraSync(storage, vi.fn(), mockFetchAll)

    expect(result.status).toBe('success')
    expect(result.featureCount).toBe(2)
    expect(result.newCount).toBe(2)
    expect(result.updatedCount).toBe(0)
    expect(result.jiraKeys).toBeInstanceOf(Set)
    expect(result.jiraKeys.has('RHAISTRAT-1')).toBe(true)

    // Verify features were written
    expect(storage._files['releases/execution/features/RHAISTRAT-1.json']).toBeDefined()
    expect(storage._files['releases/execution/features/RHAISTRAT-2.json']).toBeDefined()
    expect(storage._files['releases/execution/features/RHAISTRAT-1.json']._sources.jira).toBeDefined()
  })

  it('updates existing features while preserving pipeline + AI review fields', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1',
        summary: 'Old summary',
        status: 'New',
        metrics: { health: 'YELLOW', completionPct: 42 },
        aiReview: { recommendation: 'approve', scores: { quality: 8 } },
        _sources: { pipeline: '2026-06-01T00:00:00Z', jira: '2026-06-01T00:00:00Z' }
      }
    })

    const mockFetchAll = vi.fn()
    mockFetchAll.mockResolvedValueOnce([
      makeJiraIssue('RHAISTRAT-1', { summary: 'Updated summary', status: 'In Progress', statusCategory: 'In Progress' })
    ])
    mockFetchAll.mockResolvedValueOnce([]) // epics

    const result = await fullJiraSync(storage, vi.fn(), mockFetchAll)

    expect(result.status).toBe('success')
    expect(result.newCount).toBe(0)
    expect(result.updatedCount).toBe(1)

    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature.summary).toBe('Updated summary')
    expect(feature.status).toBe('In Progress')
    // Pipeline fields preserved
    expect(feature.metrics).toEqual({ health: 'YELLOW', completionPct: 42 })
    // AI review preserved (existing aiReview + jira-derived humanReviewStatus merged)
    expect(feature.aiReview.recommendation).toBe('approve')
    expect(feature.aiReview.scores).toEqual({ quality: 8 })
    // Sources updated
    expect(feature._sources.pipeline).toBe('2026-06-01T00:00:00Z')
    expect(feature._sources.jira).toBeDefined()
  })

  it('handles empty Jira results gracefully (no store wipe)', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Existing',
        _sources: { jira: '2026-06-01T00:00:00Z' }
      }
    })

    const mockFetchAll = vi.fn().mockResolvedValueOnce([])

    const result = await fullJiraSync(storage, vi.fn(), mockFetchAll)

    expect(result.status).toBe('skipped')
    // Existing feature should NOT be deleted
    expect(storage._files['releases/execution/features/RHAISTRAT-1.json']).toBeDefined()
  })

  it('writes last-enrichment.json metadata', async () => {
    const storage = makeStorage({})

    const mockFetchAll = vi.fn()
    mockFetchAll.mockResolvedValueOnce([makeJiraIssue('RHAISTRAT-1')])
    mockFetchAll.mockResolvedValueOnce([])

    await fullJiraSync(storage, vi.fn(), mockFetchAll)

    const meta = storage._files['releases/execution/last-enrichment.json']
    expect(meta).toBeDefined()
    expect(meta.status).toBe('success')
    expect(meta.featureCount).toBe(1)
  })

  it('attaches epics from fetchEpicsForFeatures', async () => {
    const storage = makeStorage({})

    const mockFetchAll = vi.fn()
    mockFetchAll.mockResolvedValueOnce([makeJiraIssue('RHAISTRAT-1')])
    // Epic discovery returns a child epic
    mockFetchAll.mockResolvedValueOnce([{
      key: 'RHAISTRAT-100',
      fields: {
        summary: 'Child Epic',
        status: { name: 'In Progress' },
        parent: { key: 'RHAISTRAT-1' },
        customfield_10014: null
      }
    }])

    await fullJiraSync(storage, vi.fn(), mockFetchAll)

    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature.epics).toHaveLength(1)
    expect(feature.epics[0].key).toBe('RHAISTRAT-100')
  })
})

describe('detectStaleFeatures', () => {
  it('flags features not returned by Jira that have _sources.jira', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Still in Jira',
        _sources: { jira: '2026-06-01T00:00:00Z' }
      },
      'releases/execution/features/RHAISTRAT-2.json': {
        key: 'RHAISTRAT-2', summary: 'Gone from Jira',
        _sources: { jira: '2026-06-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set(['RHAISTRAT-1'])
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(1)
    expect(result.recoveredCount).toBe(0)

    const staleFeature = storage._files['releases/execution/features/RHAISTRAT-2.json']
    expect(staleFeature._stale).toBeDefined()
    expect(staleFeature._stale.detectedAt).toBeDefined()

    // Non-stale feature should NOT have the flag
    const activeFeature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(activeFeature._stale).toBeUndefined()
  })

  it('clears _stale on features that reappear in Jira', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Was stale, now back',
        _stale: { detectedAt: '2026-06-01T00:00:00Z' },
        _sources: { jira: '2026-06-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set(['RHAISTRAT-1'])
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(0)
    expect(result.recoveredCount).toBe(1)

    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature._stale).toBeUndefined()
  })

  it('does not flag pipeline-only features (no _sources.jira)', async () => {
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Pipeline only',
        _sources: { pipeline: '2026-06-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set() // Not in Jira at all
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(0)
    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature._stale).toBeUndefined()
  })

  it('does not double-flag already stale features', async () => {
    const originalTimestamp = '2026-06-01T00:00:00Z'
    const storage = makeStorage({
      'releases/execution/features/RHAISTRAT-1.json': {
        key: 'RHAISTRAT-1', summary: 'Already stale',
        _stale: { detectedAt: originalTimestamp },
        _sources: { jira: '2026-05-01T00:00:00Z' }
      }
    })

    const jiraKeys = new Set()
    const result = await detectStaleFeatures(storage, jiraKeys)

    expect(result.staleCount).toBe(0) // Already stale, not newly stale
    const feature = storage._files['releases/execution/features/RHAISTRAT-1.json']
    expect(feature._stale.detectedAt).toBe(originalTimestamp) // Original timestamp preserved
  })

  it('handles empty store', async () => {
    const storage = makeStorage({})
    const result = await detectStaleFeatures(storage, new Set(['RHAISTRAT-1']))
    expect(result.staleCount).toBe(0)
    expect(result.recoveredCount).toBe(0)
  })
})

