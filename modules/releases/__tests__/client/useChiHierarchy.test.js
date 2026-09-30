import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()

async function freshComposable() {
  vi.resetModules()
  const mod = await import('../../client/reports/composables/useChiHierarchy')
  return mod.useChiHierarchy()
}

function okResponse(payload, { status = 200, statusText = 'OK' } = {}) {
  return {
    ok: true,
    status,
    statusText,
    json: async () => payload
  }
}

function errorResponse(status, statusText) {
  return {
    ok: false,
    status,
    statusText,
    json: async () => { throw new Error('invalid json') }
  }
}

describe('useChiHierarchy', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('exposes initial state and loadData', async () => {
    const c = await freshComposable()
    expect(c.data.value).toBe(null)
    expect(c.loading.value).toBe(false)
    expect(c.error.value).toBe(null)
    expect(typeof c.loadData).toBe('function')
  })

  it('stores the API payload from /chi-hierarchy/data', async () => {
    const payload = {
      fetchedAt: '2026-09-30T18:00:00.000Z',
      activeStreams: ['rhoai-3.5'],
      environments: { prod: { versions: [] }, stage: { versions: [] } }
    }
    fetchMock.mockResolvedValueOnce(okResponse(payload))

    const c = await freshComposable()
    const done = c.loadData()
    expect(c.loading.value).toBe(true)
    await done

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/releases/chi-hierarchy/data')
    expect(c.data.value).toEqual(payload)
    expect(c.loading.value).toBe(false)
    expect(c.error.value).toBe(null)
  })

  it('treats 404 as empty without error', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(404, 'Not Found'))

    const c = await freshComposable()
    await c.loadData()

    expect(c.data.value).toBe(null)
    expect(c.error.value).toBe(null)
  })

  it('sets error for non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))

    const c = await freshComposable()
    await c.loadData()

    expect(c.data.value).toBe(null)
    expect(c.error.value).toContain('Internal Server Error')
  })
})
