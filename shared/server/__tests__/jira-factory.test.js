import { describe, it, expect, vi } from 'vitest'

const { createJiraClient, fetchAllJqlResults } = require('../jira')

describe('createJiraClient', () => {
  it('creates a client with bound credentials', () => {
    const client = createJiraClient({ email: 'test@test.com', token: 'token123' })
    expect(client.jiraRequest).toBeInstanceOf(Function)
    expect(client.fetchAllJqlResults).toBeInstanceOf(Function)
    expect(client.fetchProjectVersions).toBeInstanceOf(Function)
    expect(client.JIRA_HOST).toBe('https://redhat.atlassian.net')
  })

  it('accepts custom host', () => {
    const client = createJiraClient({ email: 'a@b.com', token: 't', host: 'https://custom.atlassian.net' })
    expect(client.JIRA_HOST).toBe('https://custom.atlassian.net')
  })

  it('defaults host to redhat.atlassian.net', () => {
    const client = createJiraClient({ email: 'a@b.com', token: 't' })
    expect(client.JIRA_HOST).toBe('https://redhat.atlassian.net')
  })

  it('two instances with different credentials are independent', () => {
    const client1 = createJiraClient({ email: 'a@b.com', token: 't1', host: 'https://host1.com' })
    const client2 = createJiraClient({ email: 'c@d.com', token: 't2', host: 'https://host2.com' })

    expect(client1.JIRA_HOST).toBe('https://host1.com')
    expect(client2.JIRA_HOST).toBe('https://host2.com')
    expect(client1.jiraRequest).not.toBe(client2.jiraRequest)
  })

  it('creates a client even with empty credentials (error at first use)', () => {
    const client = createJiraClient({ email: '', token: '' })
    expect(client.jiraRequest).toBeInstanceOf(Function)
  })
})

describe('fetchAllJqlResults (standalone)', () => {
  it('accepts jiraRequest as first parameter', async () => {
    const mockJiraRequest = vi.fn().mockResolvedValue({
      issues: [{ key: 'TEST-1', fields: {} }],
      isLast: true
    })

    const results = await fetchAllJqlResults(mockJiraRequest, 'project = TEST', 'summary')
    expect(results).toHaveLength(1)
    expect(results[0].key).toBe('TEST-1')
    expect(mockJiraRequest).toHaveBeenCalledOnce()
  })
})
