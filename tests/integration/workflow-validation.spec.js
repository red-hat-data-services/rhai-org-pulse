const { test, expect } = require('@playwright/test')

test.describe('Workflow Validation module @workflow-validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/modules/workflow-validation/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      let body = {}
      if (path.endsWith('/filters')) body = {
        versions: [{ value: '3.6', count: 3 }, { value: '3.5', count: 2 }],
        providers: [], models: [],
        workflows: [{ value: 'live-workflow', label: 'Live workflow', count: 3 }, { value: 'other-workflow', label: 'Other workflow', count: 2 }],
        testSuites: [{ value: 'productization', count: 3 }]
      }
      if (path.endsWith('/test-suites')) {
        body = { rows: [{ suite: 'productization', invocationId: 'invocation-1', timestamp: '2026-09-15T10:00:00Z', tests: 3, passed: 2, failed: 1, errors: 0, passRate: 2 / 3, rhoaiVersion: '3.6', rhodsOperatorDigest: 'abcdef0123456789', productBugs: [] }] }
      }
      if (path.endsWith('/test-suites/productization/invocation-1')) {
        body = { suite: 'productization', invocationId: 'invocation-1', timestamp: '2026-09-15T10:00:00Z', rhoaiVersion: '3.6', rhodsOperatorDigest: 'abcdef0123456789', clusterName: 'test-cluster', summary: { tests: 1, passed: 1, failed: 0, errors: 0, passRate: 1 }, productBugs: [], tests: [{ execution_id: 'opaque-id', workflow: 'live-workflow', workflow_label: 'Live workflow', verdict: 'PASS', timestamp: '2026-09-15T10:00:00Z', tasks_passed: 1, tasks_total: 1, productBugs: [] }] }
      }
      if (path.endsWith('/overview')) {
        body = {
          runs: { total: 1, passRate: 1, passed: 1, failed: 0, errors: 0, tasksTotal: 1, tasksPassed: 1, tasksFailed: 0, aiCost: 1, infraCost: 2, avgDuration: 3, turns: 4, workflows: 1, versions: 1 },
          bugs: { total: 0, opened: 0, distinctJira: 0 }
        }
      }
      if (path.endsWith('/charts')) body = {
        overTime: [], byVersion: [], byWorkflow: [], byProvider: [], bugsByCategory: [],
        bugsByAction: [], bugsByComponent: [], newProductBugs: [], knownProductBugs: [],
        tests: [{ execution_id: 'opaque-id', workflow: 'live-workflow', workflow_label: 'Live workflow', verdict: 'PASS', tasks_passed: 1, tasks_total: 1, productBugs: [] }]
      }
      if (path.endsWith('/runs')) {
        body = { total: 1, size: 8, nextCursor: null, runs: [{ execution_id: 'opaque-id', workflow: 'live-workflow', workflow_label: 'Live workflow', verdict: 'PASS', tasks_passed: 1, tasks_total: 1, cost_usd: 1, productBugs: [] }] }
      }
      if (path.endsWith('/bugs')) {
        body = { total: 0, size: 50, nextCursor: null, kpis: { total: 0, opened: 0, distinctJira: 0 }, byCategory: [], byAction: [], bugs: [] }
      }
      if (path.endsWith('/workflows')) {
        body = { tags: [], workflows: [{ workflow: 'live-workflow', workflowLabel: 'Live workflow', tags: [], runs: 1, passRate: 1, aiCost: 1, avgDuration: 3, productBugs: [], latestVerdict: 'PASS' }] }
      }
      if (path.endsWith('/ci-runs')) {
        body = { ciRuns: [{ runId: 'run-1', version: '3.6', workflows: 1, passRate: 1, timestamp: '2026-09-10T00:00:00Z' }] }
      }
      if (path.endsWith('/compare')) {
        body = { a: { runId: 'run-1', workflows: 1 }, b: { runId: 'run-1', workflows: 1 }, rows: [], tally: {} }
      }
      if (path.includes('/compare-runs')) {
        body = { runs: [{ invocationId: 'invocation-1', version: '3.6', latestTimestamp: '2026-09-15T10:00:00Z', tests: 1, executions: 1 }, { invocationId: 'invocation-0', version: '3.5', latestTimestamp: '2026-09-01T10:00:00Z', tests: 1, executions: 1 }] }
      }
      if (path.includes('/run-compare')) {
        body = { baseline: { invocationId: 'invocation-0', version: '3.5', tests: 1 }, target: { invocationId: 'invocation-1', version: '3.6', tests: 1 }, rows: [], tally: {} }
      }
      if (path.endsWith('/runs/opaque-id')) {
        body = {
          run: { execution_id: 'opaque-id', workflow: 'live-workflow', workflow_label: 'Live workflow', verdict: 'PASS', tasks_failed: 1, summary_text: '**Rendered summary**\n\n- List item' },
          tasks: [{ task_execution_id: 'task-1', task: 'AI judged task', status: 'FAIL', passed: false }],
          bugs: [{
            id: 'finding-1', category: 'AUTOMATION_BUG', action: 'NONE',
            error_summary: 'Harness cleanup failed', severity: 'minor', reproducibility: 'always',
            reasoning: 'The failure occurred during automated cleanup.', workaround: 'Retry cleanup manually.',
            suggested_remediation: 'Refresh the resource before updating it.'
          }]
        }
      }
      if (path.endsWith('/workflow-history')) {
        body = { workflow: 'live-workflow', workflowLabel: 'Live workflow', summary: { runs: 1, passed: 1, failed: 0, passRate: 1, latestVerdict: 'PASS' }, runs: [], bugs: [] }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
  })

  test('loads live-schema execution data through the Org Pulse backend', async ({ page }) => {
    const requests = []
    page.on('request', (request) => {
      if (request.url().includes('/api/modules/workflow-validation/')) requests.push(request.url())
    })

    await page.goto('/#/workflow-validation/overview')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Workflow Validation' })).toBeVisible()
    await expect(page.getByText('Live workflow')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New Product Bugs Opened' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Known Product Bugs Encountered' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Results', exact: true })).toBeVisible()
    expect(requests.some((url) => url.includes('/overview'))).toBe(true)
    expect(requests.every((url) => !url.includes('opensearch-workflow-validation'))).toBe(true)
  })

  test('toggles hidden costs with iddqd across views', async ({ page }) => {
    await page.goto('/#/workflow-validation/overview')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Workflow Validation' })).toBeVisible()
    await expect(page.getByText('AI Cost', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Infra Cost', { exact: true })).toHaveCount(0)

    await page.keyboard.type('iddqd')
    await expect(page.getByText('AI Cost', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Infra Cost', { exact: true })).toBeVisible()

    await page.goto('/#/workflow-validation/runs')
    await expect(page.getByRole('columnheader', { name: 'AI Cost' })).toBeVisible()
    await expect(page.getByText('$1.00')).toBeVisible()

    await page.keyboard.type('iddqd')
    await expect(page.getByRole('columnheader', { name: 'AI Cost' })).toHaveCount(0)
    await expect(page.getByText('$1.00')).toHaveCount(0)
  })

  test('scopes the dashboard to one selected test run', async ({ page }) => {
    const dashboardRequests = []
    page.on('request', (request) => {
      if (/\/(overview|charts)\?/.test(request.url())) dashboardRequests.push(request.url())
    })

    await page.goto('/#/workflow-validation/overview')
    await page.getByRole('combobox', { name: 'Test Suite' }).selectOption('productization')

    await expect(page.getByRole('combobox', { name: 'Test Run' })).toHaveValue('invocation-1')
    await expect(page.getByRole('combobox', { name: 'Date range' })).toHaveCount(0)
    await expect.poll(() => dashboardRequests.some((url) =>
      url.includes('testSuite=productization') &&
      url.includes('invocationId=invocation-1') &&
      !url.includes('dateFrom=') &&
      !url.includes('dateTo=')
    )).toBe(true)
  })

  test('restores filter state from shareable URLs on every filtered top-level view', async ({ page }) => {
    const requests = []
    page.on('request', (request) => {
      if (request.url().includes('/api/modules/workflow-validation/')) requests.push(request.url())
    })

    await page.goto('/#/workflow-validation/runs?version=3.6&verdict=FAIL&workflow=live-workflow&q=live&testSuite=&invocationId=&dateFrom=2026-09-01&dateTo=2026-09-15')
    await expect(page.getByRole('combobox', { name: 'Verdict' })).toHaveValue('FAIL')
    await expect(page.getByLabel('Search test names…')).toHaveValue('live')
    await expect.poll(() => requests.some((url) =>
      url.includes('/runs?') && url.includes('version=3.6') && url.includes('workflow=live-workflow') && url.includes('dateFrom=2026-09-01')
    )).toBe(true)

    await page.goto('/#/workflow-validation/test-suites?suite=productization&datePreset=all&dateFrom=&dateTo=')
    await expect(page.getByRole('combobox', { name: 'Test run' })).toHaveValue('productization')
    await expect(page.getByRole('combobox', { name: 'Date range' })).toHaveValue('all')

    await page.goto('/#/workflow-validation/compare?testRun=productization&baselineInvocation=invocation-0&targetInvocation=invocation-1&test=')
    await expect(page.getByLabel('Test Suite', { exact: true })).toHaveValue('productization')
    await expect(page.getByLabel('Baseline Test Run')).toHaveValue('invocation-0')
    await expect(page.getByLabel('Target Test Run')).toHaveValue('invocation-1')

    await page.goto('/#/workflow-validation/activity?version=3.6&testSuite=productization&invocationId=invocation-1&workflow=live-workflow&q=timeout&dateFrom=&dateTo=')
    await expect(page.getByRole('combobox', { name: 'Test Suite', exact: true })).toHaveValue('productization')
    await expect(page.getByRole('combobox', { name: 'Test Run' })).toHaveValue('invocation-1')
    await expect(page.getByRole('combobox', { name: 'Test', exact: true })).toHaveValue('live-workflow')
    await expect(page.getByRole('option', { name: 'Other workflow' })).toHaveCount(0)
    await expect(page.getByLabel('Search Jira keys, tests, components, or bug details…')).toHaveValue('timeout')

    await page.goto('/#/workflow-validation/workflows?testRun=productization&version=3.6&datePreset=all&dateFrom=&dateTo=')
    await expect(page.getByRole('combobox', { name: 'Test Suite' })).toHaveValue('productization')
    await expect(page.getByRole('combobox', { name: 'RHOAI version' })).toHaveValue('3.6')
    await expect(page.getByRole('combobox', { name: 'Date range' })).toHaveValue('all')
  })

  test('is visible in navigation and all primary views render', async ({ page }) => {
    await page.goto('/')
    const moduleButton = page.locator('aside nav button').filter({ hasText: 'Workflow Validation' }).first()
    await expect(moduleButton).toBeVisible()
    await moduleButton.click()
    await expect(page.locator('aside nav').getByText('Dashboard', { exact: true })).toBeVisible()
    await expect(page.locator('aside nav').getByText('Test Runs', { exact: true })).toHaveCount(0)
    await expect(page.locator('aside nav').getByText('Test Results', { exact: true })).toHaveCount(0)

    for (const [view, heading] of [
      ['overview', 'Workflow Validation'],
      ['workflows', 'Trends'],
      ['compare', 'Compare Test Runs'],
      ['activity', 'Jira']
    ]) {
      await page.goto(`/#/workflow-validation/${view}`)
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }

    await page.goto('/#/workflow-validation/workflows')
    await expect(page.getByRole('heading', { name: 'Pass Rate and Test Volume' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bug Occurrences Over Time' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Bug Frequency by RHOAI Version' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Bugs opened' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Known bugs' })).toBeVisible()

    await page.goto('/#/workflow-validation/runs')
    await expect(page.getByRole('option', { name: 'Error', exact: true })).toHaveCount(1)
    await expect(page.getByRole('option', { name: 'Failed or error' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'When ↓' })).toBeVisible()
    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Test ↓' })).toBeVisible()

    await page.goto('/#/workflow-validation/test-suites')
    await expect(page.getByRole('option', { name: 'Latest' })).toHaveCount(1)
    await expect(page.getByRole('cell', { name: 'abcdef01' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Productization' })).toBeVisible()
  })

  test('renders execution and workflow hidden routes from canonical identities', async ({ page }) => {
    await page.goto('/#/workflow-validation/run-detail?runKey=opaque-id')
    await expect(page.getByRole('heading', { name: 'Live workflow' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('button', { name: 'Test Results' })).toHaveCount(0)
    await expect(page.getByRole('alert')).toContainText('This test is marked passed but with a failed task.')
    await expect(page.getByRole('button', { name: 'View test trend' })).toBeVisible()
    await expect(page.getByRole('strong')).toHaveText('Rendered summary')
    await expect(page.getByRole('listitem')).toHaveText('List item')
    await page.getByText('Finding details').click()
    await expect(page.getByText('The failure occurred during automated cleanup.')).toBeVisible()
    await expect(page.getByText('Retry cleanup manually.')).toBeVisible()

    await page.goto('/#/workflow-validation/workflow-history?workflow=live-workflow')
    await expect(page.getByRole('heading', { name: 'Live workflow' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('button', { name: 'Test Trends' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Execution History' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Compare this test across runs' })).toBeVisible()

    await page.goto('/#/workflow-validation/test-suite-detail?suite=productization&invocationId=invocation-1')
    await expect(page.getByRole('heading', { name: 'Productization' })).toBeVisible()
    await expect(page.getByText('abcdef01')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tests in this Run' })).toBeVisible()
  })
})
