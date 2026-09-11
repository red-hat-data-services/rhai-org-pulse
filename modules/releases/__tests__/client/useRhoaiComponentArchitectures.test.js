import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()

// The composable keeps module-level state, so each test gets a fresh module
// instance to avoid cross-test contamination.
async function freshComposable() {
  vi.resetModules()
  const mod = await import('../../client/reports/composables/useRhoaiComponentArchitectures')
  return mod.useRhoaiComponentArchitectures()
}

function okResponse(payload, { status = 200, statusText = 'OK' } = {}) {
  return {
    ok: true,
    status,
    statusText,
    json: async () => payload
  }
}

function errorResponse(status, statusText, body) {
  return {
    ok: false,
    status,
    statusText,
    json: body === undefined ? async () => { throw new Error('invalid json') } : async () => body
  }
}

describe('useRhoaiComponentArchitectures', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('exposes initial state and actions', async () => {
    const c = await freshComposable()
    expect(c.data.value).toBe(null)
    expect(c.loading.value).toBe(false)
    expect(c.error.value).toBe(null)
    expect(c.refreshing.value).toBe(false)
    expect(typeof c.loadData).toBe('function')
    expect(typeof c.refresh).toBe('function')
  })

  describe('loadData', () => {
    it('stores the API payload and clears loading', async () => {
      const payload = { branches: { 'rhoai-3.5': {} }, fetchedAt: '2026-08-18T12:00:00.000Z' }
      fetchMock.mockResolvedValueOnce(okResponse(payload))

      const c = await freshComposable()
      const done = c.loadData()
      expect(c.loading.value).toBe(true)
      await done

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain('/releases/rhoai-component-architectures')
      expect(c.data.value).toEqual(payload)
      expect(c.loading.value).toBe(false)
      expect(c.error.value).toBe(null)
    })

    it('treats a 404 as an empty report without an error', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(404, 'Not Found'))

      const c = await freshComposable()
      await c.loadData()

      expect(c.data.value).toBe(null)
      expect(c.error.value).toBe(null)
    })

    it('sets an error with the status text for non-ok responses', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'))

      const c = await freshComposable()
      await c.loadData()

      expect(c.data.value).toBe(null)
      expect(c.error.value).toBe('Failed to load architecture data: Internal Server Error')
    })

    it('surfaces thrown fetch errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'))

      const c = await freshComposable()
      await c.loadData()

      expect(c.error.value).toBe('network down')
      expect(c.data.value).toBe(null)
    })

  })

  describe('refresh', () => {
    it('POSTs to the refresh endpoint and reloads data on ok status', async () => {
      fetchMock
        .mockResolvedValueOnce(okResponse({ status: 'ok' }))
        .mockResolvedValueOnce(okResponse({ branches: {} }))

      const c = await freshComposable()
      await c.refresh()

      expect(fetchMock).toHaveBeenCalledTimes(2)
      const [postUrl, postInit] = fetchMock.mock.calls[0]
      expect(postUrl).toContain('/releases/rhoai-component-architectures')
      expect(postInit).toMatchObject({ method: 'POST' })
      const [, getInit] = fetchMock.mock.calls[1]
      expect(getInit).toBeUndefined()
      expect(c.data.value).toEqual({ branches: {} })
      expect(c.refreshing.value).toBe(false)
      expect(c.error.value).toBe(null)
    })

    it('does not reload when the refresh is skipped', async () => {
      fetchMock.mockResolvedValueOnce(okResponse({ status: 'skipped', message: 'Fetch disabled in demo mode' }))

      const c = await freshComposable()
      await c.refresh()

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(c.data.value).toBe(null)
      expect(c.refreshing.value).toBe(false)
      expect(c.error.value).toBe(null)
    })

    it('surfaces the API error message from the refresh response body', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(500, 'Internal Server Error', { error: 'Refresh exploded' }))

      const c = await freshComposable()
      await c.refresh()

      expect(c.error.value).toBe('Refresh exploded')
      expect(c.data.value).toBe(null)
    })

    it('falls back to the status text when the error body is not JSON', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(502, 'Bad Gateway'))

      const c = await freshComposable()
      await c.refresh()

      expect(c.error.value).toBe('Refresh failed: Bad Gateway')
    })

    it('surfaces thrown refresh errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('boom'))

      const c = await freshComposable()
      await c.refresh()

      expect(c.error.value).toBe('boom')
    })

    it('falls back to a generic message for non-Error rejections', async () => {
      fetchMock.mockRejectedValueOnce(42)

      const c = await freshComposable()
      await c.refresh()

      expect(c.error.value).toBe('Failed to refresh architecture data')
    })

    it('keeps previously loaded data when the refresh fails', async () => {
      const payload = { branches: { 'rhoai-3.5': {} } }
      fetchMock
        .mockResolvedValueOnce(okResponse(payload))
        .mockRejectedValueOnce(new Error('refresh failed'))

      const c = await freshComposable()
      await c.loadData()
      expect(c.data.value).toEqual(payload)

      await c.refresh()

      expect(c.data.value).toEqual(payload)
      expect(c.error.value).toBe('refresh failed')
    })
  })
})
