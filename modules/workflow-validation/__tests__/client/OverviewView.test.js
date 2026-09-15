import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewView from '../../client/views/OverviewView.vue'
import FilterBar from '../../client/components/FilterBar.vue'
import RunsView from '../../client/views/RunsView.vue'
import { resetCostVisibility } from '../../client/composables/useCostVisibility'
import { filters } from '../../client/composables/useWorkflowValidation'
import { apiRequest } from '@shared/client/services/api'

const mockOverview = {
  runs: {
    total: 100, passRate: 0.69, passed: 65, failed: 29,
    tasksTotal: 200, tasksPassed: 180, tasksFailed: 20,
    aiCost: 1180.6, infraCost: 9615.34, avgDuration: 3600,
    turns: 5000, workflows: 18, versions: 11
  },
  bugs: { total: 27, opened: 16, distinctJira: 18 }
}

const mockCharts = {
  overTime: [{ date: '2026-08-04', total: 5, pass: 3, fail: 2 }],
  byVersion: [{ version: '3.5.18', runs: 17, passRate: 0.82 }],
  byWorkflow: [{ workflow: 'fraud_detection', runs: 3, passRate: 0.33, aiCost: 55.5, avgDuration: 8600, bugs: 4 }],
  bugsByCategory: [{ category: 'ENVIRONMENT', count: 11 }],
  bugsByAction: [{ action: 'FILED', count: 16 }],
  recentProductBugs: [{
    id: 'rca-1', bug_key: 'RHOAIENG-123', jira_url: 'https://issues.example/RHOAIENG-123',
    error_summary: 'Deployment failed during validation', workflow: 'fraud_detection',
    rhoai_version: '3.5.18', timestamp: '2026-08-04T20:03:06.825Z'
  }],
  failedTests: [{
    id: 'failed-1', execution_id: 'failed-1', workflow_label: 'Fraud Detection Test', verdict: 'FAIL',
    rhoai_version: '3.5.18', tasks_passed: 7, tasks_failed: 2, tasks_total: 9,
    timestamp: '2026-08-04T20:03:06.825Z',
    productBugs: [{
      id: 'issue-1', category: 'PRODUCT_BUG', action: 'FILED', opened: true,
      bug_key: 'RHOAIENG-456', jira_url: 'https://issues.example/RHOAIENG-456'
    }]
  }, {
    id: 'failed-2', execution_id: 'failed-2', workflow_label: 'Known Product Defect', verdict: 'FAIL',
    tasks_passed: 3, tasks_failed: 1, timestamp: '2026-08-04T19:03:06.825Z',
    productBugs: [{
      id: 'issue-2', category: 'PRODUCT_BUG', action: 'EXISTING', opened: false,
      bug_key: 'RHOAIENG-789', jira_url: 'https://issues.example/RHOAIENG-789'
    }]
  }, {
    id: 'failed-3', execution_id: 'failed-3', workflow_label: 'Environment Failure', verdict: 'FAIL',
    tasks_passed: 0, tasks_failed: 1, timestamp: '2026-08-04T18:03:06.825Z',
    productBugs: [{
      id: 'non-product-1', category: 'ENVIRONMENT', action: 'FILED', opened: true,
      bug_key: 'AIPCC-123', jira_url: 'https://issues.example/AIPCC-123'
    }]
  }, {
    id: 'failed-4', execution_id: 'failed-4', workflow_label: 'Unlinked Product Defect', verdict: 'FAIL',
    tasks_passed: 1, tasks_failed: 1, timestamp: '2026-08-04T17:03:06.825Z',
    productBugs: [{ id: 'issue-3', category: 'PRODUCT_BUG', action: 'NONE', opened: false }]
  }],
  recentTests: [{
    id: '3.5.18/1/fraud_detection/fraud-detection-tutorial',
    workflow_label: 'fraud_detection / fraud-detection-tutorial',
    rhoai_version: '3.5.18', verdict: 'FAIL',
    tasks_passed: 2, tasks_failed: 7, cost_usd: 1.94,
    timestamp: '2026-08-04T20:03:06.825Z',
    productBugs: [{
      id: 'issue-4', category: 'PRODUCT_BUG', action: 'EXISTING', opened: false,
      bug_key: 'RHOAIENG-999', jira_url: 'https://issues.example/RHOAIENG-999'
    }]
  }]
}

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn((path) => {
    if (path.includes('/overview')) return Promise.resolve(mockOverview)
    if (path.includes('/charts')) return Promise.resolve(mockCharts)
    if (path.includes('/runs')) return Promise.resolve({ total: 0, runs: [], nextCursor: null })
    if (path.includes('/test-suites')) return Promise.resolve({ rows: [{
      suite: 'productization', invocationId: 'invocation-2', timestamp: '2026-09-15T12:00:00Z',
      rhoaiVersion: '3.6.0', rhodsOperatorDigest: 'sha256:abcdef123456'
    }, {
      suite: 'productization', invocationId: 'invocation-1', timestamp: '2026-09-14T12:00:00Z'
    }] })
    if (path.includes('/filters')) return Promise.resolve({
      versions: [], providers: [], models: [], workflows: [],
      testSuites: [{ value: 'productization', count: 20 }]
    })
    return Promise.resolve({})
  })
}))

describe('Workflow Validation OverviewView', () => {
  let wrapper
  let moduleNav

  beforeEach(async () => {
    vi.clearAllMocks()
    resetCostVisibility()
    filters.verdict = 'FAIL'
    filters.q = 'stale detail search'
    filters.testSuite = ''
    filters.invocationId = ''
    moduleNav = { navigateTo: vi.fn(), updateParams: vi.fn(), params: { value: {} } }
    wrapper = mount(OverviewView, {
      global: {
        provide: {
          moduleNav
        },
        stubs: {
          TrendLineChart: true,
          CategoryDonut: true,
          PassRateByVersionChart: true,
          FilterBar: true
        }
      }
    })
    await vi.dynamicImportSettled?.()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
  })

  afterEach(() => {
    filters.verdict = ''
    filters.q = ''
    filters.testSuite = ''
    filters.invocationId = ''
    wrapper.unmount()
  })

  it('renders the module heading', () => {
    expect(wrapper.text()).toContain('Workflow Validation')
  })

  it('renders KPI values from the overview endpoint', () => {
    const text = wrapper.text()
    expect(text).toContain('100') // total executions
    expect(text).toContain('69%') // pass rate
    expect(text).toContain('New Product Bugs')
  })

  it('renders failed tests with task outcomes and newly opened product bugs', () => {
    expect(wrapper.text()).toContain('Failed Tests')
    expect(wrapper.text()).toContain('Fraud Detection Test')
    expect(wrapper.text()).toContain('7 tasks passed')
    expect(wrapper.text()).toContain('2 tasks failed')
    expect(wrapper.text()).toContain('RHOAIENG-456 — New product bug opened.')
    expect(wrapper.text()).toContain('RHOAIENG-789 — Pre-existing product bug detected.')
    expect(wrapper.text()).toContain('Environmental failure detected. No product bug detected.')
    expect(wrapper.text()).not.toContain('AIPCC-123')
    expect(wrapper.text()).toContain('Existing product bug detected. Jira ID missing.')
    expect(wrapper.text()).not.toContain('Most Frequently Failing Tasks')
  })

  it('explains each product bug state with a tooltip', () => {
    const tooltips = wrapper.findAll('[title]').map((node) => node.attributes('title'))
    expect(tooltips).toContain('A new product bug was detected. RHOAIENG-456 has been opened.')
    expect(tooltips).toContain('The test failed after encountering an already reported bug. No new issue was opened, but a new occurrence was logged and the issue was updated.')
    expect(tooltips).toContain('A Jira issue exists for this product bug, but its ID is missing from Org Pulse. This may indicate a data import problem or a problem publishing the telemetry.')
    expect(tooltips).toContain('The test failed or was terminated due to a problem in the test execution environment. No product bug was observed.')
  })

  it('renders recently opened product bugs instead of a category chart', () => {
    expect(wrapper.text()).toContain('Recently Opened Product Bugs')
    expect(wrapper.text()).toContain('RHOAIENG-123')
    expect(wrapper.text()).not.toContain('Root Causes by Category')
  })

  it('hides the version chart when only one RHOAI version is present', () => {
    expect(wrapper.findComponent({ name: 'PassRateByVersionChart' }).exists()).toBe(false)
  })

  it('renders the recent tests table', () => {
    expect(wrapper.text()).toContain('Recent Tests')
    expect(wrapper.text()).toContain('fraud_detection')
    expect(wrapper.text()).toContain('RHOAIENG-999 — Pre-existing product bug detected.')
  })

  it('loads dashboard tests through the charts endpoint', () => {
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/charts'))).toBe(true)
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/runs'))).toBe(false)
  })

  it('always requests dashboard data without a verdict filter', () => {
    const dashboardRequests = apiRequest.mock.calls
      .map(([path]) => path)
      .filter((path) => path.includes('/overview') || path.includes('/charts'))
    expect(dashboardRequests).toHaveLength(2)
    expect(dashboardRequests.every((path) => !path.includes('verdict=') && !path.includes('q='))).toBe(true)
  })

  it('passes verdict filters to the tests page without changing dashboard state', async () => {
    filters.verdict = 'PASS'
    await wrapper.get('button[aria-label="View all failed tests"]').trigger('click')
    expect(moduleNav.navigateTo).toHaveBeenCalledWith('runs', expect.objectContaining({
      verdict: 'UNSUCCESSFUL', q: '', dateFrom: filters.dateFrom, dateTo: filters.dateTo
    }))
    expect(filters.verdict).toBe('PASS')
  })

  it('can hide dashboard-only filter controls', async () => {
    const filter = mount(FilterBar, { props: { showVerdict: false, showSearch: false } })
    await vi.dynamicImportSettled?.()
    expect(filter.find('select[aria-label="Verdict"]').exists()).toBe(false)
    expect(filter.find('input[type="text"]').exists()).toBe(false)
    filter.unmount()
  })

  it('selects the latest concrete suite execution and replaces date controls', async () => {
    const filter = mount(FilterBar, { props: { showTestSuite: true } })
    await vi.dynamicImportSettled?.()
    await filter.vm.$nextTick()

    await filter.get('select[aria-label="Test suite"]').setValue('productization')
    await filter.vm.$nextTick()

    expect(filters.invocationId).toBe('invocation-2')
    expect(filter.get('select[aria-label="Suite execution"]').text()).toContain('Sep 15, 2026')
    expect(filter.find('select[aria-label="Date range"]').exists()).toBe(false)
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/test-suites?suite=productization'))).toBe(true)
    filter.unmount()
  })

  it('scopes dashboard requests to one suite execution without date bounds', async () => {
    filters.testSuite = 'productization'
    filters.invocationId = 'invocation-2'
    await wrapper.vm.loadAll()

    const dashboardRequests = apiRequest.mock.calls
      .map(([path]) => path)
      .filter((path) => path.includes('/overview') || path.includes('/charts'))
      .slice(-2)
    expect(dashboardRequests.every((path) => path.includes('testSuite=productization'))).toBe(true)
    expect(dashboardRequests.every((path) => path.includes('invocationId=invocation-2'))).toBe(true)
    expect(dashboardRequests.every((path) => !path.includes('dateFrom=') && !path.includes('dateTo='))).toBe(true)
  })

  it('applies a navigated verdict on the tests detail page', async () => {
    filters.verdict = 'PASS'
    const testsView = mount(RunsView, {
      global: {
        provide: { moduleNav: { navigateTo: vi.fn(), params: { value: { verdict: 'FAIL' } } } },
        stubs: { FilterBar: true }
      }
    })
    await vi.dynamicImportSettled?.()
    await testsView.vm.$nextTick()
    expect(filters.verdict).toBe('FAIL')
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/runs') && path.includes('verdict=FAIL'))).toBe(true)
    testsView.unmount()
  })

  it('hides costs until iddqd is typed', async () => {
    expect(wrapper.text()).not.toContain('AI Cost')
    expect(wrapper.text()).not.toContain('Infra Cost')
    expect(wrapper.text()).not.toContain('$1.94')

    for (const key of 'iddqd') window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('AI Cost')
    expect(wrapper.text()).toContain('Infra Cost')
    expect(wrapper.text()).toContain('$1.94')
  })
})
