import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import RecentRunsView from '../../client/views/RecentRunsView.vue'
import { filters, resetFilters } from '../../client/composables/useWorkflowValidation'
import { apiRequest } from '@shared/client/services/api'
import fixture from '../fixtures/recent-runs.json'
import { createHash } from 'node:crypto'
import * as versionRules from '../../lib/versions.js'
const { parseRecentRuns, pageRecentRuns } = require('../../server/recent-runs')(versionRules)

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))
const options = { versions: ['3.6.0-ea.2', '3.5.0', 'older'], suites: ['release_gate', 'exploratory_specs', 'ad-hoc'] }
/** Build a complete page fixture and allow explicit pagination overrides. */
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
    expect(Object.fromEntries(request(0))).toEqual({ pageSize: '20', includeBugs: 'false', includeBugTickets: 'true', sortField: 'timestamp', sortDir: 'desc' })
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.findAll('thead th').map(cell => cell.attributes('aria-label'))).toEqual(['Test suite', 'Version', 'RHOAI build (UTC)', 'Executed at (UTC)', 'Issues found'])
    expect(wrapper.findAll('th button')).toHaveLength(4)
    expect(wrapper.findAll('th select')).toHaveLength(0)
    expect(wrapper.get('button[aria-label="Sort execution time"]').text()).toContain('↓')
    expect(wrapper.get('nav[aria-label="Recent run pages"]').text()).toContain('Showing 1–3 of 3 runs')
    expect(button('Previous').element.disabled).toBe(true)
    expect(button('Next').element.disabled).toBe(true)
    expect(wrapper.text()).not.toContain('All versions · All suites · All run IDs · All time')
    expect(wrapper.text()).toContain('Version unavailable')
    expect(wrapper.findAll('time')).toHaveLength(3)
    expect(wrapper.text()).toContain('unavailable')
    expect(wrapper.text()).not.toMatch(/Build date|Jenkins|Image release/)
  })

  it('matches execution date formatting on one line without repeating UTC in build cells', async () => {
    apiRequest.mockResolvedValueOnce(page([{ ...fixture.rows[0], buildDate: '2026-11-06T01:14:40+02:00', timestamp: '2026-11-05T23:14:40Z' }]))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    const cell = wrapper.get('tbody tr').findAll('td')[2]
    expect(cell.get('time').text()).toBe('5 Nov 2026, 23:14:40')
    expect(cell.text()).toBe(wrapper.get('tbody tr').findAll('td')[3].text())
    expect(cell.find('br').exists()).toBe(false)
    expect(cell.text()).not.toContain('UTC')
    expect(cell.get('time').attributes('datetime')).toBe('2026-11-06T01:14:40+02:00')
  })

  it.each([
    { buildDate: null, buildDateStatus: 'unavailable' },
    { buildDate: 'not-a-date', buildDateStatus: 'verified' },
    { buildDate: '2026-11-05T05:14:40Z', buildDateStatus: 'unavailable' },
    { buildDate: undefined, buildDateStatus: undefined }
  ])('shows lowercase unavailable for missing, invalid, or unverified build metadata: %j', async build => {
    apiRequest.mockResolvedValueOnce(page([{ ...fixture.rows[0], ...build }]))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    const cell = wrapper.get('tbody tr').findAll('td')[2]
    expect(cell.text()).toBe('unavailable')
    expect(cell.find('time').exists()).toBe(false)
  })

  it('opens exact runs from the whole row by click and Enter without a version filter', async () => {
    const nav = { navigateTo: vi.fn() }
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    expect(wrapper.findAll('a')).toHaveLength(0)
    for (const [index, row] of wrapper.findAll('tbody tr').entries()) {
      const run = fixture.rows[index]
      await row.trigger(index % 2 ? 'keydown.enter' : 'click')
      expect(nav.navigateTo).toHaveBeenLastCalledWith('overview', { exactRun: '1', version: '', testSuite: run.suite,
        invocationId: run.invocationId, datePreset: 'all', dateFrom: '', dateTo: '' })
      expect(row.attributes('tabindex')).toBe('0')
    }
  })

  it('opens Jira separately from row navigation and distinguishes empty from unavailable tickets', async () => {
    const url = 'https://redhat.atlassian.net/issues/?jql=' + encodeURIComponent('key IN (RHOAIENG-1) AND (labels IS EMPTY OR labels NOT IN ("rca-scope-internal"))')
    apiRequest.mockResolvedValueOnce(page(fixture.rows.map((row, index) => ({ ...row,
      bugTickets: index === 0 ? { status: 'ready', url } : { status: index === 1 ? 'empty' : 'unavailable' }
    }))))
    const nav = { navigateTo: vi.fn() }
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    const link = wrapper.get('a')
    expect(link.attributes()).toMatchObject({ href: url, target: '_blank', rel: 'noopener noreferrer' })
    await link.trigger('click')
    await link.trigger('keydown.enter')
    expect(nav.navigateTo).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No issues recorded')
    expect(wrapper.text()).toContain('Issues unavailable')
    await wrapper.get('tbody tr td').trigger('click')
    expect(nav.navigateTo).toHaveBeenCalledTimes(1)
  })

  it('does not render an unsafe ticket URL', async () => {
    apiRequest.mockResolvedValueOnce(page([{ ...fixture.rows[0], bugTickets: { status: 'ready', url: 'javascript:alert(1)' } }]))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('Issues unavailable')
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

  it('automatically applies multiple versions and custom dates, then clears everything', async () => {
    apiRequest.mockResolvedValueOnce(page(fixture.rows, { nextCursor: 'next-page', total: 40 }))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    await wrapper.get('button[aria-controls]').trigger('click')
    const checkbox = value => wrapper.findAll('[role="group"] label').find(label => label.text() === value).get('input')
    await checkbox('older').setValue(true)
    await checkbox('3.5.0').setValue(true)
    await wrapper.get('select[aria-label="Test suite"]').setValue('release_gate')
    await wrapper.get('input[aria-label="Run ID"]').setValue('original-run')
    await wrapper.get('select[aria-label="Date Range"]').setValue('custom')
    await wrapper.get('input[aria-label="Start Date (UTC)"]').setValue('2026-01-01')
    await wrapper.get('input[aria-label="End Date (UTC)"]').setValue('2026-02-01')
    await wrapper.get('button[aria-label="Sort test suite"]').trigger('click')
    await flushPromises()
    expect(request(-1).getAll('versions')).toEqual(['3.5.0', 'older'])
    expect(Object.fromEntries(request(-1))).toMatchObject({ suite: 'release_gate', runQuery: 'original-run', dateFrom: '2026-01-01', dateTo: '2026-02-01', sortField: 'suite', sortDir: 'asc' })
    expect(request(-1).has('cursor')).toBe(false)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    await button('Clear filters').trigger('click')
    await flushPromises()
    expect(Object.fromEntries(request(-1))).toEqual({ pageSize: '20', includeBugs: 'false', includeBugTickets: 'true', sortField: 'timestamp', sortDir: 'desc' })
    expect(wrapper.get('select[aria-label="Date Range"]').element.value).toBe('all')
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
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

  it('waits for valid custom dates and cancels an older request when the range becomes invalid', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    await wrapper.get('select[aria-label="Date Range"]').setValue('custom')
    let resolve
    apiRequest.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await wrapper.get('input[aria-label="Start Date (UTC)"]').setValue('2026-02-01')
    const calls = apiRequest.mock.calls.length
    await wrapper.get('input[aria-label="End Date (UTC)"]').setValue('2026-01-01')
    expect(apiRequest.mock.calls.at(-1)[1].signal.aborted).toBe(true)
    resolve(page([{ ...fixture.rows[0], invocationId: 'obsolete-date-response' }]))
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(calls)
    expect(wrapper.text()).not.toContain('obsolete-date-response')
    expect(wrapper.get('[role="alert"]').text()).toContain('Start Date must be on or before End Date')
    for (const heading of wrapper.findAll('th button')) await heading.trigger('click')
    expect(apiRequest).toHaveBeenCalledTimes(calls)
    await wrapper.get('input[aria-label="End Date (UTC)"]').setValue('2026-03-01')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(calls + 1)
    expect(request(-1).get('dateTo')).toBe('2026-03-01')
    expect(request(-1).get('sortField')).toBe('timestamp')
    expect(request(-1).get('sortDir')).toBe('desc')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('waits for a valid restored URL range before fetching, including navigation and refresh', async () => {
    const params = ref({ recentFrom: '2026-02-01', recentTo: '2026-01-01' })
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: { params } } } })
    await flushPromises()
    expect(apiRequest).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('Start Date must be on or before End Date')
    await button('Refresh').trigger('click')
    expect(apiRequest).not.toHaveBeenCalled()
    params.value = { recentFrom: '2026-01-01', recentTo: '2026-02-01' }
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    params.value = { recentFrom: '2026-03-01', recentTo: '2026-02-01' }
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('Start Date must be on or before End Date')
  })

  it('hydrates its own URL state and synchronizes successful selections without duplicate loads', async () => {
    const params = ref({ recentVersion: '3.5.0', recentSort: 'asc', recentCursor: 'saved-page', version: 'unrelated' })
    const nav = { params, updateParams: vi.fn(values => { params.value = { ...params.value, ...values } }) }
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    expect(Object.fromEntries(request(0))).toMatchObject({ versions: '3.5.0', sortDir: 'asc', cursor: 'saved-page' })
    expect(apiRequest).toHaveBeenCalledTimes(1)
    await button('Clear filters').trigger('click')
    await flushPromises()
    expect(nav.updateParams).toHaveBeenLastCalledWith(expect.objectContaining({ recentVersion: '', recentSort: 'desc', recentCursor: '' }), { push: false })
    expect(apiRequest).toHaveBeenCalledTimes(2)
    params.value = { recentRun: 'restored-search' }
    await flushPromises()
    expect(request(2).get('runQuery')).toBe('restored-search')
  })

  it.each([1, 2])('preserves a v%s bookmark scope through Refresh, reload, and page navigation', async v => {
    const rows = Array.from({ length: 47 }, (_, index) => ({ suite: 'suite', invocationId: `legacy-${index}`,
      rhoaiVersion: '3.6', timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }))
    const hash = value => createHash('sha256').update(value).digest('hex')
    const scope = hash(JSON.stringify([{ version: '3.6', suite: '', runQuery: '', dateFrom: '', dateTo: '' }, 'desc', 20]))
    const origin = rows[27], identity = value => v === 1 ? value : hash(value)
    const cursor = Buffer.from(JSON.stringify({ v, scope, direction: 'after',
      anchor: [Date.parse(origin.timestamp), identity(origin.suite), identity(origin.invocationId)] })).toString('base64url')
    apiRequest.mockImplementation(async url => {
      const query = new URL(url, 'http://localhost').searchParams
      return pageRecentRuns(rows, parseRecentRuns({ ...Object.fromEntries(query), versions: query.getAll('versions') }))
    })
    const params = ref({ recentVersion: '3.6', recentCursor: cursor })
    const nav = { params, updateParams: vi.fn(values => { params.value = { ...params.value, ...values } }) }
    const mountView = () => mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Showing 21–40 of 47 runs')
    expect(wrapper.get('button[aria-controls]').text()).toContain('3.6.0')
    for (let reload = 0; reload < 2; reload++) {
      await button('Refresh').trigger('click')
      await flushPromises()
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Showing 21–40 of 47 runs')
      expect(request(-1).getAll('versions')).toEqual(['3.6'])
      expect(request(-1).get('cursor')).toBe(cursor)
      if (!reload) { wrapper.unmount(); wrapper = mountView(); await flushPromises() }
    }
    await button('Next').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Showing 41–47 of 47 runs')
    await button('Refresh').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await button('Previous').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Showing 21–40 of 47 runs')
    await wrapper.get('button[aria-label="Sort version"]').trigger('click')
    await flushPromises()
    expect(request(-1).getAll('versions')).toEqual(['3.6.0'])
    expect(request(-1).has('cursor')).toBe(false)
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
  it('uses inclusive UTC dates for presets and shows date inputs only for Custom', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-11-05T00:15:00Z'))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
    for (const [preset, from] of [['7', '2026-10-30'], ['30', '2026-10-07'], ['90', '2026-08-08']]) {
      await wrapper.get('select[aria-label="Date Range"]').setValue(preset)
      await flushPromises()
      expect(request(-1).get('dateFrom')).toBe(from)
      expect(request(-1).get('dateTo')).toBe('2026-11-05')
    }
    await wrapper.get('select[aria-label="Date Range"]').setValue('custom')
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(2)
    await wrapper.get('select[aria-label="Date Range"]').setValue('all')
    await flushPromises()
    expect(request(-1).has('dateFrom')).toBe(false)
  })

  it('toggles each heading and resets to its first direction when switching columns', async () => {
    const params = ref({ recentVersions: JSON.stringify(['3.5.0', '3.6.0-ea.2']) })
    const nav = { params, updateParams: vi.fn(values => { params.value = { ...params.value, ...values } }) }
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    for (const [index, field, first] of [[0, 'suite', 'asc'], [1, 'version', 'desc'], [2, 'buildDate', 'desc'], [3, 'timestamp', 'desc']]) {
      await wrapper.findAll('th button')[index].trigger('click')
      await flushPromises()
      expect(request(-1).get('sortField')).toBe(field)
      expect(request(-1).get('sortDir')).toBe(first)
      expect(wrapper.findAll('th')[index].attributes('aria-sort')).toBe(first === 'asc' ? 'ascending' : 'descending')
      await wrapper.findAll('th button')[index].trigger('click')
      await flushPromises()
      expect(request(-1).get('sortDir')).not.toBe(first)
    }
    for (const [index, first] of [[0, 'asc'], [1, 'desc'], [2, 'desc'], [3, 'desc']]) {
      await wrapper.findAll('th button')[index].trigger('click')
      await flushPromises()
      expect(request(-1).get('sortDir')).toBe(first)
      expect(wrapper.findAll('th button')[index].text()).toContain(first === 'asc' ? '↑' : '↓')
      expect(request(-1).has('cursor')).toBe(false)
    }
    expect(JSON.parse(params.value.recentVersions)).toEqual(['3.6.0-ea.2', '3.5.0'])
    expect(params.value.recentSortField).toBe('timestamp')
  })

  it('reverses a pending sort on a second click and ignores the earlier response', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    let resolveEarlier
    apiRequest.mockReturnValueOnce(new Promise(resolve => { resolveEarlier = resolve }))
    const suiteHeading = wrapper.get('button[aria-label="Sort test suite"]')
    await suiteHeading.trigger('click')
    expect(request(-1).get('sortDir')).toBe('asc')
    apiRequest.mockResolvedValueOnce(page([{ ...fixture.rows[0], invocationId: 'latest-sort' }]))
    await suiteHeading.trigger('click')
    await flushPromises()
    expect(request(-1).get('sortDir')).toBe('desc')
    expect(apiRequest.mock.calls[1][1].signal.aborted).toBe(true)
    resolveEarlier(page([{ ...fixture.rows[0], invocationId: 'earlier-sort' }]))
    await flushPromises()
    expect(wrapper.text()).toContain('latest-sort')
    expect(wrapper.text()).not.toContain('earlier-sort')
    expect(wrapper.findAll('th')[0].attributes('aria-sort')).toBe('descending')
  })

  it('reverses the displayed sort after a different column request fails', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    apiRequest.mockRejectedValueOnce(new Error('Temporary failure'))
    await wrapper.get('button[aria-label="Sort test suite"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('th')[3].attributes('aria-sort')).toBe('descending')
    await wrapper.get('button[aria-label="Sort execution time"]').trigger('click')
    await flushPromises()
    expect(request(-1).get('sortField')).toBe('timestamp')
    expect(request(-1).get('sortDir')).toBe('asc')
  })

  it('does not fetch malformed saved versions and recovers through Clear', async () => {
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: { params: ref({ recentVersions: '[bad' }) } } } })
    await flushPromises()
    expect(apiRequest).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('saved version selection is invalid')
    await button('Clear filters').trigger('click')
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledTimes(1)
  })

  it('does not navigate while a user is selecting run text', async () => {
    const nav = { navigateTo: vi.fn() }
    wrapper = mount(RecentRunsView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    const selection = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'copied run ID' })
    await wrapper.get('tbody tr').trigger('click')
    expect(nav.navigateTo).not.toHaveBeenCalled()
    selection.mockRestore()
  })

})
