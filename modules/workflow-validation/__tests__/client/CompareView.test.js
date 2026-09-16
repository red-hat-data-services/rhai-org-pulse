import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CompareView from '../../client/views/CompareView.vue'
import { apiRequest } from '@shared/client/services/api'

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))

const runs = [
  { invocationId: 'run-new', version: '3.6', latestTimestamp: '2026-09-15T10:00:00Z', tests: 2, executions: 2 },
  { invocationId: 'run-old', version: '3.5', latestTimestamp: '2026-09-01T10:00:00Z', tests: 2, executions: 2 }
]

describe('Workflow Validation CompareView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recovers from an initial API failure when retried', async () => {
    let compareAttempts = 0
    apiRequest.mockImplementation((path) => {
      if (path.endsWith('/filters')) return Promise.resolve({ testSuites: [{ value: 'productization' }] })
      if (path.includes('/compare-runs')) {
        compareAttempts += 1
        return compareAttempts === 1 ? Promise.reject(new Error('Cannot reach OpenSearch: fetch failed')) : Promise.resolve({ runs })
      }
      return Promise.resolve({
        baseline: { invocationId: 'run-old', version: '3.5', tests: 2 },
        target: { invocationId: 'run-new', version: '3.6', tests: 2 },
        rows: [],
        tally: { higher: 1 }
      })
    })

    const wrapper = mount(CompareView, {
      global: {
        provide: { moduleNav: { navigateTo: vi.fn() } },
        stubs: { MetricCard: true, StatusBadge: true, ProductBugStatus: true }
      }
    })
    await vi.dynamicImportSettled?.()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Unable to load comparison')
    expect(wrapper.text()).toContain('Cannot reach OpenSearch: fetch failed')

    await wrapper.get('button').trigger('click')
    await vi.dynamicImportSettled?.()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('Unable to load comparison')
    expect(wrapper.findAll('select')).toHaveLength(4)
    expect(apiRequest).toHaveBeenCalledWith('/modules/workflow-validation/run-compare?baselineInvocation=run-old&targetInvocation=run-new&testSuite=productization')
    wrapper.unmount()
  })

  it('can scope the version comparison to one test', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.endsWith('/filters')) return Promise.resolve({ testSuites: [{ value: 'productization' }] })
      if (path.includes('/compare-runs')) return Promise.resolve({ runs })
      return Promise.resolve({
        baseline: { version: '3.5', tests: 2 },
        target: { version: '3.6', tests: 2 },
        rows: [
          { workflow: 'alpha', workflowLabel: 'Alpha test', change: 'higher', passRateChange: 0.5, baseline: { executions: 2, passed: 1, failed: 1, passRate: 0.5 }, target: { executions: 2, passed: 2, failed: 0, passRate: 1, productBugs: [] } },
          { workflow: 'beta', workflowLabel: 'Beta test', change: 'lower', passRateChange: -0.5, baseline: { executions: 2, passed: 2, failed: 0, passRate: 1 }, target: { executions: 2, passed: 1, failed: 1, passRate: 0.5, productBugs: [] } }
        ],
        tally: { higher: 1, lower: 1 }
      })
    })

    const wrapper = mount(CompareView, {
      global: {
        provide: { moduleNav: { navigateTo: vi.fn() } },
        stubs: { MetricCard: true, StatusBadge: true, ProductBugStatus: true }
      }
    })
    await vi.dynamicImportSettled?.()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Alpha test')
    expect(wrapper.text()).toContain('Beta test')
    await wrapper.get('select[aria-label="Test"]').setValue('beta')
    expect(wrapper.get('tbody').text()).not.toContain('Alpha test')
    expect(wrapper.get('tbody').text()).toContain('Beta test')
    wrapper.unmount()
  })

  it('hydrates every comparison filter from a shared URL and keeps it synchronized', async () => {
    apiRequest.mockImplementation((path) => {
      if (path.endsWith('/filters')) return Promise.resolve({ testSuites: [{ value: 'productization' }] })
      if (path.includes('/compare-runs')) return Promise.resolve({ runs })
      return Promise.resolve({
        baseline: { invocationId: 'run-old', version: '3.5', tests: 2 },
        target: { invocationId: 'run-new', version: '3.6', tests: 2 },
        rows: [{
          workflow: 'beta', workflowLabel: 'Beta test', change: 'same', passRateChange: 0,
          baseline: { executions: 1, passed: 1, passRate: 1 },
          target: { executions: 1, passed: 1, passRate: 1, productBugs: [] }
        }]
      })
    })
    const updateParams = vi.fn()
    const wrapper = mount(CompareView, {
      global: {
        provide: { moduleNav: {
          navigateTo: vi.fn(), updateParams,
          params: { value: { testRun: 'productization', baselineInvocation: 'run-old', targetInvocation: 'run-new', test: 'beta' } }
        } },
        stubs: { MetricCard: true, StatusBadge: true, ProductBugStatus: true }
      }
    })
    await vi.dynamicImportSettled?.()
    await wrapper.vm.$nextTick()

    expect(apiRequest).toHaveBeenCalledWith('/modules/workflow-validation/run-compare?baselineInvocation=run-old&targetInvocation=run-new&testSuite=productization')
    expect(wrapper.findAll('select').map((select) => select.element.value)).toEqual(['productization', 'run-old', 'run-new', 'beta'])
    expect(updateParams).toHaveBeenCalledWith({ testRun: 'productization', baselineInvocation: 'run-old', targetInvocation: 'run-new', test: 'beta' }, { push: false })
    wrapper.unmount()
  })
})
