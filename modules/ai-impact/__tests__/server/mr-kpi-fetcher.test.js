import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const { fetchMrKpiData, MR_KPI_SOURCES, _setFetch } = require('../../server/gitlab/mr-kpi-fetcher')
const { init: initMrStatus } = require('../../server/mr-status')

describe('mr-kpi-fetcher', () => {
  let mockFetch
  const MOCK_MR = {
    iid: 100,
    title: 'docs: test feature',
    state: 'merged',
    created_at: '2026-04-01T10:00:00Z',
    merged_at: '2026-04-03T14:00:00Z',
    author: { username: 'ai-bot' },
    web_url: 'https://gitlab.cee.redhat.com/docs/project/-/merge_requests/100',
    user_notes_count: 3
  }

  beforeEach(() => {
    initMrStatus({ GITLAB_CEE_REDHAT_DOCS_TOKEN: 'test-token' })
    mockFetch = () => Promise.resolve({ ok: false, status: 404 })
    _setFetch((...args) => mockFetch(...args))
  })

  afterEach(() => {
    _setFetch(globalThis.fetch)
    initMrStatus({})
  })

  it('has expected source config', () => {
    expect(MR_KPI_SOURCES).toHaveLength(1)
    expect(MR_KPI_SOURCES[0].host).toBe('https://gitlab.cee.redhat.com')
    expect(MR_KPI_SOURCES[0].labels).toEqual(['ai1st-jira-contributed'])
  })

  it('fetches MRs and enriches with commit count and first review', async () => {
    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([MOCK_MR])
        })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
        })
      }
      if (url.includes('/notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ created_at: '2026-04-02T08:00:00Z', system: false, author: { username: 'reviewer1' } }])
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests).toHaveLength(1)

    const mr = result.mergeRequests[0]
    expect(mr.iid).toBe(100)
    expect(mr.state).toBe('merged')
    expect(mr.commitCount).toBe(3)
    expect(mr.commentCount).toBe(3)
    expect(mr.firstReviewAt).toBe('2026-04-02T08:00:00Z')
    expect(mr.author).toBe('ai-bot')
  })

  it('skips first review fetch when commentCount is 0', async () => {
    const mrNoComments = { ...MOCK_MR, user_notes_count: 0 }
    let notesCalled = false

    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mrNoComments])
        })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'a' }])
        })
      }
      if (url.includes('/notes')) {
        notesCalled = true
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests[0].firstReviewAt).toBeNull()
    expect(notesCalled).toBe(false)
  })

  it('skips system notes for first review', async () => {
    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([MOCK_MR])
        })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'a' }])
        })
      }
      if (url.includes('/notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ created_at: '2026-04-02T08:00:00Z', system: true }])
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests[0].firstReviewAt).toBeNull()
  })

  it('skips bot author notes and finds first human review', async () => {
    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([MOCK_MR])
        })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'a' }])
        })
      }
      if (url.includes('/notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { created_at: '2026-04-01T10:00:30Z', system: false, author: { username: 'cp-ops-service' } },
            { created_at: '2026-04-01T10:01:00Z', system: false, author: { username: 'project_82936_bot_de8f25c2e1ca1c33b2b507874163e1c7' } },
            { created_at: '2026-04-02T09:00:00Z', system: false, author: { username: 'jdoe' } }
          ])
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests[0].firstReviewAt).toBe('2026-04-02T09:00:00Z')
  })

  it('returns null firstReviewAt when all notes are from bots', async () => {
    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([MOCK_MR])
        })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'a' }])
        })
      }
      if (url.includes('/notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { created_at: '2026-04-01T10:00:30Z', system: false, author: { username: 'cp-ops-service' } },
            { created_at: '2026-04-01T10:01:00Z', system: false, author: { username: 'project_82936_bot_de8f25c2e1ca1c33b2b507874163e1c7' } }
          ])
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests[0].firstReviewAt).toBeNull()
  })

  it('returns empty when no token is available', async () => {
    initMrStatus({})

    const result = await fetchMrKpiData()
    expect(result.mergeRequests).toHaveLength(0)
  })

  it('handles API errors gracefully', async () => {
    mockFetch = () => Promise.resolve({ ok: false, status: 500 })

    await expect(fetchMrKpiData()).rejects.toThrow('GitLab API returned 500')
  })

  it('deduplicates MRs across labels', async () => {
    const calls = []
    mockFetch = (url) => {
      calls.push(url)
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([MOCK_MR])
        })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'a' }])
        })
      }
      if (url.includes('/notes')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ created_at: '2026-04-02T08:00:00Z', system: false }])
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests).toHaveLength(1)
  })

  it('paginates when a full page is returned', async () => {
    let pagesRequested = []

    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        const pageMatch = url.match(/[&?]page=(\d+)/)
        const page = pageMatch ? parseInt(pageMatch[1]) : 1
        pagesRequested.push(page)
        if (page === 1) {
          // Return exactly 100 to trigger next page fetch
          const fullPage = Array.from({ length: 100 }, (_, i) => ({
            ...MOCK_MR,
            iid: i + 1,
            user_notes_count: 0
          }))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(fullPage) })
        }
        // Page 2 returns empty → stops pagination
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'a' }]) })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(pagesRequested).toContain(1)
    expect(pagesRequested).toContain(2)
    expect(result.mergeRequests).toHaveLength(100)
  })

  it('handles commit fetch failure gracefully', async () => {
    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ ...MOCK_MR, user_notes_count: 0 }])
        })
      }
      if (url.includes('/commits')) {
        return Promise.reject(new Error('ECONNREFUSED'))
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests).toHaveLength(1)
    expect(result.mergeRequests[0].commitCount).toBe(1)
  })

  it('maps opened state correctly', async () => {
    mockFetch = (url) => {
      if (url.includes('/merge_requests?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ ...MOCK_MR, state: 'opened', merged_at: null, user_notes_count: 0 }])
        })
      }
      if (url.includes('/commits')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'a' }])
        })
      }
      return Promise.resolve({ ok: false, status: 404 })
    }

    const result = await fetchMrKpiData()
    expect(result.mergeRequests[0].state).toBe('opened')
    expect(result.mergeRequests[0].mergedAt).toBeNull()
  })
})
