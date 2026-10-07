import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCveSustaining } from '../../client/reports/composables/useCveSustaining.js'

const API_BASE = '/api/modules/releases/cve-sustaining'

function payload(timestamp, version) {
  return { lastRefreshed: timestamp, version }
}

describe('useCveSustaining', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.useRealTimers())

  it('replaces the cache payload after a successful refresh', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T12:00:00Z', 'old') })
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T13:00:00Z', 'new') }))
    const report = useCveSustaining()

    await report.loadData()
    await report.refresh()

    expect(fetch).toHaveBeenNthCalledWith(2, `${API_BASE}/refresh`, { method: 'POST' })
    expect(report.data.value.version).toBe('new')
    expect(report.refreshError.value).toBeNull()
  })

  it.each([502, 504])('polls for a changed cache after a %i gateway response', async status => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T12:00:00Z', 'old') })
      .mockResolvedValueOnce({ ok: false, status, statusText: 'Gateway Timeout', json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T12:00:00Z', 'old') })
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T13:00:00Z', 'new') }))
    const report = useCveSustaining()
    await report.loadData()

    const refreshPromise = report.refresh()
    await vi.advanceTimersByTimeAsync(3000)
    expect(report.refreshing.value).toBe(true)
    expect(report.data.value.version).toBe('old')

    await vi.advanceTimersByTimeAsync(3000)
    await refreshPromise
    expect(report.refreshing.value).toBe(false)
    expect(report.refreshError.value).toBeNull()
    expect(report.data.value.version).toBe('new')
  })

  it('polls after the refresh request loses its network connection', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T12:00:00Z', 'old') })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T13:00:00Z', 'new') }))
    const report = useCveSustaining()
    await report.loadData()

    const refreshPromise = report.refresh()
    await vi.advanceTimersByTimeAsync(3000)
    await refreshPromise

    expect(report.refreshError.value).toBeNull()
    expect(report.data.value.version).toBe('new')
  })

  it('shows an explicit refresh error without discarding cached data', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T12:00:00Z', 'old') })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Refresh failed: Jira denied the request' })
      }))
    const report = useCveSustaining()
    await report.loadData()
    await report.refresh()

    expect(report.error.value).toBeNull()
    expect(report.refreshError.value).toBe('Refresh failed: Jira denied the request')
    expect(report.data.value.version).toBe('old')
  })

  it('times out polling without discarding cached data', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (url === `${API_BASE}/refresh`) {
        return { ok: false, status: 502, statusText: 'Bad Gateway', json: async () => ({}) }
      }
      return { ok: true, json: async () => payload('2026-09-22T12:00:00Z', 'old') }
    }))
    const report = useCveSustaining()
    await report.loadData()

    const refreshPromise = report.refresh()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    await refreshPromise

    expect(report.refreshError.value).toContain('taking longer than expected')
    expect(report.data.value.version).toBe('old')
    expect(report.refreshing.value).toBe(false)
  })

  it('stops cache polling during cleanup', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => payload('2026-09-22T12:00:00Z', 'old') })
      .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway', json: async () => ({}) }))
    const report = useCveSustaining()
    await report.loadData()
    const refreshPromise = report.refresh()
    await Promise.resolve()

    report.cleanup()
    await refreshPromise
    await vi.advanceTimersByTimeAsync(3000)

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
