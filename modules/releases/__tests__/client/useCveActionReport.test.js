import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useCveActionReport } from '../../client/reports/composables/useCveActionReport.js'

describe('useCveActionReport', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.useRealTimers())

  it('derives sorted components and loads a validated deep link', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Zeta', 'Alpha', 'Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', summary: {} }) }))
    const report = useCveActionReport()
    await report.loadComponents('Alpha')
    expect(report.availableComponents.value).toEqual(['Alpha', 'Zeta'])
    expect(report.selectedComponent.value).toBe('Alpha')
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/modules/releases/cve-sustaining/action-report/components')
    expect(fetch).toHaveBeenLastCalledWith('/api/modules/releases/cve-sustaining/action-report?component=Alpha')
    expect(report.lastRefreshed.value).toBe('2026-09-22T12:00:00Z')
  })

  it('does not request the action endpoint for an invalid component', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ availableComponents: ['Alpha'] }) }))
    const report = useCveActionReport()
    await report.loadComponents('Unknown')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(report.selectedComponent.value).toBe('')
  })

  it('ignores an older response after selection changes', async () => {
    let resolveFirst
    const first = new Promise(resolve => { resolveFirst = resolve })
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['A', 'B'] }) })
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'B' }) }))
    const report = useCveActionReport()
    await report.loadComponents()
    const firstLoad = report.loadReport('A')
    const secondLoad = report.loadReport('B')
    await secondLoad
    resolveFirst({ ok: true, json: async () => ({ component: 'A' }) })
    await firstLoad
    await nextTick()
    expect(report.data.value.component).toBe('B')
  })

  it('refreshes the cached CVE data then reloads the selected component', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T13:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', summary: {} }) }))
    const report = useCveActionReport()
    await report.loadComponents()
    await report.loadReport('Alpha')
    await report.refresh()
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/modules/releases/cve-sustaining/refresh', { method: 'POST' })
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/modules/releases/cve-sustaining/action-report/components')
    expect(fetch).toHaveBeenNthCalledWith(5, '/api/modules/releases/cve-sustaining/action-report?component=Alpha')
    expect(report.lastRefreshed.value).toBe('2026-09-22T13:00:00Z')
  })

  it.each([502, 504])('polls for the refreshed cache after a %i gateway response', async status => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', lastRefreshed: '2026-09-22T12:00:00Z', summary: { version: 'old' } }) })
      .mockResolvedValueOnce({ ok: false, status, statusText: 'Gateway Timeout', json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T13:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', lastRefreshed: '2026-09-22T13:00:00Z', summary: { version: 'new' } }) }))
    const report = useCveActionReport()
    await report.loadComponents('Alpha')

    const refreshPromise = report.refresh()
    await vi.advanceTimersByTimeAsync(3000)
    expect(report.refreshing.value).toBe(true)
    expect(report.data.value.summary.version).toBe('old')

    await vi.advanceTimersByTimeAsync(3000)
    await refreshPromise
    expect(report.refreshError.value).toBeNull()
    expect(report.refreshing.value).toBe(false)
    expect(report.data.value.summary.version).toBe('new')
    expect(report.lastRefreshed.value).toBe('2026-09-22T13:00:00Z')
  })

  it('polls after the refresh request loses its network connection', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T13:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', lastRefreshed: '2026-09-22T13:00:00Z' }) }))
    const report = useCveActionReport()
    await report.loadComponents('Alpha')

    const refreshPromise = report.refresh()
    await vi.advanceTimersByTimeAsync(3000)
    await refreshPromise

    expect(report.refreshError.value).toBeNull()
    expect(report.lastRefreshed.value).toBe('2026-09-22T13:00:00Z')
  })

  it('keeps the current report visible when Jira returns an explicit refresh error', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', summary: { version: 'old' } }) })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({ error: 'Refresh failed: Jira denied the request' }) }))
    const report = useCveActionReport()
    await report.loadComponents('Alpha')
    await report.refresh()

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(report.error.value).toBeNull()
    expect(report.refreshError.value).toBe('Refresh failed: Jira denied the request')
    expect(report.data.value.summary.version).toBe('old')
  })

  it('times out polling without discarding the current report', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async url => {
      if (url === '/api/modules/releases/cve-sustaining/refresh') {
        return { ok: false, status: 502, statusText: 'Bad Gateway', json: async () => ({}) }
      }
      if (url === '/api/modules/releases/cve-sustaining/action-report/components') {
        return { ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) }
      }
      return { ok: true, json: async () => ({ component: 'Alpha', summary: { version: 'old' } }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const report = useCveActionReport()
    await report.loadComponents('Alpha')

    const refreshPromise = report.refresh()
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    await refreshPromise

    expect(report.refreshError.value).toContain('taking longer than expected')
    expect(report.data.value.summary.version).toBe('old')
    expect(report.refreshing.value).toBe(false)
  })

  it('clears a selected component that is absent from the refreshed cache', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Alpha'], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ component: 'Alpha', summary: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: ['Beta'], lastRefreshed: '2026-09-22T13:00:00Z' }) }))
    const report = useCveActionReport()
    await report.loadComponents('Alpha')
    await report.refresh()

    expect(report.availableComponents.value).toEqual(['Beta'])
    expect(report.selectedComponent.value).toBe('')
    expect(report.data.value).toBeNull()
  })

  it('stops cache polling during cleanup', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ availableComponents: [], lastRefreshed: '2026-09-22T12:00:00Z' }) })
      .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway', json: async () => ({}) }))
    const report = useCveActionReport()
    await report.loadComponents()
    const refreshPromise = report.refresh()
    await Promise.resolve()

    report.cleanup()
    await refreshPromise
    await vi.advanceTimersByTimeAsync(3000)

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
