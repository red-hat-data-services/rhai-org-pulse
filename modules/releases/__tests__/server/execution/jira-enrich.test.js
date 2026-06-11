import { describe, it, expect, vi } from 'vitest'

const {
  enrichFeatures,
  transformForEnrichment,
  extractIssueLinks,
  checkIsBlocked,
  findLinkedRfeKey
} = require('../../../server/execution/jira-enrich')

function makeJiraIssue(key, overrides = {}) {
  return {
    key,
    fields: {
      summary: overrides.summary || 'Test feature',
      status: { name: overrides.status || 'In Progress', statusCategory: { name: 'In Progress' } },
      assignee: 'assignee' in overrides ? overrides.assignee : { displayName: 'Alice', accountId: 'alice-123' },
      fixVersions: (overrides.fixVersions || ['rhoai-3.5']).map(v => ({ name: v })),
      components: (overrides.components || ['Serving']).map(c => ({ name: c })),
      labels: overrides.labels || ['core'],
      priority: { name: overrides.priority || 'Normal' },
      issuelinks: overrides.issuelinks || [],
      created: '2026-01-01T00:00:00.000+0000',
      updated: '2026-06-01T00:00:00.000+0000',
      parent: overrides.parent || null,
      customfield_10001: overrides.team ? { name: overrides.team } : null,
      customfield_10851: overrides.releaseType ? { name: overrides.releaseType } : null,
      customfield_10814: overrides.statusSummary || null,
      customfield_10712: overrides.colorStatus ? { name: overrides.colorStatus } : null,
      customfield_10665: overrides.docsRequired ? { name: overrides.docsRequired } : null,
      customfield_10023: overrides.targetEnd || null,
      customfield_10469: overrides.pmOwner || null,
      customfield_10862: overrides.reach || null,
      customfield_10836: overrides.impact || null,
      customfield_10838: overrides.confidence || null,
      customfield_10637: overrides.effort || null,
      customfield_10864: overrides.riceScore || null,
      ...overrides.fields
    },
    renderedFields: overrides.renderedFields || {}
  }
}

describe('transformForEnrichment', () => {
  it('preserves assignee as object, not string', () => {
    const issue = makeJiraIssue('RHAISTRAT-100')
    const result = transformForEnrichment(issue)
    expect(result.assignee).toEqual({ displayName: 'Alice', accountId: 'alice-123' })
  })

  it('maps colorStatus from custom field', () => {
    const issue = makeJiraIssue('RHAISTRAT-100', { colorStatus: 'Green' })
    const result = transformForEnrichment(issue)
    expect(result.colorStatus).toBe('Green')
    expect(result.ownerStatusColor).toBe('Green')
  })

  it('handles null assignee', () => {
    const issue = makeJiraIssue('RHAISTRAT-100', { assignee: null })
    const result = transformForEnrichment(issue)
    expect(result.assignee).toBeNull()
  })

  it('maps status and statusCategory', () => {
    const issue = makeJiraIssue('RHAISTRAT-100', { status: 'Release Pending' })
    const result = transformForEnrichment(issue)
    expect(result.status).toBe('Release Pending')
    expect(result.statusCategory).toBe('In Progress')
  })

  it('extracts components and fixVersions as arrays of strings', () => {
    const issue = makeJiraIssue('RHAISTRAT-100', {
      components: ['Serving', 'Pipelines'],
      fixVersions: ['rhoai-3.5', 'rhoai-3.6']
    })
    const result = transformForEnrichment(issue)
    expect(result.components).toEqual(['Serving', 'Pipelines'])
    expect(result.fixVersions).toEqual(['rhoai-3.5', 'rhoai-3.6'])
  })
})

describe('extractIssueLinks', () => {
  it('normalizes outward and inward links', () => {
    const links = [
      {
        type: { name: 'Cloners' },
        outwardIssue: {
          key: 'RHAIRFE-100',
          fields: { summary: 'RFE', status: { name: 'Approved' } }
        }
      },
      {
        type: { name: 'Blocks' },
        inwardIssue: {
          key: 'RHOAIENG-200',
          fields: { summary: 'Blocker', status: { name: 'Open' } }
        }
      }
    ]
    const result = extractIssueLinks(links)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      type: 'Cloners', direction: 'outward',
      linkedKey: 'RHAIRFE-100', linkedSummary: 'RFE', linkedStatus: 'Approved'
    })
    expect(result[1]).toEqual({
      type: 'Blocks', direction: 'inward',
      linkedKey: 'RHOAIENG-200', linkedSummary: 'Blocker', linkedStatus: 'Open'
    })
  })

  it('returns empty array for null/undefined input', () => {
    expect(extractIssueLinks(null)).toEqual([])
    expect(extractIssueLinks(undefined)).toEqual([])
  })
})

describe('checkIsBlocked', () => {
  it('returns true for unresolved inward Blocks link', () => {
    const links = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: { key: 'X-1', fields: { status: { name: 'Open' } } }
    }]
    expect(checkIsBlocked(links)).toBe(true)
  })

  it('returns false when blocker is resolved', () => {
    const links = [{
      type: { name: 'Blocks', inward: 'is blocked by' },
      inwardIssue: { key: 'X-1', fields: { status: { name: 'Closed' } } }
    }]
    expect(checkIsBlocked(links)).toBe(false)
  })

  it('returns false for non-Blocks links', () => {
    const links = [{
      type: { name: 'Cloners' },
      inwardIssue: { key: 'X-1', fields: { status: { name: 'Open' } } }
    }]
    expect(checkIsBlocked(links)).toBe(false)
  })
})

describe('findLinkedRfeKey', () => {
  it('finds RHAIRFE clones link', () => {
    const links = [{
      type: { name: 'Cloners', outward: 'clones' },
      outwardIssue: { key: 'RHAIRFE-100' }
    }]
    expect(findLinkedRfeKey(links)).toBe('RHAIRFE-100')
  })

  it('returns null when no RHAIRFE link', () => {
    const links = [{
      type: { name: 'Cloners', outward: 'clones' },
      outwardIssue: { key: 'RHAISTRAT-100' }
    }]
    expect(findLinkedRfeKey(links)).toBeNull()
  })
})

describe('enrichFeatures', () => {
  it('batch-enriches features from Jira', async () => {
    const mockJiraRequest = vi.fn()
    const mockFetchAll = vi.fn()

    // Main enrichment returns issues
    mockFetchAll.mockResolvedValueOnce([
      makeJiraIssue('RHAISTRAT-1', { colorStatus: 'Green' }),
      makeJiraIssue('RHAISTRAT-2', { colorStatus: 'Yellow' })
    ])
    // Epic discovery returns no epics
    mockFetchAll.mockResolvedValueOnce([])

    const result = await enrichFeatures(['RHAISTRAT-1', 'RHAISTRAT-2'], mockJiraRequest, mockFetchAll)

    expect(result.size).toBe(2)
    expect(result.get('RHAISTRAT-1').colorStatus).toBe('Green')
    expect(result.get('RHAISTRAT-2').colorStatus).toBe('Yellow')
  })

  it('returns partial results on batch failure', async () => {
    const mockJiraRequest = vi.fn()
    const mockFetchAll = vi.fn()

    // Main enrichment fails
    mockFetchAll.mockRejectedValueOnce(new Error('Jira timeout'))
    // Epic discovery succeeds with empty
    mockFetchAll.mockResolvedValueOnce([])

    const result = await enrichFeatures(['RHAISTRAT-1'], mockJiraRequest, mockFetchAll)
    expect(result.size).toBe(0)
  })

  it('attaches epics from discovery', async () => {
    const mockJiraRequest = vi.fn()
    const mockFetchAll = vi.fn()

    // Main enrichment
    mockFetchAll.mockResolvedValueOnce([
      makeJiraIssue('RHAISTRAT-1')
    ])
    // Epic discovery returns a child
    mockFetchAll.mockResolvedValueOnce([{
      key: 'RHOAIENG-500',
      fields: {
        summary: 'Child epic',
        status: { name: 'In Progress' },
        parent: { key: 'RHAISTRAT-1' },
        customfield_10014: null
      }
    }])

    const result = await enrichFeatures(['RHAISTRAT-1'], mockJiraRequest, mockFetchAll)
    expect(result.get('RHAISTRAT-1').epics).toEqual([{
      key: 'RHOAIENG-500', summary: 'Child epic', status: 'In Progress'
    }])
  })
})
