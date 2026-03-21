import { describe, it, expect, vi } from 'vitest'

// Replicate mergeMonths for unit testing since it's not exported
function mergeMonths(existing, fresh, sinceDate) {
  if (!sinceDate) {
    return { ...existing, ...fresh }
  }

  const boundary = sinceDate.slice(0, 7)
  const merged = {}

  for (const [month, count] of Object.entries(existing)) {
    if (month < boundary) {
      merged[month] = count
    }
  }

  for (const [month, count] of Object.entries(fresh)) {
    merged[month] = count
  }

  return merged
}

// Replicate generateMonthlyChunks for unit testing since it's not exported
function generateMonthlyChunks(afterDate) {
  const chunks = []
  const start = new Date(afterDate)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  let current = new Date(start)

  while (current < tomorrow) {
    const next = new Date(current)
    next.setMonth(next.getMonth() + 1)

    const before = next < tomorrow ? next : tomorrow

    chunks.push({
      after: current.toISOString().slice(0, 10),
      before: before.toISOString().slice(0, 10)
    })

    current = new Date(before)
  }

  return chunks
}

// Replicate bucketByMonth (events-based version) for unit testing
function bucketByMonth(events) {
  const months = {}
  for (const event of events) {
    const monthKey = event.created_at.slice(0, 7)
    months[monthKey] = (months[monthKey] || 0) + 1
  }
  return months
}

describe('GitLab mergeMonths logic', () => {
  it('replaces boundary month count instead of adding', () => {
    const existing = { '2026-01': 10, '2026-02': 5 }
    const fresh = { '2026-02': 3, '2026-03': 7 }
    const result = mergeMonths(existing, fresh, '2026-02-15')

    // boundary is 2026-02, so existing 2026-02 is dropped, fresh 2026-02 used
    expect(result['2026-01']).toBe(10)
    expect(result['2026-02']).toBe(3)
    expect(result['2026-03']).toBe(7)
  })

  it('replaces all months at or after the boundary', () => {
    const existing = { '2025-11': 8, '2025-12': 4, '2026-01': 10 }
    const fresh = { '2025-12': 6, '2026-01': 12 }
    const result = mergeMonths(existing, fresh, '2025-12-01')

    expect(result['2025-11']).toBe(8)
    expect(result['2025-12']).toBe(6)
    expect(result['2026-01']).toBe(12)
  })

  it('adds counts for months before the boundary from existing', () => {
    const existing = { '2025-09': 3, '2025-10': 5, '2025-11': 7 }
    const fresh = { '2025-11': 2 }
    const result = mergeMonths(existing, fresh, '2025-11-01')

    expect(result['2025-09']).toBe(3)
    expect(result['2025-10']).toBe(5)
    expect(result['2025-11']).toBe(2)
  })

  it('handles null sinceDate by adding all counts', () => {
    const existing = { '2025-09': 3 }
    const fresh = { '2025-09': 5, '2025-10': 7 }
    const result = mergeMonths(existing, fresh, null)

    expect(result['2025-09']).toBe(5)
    expect(result['2025-10']).toBe(7)
  })

  it('handles empty existing data', () => {
    const fresh = { '2026-01': 10, '2026-02': 5 }
    const result = mergeMonths({}, fresh, '2026-01-01')

    expect(result).toEqual({ '2026-01': 10, '2026-02': 5 })
  })
})

describe('GitLab generateMonthlyChunks logic', () => {
  it('generates correct number of chunks for a known date range', () => {
    // Use a date ~3 months ago to get roughly 3-4 chunks
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    const afterDate = threeMonthsAgo.toISOString().slice(0, 10)

    const chunks = generateMonthlyChunks(afterDate)
    // Should produce 3 or 4 chunks depending on exact day
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    expect(chunks.length).toBeLessThanOrEqual(4)
  })

  it('each chunk before equals next chunk after (contiguous)', () => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const afterDate = sixMonthsAgo.toISOString().slice(0, 10)

    const chunks = generateMonthlyChunks(afterDate)
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].before).toBe(chunks[i + 1].after)
    }
  })

  it('handles partial month at start', () => {
    const partialStart = new Date()
    partialStart.setMonth(partialStart.getMonth() - 2)
    partialStart.setDate(15) // mid-month
    const afterDate = partialStart.toISOString().slice(0, 10)

    const chunks = generateMonthlyChunks(afterDate)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0].after).toBe(afterDate)
  })

  it('handles very recent afterDate (produces 1 chunk)', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const afterDate = yesterday.toISOString().slice(0, 10)

    const chunks = generateMonthlyChunks(afterDate)
    expect(chunks.length).toBe(1)
  })
})

describe('GitLab bucketByMonth logic (events-based)', () => {
  it('buckets events by month correctly', () => {
    const events = [
      { created_at: '2026-01-05T10:00:00Z' },
      { created_at: '2026-01-20T14:00:00Z' },
      { created_at: '2026-01-20T15:00:00Z' },
      { created_at: '2026-02-10T09:00:00Z' }
    ]
    const result = bucketByMonth(events)

    expect(result['2026-01']).toBe(3)
    expect(result['2026-02']).toBe(1)
  })

  it('handles empty events array', () => {
    expect(bucketByMonth([])).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// Integration tests with mocked fetch
// ---------------------------------------------------------------------------

describe('fetchGitlabData integration', () => {
  /**
   * Helper that sets up the mock environment for each test.
   * We mock node-fetch by replacing it in Node's require cache before
   * loading contributions.js. This is necessary because vitest's vi.mock
   * does not intercept native CJS require() calls in CJS modules.
   *
   * Returns { fetchGitlabData, mockFetch, cleanup }.
   */
  async function setup() {
    const { createRequire } = await import('module')
    const cjsRequire = createRequire(import.meta.url)

    const nodeFetchPath = cjsRequire.resolve('node-fetch')
    const contribPath = cjsRequire.resolve('../contributions.js')

    // Ensure node-fetch is loaded into the cache
    cjsRequire('node-fetch')
    const originalExports = cjsRequire.cache[nodeFetchPath].exports

    // Replace node-fetch with our mock
    const mockFetch = vi.fn()
    cjsRequire.cache[nodeFetchPath].exports = mockFetch

    // Clear contributions module so it re-requires our mocked node-fetch
    delete cjsRequire.cache[contribPath]

    // Set env vars before loading the module (it reads them at load time)
    process.env.GITLAB_TOKEN = 'test-token'
    process.env.GITLAB_BASE_URL = 'https://gitlab.example.com'

    const { fetchGitlabData } = cjsRequire('../contributions.js')

    function cleanup() {
      cjsRequire.cache[nodeFetchPath].exports = originalExports
      delete cjsRequire.cache[contribPath]
      delete process.env.GITLAB_TOKEN
      delete process.env.GITLAB_BASE_URL
    }

    return { fetchGitlabData, mockFetch, cleanup }
  }

  // Helper to create a mock Response
  function mockResponse(body, { status = 200, headers = {} } = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get: (name) => headers[name] || headers[name.toLowerCase()] || null
      },
      json: async () => body
    }
  }

  it('resolves user ID and fetches events successfully', async () => {
    const { fetchGitlabData, mockFetch, cleanup } = await setup()
    try {
      const events = [
        { created_at: '2026-02-10T10:00:00Z', action_name: 'pushed to' },
        { created_at: '2026-02-15T12:00:00Z', action_name: 'pushed to' },
        { created_at: '2026-03-01T08:00:00Z', action_name: 'opened' }
      ]

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/v4/users?username=')) {
          return mockResponse([{ id: 123 }])
        }
        if (url.includes('/api/v4/users/123/events')) {
          if (url.includes('&page=1&')) {
            return mockResponse(events)
          }
          return mockResponse([])
        }
        return mockResponse([], { status: 404 })
      })

      const results = await fetchGitlabData(['testuser'], { concurrency: 1 })

      expect(results.testuser).not.toBeNull()
      expect(results.testuser.totalContributions).toBe(3)
      expect(results.testuser.months['2026-02']).toBe(2)
      expect(results.testuser.months['2026-03']).toBe(1)
      expect(results.testuser.fetchedAt).toBeDefined()
      expect(results.testuser.source).toBe('events')
    } finally {
      cleanup()
    }
  })

  it('falls back to monthly chunks on 500', async () => {
    const { fetchGitlabData, mockFetch, cleanup } = await setup()
    try {
      const chunkEvents = [
        { created_at: '2026-01-05T10:00:00Z', action_name: 'pushed to' },
        { created_at: '2026-02-10T10:00:00Z', action_name: 'pushed to' }
      ]

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/v4/users?username=')) {
          return mockResponse([{ id: 456 }])
        }
        if (url.includes('/api/v4/users/456/events')) {
          // Primary fetch (no "before" param) returns 500
          if (!url.includes('&before=')) {
            return mockResponse(null, { status: 500 })
          }
          // Chunked requests (with "before" param)
          if (url.includes('&page=1&')) {
            const afterMatch = url.match(/after=([^&]+)/)
            const beforeMatch = url.match(/before=([^&]+)/)
            if (afterMatch && beforeMatch) {
              const after = decodeURIComponent(afterMatch[1])
              const before = decodeURIComponent(beforeMatch[1])
              const matching = chunkEvents.filter(e => {
                const d = e.created_at.slice(0, 10)
                return d > after && d < before
              })
              if (matching.length > 0) {
                return mockResponse(matching)
              }
            }
            return mockResponse([])
          }
          return mockResponse([])
        }
        return mockResponse([], { status: 404 })
      })

      const results = await fetchGitlabData(['chunkuser'], { concurrency: 1 })

      expect(results.chunkuser).not.toBeNull()
      expect(results.chunkuser.source).toBe('events')
      expect(results.chunkuser.totalContributions).toBeGreaterThanOrEqual(1)
    } finally {
      cleanup()
    }
  })

  it('handles 429 with retry', async () => {
    const { fetchGitlabData, mockFetch, cleanup } = await setup()
    try {
      let eventsCallCount = 0

      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/v4/users?username=')) {
          return mockResponse([{ id: 789 }])
        }
        if (url.includes('/api/v4/users/789/events')) {
          eventsCallCount++
          // First events request returns 429, subsequent calls return 200
          if (eventsCallCount === 1) {
            return mockResponse(null, {
              status: 429,
              headers: { 'Retry-After': '0' }
            })
          }
          if (url.includes('&page=1&')) {
            return mockResponse([
              { created_at: '2026-03-10T10:00:00Z', action_name: 'pushed to' }
            ])
          }
          return mockResponse([])
        }
        return mockResponse([], { status: 404 })
      })

      const results = await fetchGitlabData(['retryuser'], { concurrency: 1 })

      expect(results.retryuser).not.toBeNull()
      expect(results.retryuser.totalContributions).toBe(1)
      expect(results.retryuser.source).toBe('events')
    } finally {
      cleanup()
    }
  })

  it('uses incremental mode only when source is "events"', async () => {
    const { fetchGitlabData, mockFetch, cleanup } = await setup()
    try {
      const fetchedAt = '2026-03-01T00:00:00Z'
      const capturedUrls = []

      mockFetch.mockImplementation(async (url) => {
        capturedUrls.push(url)
        if (url.includes('/api/v4/users?username=')) {
          return mockResponse([{ id: 100 }])
        }
        if (url.includes('/api/v4/users/100/events')) {
          if (url.includes('&page=1&')) {
            return mockResponse([
              { created_at: '2026-03-10T10:00:00Z', action_name: 'pushed to' }
            ])
          }
          return mockResponse([])
        }
        return mockResponse([], { status: 404 })
      })

      // Case 1: existing data with source: "events" — should use fetchedAt as sinceDate
      await fetchGitlabData(['incuser'], {
        concurrency: 1,
        existingData: {
          incuser: {
            totalContributions: 5,
            months: { '2026-02': 5 },
            fetchedAt,
            source: 'events'
          }
        }
      })

      const eventsUrlsCase1 = capturedUrls.filter(u => u.includes('/events'))
      expect(eventsUrlsCase1.some(u => u.includes('after=2026-03-01'))).toBe(true)

      // Reset for case 2
      capturedUrls.length = 0
      mockFetch.mockClear()

      mockFetch.mockImplementation(async (url) => {
        capturedUrls.push(url)
        if (url.includes('/api/v4/users?username=')) {
          return mockResponse([{ id: 100 }])
        }
        if (url.includes('/api/v4/users/100/events')) {
          if (url.includes('&page=1&')) {
            return mockResponse([
              { created_at: '2026-03-10T10:00:00Z', action_name: 'pushed to' }
            ])
          }
          return mockResponse([])
        }
        return mockResponse([], { status: 404 })
      })

      // Case 2: existing data without source field (calendar-era cache) — full fetch
      await fetchGitlabData(['incuser'], {
        concurrency: 1,
        existingData: {
          incuser: {
            totalContributions: 5,
            months: { '2026-02': 5 },
            fetchedAt
            // no source field
          }
        }
      })

      const eventsUrlsCase2 = capturedUrls.filter(u => u.includes('/events'))
      expect(eventsUrlsCase2.some(u => u.includes('after=2026-03-01'))).toBe(false)
      expect(eventsUrlsCase2.some(u => u.includes('after=2025-03'))).toBe(true)
    } finally {
      cleanup()
    }
  })

  it('returns null for unresolvable users', async () => {
    const { fetchGitlabData, mockFetch, cleanup } = await setup()
    try {
      mockFetch.mockImplementation(async (url) => {
        if (url.includes('/api/v4/users?username=')) {
          return mockResponse([])
        }
        return mockResponse([], { status: 404 })
      })

      const results = await fetchGitlabData(['ghostuser'], { concurrency: 1 })

      expect(results.ghostuser).toBeNull()
    } finally {
      cleanup()
    }
  })

  it('handles empty usernames array', async () => {
    const { fetchGitlabData, mockFetch, cleanup } = await setup()
    try {
      const results = await fetchGitlabData([])

      expect(results).toEqual({})
      expect(mockFetch).not.toHaveBeenCalled()
    } finally {
      cleanup()
    }
  })
})
