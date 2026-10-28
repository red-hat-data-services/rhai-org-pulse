import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import OverviewView from '../../client/views/OverviewView.vue'
import FilterBar from '../../client/components/FilterBar.vue'
import RunsView from '../../client/views/RunsView.vue'
import { resetCostVisibility } from '../../client/composables/useCostVisibility'
import { filters, resetFilters } from '../../client/composables/useWorkflowValidation'
import { apiRequest } from '@shared/client/services/api'

const mockOverview = {
  runs: {
    total: 100, passRate: 0.69, passed: 65, failed: 29,
    tasksTotal: 200, tasksPassed: 180, tasksFailed: 20,
    aiCost: 1180.6, infraCost: 9615.34, avgDuration: 3600, suiteDuration: 5400,
    turns: 5000, workflows: 18, versions: 1, version: '3.6.0-ea.1',
    rhodsOperatorDigest: 'a6b5eb9cba3d340e7ffa7ab4864bf4c996b5345e3706bc47f6a9b775931292b3'
  },
  bugs: { total: 27, opened: 16, distinctJira: 18 }
}

const mockCharts = {
  overTime: [{ date: '2026-08-04', total: 5, pass: 3, fail: 2 }],
  byVersion: [{ version: '3.5.18', runs: 17, passRate: 0.82 }],
  byWorkflow: [{ workflow: 'fraud_detection', runs: 3, passRate: 0.33, aiCost: 55.5, avgDuration: 8600, bugs: 4 }],
  bugsByCategory: [{ category: 'ENVIRONMENT', count: 11 }],
  bugsByAction: [{ action: 'FILED', count: 16 }],
  newProductBugs: [{
    id: 'rca-1', bug_key: 'RHOAIENG-123', jira_url: 'https://issues.example/RHOAIENG-123',
    category: 'PRODUCT_BUG', action: 'FILED', opened: true,
    error_summary: 'Deployment failed during validation', workflow: 'fraud_detection',
    rhoai_version: '3.5.18', timestamp: '2026-08-04T20:03:06.825Z'
  }, {
    id: 'rca-rfe', bug_key: 'RHAIRFE-123', jira_url: 'https://issues.example/RHAIRFE-123',
    category: 'FEATURE_REQUEST', action: 'FILED', opened: true,
    error_summary: 'Requested workflow enhancement', workflow: 'fraud_detection',
    rhoai_version: '3.5.18', timestamp: '2026-08-04T20:03:06.825Z'
  }],
  knownProductBugs: [{
    id: 'rca-2', bug_key: 'RHOAIENG-789', jira_url: 'https://issues.example/RHOAIENG-789',
    category: 'PRODUCT_BUG', action: 'EXISTING', opened: false,
    error_summary: 'Previously reported defect encountered', workflow: 'known_defect'
  }],
  tests: [{
    id: 'failed-1', execution_id: 'failed-1', workflow_label: 'Fraud Detection Test', verdict: 'FAIL',
    telemetry_origin: 'gitlab-mr',
    rhoai_version: '3.5.18', tasks_passed: 7, tasks_failed: 2, tasks_total: 9,
    timestamp: '2026-08-04T20:03:06.825Z',
    duration_s: 125,
    productBugs: [{
      id: 'issue-1', category: 'PRODUCT_BUG', action: 'FILED', opened: true,
      bug_key: 'RHOAIENG-456', jira_url: 'https://issues.example/RHOAIENG-456'
    }, {
      id: 'issue-rfe', category: 'FEATURE_REQUEST', action: 'FILED', opened: true,
      bug_key: 'RHAIRFE-123', jira_url: 'https://issues.example/RHAIRFE-123'
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
  }, {
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
    if (path.includes('/test-suites/')) return Promise.resolve({ suite: 'productization', invocationId: path.split('/').at(-1), rhoaiVersion: null })
    if (path.includes('/test-suites') && path.includes('version=3.5.0')) return Promise.resolve({ rows: [{
      suite: 'legacy-validation', invocationId: 'legacy-invocation', timestamp: '2026-08-15T12:00:00Z',
      rhoaiVersion: '3.5.0'
    }] })
    if (path.includes('/test-suites')) return Promise.resolve({ rows: [{
      suite: 'productization', invocationId: 'invocation-2', timestamp: '2026-09-15T12:00:00Z',
      rhoaiVersion: '3.6.0', rhodsOperatorDigest: 'sha256:abcdef123456'
    }, {
      suite: 'productization', invocationId: 'invocation-1', timestamp: '2026-09-14T12:00:00Z'
    }] })
    if (path.includes('/filters')) return Promise.resolve({
      versions: [{ value: '3.6.0', count: 20 }],
      providers: [], models: [], workflows: [],
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
    filters.version = '3.6.0'
    filters.testSuite = 'productization'
    filters.invocationId = 'invocation-2'
    moduleNav = { navigateTo: vi.fn(), updateParams: vi.fn(), params: { value: {} } }
    wrapper = mount(OverviewView, {
      global: {
        provide: {
          moduleNav
        },
        stubs: {
          FilterBar: {
            template: '<div />',
            emits: ['ready'],
            mounted() { this.$emit('ready') }
          }
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
    expect(text).toContain('5Tests')
    expect(text).toContain('0%Pass Rate')
    expect(text).toContain('2Skipped')
    expect(text).toContain('3.6.0-ea.1')
    expect(text).toContain('a6b5eb9c')
    expect(text).toContain('Issues Opened')
    expect(text).toContain('Existing Issues Encountered')
    expect(text).not.toContain('Total Test Time')
    expect(text).not.toContain('Product Bug Occurrences')
    expect(text).not.toContain('Tasks Passed')
    expect(text).not.toContain('distinct linked issues')
  })

  it('renders every test result with Jira issue context and hides task outcomes', () => {
    expect(wrapper.text()).toContain('Test Results')
    expect(wrapper.text()).toContain('Fraud Detection Test')
    expect(wrapper.text()).toContain('Origin: gitlab-mr')
    expect(wrapper.text()).not.toContain('7 tasks passed')
    expect(wrapper.text()).not.toContain('2 tasks failed')
    expect(wrapper.text()).not.toContain('Duration')
    expect(wrapper.text()).toContain('RHOAIENG-456 — New product bug opened.')
    expect(wrapper.text()).toContain('RHAIRFE-123 — New feature request opened.')
    expect(wrapper.get('a[href="https://issues.example/RHOAIENG-456"]').text()).toBe('RHOAIENG-456')
    expect(wrapper.text()).toContain('RHOAIENG-789 — Pre-existing product bug detected.')
    expect(wrapper.findAll('[role="img"][aria-label="No Jira-linked issue recorded."]')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('Environmental failure detected. No product or UX issue detected.')
    expect(wrapper.text()).not.toContain('AIPCC-123')
    expect(wrapper.text()).not.toContain('Existing product bug detected. Jira ID missing.')
    expect(wrapper.text()).not.toContain('Most Frequently Failing Tasks')
  })

  it('explains each Jira issue state with a tooltip', () => {
    const tooltips = wrapper.findAll('[title]').map((node) => node.attributes('title'))
    expect(tooltips).toContain('A new product bug was detected. RHOAIENG-456 has been opened.')
    expect(tooltips).toContain('A new feature request was detected. RHAIRFE-123 has been opened.')
    expect(tooltips).toContain('The test encountered an already reported product bug. No new issue was opened.')
    expect(tooltips).not.toContain('A Jira issue exists for this product bug, but its ID is missing from Org Pulse. This may indicate a data import problem or a problem publishing the telemetry.')
    expect(tooltips).toContain('The test failed or was terminated without a Jira-linked issue recorded.')
  })

  it('separates newly opened and existing Jira issues with clear explanations', () => {
    expect(wrapper.text()).toContain('New Jira Issues Opened')
    expect(wrapper.text()).toContain('Jira issues first opened during this test run.')
    expect(wrapper.text()).toContain('RHOAIENG-123')
    expect(wrapper.text()).toContain('RHAIRFE-123')
    expect(wrapper.text()).toContain('Existing Jira Issues Encountered')
    expect(wrapper.text()).toContain('Previously reported Jira issues encountered again during this test run; no new issue was opened.')
    expect(wrapper.text()).toContain('RHOAIENG-789')
    expect(wrapper.text()).not.toContain('Root Causes by Category')
  })

  it('uses one complete suite-execution test table', () => {
    expect(wrapper.text()).toContain('fraud_detection')
    expect(wrapper.text()).toContain('RHOAIENG-999 — Pre-existing product bug detected.')
    expect(wrapper.text()).not.toContain('Recent Tests')
    expect(wrapper.text()).not.toContain('Failed Tests')
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

  it('can hide dashboard-only filter controls', async () => {
    const filter = mount(FilterBar, { props: { showVerdict: false, showSearch: false } })
    await vi.dynamicImportSettled?.()
    expect(filter.find('select[aria-label="Verdict"]').exists()).toBe(false)
    expect(filter.find('input[type="text"]').exists()).toBe(false)
    filter.unmount()
  })

  it('selects the latest concrete test run and replaces date controls', async () => {
    filters.version = ''
    filters.testSuite = ''
    filters.invocationId = ''
    const filter = mount(FilterBar, { props: { showTestSuite: true, suiteExecutionOnly: true } })
    await vi.dynamicImportSettled?.()
    await filter.vm.$nextTick()

    await vi.waitFor(() => expect(filters.invocationId).toBe('invocation-2'))
    expect(filters.version).toBe('3.6.0')
    expect(filter.get('select[aria-label="Test Suite"]').element.value).toBe('productization')
    expect(filters.invocationId).toBe('invocation-2')
    expect(filter.get('select[aria-label="Test Run"]').text()).toContain('Sep 15, 2026')
    expect(filter.find('select[aria-label="Date range"]').exists()).toBe(false)
    expect(filter.get('button').text()).toBe('Latest')
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/test-suites?version=3.6.0'))).toBe(true)
    filter.unmount()
  })

  it('returns to the latest release and test run after browsing older data', async () => {
    filters.version = '3.5.0'
    filters.testSuite = 'productization'
    filters.invocationId = 'invocation-1'
    const filter = mount(FilterBar, { props: { showTestSuite: true, suiteExecutionOnly: true } })
    await vi.dynamicImportSettled?.()
    await filter.vm.$nextTick()

    await vi.waitFor(() => expect(filters.testSuite).toBe('legacy-validation'))
    expect(filter.get('select[aria-label="Test Suite"]').text()).toContain('Legacy Validation')
    expect(filter.get('select[aria-label="Test Suite"]').text()).not.toContain('Productization')

    await filter.get('button').trigger('click')
    await vi.waitFor(() => expect(filters.invocationId).toBe('invocation-2'))

    expect(filters.version).toBe('3.6.0')
    expect(filters.testSuite).toBe('productization')
    expect(filter.emitted('change')).toHaveLength(1)
    filter.unmount()
  })

  it('scopes dashboard requests to one test run without date bounds', async () => {
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

  it('toggles costs each time iddqd is typed', async () => {
    expect(wrapper.text()).not.toContain('AI Cost')
    expect(wrapper.text()).not.toContain('Infra Cost')
    expect(wrapper.text()).not.toContain('$1.94')

    for (const key of 'iddqd') window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('AI Cost')
    expect(wrapper.text()).toContain('Infra Cost')
    expect(wrapper.text()).toContain('$1.94')

    for (const key of 'iddqd') window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).not.toContain('AI Cost')
    expect(wrapper.text()).not.toContain('Infra Cost')
    expect(wrapper.text()).not.toContain('$1.94')
  })
})

describe('Dashboard navigation from Recent Runs', () => {
  let wrapper
  let nav
  beforeEach(() => {
    vi.clearAllMocks()
    resetFilters()
    nav = { navigateTo: vi.fn(), updateParams: vi.fn(), params: ref({
      exactRun: '1', testSuite: 'productization', invocationId: 'selected-run', version: '',
      datePreset: 'all', dateFrom: '', dateTo: ''
    }) }
  })
  afterEach(() => wrapper?.unmount())

  it('honors an explicit run with no version instead of selecting the highest version', async () => {
    filters.version = 'stale-version'
    wrapper = mount(OverviewView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    const requests = apiRequest.mock.calls.map(([path]) => path).filter(path => /\/(overview|charts)/.test(path))
    expect(requests).toHaveLength(2)
    for (const path of requests) {
      const params = new URL(path, 'http://localhost').searchParams
      expect(params.get('testSuite')).toBe('productization')
      expect(params.get('invocationId')).toBe('selected-run')
      for (const key of ['version', 'dateFrom', 'dateTo', 'verdict', 'q']) expect(params.has(key)).toBe(false)
    }
    expect(wrapper.findComponent(FilterBar).exists()).toBe(false)
    expect(nav.updateParams).not.toHaveBeenCalled()
    expect(wrapper.get('a[href="#/workflow-validation/recent-runs"]').text()).toBe('Recent Runs')
  })

  it('keeps shared filters unchanged while an exact run is open', async () => {
    Object.assign(filters, { version: '3.5', testSuite: 'exploratory-specs', invocationId: 'previous-run',
      datePreset: 'custom', dateFrom: '2026-09-01', dateTo: '2026-09-30' })
    const previous = { ...filters }
    wrapper = mount(OverviewView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    expect({ ...filters }).toEqual(previous)
    const requests = apiRequest.mock.calls.map(([path]) => path).filter(path => /\/(overview|charts)/.test(path))
    expect(requests.every(path => new URL(path, 'http://localhost').searchParams.get('invocationId') === 'selected-run')).toBe(true)
  })

  it('reports a removed run without falling back to another invocation', async () => {
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Not found'), { status: 404 }))
    wrapper = mount(OverviewView, { global: { provide: { moduleNav: nav } } })
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('This run is no longer available')
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith('/modules/workflow-validation/test-suites/productization/selected-run')
    expect(wrapper.text()).not.toContain('Fraud Detection Test')
  })

  it('reloads a new selected run and ignores the previous run response', async () => {
    let resolveFirst
    apiRequest.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
    wrapper = mount(OverviewView, { global: { provide: { moduleNav: nav } } })
    nav.params.value = { ...nav.params.value, invocationId: 'new-selected-run' }
    await flushPromises()
    expect(apiRequest).toHaveBeenCalledWith('/modules/workflow-validation/test-suites/productization/new-selected-run')
    const count = apiRequest.mock.calls.length
    resolveFirst({ rhoaiVersion: 'outdated-version' })
    await flushPromises()
    expect(apiRequest.mock.calls).toHaveLength(count)
    expect(wrapper.text()).not.toContain('outdated-version')
    expect(wrapper.text()).toContain('new-selected-run')
  })
})
