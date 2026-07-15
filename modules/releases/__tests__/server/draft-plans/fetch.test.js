import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetchDraftPlans, DATA_PREFIX, _setFetch } = require('../../../server/draft-plans/fetch')

const mockFetch = vi.fn()

function makeStorage() {
  const written = {}
  return {
    async writeToStorage(key, data) { written[key] = data },
    async readFromStorage(key) { return written[key] || null },
    _written: written
  }
}

const baseConfig = {
  gitlabBaseUrl: 'https://gitlab.com',
  projectId: '81798612',
  branch: 'main'
}

function mockJsonResponse(data) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data))
  }
}

const PLAN_DATA = {
  generatedAt: '2026-07-08T11:00:00Z',
  product: 'RHOAI',
  summary: { totalFeatures: 100 },
  releases: [
    { version: '3.5', events: { EA1: { features: [] }, GA: { features: [] } } },
    { version: '3.6', events: { EA1: { features: [] } } }
  ]
}

const HEALTH_DATA = {
  generatedAt: '2026-07-08',
  releases: [
    { version: '3.5', totalFeatures: 156, healthStatus: 'critical', featureHealth: { ready: 127 } },
    { version: '3.6', totalFeatures: 80, healthStatus: 'healthy', featureHealth: { ready: 75 } }
  ]
}

describe('fetchDraftPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _setFetch(mockFetch)
  })

  it('fetches and stores both JSON files for each product', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(PLAN_DATA))
      .mockResolvedValueOnce(mockJsonResponse(HEALTH_DATA))

    const storage = makeStorage()
    const result = await fetchDraftPlans(storage, baseConfig, 'test-token')

    expect(result.status).toBe('success')
    expect(result.fileCount).toBe(2)
    expect(storage._written[`${DATA_PREFIX}/RHOAI/release-plan.json`]).toEqual(PLAN_DATA)
    expect(storage._written[`${DATA_PREFIX}/RHOAI/release-health.json`]).toEqual(HEALTH_DATA)
  })

  it('constructs correct GitLab Repository Files API URLs', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(PLAN_DATA))
      .mockResolvedValueOnce(mockJsonResponse(HEALTH_DATA))

    const storage = makeStorage()
    await fetchDraftPlans(storage, baseConfig, 'my-token')

    const planUrl = mockFetch.mock.calls[0][0]
    expect(planUrl).toBe('https://gitlab.com/api/v4/projects/81798612/repository/files/RHOAI%2Flatest%2Frelease-plan.json/raw?ref=main')

    const healthUrl = mockFetch.mock.calls[1][0]
    expect(healthUrl).toBe('https://gitlab.com/api/v4/projects/81798612/repository/files/RHOAI%2Flatest%2Frelease-health.json/raw?ref=main')
  })

  it('sends Bearer token in Authorization header', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse(PLAN_DATA))

    const storage = makeStorage()
    await fetchDraftPlans(storage, baseConfig, 'secret-token')

    const opts = mockFetch.mock.calls[0][1]
    expect(opts.headers.Authorization).toBe('Bearer secret-token')
  })

  it('writes last-fetch.json metadata', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse(PLAN_DATA))

    const storage = makeStorage()
    await fetchDraftPlans(storage, baseConfig, 'token')

    const lastFetch = storage._written[`${DATA_PREFIX}/last-fetch.json`]
    expect(lastFetch).toBeDefined()
    expect(lastFetch.status).toBe('success')
    expect(lastFetch.timestamp).toBeDefined()
    expect(lastFetch.duration).toBeGreaterThanOrEqual(0)
    expect(lastFetch.products.RHOAI).toBeDefined()
  })

  it('throws on 401 (authentication failure)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('') })

    const storage = makeStorage()
    await expect(fetchDraftPlans(storage, baseConfig, 'bad-token'))
      .rejects.toThrow('authentication failed')
  })

  it('throws on 429 (rate limited)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: () => Promise.resolve('') })

    const storage = makeStorage()
    await expect(fetchDraftPlans(storage, baseConfig, 'token'))
      .rejects.toThrow('rate limited')
  })

  it('skips product on 404 and records warning', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') })

    const storage = makeStorage()
    const result = await fetchDraftPlans(storage, baseConfig, 'token')

    expect(result.status).toBe('no_data')
    expect(result.fileCount).toBe(0)
    expect(result.warnings).toBeDefined()
    expect(result.warnings.some(w => w.includes('not found (404)'))).toBe(true)
  })

  it('handles invalid JSON response gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('not valid json {{{')
    })

    const storage = makeStorage()
    const result = await fetchDraftPlans(storage, baseConfig, 'token')

    expect(result.fileCount).toBe(0)
    expect(result.warnings).toBeDefined()
    expect(result.warnings.some(w => w.includes('Failed to parse'))).toBe(true)
  })

  it('requires projectId', async () => {
    const storage = makeStorage()
    await expect(fetchDraftPlans(storage, { ...baseConfig, projectId: '' }, 'token'))
      .rejects.toThrow('projectId is required')
  })

  it('rejects invalid gitlabBaseUrl protocol', async () => {
    const storage = makeStorage()
    await expect(fetchDraftPlans(storage, { ...baseConfig, gitlabBaseUrl: 'ftp://evil.com' }, 'token'))
      .rejects.toThrow('gitlabBaseUrl must use http or https')
  })

  it('rejects completely invalid gitlabBaseUrl', async () => {
    const storage = makeStorage()
    await expect(fetchDraftPlans(storage, { ...baseConfig, gitlabBaseUrl: 'not-a-url' }, 'token'))
      .rejects.toThrow('Invalid gitlabBaseUrl')
  })

  it('succeeds when one file fetches but the other 404s', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse(PLAN_DATA))
      .mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') })

    const storage = makeStorage()
    const result = await fetchDraftPlans(storage, baseConfig, 'token')

    expect(result.status).toBe('success')
    expect(result.fileCount).toBe(1)
    expect(storage._written[`${DATA_PREFIX}/RHOAI/release-plan.json`]).toEqual(PLAN_DATA)
    expect(storage._written[`${DATA_PREFIX}/RHOAI/release-health.json`]).toBeUndefined()
  })

  it('uses custom branch in API URL', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse(PLAN_DATA))

    const storage = makeStorage()
    await fetchDraftPlans(storage, { ...baseConfig, branch: 'staging' }, 'token')

    const url = mockFetch.mock.calls[0][0]
    expect(url).toContain('ref=staging')
  })
})
