import { describe, it, expect, vi } from 'vitest'
import { computeCycleTimeDays, findWorkStartDate, fetchPersonMetrics } from '../person-metrics'

function makeIssue({ created, resolutiondate, histories }) {
  return {
    fields: { created, resolutiondate },
    changelog: histories !== undefined ? { histories } : undefined
  }
}

function makeHistory(created, fromString, toString) {
  return {
    created,
    items: [{ field: 'status', fromString, toString }]
  }
}

describe('findWorkStartDate', () => {
  it('returns the first In Progress transition timestamp', () => {
    const issue = makeIssue({
      created: '2026-01-12T10:00:00.000+0000',
      resolutiondate: '2026-02-25T10:00:00.000+0000',
      histories: [
        makeHistory('2026-02-20T10:30:00.000+0000', 'New', 'In Progress'),
        makeHistory('2026-02-23T14:00:00.000+0000', 'In Progress', 'Code Review')
      ]
    })
    expect(findWorkStartDate(issue)).toBe('2026-02-20T10:30:00.000+0000')
  })

  it('matches other active statuses (Code Review, Testing, etc.)', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: '2026-02-01T00:00:00.000+0000',
      histories: [
        makeHistory('2026-01-15T08:00:00.000+0000', 'New', 'Code Review')
      ]
    })
    expect(findWorkStartDate(issue)).toBe('2026-01-15T08:00:00.000+0000')
  })

  it('matches statuses case-insensitively', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: '2026-02-01T00:00:00.000+0000',
      histories: [
        makeHistory('2026-01-20T00:00:00.000+0000', 'New', 'IN PROGRESS')
      ]
    })
    expect(findWorkStartDate(issue)).toBe('2026-01-20T00:00:00.000+0000')
  })

  it('returns first active transition when there are multiple', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: '2026-03-01T00:00:00.000+0000',
      histories: [
        makeHistory('2026-01-10T00:00:00.000+0000', 'New', 'In Progress'),
        makeHistory('2026-01-15T00:00:00.000+0000', 'In Progress', 'On Hold'),
        makeHistory('2026-02-01T00:00:00.000+0000', 'On Hold', 'In Progress')
      ]
    })
    expect(findWorkStartDate(issue)).toBe('2026-01-10T00:00:00.000+0000')
  })

  it('returns null when no active status transition exists', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: '2026-02-01T00:00:00.000+0000',
      histories: [
        makeHistory('2026-01-05T00:00:00.000+0000', 'New', 'Closed')
      ]
    })
    expect(findWorkStartDate(issue)).toBeNull()
  })

  it('returns null when changelog is missing', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: '2026-02-01T00:00:00.000+0000',
      histories: undefined
    })
    expect(findWorkStartDate(issue)).toBeNull()
  })

  it('returns null when histories is empty', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: '2026-02-01T00:00:00.000+0000',
      histories: []
    })
    expect(findWorkStartDate(issue)).toBeNull()
  })
})

describe('computeCycleTimeDays', () => {
  it('uses In Progress transition as start date when available', () => {
    const issue = makeIssue({
      created: '2026-01-12T10:00:00.000+0000',
      resolutiondate: '2026-02-25T10:00:00.000+0000',
      histories: [
        makeHistory('2026-02-20T10:00:00.000+0000', 'New', 'In Progress')
      ]
    })
    // Feb 20 → Feb 25 = 5 days
    expect(computeCycleTimeDays(issue)).toBeCloseTo(5, 0)
  })

  it('falls back to created date when no active transition exists', () => {
    const issue = makeIssue({
      created: '2026-01-01T10:00:00.000+0000',
      resolutiondate: '2026-01-11T10:00:00.000+0000',
      histories: [
        makeHistory('2026-01-11T09:00:00.000+0000', 'New', 'Closed')
      ]
    })
    // Jan 1 → Jan 11 = 10 days
    expect(computeCycleTimeDays(issue)).toBeCloseTo(10, 0)
  })

  it('falls back to created date when changelog is null', () => {
    const issue = makeIssue({
      created: '2026-02-01T00:00:00.000+0000',
      resolutiondate: '2026-02-08T00:00:00.000+0000',
      histories: undefined
    })
    // Feb 1 → Feb 8 = 7 days
    expect(computeCycleTimeDays(issue)).toBeCloseTo(7, 0)
  })

  it('returns null when resolutiondate is missing', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: null,
      histories: []
    })
    expect(computeCycleTimeDays(issue)).toBeNull()
  })

  it('handles vulnerability created by scanner and picked up weeks later', () => {
    // Scanner creates issue Jan 12, engineer starts Feb 20, resolves Feb 25
    const issue = makeIssue({
      created: '2026-01-12T00:00:00.000+0000',
      resolutiondate: '2026-02-25T00:00:00.000+0000',
      histories: [
        makeHistory('2026-02-20T00:00:00.000+0000', 'New', 'In Progress'),
        makeHistory('2026-02-24T00:00:00.000+0000', 'In Progress', 'Code Review'),
        makeHistory('2026-02-25T00:00:00.000+0000', 'Code Review', 'Closed')
      ]
    })
    // Should be ~5 days (Feb 20 → Feb 25), NOT 44 days (Jan 12 → Feb 25)
    expect(computeCycleTimeDays(issue)).toBeCloseTo(5, 0)
  })

  it('uses first active transition when issue bounces between statuses', () => {
    const issue = makeIssue({
      created: '2026-01-01T00:00:00.000+0000',
      resolutiondate: '2026-02-15T00:00:00.000+0000',
      histories: [
        makeHistory('2026-01-10T00:00:00.000+0000', 'New', 'In Progress'),
        makeHistory('2026-01-12T00:00:00.000+0000', 'In Progress', 'On Hold'),
        makeHistory('2026-02-01T00:00:00.000+0000', 'On Hold', 'In Progress'),
        makeHistory('2026-02-15T00:00:00.000+0000', 'In Progress', 'Closed')
      ]
    })
    // Jan 10 → Feb 15 = 36 days (uses first In Progress transition)
    expect(computeCycleTimeDays(issue)).toBeCloseTo(36, 0)
  })
})

describe('fetchPersonMetrics', () => {
  // Helper to create a mock jiraRequest that handles Cloud API patterns
  function createMockJiraRequest(handlers = {}) {
    return vi.fn(async (url) => {
      // v3 search/jql GET requests
      if (url.startsWith('/rest/api/3/search/jql')) {
        const jql = new URL(`https://jira${url}`).searchParams.get('jql') || ''
        if (handlers.search) return handlers.search(jql)
        return { issues: [], isLast: true }
      }
      // User search
      if (url.includes('/rest/api/2/user/search')) {
        if (handlers.userSearch) return handlers.userSearch(url)
        return []
      }
      return { issues: [], isLast: true }
    })
  }

  it('in-progress query includes all active work statuses', async () => {
    const capturedJqls = []
    const mockJiraRequest = createMockJiraRequest({
      search: (jql) => {
        capturedJqls.push(jql)
        return { issues: [], isLast: true }
      },
      userSearch: () => [{ displayName: 'Test User', accountId: 'abc123' }]
    })

    await fetchPersonMetrics(mockJiraRequest, 'Test User', { nameCache: {} })

    const inProgressJql = capturedJqls.find(jql => jql.includes('status in'))
    expect(inProgressJql).toContain('"In Progress"')
    expect(inProgressJql).toContain('"Code Review"')
    expect(inProgressJql).toContain('"Review"')
    expect(inProgressJql).toContain('"Coding In Progress"')
    expect(inProgressJql).toContain('"Testing"')
    expect(inProgressJql).toContain('"Refinement"')
    expect(inProgressJql).toContain('"Planning"')
  })

  it('resolves display name to accountId via user search and caches it', async () => {
    const nameCache = {}
    const mockJiraRequest = createMockJiraRequest({
      userSearch: () => [{ displayName: 'Matthew Prahl', accountId: 'acc-mprahl-123' }]
    })

    const result = await fetchPersonMetrics(mockJiraRequest, 'Matt Prahl', { nameCache })

    // Should have cached the mapping with accountId
    expect(nameCache['Matt Prahl']).toEqual({
      accountId: 'acc-mprahl-123',
      displayName: 'Matthew Prahl'
    })
    // Response keeps the original roster name
    expect(result.jiraDisplayName).toBe('Matt Prahl')
    // _resolvedName indicates a mapping occurred
    expect(result._resolvedName).toBe('Matthew Prahl')
  })

  it('uses cached accountId without making user search API calls', async () => {
    const nameCache = { 'Matt Prahl': { accountId: 'acc-mprahl-123', displayName: 'Matthew Prahl' } }
    const mockJiraRequest = createMockJiraRequest()

    await fetchPersonMetrics(mockJiraRequest, 'Matt Prahl', { nameCache })

    // Should not have called user search
    const userSearchCalls = mockJiraRequest.mock.calls.filter(c => c[0].includes('/rest/api/2/user/search'))
    expect(userSearchCalls.length).toBe(0)
    // Should have made 2 search calls (resolved + in-progress) using accountId in JQL
    const searchCalls = mockJiraRequest.mock.calls.filter(c => c[0].startsWith('/rest/api/3/search/jql'))
    expect(searchCalls.length).toBe(2)
    expect(searchCalls[0][0]).toContain('acc-mprahl-123')
  })

  it('returns empty results when user search returns 0 results', async () => {
    const nameCache = {}
    const mockJiraRequest = createMockJiraRequest({
      userSearch: () => []
    })

    const result = await fetchPersonMetrics(mockJiraRequest, 'Unknown Person', { nameCache })

    expect(nameCache).toEqual({})
    expect(result._error).toContain('Could not resolve')
    expect(result.resolved.count).toBe(0)
  })

  it('matches on last name when user search returns multiple results', async () => {
    const nameCache = {}
    const mockJiraRequest = createMockJiraRequest({
      userSearch: () => [
        { displayName: 'Christopher Smith', accountId: 'acc-csmith' },
        { displayName: 'Christopher Prahl', accountId: 'acc-cprahl' }
      ]
    })

    await fetchPersonMetrics(mockJiraRequest, 'Chris Prahl', { nameCache })

    expect(nameCache['Chris Prahl']).toEqual({
      accountId: 'acc-cprahl',
      displayName: 'Christopher Prahl'
    })
  })

  it('returns empty results when nameCache is not provided (no accountId)', async () => {
    const mockJiraRequest = createMockJiraRequest()

    const result = await fetchPersonMetrics(mockJiraRequest, 'Test User')

    expect(result._error).toContain('Could not resolve')
    expect(result.resolved.count).toBe(0)
  })

  it('includes issues in Review status in inProgress results', async () => {
    const reviewIssue = {
      key: 'RHOAIENG-1234',
      fields: {
        summary: 'Remove MLMD from Pipelines',
        issuetype: { name: 'Story' },
        status: { name: 'Review' },
        assignee: { displayName: 'Test User', accountId: 'acc-test' },
        resolutiondate: null,
        created: '2026-01-15T00:00:00.000+0000',
        components: [],
        customfield_10028: 3
      }
    }

    const capturedJqls = []
    const mockJiraRequest = createMockJiraRequest({
      search: (jql) => {
        capturedJqls.push(jql)
        if (jql.includes('status in')) {
          return { issues: [reviewIssue], isLast: true }
        }
        return { issues: [], isLast: true }
      },
      userSearch: () => [{ displayName: 'Test User', accountId: 'acc-test' }]
    })

    const result = await fetchPersonMetrics(mockJiraRequest, 'Test User', { nameCache: {} })

    expect(result.inProgress.count).toBe(1)
    expect(result.inProgress.issues[0].key).toBe('RHOAIENG-1234')
    expect(result.inProgress.issues[0].status).toBe('Review')
  })

  it('ignores stale string-format cache entries from Data Center', async () => {
    // Old cache format stored plain strings; new format stores { accountId, displayName }
    const nameCache = { 'Matt Prahl': 'Matthew Prahl' }
    const mockJiraRequest = createMockJiraRequest({
      userSearch: () => [{ displayName: 'Matthew Prahl', accountId: 'acc-mprahl-123' }]
    })

    await fetchPersonMetrics(mockJiraRequest, 'Matt Prahl', { nameCache })

    // Should have re-resolved and overwritten with new format
    expect(nameCache['Matt Prahl']).toEqual({
      accountId: 'acc-mprahl-123',
      displayName: 'Matthew Prahl'
    })
  })
})
