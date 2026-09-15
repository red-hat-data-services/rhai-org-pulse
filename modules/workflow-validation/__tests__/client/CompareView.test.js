import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CompareView from '../../client/views/CompareView.vue'
import { apiRequest } from '@shared/client/services/api'

vi.mock('@shared/client/services/api', () => ({ apiRequest: vi.fn() }))

const versions = [
  { version: '3.6', tests: 2, executions: 3 },
  { version: '3.5', tests: 2, executions: 4 }
]

describe('Workflow Validation CompareView', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recovers from an initial API failure when retried', async () => {
    apiRequest
      .mockRejectedValueOnce(new Error('Cannot reach OpenSearch: fetch failed'))
      .mockResolvedValueOnce({ versions })
      .mockResolvedValueOnce({
        baseline: { version: '3.5', tests: 2 },
        target: { version: '3.6', tests: 2 },
        rows: [],
        tally: { higher: 1 }
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
    expect(wrapper.findAll('select')).toHaveLength(3)
    expect(apiRequest).toHaveBeenCalledWith('/modules/workflow-validation/version-compare?baseline=3.5&target=3.6')
    wrapper.unmount()
  })

  it('can scope the version comparison to one test', async () => {
    apiRequest
      .mockResolvedValueOnce({ versions })
      .mockResolvedValueOnce({
        baseline: { version: '3.5', tests: 2 },
        target: { version: '3.6', tests: 2 },
        rows: [
          { workflow: 'alpha', workflowLabel: 'Alpha test', change: 'higher', passRateChange: 0.5, baseline: { executions: 2, passed: 1, failed: 1, passRate: 0.5 }, target: { executions: 2, passed: 2, failed: 0, passRate: 1, productBugs: [] } },
          { workflow: 'beta', workflowLabel: 'Beta test', change: 'lower', passRateChange: -0.5, baseline: { executions: 2, passed: 2, failed: 0, passRate: 1 }, target: { executions: 2, passed: 1, failed: 1, passRate: 0.5, productBugs: [] } }
        ],
        tally: { higher: 1, lower: 1 }
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
    await wrapper.findAll('select')[2].setValue('beta')
    expect(wrapper.get('tbody').text()).not.toContain('Alpha test')
    expect(wrapper.get('tbody').text()).toContain('Beta test')
    wrapper.unmount()
  })

  it('hydrates every comparison filter from a shared URL and keeps it synchronized', async () => {
    apiRequest
      .mockResolvedValueOnce({ versions })
      .mockResolvedValueOnce({
        baseline: { version: '3.6', tests: 2 },
        target: { version: '3.5', tests: 2 },
        rows: [{
          workflow: 'beta', workflowLabel: 'Beta test', change: 'same', passRateChange: 0,
          baseline: { executions: 1, passed: 1, passRate: 1 },
          target: { executions: 1, passed: 1, passRate: 1, productBugs: [] }
        }]
      })
    const updateParams = vi.fn()
    const wrapper = mount(CompareView, {
      global: {
        provide: { moduleNav: {
          navigateTo: vi.fn(), updateParams,
          params: { value: { baseline: '3.6', target: '3.5', test: 'beta' } }
        } },
        stubs: { MetricCard: true, StatusBadge: true, ProductBugStatus: true }
      }
    })
    await vi.dynamicImportSettled?.()
    await wrapper.vm.$nextTick()

    expect(apiRequest).toHaveBeenCalledWith('/modules/workflow-validation/version-compare?baseline=3.6&target=3.5')
    expect(wrapper.findAll('select').map((select) => select.element.value)).toEqual(['3.6', '3.5', 'beta'])
    expect(updateParams).toHaveBeenCalledWith({ baseline: '3.6', target: '3.5', test: 'beta' }, { push: false })
    wrapper.unmount()
  })
})
