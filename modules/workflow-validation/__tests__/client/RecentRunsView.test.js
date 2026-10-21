import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RecentRunsView from '../../client/views/RecentRunsView.vue'
import { filters, resetFilters } from '../../client/composables/useWorkflowValidation'
import { apiRequest } from '@shared/client/services/api'
import fixture from '../../../../fixtures/workflow-validation/recent-runs.json'

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))

describe('Recent Runs', () => {
  let wrapper
  beforeEach(() => {
    apiRequest.mockReset().mockResolvedValue(fixture)
    resetFilters()
  })
  afterEach(() => wrapper?.unmount())

  it('uses the existing API across all suites and versions without shared filters', async () => {
    Object.assign(filters, { version: 'older', testSuite: 'another-suite', invocationId: 'another-run', verdict: 'FAIL', q: 'old search' })
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith('/modules/workflow-validation/test-suites?limit=20&includeBugs=false')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.text()).toContain('Release Gate')
    expect(wrapper.text()).toContain('Exploratory Specs')
    expect(wrapper.text()).toContain('Version unavailable')
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('Not available yet')
    expect(wrapper.text()).not.toContain('2026-10-19')
    expect(wrapper.text()).not.toContain('Design preview')
  })

  it('links to the exact dashboard run and explicitly clears an unavailable version', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    const link = new URL(wrapper.findAll('a')[2].attributes('href').replace('#', ''), 'http://localhost')
    expect(link.pathname).toBe('/workflow-validation/overview')
    expect(Object.fromEntries(link.searchParams)).toEqual({
      exactRun: '1', version: '', testSuite: 'ad-hoc', invocationId: 'sample / opaque?&id',
      datePreset: 'all', dateFrom: '', dateTo: ''
    })
  })

  it('caps older backend responses at 20 rows', async () => {
    apiRequest.mockResolvedValue({ rows: Array.from({ length: 25 }, (_, i) => ({ ...fixture.rows[0], invocationId: `run-${i}` })) })
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(20)
  })

  it('shows an empty state only after a successful request', async () => {
    let resolve
    apiRequest.mockReturnValue(new Promise(done => { resolve = done }))
    wrapper = mount(RecentRunsView)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[role="status"]').text()).toContain('Loading')
    expect(wrapper.text()).not.toContain('No runs are available')
    resolve({ rows: [] })
    await flushPromises()
    expect(wrapper.text()).toContain('No runs are available')
  })

  it('retries failures without presenting them as empty results', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Service unavailable'))
    wrapper = mount(RecentRunsView)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Service unavailable')
    expect(wrapper.text()).not.toContain('No runs are available')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('retains rows while refreshing and after a refresh failure', async () => {
    wrapper = mount(RecentRunsView)
    await flushPromises()
    let reject
    apiRequest.mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
    await wrapper.get('button').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.get('button').element.disabled).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toContain('Updating')
    reject(new Error('Refresh failed'))
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.get('[role="alert"]').text()).toContain('Refresh failed')
  })
})
