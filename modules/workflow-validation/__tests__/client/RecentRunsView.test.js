import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import RecentRunsView from '../../client/views/RecentRunsView.vue'
import { filters, resetFilters } from '../../client/composables/useWorkflowValidation'
import { apiRequest } from '@shared/client/services/api'
import fixture from '../fixtures/recent-runs.json'

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))
const options = { versions: ['3.6.0-ea.2', '3.5.0', 'older'], suites: ['release_gate', 'exploratory_specs', 'ad-hoc'] }
function page(rows = fixture.rows, values = {}) {
  return { rows, total: rows.length, start: rows.length ? 1 : 0, end: rows.length,
    nextCursor: null, previousCursor: null, options, ...values }
}
const request = call => new URL(apiRequest.mock.calls.at(call)[0], 'http://localhost').searchParams

describe('Recent Runs', () => {
  let wrapper
  const button = name => wrapper.findAll('button').find(item => item.text() === name)
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); apiRequest.mockReset().mockResolvedValue(page()); resetFilters() })
  afterEach(() => { wrapper?.unmount(); vi.useRealTimers() })

  it('starts unfiltered with pagination and the existing recorded timestamp', async () => {
    Object.assign(filters, { version: 'older', testSuite: 'another-suite', invocationId: 'another-run', dateFrom: '2000-01-01' })
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(Object.fromEntries(request(0))).toEqual({ pageSize: '20', includeBugs: 'false', sortDir: 'desc' })
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.findAll('thead th').map(cell => cell.text())).toEqual(['Test suite', 'Version', 'Recorded test time (UTC)', 'Run details'])
    expect(wrapper.get('nav[aria-label="Recent run pages"]').text()).toContain('Showing 1–3 of 3 runs')
    expect(button('Previous').element.disabled).toBe(true)
    expect(button('Next').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('All versions · All suites · All run IDs · All dates')
    expect(wrapper.text()).toContain('Version unavailable')
    expect(wrapper.findAll('time')).toHaveLength(2)
    expect(wrapper.text()).not.toMatch(/Build date|Jenkins|Image release/)
  })

  it('opens exact runs by suite and invocation without a version filter', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    for (const [index, anchor] of wrapper.findAll('a').entries()) {
      const run = fixture.rows[index]
      const link = new URL(anchor.attributes('href').replace('#', ''), 'http://localhost')
      expect(link.pathname).toBe('/workflow-validation/overview')
      expect(Object.fromEntries(link.searchParams)).toEqual({ exactRun: '1', version: '', testSuite: run.suite,
        invocationId: run.invocationId, datePreset: 'all', dateFrom: '', dateTo: '' })
    }
  })

  it('visits subsequent and previous pages without applying shared filters', async () => {
    apiRequest.mockResolvedValueOnce(page(fixture.rows, { total: 45, nextCursor: 'page-two' }))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    apiRequest.mockResolvedValueOnce(page([fixture.rows[1]], { total: 45, start: 21, end: 21, previousCursor: 'page-one' }))
    await button('Next').trigger('click')
    await flushPromises()
    expect(request(1).get('cursor')).toBe('page-two')
    expect(wrapper.text()).toContain('Showing 21–21 of 45 runs')
    apiRequest.mockResolvedValueOnce(page())
    await button('Previous').trigger('click')
    await flushPromises()
    expect(request(2).get('cursor')).toBe('page-one')
  })

  it('automatically applies choices and resets pagination, then clears everything', async () => {
    apiRequest.mockResolvedValueOnce(page(fixture.rows, { nextCursor: 'next-page', total: 40 }))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    await wrapper.get('select[aria-label="RHOAI version"]').setValue('older')
    await wrapper.get('select[aria-label="Test suite"]').setValue('release_gate')
    await wrapper.get('input[aria-label="Run ID"]').setValue('original-run')
    await wrapper.get('input[aria-label="Recorded from (UTC)"]').setValue('2026-01-01')
    await wrapper.get('input[aria-label="Recorded to (UTC)"]').setValue('2026-02-01')
    await wrapper.get('select[aria-label="Sort runs"]').setValue('asc')
    await flushPromises()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(Object.fromEntries(request(-1))).toEqual({ pageSize: '20', includeBugs: 'false', version: 'older', suite: 'release_gate', runQuery: 'original-run', dateFrom: '2026-01-01', dateTo: '2026-02-01', sortDir: 'asc' })
    await button('Clear filters').trigger('click')
    await flushPromises()
    expect(Object.fromEntries(request(-1))).toEqual({ pageSize: '20', includeBugs: 'false', sortDir: 'desc' })
    expect(wrapper.get('input[aria-label="Run ID"]').element.value).toBe('')
    expect(filters.version).toBe('')
  })

  it('waits for a pause in Run ID typing and returns to the first page', async () => {
    apiRequest.mockResolvedValueOnce(page(fixture.rows, { total: 45, nextCursor: 'page-two' }))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    await button('Next').trigger('click')
    await flushPromises()
    await wrapper.get('input[aria-label="Run ID"]').setValue('or')
    expect(button('Refresh').element.disabled).toBe(true)
    await vi.advanceTimersByTimeAsync(299)
    expect(apiRequest).toHaveBeenCalledTimes(2)
    await wrapper.get('input[aria-label="Run ID"]').setValue('original')
    await vi.advanceTimersByTimeAsync(299)
    expect(apiRequest).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(3)
    expect(request(-1).get('runQuery')).toBe('original')
    expect(request(-1).has('cursor')).toBe(false)
  })

  it('cancels queued search when clearing or leaving the page', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    await wrapper.get('input[aria-label="Run ID"]').setValue('queued')
    await button('Clear filters').trigger('click')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(request(-1).has('runQuery')).toBe(false)
    await wrapper.get('input[aria-label="Run ID"]').setValue('leaving')
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(300)
    expect(apiRequest).toHaveBeenCalledTimes(2)
  })

  it('waits for a valid date range before fetching', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    await wrapper.get('input[aria-label="Recorded from (UTC)"]').setValue('2026-02-01')
    await flushPromises()
    await wrapper.get('input[aria-label="Recorded to (UTC)"]').setValue('2026-01-01')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[role="alert"]').text()).toContain('Recorded from must be on or before Recorded to')
    await wrapper.get('input[aria-label="Recorded to (UTC)"]').setValue('2026-03-01')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(3)
    expect(request(-1).get('dateTo')).toBe('2026-03-01')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('waits for a valid restored URL range before fetching, including navigation and refresh', async () => {
    const params = ref({ recentFrom: '2026-02-01', recentTo: '2026-01-01' })
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: { params } } } })
    await flushPromises()
    expect(apiRequest).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('Recorded from must be on or before Recorded to')
    await button('Refresh').trigger('click')
    expect(apiRequest).not.toHaveBeenCalled()
    params.value = { recentFrom: '2026-01-01', recentTo: '2026-02-01' }
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    params.value = { recentFrom: '2026-03-01', recentTo: '2026-02-01' }
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('Recorded from must be on or before Recorded to')
  })

  it('hydrates its own URL state and synchronizes successful selections without duplicate loads', async () => {
    const params = ref({ recentVersion: '3.5.0', recentSort: 'asc', recentCursor: 'saved-page', version: 'unrelated' })
    const nav = { params, updateParams: vi.fn(values => { params.value = { ...params.value, ...values } }) }
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    expect(Object.fromEntries(request(0))).toMatchObject({ version: '3.5.0', sortDir: 'asc', cursor: 'saved-page' })
    expect(apiRequest).toHaveBeenCalledTimes(1)
    await button('Clear filters').trigger('click')
    await flushPromises()
    expect(nav.updateParams).toHaveBeenLastCalledWith(expect.objectContaining({ recentVersion: '', recentSort: 'desc', recentCursor: '' }), { push: false })
    expect(apiRequest).toHaveBeenCalledTimes(2)
    params.value = { recentRun: 'restored-search' }
    await flushPromises()
    expect(request(2).get('runQuery')).toBe('restored-search')
  })

  it('ignores a late response after a newer filter request and aborts the old fetch', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    let resolve
    apiRequest.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await button('Refresh').trigger('click')
    await wrapper.get('input[aria-label="Run ID"]').setValue('newer')
    apiRequest.mockResolvedValueOnce(page([{ ...fixture.rows[0], invocationId: 'newer' }]))
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(apiRequest.mock.calls[1][1].signal.aborted).toBe(true)
    resolve(page([{ ...fixture.rows[0], invocationId: 'old-response' }]))
    await flushPromises()
    expect(wrapper.text()).toContain('newer')
    expect(wrapper.text()).not.toContain('old-response')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('does not commit a response or URL update during the typing delay', async () => {
    const params = ref({})
    const nav = { params, updateParams: vi.fn(values => { params.value = { ...params.value, ...values } }) }
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    let resolve
    apiRequest.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await button('Refresh').trigger('click')
    expect(request(-1).get('refresh')).toBe('true')
    await wrapper.get('input[aria-label="Run ID"]').setValue('new-search')
    expect(apiRequest.mock.calls[1][1].signal.aborted).toBe(true)
    resolve(page([{ ...fixture.rows[0], invocationId: 'obsolete' }]))
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()
    expect(wrapper.text()).not.toContain('obsolete')
    expect(nav.updateParams).toHaveBeenCalledTimes(1)
    expect(params.value.recentRun).toBe('')
    apiRequest.mockResolvedValueOnce(page([{ ...fixture.rows[0], invocationId: 'new-search' }]))
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()
    expect(wrapper.text()).toContain('new-search')
    expect(params.value.recentRun).toBe('new-search')
  })

  it('shows empty results only after success and always keeps pagination visible', async () => {
    let resolve
    apiRequest.mockReturnValue(new Promise(done => { resolve = done }))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Loading')
    expect(wrapper.text()).not.toContain('No runs are available')
    resolve(page([]))
    await flushPromises()
    expect(wrapper.text()).toContain('No runs are available.')
    expect(wrapper.get('nav').text()).toContain('Showing 0–0 of 0 runs')
  })

  it('retries initial failures and retains a previous page after refresh failure', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Service unavailable'))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
    expect(wrapper.text()).not.toContain('No runs are available')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    apiRequest.mockRejectedValueOnce(new Error('Refresh failed'))
    await button('Refresh').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.get('[role="alert"]').text()).toContain('The previous results are still shown')
  })

  it('rejects an old backend response without pagination instead of presenting a false total', async () => {
    apiRequest.mockResolvedValueOnce({ rows: fixture.rows })
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('invalid page')
    expect(wrapper.find('nav').exists()).toBe(false)
  })
})
