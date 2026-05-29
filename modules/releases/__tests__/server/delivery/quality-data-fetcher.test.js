import { describe, it, expect, vi } from 'vitest'
import { fetchVersions, fetchBugs, fetchBugCounts } from '../../../server/delivery/quality/data-fetcher.js'

describe('fetchVersions', () => {
  it('fetches and deduplicates versions from multiple projects', async () => {
    const mockJiraFetch = vi.fn()
      .mockResolvedValueOnce([
        { name: 'rhoai-3.3', releaseDate: '2026-01-15', released: false },
        { name: 'rhoai-3.4', releaseDate: '2026-03-20', released: false }
      ])
      .mockResolvedValueOnce([
        { name: 'rhoai-3.3', releaseDate: '2026-01-15', released: false }, // Duplicate
        { name: 'rhoai-3.5', releaseDate: '2026-05-10', released: false }
      ])

    const result = await fetchVersions(['RHOAIENG', 'AIPCC'], { jiraFetch: mockJiraFetch })

    expect(mockJiraFetch).toHaveBeenCalledTimes(2)
    expect(mockJiraFetch).toHaveBeenCalledWith('/rest/api/3/project/RHOAIENG/versions')
    expect(mockJiraFetch).toHaveBeenCalledWith('/rest/api/3/project/AIPCC/versions')

    // Deduplicated by name (case-insensitive), keeps first occurrence
    expect(result).toHaveLength(3)
    expect(result.map(v => v.name)).toEqual(['rhoai-3.5', 'rhoai-3.4', 'rhoai-3.3'])
    expect(result[0].project).toBe('AIPCC') // rhoai-3.5 from AIPCC
    expect(result[1].project).toBe('RHOAIENG') // rhoai-3.4 from RHOAIENG
    expect(result[2].project).toBe('RHOAIENG') // rhoai-3.3 first seen in RHOAIENG
  })

  it('filters out versions without release dates', async () => {
    const mockJiraFetch = vi.fn().mockResolvedValue([
      { name: 'rhoai-3.3', releaseDate: '2026-01-15', released: false },
      { name: 'rhoai-future', releaseDate: null, released: false }
    ])

    const result = await fetchVersions(['RHOAIENG'], { jiraFetch: mockJiraFetch })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('rhoai-3.3')
  })

  it('handles API errors gracefully and continues', async () => {
    const mockJiraFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce([
        { name: 'rhoai-3.3', releaseDate: '2026-01-15', released: false }
      ])

    const result = await fetchVersions(['RHOAIENG', 'AIPCC'], { jiraFetch: mockJiraFetch })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('rhoai-3.3')
    expect(result[0].project).toBe('AIPCC')
  })

  it('sorts versions by release date descending', async () => {
    const mockJiraFetch = vi.fn().mockResolvedValue([
      { name: 'rhoai-3.3', releaseDate: '2026-01-15', released: false },
      { name: 'rhoai-3.5', releaseDate: '2026-05-10', released: false },
      { name: 'rhoai-3.4', releaseDate: '2026-03-20', released: false }
    ])

    const result = await fetchVersions(['RHOAIENG'], { jiraFetch: mockJiraFetch })

    expect(result.map(v => v.name)).toEqual(['rhoai-3.5', 'rhoai-3.4', 'rhoai-3.3'])
  })

  it('handles case-insensitive deduplication', async () => {
    const mockJiraFetch = vi.fn()
      .mockResolvedValueOnce([
        { name: 'RHOAI-3.3', releaseDate: '2026-01-15', released: false }
      ])
      .mockResolvedValueOnce([
        { name: 'rhoai-3.3', releaseDate: '2026-01-15', released: false }
      ])

    const result = await fetchVersions(['RHOAIENG', 'AIPCC'], { jiraFetch: mockJiraFetch })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('RHOAI-3.3') // Keeps first occurrence
  })
})

describe('fetchBugs', () => {
  const mockVersions = [
    { name: 'rhoai-3.3', releaseDate: '2026-01-15', project: 'RHOAIENG' },
    { name: 'rhoai-3.4', releaseDate: '2026-03-20', project: 'AIPCC' }
  ]

  it('fetches bugs with correct JQL and field list', async () => {
    const mockFetchAll = vi.fn().mockResolvedValue([])

    await fetchBugs('RHOAIENG', mockVersions, { jiraFetchAll: mockFetchAll })

    expect(mockFetchAll).toHaveBeenCalledTimes(1)
    const [, jql, fields] = mockFetchAll.mock.calls[0]

    expect(jql).toContain('project = RHOAIENG')
    expect(jql).toContain('issuetype = Bug')
    expect(jql).toContain('affectedVersion is not EMPTY')
    expect(jql).not.toContain('priority in')

    expect(fields).toContain('versions')
    expect(fields).toContain('components')
    expect(fields).toContain('created')
  })

  it('maps Jira issue fields to bug objects correctly', async () => {
    const mockIssues = [
      {
        key: 'RHOAIENG-123',
        fields: {
          summary: 'Test bug',
          priority: { name: 'Blocker' },
          status: { name: 'Open' },
          versions: [{ name: 'rhoai-3.3' }],
          components: [{ name: 'Dashboard' }],
          created: '2026-01-17T10:00:00.000Z',
          resolutiondate: null
        }
      }
    ]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)

    const result = await fetchBugs('RHOAIENG', mockVersions, { jiraFetchAll: mockFetchAll })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      key: 'RHOAIENG-123',
      summary: 'Test bug',
      priority: 'Blocker',
      status: 'Open',
      affectedVersions: ['rhoai-3.3'],
      components: ['Dashboard'],
      created: '2026-01-17T10:00:00.000Z',
      resolved: null,
      releaseDate: '2026-01-15'
    })
  })

  it('filters out bugs created before release date', async () => {
    const mockIssues = [
      {
        key: 'PRE-RELEASE',
        fields: {
          summary: 'Pre-release bug',
          priority: { name: 'Critical' },
          status: { name: 'Open' },
          versions: [{ name: 'rhoai-3.3' }],
          components: [],
          created: '2026-01-10T10:00:00.000Z', // 5 days before release
          resolutiondate: null
        }
      },
      {
        key: 'POST-RELEASE',
        fields: {
          summary: 'Post-release bug',
          priority: { name: 'Critical' },
          status: { name: 'Open' },
          versions: [{ name: 'rhoai-3.3' }],
          components: [],
          created: '2026-01-17T10:00:00.000Z', // 2 days after release
          resolutiondate: null
        }
      }
    ]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)

    const result = await fetchBugs('RHOAIENG', mockVersions, { jiraFetchAll: mockFetchAll })

    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('POST-RELEASE')
  })

  it('uses earliest release date when bug affects multiple versions', async () => {
    const mockIssues = [
      {
        key: 'MULTI-VERSION',
        fields: {
          summary: 'Multi-version bug',
          priority: { name: 'Major' },
          status: { name: 'Open' },
          versions: [{ name: 'rhoai-3.3' }, { name: 'rhoai-3.4' }],
          components: [],
          created: '2026-01-17T10:00:00.000Z',
          resolutiondate: null
        }
      }
    ]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)

    const result = await fetchBugs('RHOAIENG', mockVersions, { jiraFetchAll: mockFetchAll })

    expect(result).toHaveLength(1)
    expect(result[0].releaseDate).toBe('2026-01-15') // Earliest of 3.3 and 3.4
  })

  it('filters out bugs with no matching version release date', async () => {
    const mockIssues = [
      {
        key: 'UNKNOWN-VERSION',
        fields: {
          summary: 'Unknown version bug',
          priority: { name: 'Major' },
          status: { name: 'Open' },
          versions: [{ name: 'rhoai-99.0' }],
          components: [],
          created: '2026-01-17T10:00:00.000Z',
          resolutiondate: null
        }
      }
    ]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)

    const result = await fetchBugs('RHOAIENG', mockVersions, { jiraFetchAll: mockFetchAll })

    expect(result).toHaveLength(0)
  })

  it('handles API errors and returns empty array', async () => {
    const mockFetchAll = vi.fn().mockRejectedValue(new Error('Jira timeout'))

    const result = await fetchBugs('RHOAIENG', mockVersions, { jiraFetchAll: mockFetchAll })

    expect(result).toEqual([])
  })

  it('handles bugs with missing fields gracefully', async () => {
    const mockIssues = [
      {
        key: 'INCOMPLETE-BUG',
        fields: {
          summary: 'Incomplete bug',
          priority: null,
          status: null,
          versions: [{ name: 'rhoai-3.3' }],
          components: null,
          created: '2026-01-17T10:00:00.000Z',
          resolutiondate: null
        }
      }
    ]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)

    const result = await fetchBugs('RHOAIENG', mockVersions, { jiraFetchAll: mockFetchAll })

    expect(result).toHaveLength(1)
    expect(result[0].priority).toBe('Unknown')
    expect(result[0].status).toBe('Unknown')
    expect(result[0].components).toEqual([])
  })

  it('does NOT filter bugs by version project (cross-project versions)', async () => {
    // This is the critical fix from Alex's review - versions are shared across projects
    const mockIssues = [
      {
        key: 'AIPCC-123',
        fields: {
          summary: 'AIPCC bug affecting shared version',
          priority: { name: 'Critical' },
          status: { name: 'Open' },
          versions: [{ name: 'rhoai-3.3' }], // Version from RHOAIENG project
          components: [],
          created: '2026-01-17T10:00:00.000Z',
          resolutiondate: null
        }
      }
    ]
    const mockFetchAll = vi.fn().mockResolvedValue(mockIssues)

    // Fetch bugs for AIPCC project, but version is from RHOAIENG
    const result = await fetchBugs('AIPCC', mockVersions, { jiraFetchAll: mockFetchAll })

    // Bug should NOT be filtered out - version release dates are shared
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe('AIPCC-123')
    expect(result[0].releaseDate).toBe('2026-01-15')
  })
})

describe('fetchBugCounts', () => {
  const mockVersions = [
    { name: 'rhoai-3.3', releaseDate: '2026-01-15', project: 'RHOAIENG' },
    { name: 'rhoai-3.4', releaseDate: '2026-03-20', project: 'RHOAIENG' }
  ]

  it('queries Jira per project and counts bugs by affected version', async () => {
    const mockFetchAll = vi.fn()
      .mockResolvedValueOnce([
        { key: 'RHOAIENG-1', fields: { versions: [{ name: 'rhoai-3.3' }] } },
        { key: 'RHOAIENG-2', fields: { versions: [{ name: 'rhoai-3.3' }, { name: 'rhoai-3.4' }] } },
        { key: 'RHOAIENG-3', fields: { versions: [{ name: 'rhoai-3.4' }] } }
      ])
      .mockResolvedValueOnce([
        { key: 'AIPCC-1', fields: { versions: [{ name: 'rhoai-3.3' }] } }
      ])

    const counts = await fetchBugCounts(['RHOAIENG', 'AIPCC'], mockVersions, { jiraFetchAll: mockFetchAll })

    expect(mockFetchAll).toHaveBeenCalledTimes(2)

    const [, jql1] = mockFetchAll.mock.calls[0]
    expect(jql1).toContain('project = RHOAIENG')
    expect(jql1).toContain('issuetype = Bug')
    expect(jql1).toContain('affectedVersion is not EMPTY')

    expect(counts.get('rhoai-3.3')).toBe(3)
    expect(counts.get('rhoai-3.4')).toBe(2)
  })

  it('returns 0 for projects that fail to fetch', async () => {
    const mockFetchAll = vi.fn()
      .mockRejectedValueOnce(new Error('Jira timeout'))
      .mockResolvedValueOnce([
        { key: 'AIPCC-1', fields: { versions: [{ name: 'rhoai-3.3' }] } }
      ])

    const counts = await fetchBugCounts(['RHOAIENG', 'AIPCC'], mockVersions, { jiraFetchAll: mockFetchAll })

    expect(counts.get('rhoai-3.3')).toBe(1)
    expect(counts.get('rhoai-3.4')).toBe(0)
  })

  it('ignores affected versions not in the versions list', async () => {
    const mockFetchAll = vi.fn().mockResolvedValue([
      { key: 'RHOAIENG-1', fields: { versions: [{ name: 'rhoai-99.0' }] } },
      { key: 'RHOAIENG-2', fields: { versions: [{ name: 'rhoai-3.3' }] } }
    ])

    const counts = await fetchBugCounts(['RHOAIENG'], mockVersions, { jiraFetchAll: mockFetchAll })

    expect(counts.get('rhoai-3.3')).toBe(1)
    expect(counts.get('rhoai-3.4')).toBe(0)
    expect(counts.has('rhoai-99.0')).toBe(false)
  })

  it('returns all zeros for empty projects list', async () => {
    const mockFetchAll = vi.fn()

    const counts = await fetchBugCounts([], mockVersions, { jiraFetchAll: mockFetchAll })

    expect(mockFetchAll).not.toHaveBeenCalled()
    expect(counts.get('rhoai-3.3')).toBe(0)
    expect(counts.get('rhoai-3.4')).toBe(0)
  })
})
