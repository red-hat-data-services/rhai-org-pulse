import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewView from '../../client/views/OverviewView.vue'

const mockOverview = {
  runs: {
    total: 100, passRate: 0.69, passed: 65, failed: 29,
    tasksTotal: 200, tasksPassed: 180, tasksFailed: 20,
    aiCost: 1180.6, infraCost: 75117.5, avgDuration: 3600,
    turns: 5000, workflows: 18, versions: 11
  },
  bugs: { total: 27, opened: 16, distinctJira: 18 }
}

const mockCharts = {
  overTime: [{ date: '2026-08-04', total: 5, pass: 3, fail: 2 }],
  byVersion: [{ version: '3.5.18', runs: 17, passRate: 0.82 }],
  byWorkflow: [{ workflow: 'fraud_detection', runs: 3, passRate: 0.33, aiCost: 55.5, avgDuration: 8600, bugs: 4 }],
  bugsByCategory: [{ category: 'ENVIRONMENT', count: 11 }],
  bugsByAction: [{ action: 'FILED', count: 16 }]
}

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn((path) => {
    if (path.includes('/overview')) return Promise.resolve(mockOverview)
    if (path.includes('/charts')) return Promise.resolve(mockCharts)
    if (path.includes('/filters')) return Promise.resolve({ versions: [], providers: [], models: [], workflows: [] })
    return Promise.resolve({})
  })
}))

describe('Workflow Validation OverviewView', () => {
  let wrapper

  beforeEach(async () => {
    wrapper = mount(OverviewView, {
      global: {
        provide: {
          moduleNav: { navigateTo: vi.fn(), params: { value: {} } }
        },
        stubs: {
          RunsOverTimeChart: true,
          PassRateByVersionChart: true,
          FilterBar: true
        }
      }
    })
    await vi.dynamicImportSettled?.()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
  })

  it('renders the module heading', () => {
    expect(wrapper.text()).toContain('Workflow Validation')
  })

  it('renders KPI values from the overview endpoint', () => {
    const text = wrapper.text()
    expect(text).toContain('100') // total runs
    expect(text).toContain('69%') // pass rate
    expect(text).toContain('Bugs Opened')
  })

  it('renders the per-workflow breakdown row', () => {
    expect(wrapper.text()).toContain('fraud_detection')
  })
})
