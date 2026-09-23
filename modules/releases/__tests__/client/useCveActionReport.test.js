import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useCveActionReport } from '../../client/reports/composables/useCveActionReport.js'

describe('useCveActionReport', () => {
  beforeEach(() => vi.restoreAllMocks())

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
})
