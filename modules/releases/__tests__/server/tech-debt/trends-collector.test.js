import { describe, expect, it, vi } from 'vitest'
import {
  collectSnapshot,
  fetchJiraPages,
  historicalJql,
  uploadSnapshot
} from '../../../../../scripts/generate-tech-debt-trends.mjs'

function response(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async function () { return JSON.stringify(body) }
  }
}

const config = {
  jiraHost: 'https://jira.example.test',
  jiraEmail: 'user@example.test',
  jiraToken: 'token'
}

describe('Tech Debt trend collector', function () {
  it('builds a bounded six-month Jira query', function () {
    const jql = historicalJql(new Date('2026-10-29T06:00:00.000Z'))
    expect(jql).toContain('project in (RHAI, RHAIENG, RHOAIENG, INFERENG, AIPCC)')
    expect(jql).toContain('created >= "2026-05-01"')
    expect(jql).toContain('resolutiondate < "2026-11-01"')
  })

  it('paginates Jira search results', async function () {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ issues: [{ key: 'RHAI-1' }], isLast: false, nextPageToken: 'next' }))
      .mockResolvedValueOnce(response({ issues: [{ key: 'RHAI-2' }], isLast: true }))

    const issues = await fetchJiraPages(config, 'project = RHAI', 'key', fetchImpl)
    expect(issues.map(function (issue) { return issue.key })).toEqual(['RHAI-1', 'RHAI-2'])
    const secondUrl = new URL(fetchImpl.mock.calls[1][0])
    expect(secondUrl.searchParams.get('nextPageToken')).toBe('next')
  })

  it('enriches customer-linked Bugs with the cohort-scoped SFDC lookup', async function () {
    const fetchImpl = vi.fn(async function (url) {
      const params = new URL(url).searchParams
      const jql = params.get('jql') || ''
      if (jql.includes('SFDC_Cases_Counter')) return response({ issues: [{ key: 'RHAI-1' }], isLast: true })
      return response({
        issues: [{
          key: 'RHAI-1',
          fields: {
            issuetype: { name: 'Bug' },
            components: [{ name: 'AI Gateway' }],
            created: '2026-09-01T00:00:00.000Z',
            resolutiondate: null,
            labels: [],
            reporter: { displayName: 'Engineer' },
            customfield_10847: null
          }
        }],
        isLast: true
      })
    })

    const snapshot = await collectSnapshot(config, new Date('2026-10-29T06:00:00.000Z'), fetchImpl)
    expect(snapshot.events[0].category).toBe('customer-linked')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('uploads with a scoped API token when configured', async function () {
    const fetchImpl = vi.fn().mockResolvedValue(response({ stored: true }))
    await uploadSnapshot({
      orgPulseUrl: 'https://pulse.example.test',
      orgPulseToken: 'scoped-token'
    }, { schemaVersion: 1 }, fetchImpl)

    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer scoped-token')
    expect(fetchImpl.mock.calls[0][1].headers['X-Proxy-Secret']).toBeUndefined()
  })

  it('uploads through the internal proxy-authenticated service path', async function () {
    const fetchImpl = vi.fn().mockResolvedValue(response({ stored: true }))
    await uploadSnapshot({
      orgPulseUrl: 'http://backend:3001',
      orgPulseEmail: 'collector@example.test',
      orgPulseProxySecret: 'proxy-secret'
    }, { schemaVersion: 1 }, fetchImpl)

    const headers = fetchImpl.mock.calls[0][1].headers
    expect(headers.Authorization).toBeUndefined()
    expect(headers['X-Forwarded-Email']).toBe('collector@example.test')
    expect(headers['X-Proxy-Secret']).toBe('proxy-secret')
  })
})
