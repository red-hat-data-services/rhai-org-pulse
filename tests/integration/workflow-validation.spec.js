const { test, expect } = require('@playwright/test')

async function mockTrendSuites(page) {
  const rows = [
    { suite: 'ad-hoc', invocationId: 'ad-hoc-latest', timestamp: '2026-10-02T10:00:00Z', tests: 2, passed: 2, failed: 0, errors: 0, passRate: 1, rhoaiVersion: '3.6', productBugs: [] },
    { suite: 'release-gate', invocationId: 'release-gate-older', timestamp: '2026-10-01T10:00:00Z', tests: 3, passed: 2, failed: 1, errors: 0, passRate: 2 / 3, rhoaiVersion: '3.6', productBugs: [] },
  ]
  await page.route('**/api/modules/workflow-validation/filters', (route) => route.fulfill({
    json: {
      versions: [{ value: '3.6', count: 5 }],
      providers: [], models: [], workflows: [],
      testSuites: [{ value: 'ad-hoc', count: 2 }, { value: 'release-gate', count: 3 }],
    },
  }))
  await page.route('**/api/modules/workflow-validation/test-suites?**', (route) => {
    const suite = new URL(route.request().url()).searchParams.get('suite')
    return route.fulfill({ json: { rows: suite ? rows.filter((row) => row.suite === suite) : rows } })
  })
}

test.describe('Workflow Validation module @workflow-validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/modules/workflow-validation/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      let body = {}
      if (path.endsWith('/config')) body = {
        url: 'https://search.example', httpProxy: '', httpsProxy: '',
        overrides: {}, sources: { url: 'environment', httpProxy: 'none', httpsProxy: 'none' }
      }
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
        bugsByAction: [], bugsByComponent: [], newProductBugs: [{
          id: 'ux-finding-1', root_cause_id: 'invocation-1/jira-RHOAIENG-99762',
          run_id: 'invocation-1', workflow: 'ux-workflow', category: 'UX_DEFECT',
          action: 'FILED', opened: true, bug_key: 'RHOAIENG-99762',
          jira_url: 'https://redhat.atlassian.net/browse/RHOAIENG-99762',
          error_summary: 'API key form hides subscription model scope'
        }], knownProductBugs: [],
        tests: [
          { execution_id: 'opaque-id', invocation_id: 'invocation-1', workflow: 'live-workflow', workflow_label: 'Live workflow', verdict: 'PASS', tasks_passed: 1, tasks_total: 1, productBugs: [] },
          { execution_id: 'ux-id', invocation_id: 'invocation-1', workflow: 'ux-workflow', workflow_label: 'UX workflow', verdict: 'FAIL', tasks_passed: 0, tasks_failed: 1, tasks_total: 1, productBugs: [{
            id: 'ux-finding-1', run_id: 'invocation-1', workflow: 'ux-workflow', category: 'UX_DEFECT',
            action: 'FILED', opened: true, bug_key: 'RHOAIENG-99762',
            jira_url: 'https://redhat.atlassian.net/browse/RHOAIENG-99762'
          }] }
        ]
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
            id: 'finding-1', category: 'SPEC_DEFECT', action: 'NONE',
            error_summary: 'Harness cleanup failed', severity: 'minor', reproducibility: 'always',
            reasoning: 'The failure occurred during automated cleanup.', workaround: 'Retry cleanup manually.',
            suggested_remediation: 'Refresh the resource before updating it.'
          }, {
            id: 'finding-2', category: 'AUTOMATION_BUG', action: 'NONE',
            error_summary: 'Hidden automation finding'
          }, {
            id: 'finding-3', category: 'MISSING_PRECONDITION', action: 'NONE',
            error_summary: 'Hidden precondition finding'
          }]
        }
      }
      if (path.endsWith('/runs/ux-id')) {
        body = {
          run: { execution_id: 'ux-id', invocation_id: 'invocation-1', workflow: 'ux-workflow', workflow_label: 'UX workflow', verdict: 'FAIL', tasks_failed: 1 },
          tasks: [{ task_execution_id: 'ux-id/000', execution_id: 'ux-id', task: 'Validate API key form', status: 'FAIL', passed: false }],
          bugs: [{
            id: 'ux-finding-1', root_cause_id: 'invocation-1/jira-RHOAIENG-99762',
            run_id: 'invocation-1', workflow: 'ux-workflow', category: 'UX_DEFECT',
            action: 'FILED', opened: true, bug_key: 'RHOAIENG-99762',
            jira_url: 'https://redhat.atlassian.net/browse/RHOAIENG-99762',
            error_summary: 'API key form hides subscription model scope'
          }]
        }
      }
      if (path.endsWith('/workflow-history')) {
        body = { workflow: 'live-workflow', workflowLabel: 'Live workflow', summary: { runs: 1, passed: 1, failed: 0, passRate: 1, latestVerdict: 'PASS' }, runs: [{ id: 'different-opensearch-id', execution_id: 'opaque-id', run_id: 'run-1', workflow: 'live-workflow', workflow_label: 'Live workflow', rhoai_version: '3.6', verdict: 'PASS', timestamp: '2026-09-15T10:00:00Z', tasks_passed: 1, tasks_total: 1 }], bugs: [] }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
  })

  test('defaults Trends to Release Gate despite a newer Ad Hoc run and allows changing suites', async ({ page }) => {
    await mockTrendSuites(page)
    await page.goto('/#/workflow-validation/workflows?datePreset=all')

    const suiteSelect = page.getByRole('combobox', { name: 'Test Suite' })
    await expect(suiteSelect).toHaveValue('release-gate')
    await expect(page).toHaveURL(/testRun=release-gate/)
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible()
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1)

    await suiteSelect.selectOption('ad-hoc')
    await expect(suiteSelect).toHaveValue('ad-hoc')
    await expect(page).toHaveURL(/testRun=ad-hoc/)
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1)
  })

  for (const parameter of ['testRun', 'suite']) {
    test(`preserves an explicit Trends suite in the ${parameter} URL parameter`, async ({ page }) => {
      await mockTrendSuites(page)
      await page.goto(`/#/workflow-validation/workflows?datePreset=all&${parameter}=ad-hoc`)

      await expect(page.getByRole('combobox', { name: 'Test Suite' })).toHaveValue('ad-hoc')
      await expect(page).toHaveURL(/testRun=ad-hoc/)
      await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible()
      await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1)
    })
  }

  test('loads the real backend router in the production image', async ({ request }) => {
    const response = await request.get('/api/modules/workflow-validation/status')

    // OpenSearch is intentionally not configured in the integration image, so
    // the module may report that its dependency is unavailable. A 404 means
    // the module loader failed before it could mount the router.
    expect([200, 502, 503]).toContain(response.status())
  })

  test('loads live-schema execution data through the Org Pulse backend', async ({ page }) => {
    const requests = []
    page.on('request', (request) => {
      if (request.url().includes('/api/modules/workflow-validation/')) requests.push(request.url())
    })

    await page.goto('/#/workflow-validation/overview')
    await expect(page.getByRole('main').getByRole('heading', { name: 'Workflow Validation' })).toBeVisible()
    await expect(page.getByText('Live workflow')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'New Jira Issues Opened' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Existing Jira Issues Encountered' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Test Results', exact: true })).toBeVisible()
    const resultsTable = page.getByRole('table')
    await expect(resultsTable.getByRole('columnheader', { name: /Task results/i })).toHaveCount(0)
    await expect(resultsTable.getByRole('columnheader', { name: 'Jira issue', exact: true })).toBeVisible()
    await expect(resultsTable.getByRole('columnheader')).toHaveCount(5)
    await expect(resultsTable.locator('tbody tr').first().getByRole('cell')).toHaveCount(5)
    expect(requests.some((url) => url.includes('/overview'))).toBe(true)
    expect(requests.every((url) => !url.includes('opensearch-workflow-validation'))).toBe(true)
  })

  test('links an invocation-scoped UX defect from the dashboard to its test execution', async ({ page }) => {
    const requests = []
    page.on('request', (request) => {
      if (request.url().includes('/api/modules/workflow-validation/')) requests.push(request.url())
    })

    await page.goto('/#/workflow-validation/overview?version=3.6&testSuite=productization&invocationId=invocation-1')

    await expect(page.getByText('New UX defect opened.', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: 'RHOAIENG-99762' }).first()).toHaveAttribute(
      'href', 'https://redhat.atlassian.net/browse/RHOAIENG-99762'
    )
    await expect(page.getByText('UX workflow', { exact: true })).toBeVisible()
    await page.getByText('UX workflow', { exact: true }).click()

    await expect(page).toHaveURL(/run-detail\?runKey=ux-id/)
    await expect(page.getByRole('heading', { name: 'UX workflow' })).toBeVisible()
    await expect(page.getByText('API key form hides subscription model scope')).toBeVisible()
    expect(requests.some((url) => url.includes('/charts?') && url.includes('invocationId=invocation-1'))).toBe(true)
    expect(requests.some((url) => url.endsWith('/runs/ux-id'))).toBe(true)
  })

  test('does not expose Workflow Validation connection settings to non-admins', async ({ page }) => {
    await page.goto('/#/settings?tab=workflow-validation')
    await expect(page.getByRole('heading', { name: 'Workflow Validation connection' })).toHaveCount(0)
    await expect(page.getByLabel('OpenSearch URL')).toHaveCount(0)
  })

  test('shows compact no-bug indicators with accessible explanations and preserves Jira links', async ({ page }) => {
    const bugs = [
      ['PRODUCT_BUG', 'FILED'], ['PRODUCT_BUG', 'EXISTING'],
      ['UX_DEFECT', 'FILED'], ['UX_DEFECT', 'EXISTING'],
    ].map(([category, action], index) => ({
      id: `bug-${index}`, category, action,
      bug_key: `RHOAIENG-${123 + index}`,
      jira_url: `https://redhat.atlassian.net/browse/RHOAIENG-${123 + index}`,
    }))
    await page.route('**/api/modules/workflow-validation/charts?**', (route) => route.fulfill({
      json: {
        overTime: [], byVersion: [], byWorkflow: [], bugsByCategory: [], bugsByAction: [],
        newProductBugs: [], knownProductBugs: [],
        tests: [
          { id: 'pass', workflow_label: 'Passing test without a bug', verdict: 'PASS', productBugs: [] },
          { id: 'environment', workflow_label: 'Environmental failure', verdict: 'ERROR', productBugs: [] },
          { id: 'new-bug', workflow_label: 'Test with a new bug', verdict: 'FAIL', productBugs: [bugs[0]] },
          { id: 'known-bug', workflow_label: 'Test with a known bug', verdict: 'FAIL', productBugs: [bugs[1]] },
          { id: 'new-ux', workflow_label: 'Test with a new UX defect', verdict: 'FAIL', productBugs: [bugs[2]] },
          { id: 'known-ux', workflow_label: 'Test with a known UX defect', verdict: 'FAIL', productBugs: [bugs[3]] },
        ],
      },
    }))
    await page.goto('/#/workflow-validation/overview')

    const passed = page.getByRole('row').filter({ hasText: 'Passing test without a bug' })
    const environment = page.getByRole('row').filter({ hasText: 'Environmental failure' })
    const passedIndicator = passed.getByRole('img', { name: 'No Jira-linked issue recorded.' })
    const environmentIndicator = environment.getByRole('img', { name: 'No Jira-linked issue recorded.' })
    await expect(passedIndicator).toHaveText('—')
    await expect(passedIndicator).toHaveAttribute('title', 'No Jira-linked issue recorded.')
    await expect(environmentIndicator).toHaveText('—')
    await expect(environmentIndicator).toHaveAccessibleDescription('The test failed or was terminated without a Jira-linked issue recorded.')
    await passedIndicator.focus()
    await page.keyboard.press('Tab')
    await expect(environmentIndicator).toBeFocused()
    await expect(page.getByRole('main')).not.toContainText('No product or UX issues observed in the filtered executions.')
    await expect(page.getByRole('main')).not.toContainText('Environmental failure detected. No product or UX issue detected.')
    await expect(page.getByText('New UX defect opened.', { exact: false })).toBeVisible()
    await expect(page.getByText('Pre-existing UX defect detected.', { exact: false })).toBeVisible()

    for (const bug of bugs) {
      await expect(page.getByRole('link', { name: bug.bug_key, exact: true })).toHaveAttribute('href', bug.jira_url)
    }
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

    await page.goto('/#/workflow-validation/compare?testRun=productization&baselineInvocation=invocation-0&targetInvocation=invocation-1&test=')
    await expect(page.getByLabel('Test Suite', { exact: true })).toHaveValue('productization')
    await expect(page.getByLabel('Baseline Test Run')).toHaveValue('invocation-0')
    await expect(page.getByLabel('Target Test Run')).toHaveValue('invocation-1')

    await page.goto('/#/workflow-validation/activity?version=3.6&testSuite=productization&invocationId=invocation-1&workflow=live-workflow&q=timeout&dateFrom=&dateTo=')
    await expect(page.getByRole('combobox', { name: 'Test Suite', exact: true })).toHaveValue('productization')
    await expect(page.getByRole('combobox', { name: 'Test Run' })).toHaveValue('invocation-1')
    await expect(page.getByRole('combobox', { name: 'Test', exact: true })).toHaveValue('live-workflow')
    await expect(page.getByRole('option', { name: 'Other workflow' })).toHaveCount(0)
    await expect(page.getByLabel('Search Jira keys, tests, components, or issue details…')).toHaveValue('timeout')

    await page.goto('/#/workflow-validation/workflows?testRun=productization&version=3.6&datePreset=all&dateFrom=&dateTo=')
    await expect(page.getByRole('combobox', { name: 'Test Suite' })).toHaveValue('productization')
    await expect(page.getByRole('combobox', { name: 'RHOAI version' })).toHaveValue('3.6')
    await expect(page.getByRole('combobox', { name: 'Date range' })).toHaveValue('all')
  })

  test('switches Jira between suite, release, date, and all-issue scopes', async ({ page }) => {
    const bugRequests = []
    const workflowRequests = []
    page.on('request', (request) => {
      if (request.url().includes('/api/modules/workflow-validation/bugs')) bugRequests.push(request.url())
      if (request.url().includes('/api/modules/workflow-validation/workflows')) workflowRequests.push(request.url())
    })

    await page.goto('/#/workflow-validation/activity')
    await expect(page.getByLabel('View By')).toHaveValue('suite')
    await expect(page.getByRole('option', { name: 'All Issues' })).toHaveCount(1)
    await expect(page.getByLabel('Test Suite')).toBeVisible()
    await expect(page.getByLabel('Show Issues From')).toHaveValue('run')
    await expect(page.getByLabel('Test Run')).toBeVisible()

    await page.getByLabel('Show Issues From').selectOption('date')
    await expect(page.getByLabel('Test Run')).toHaveCount(0)
    await expect(page.getByLabel('Date Range')).toHaveValue('90')
    await expect(page.getByLabel('Start Date')).toBeVisible()
    await expect(page.getByLabel('End Date')).toBeVisible()
    await expect.poll(() => {
      const url = new URL(bugRequests.at(-1))
      return url.searchParams.get('testSuite') === 'productization' &&
        !url.searchParams.has('invocationId') &&
        Boolean(url.searchParams.get('dateFrom')) &&
        Boolean(url.searchParams.get('dateTo'))
    }).toBe(true)
    await expect.poll(() => {
      const url = new URL(workflowRequests.at(-1))
      return url.searchParams.get('testSuite') === 'productization' &&
        Boolean(url.searchParams.get('dateFrom')) &&
        Boolean(url.searchParams.get('dateTo'))
    }).toBe(true)

    await page.getByLabel('View By').selectOption('release')
    await expect(page.getByLabel('RHOAI Version')).toHaveValue('3.6')
    await expect.poll(() => bugRequests.at(-1)).toContain('version=3.6')

    await page.getByLabel('View By').selectOption('date')
    await expect(page.getByLabel('Date Range')).toHaveValue('90')
    await expect(page.getByLabel('Start Date')).toBeVisible()
    await expect.poll(() => bugRequests.at(-1)).toContain('dateFrom=')

    await page.getByLabel('View By').selectOption('all')
    await expect(page.getByLabel('Test Suite')).toHaveCount(0)
    await expect.poll(() => {
      const url = new URL(bugRequests.at(-1))
      return ['version', 'testSuite', 'invocationId', 'dateFrom', 'dateTo', 'category'].every((key) => !url.searchParams.has(key))
    }).toBe(true)
  })

  test('shows Jira-linked RFEs and future issue categories', async ({ page }) => {
    await page.route('**/api/modules/workflow-validation/bugs?**', (route) => route.fulfill({ json: {
      total: 2, size: 50, nextCursor: null,
      kpis: { total: 2, opened: 1, distinctJira: 2 },
      byCategory: [{ category: 'FEATURE_REQUEST', count: 1 }, { category: 'FUTURE_CATEGORY', count: 1 }],
      byAction: [{ action: 'FILED', count: 1 }, { action: 'EXISTING', count: 1 }],
      bugs: [
        { id: 'rfe', category: 'FEATURE_REQUEST', action: 'FILED', opened: true, bug_key: 'RHAIRFE-123', error_summary: 'Requested workflow enhancement' },
        { id: 'future', category: 'FUTURE_CATEGORY', action: 'EXISTING', opened: false, bug_key: 'RHOAIENG-234', error_summary: 'Future issue category' }
      ]
    } }))
    await page.goto('/#/workflow-validation/activity')

    await expect(page.getByText('RHAIRFE-123')).toBeVisible()
    await expect(page.getByText('RHOAIENG-234')).toBeVisible()
    await expect(page.getByText('Category: FEATURE REQUEST')).toBeVisible()
    await expect(page.getByText('Category: FUTURE CATEGORY')).toBeVisible()
    await expect(page.getByText('New Jira issue opened')).toBeVisible()
    await expect(page.getByText('Existing Jira issue encountered')).toBeVisible()
  })

  test('shows distinct Jira issues by default and switches to all occurrences', async ({ page }) => {
    const requests = []
    await page.route('**/api/modules/workflow-validation/bugs?**', (route) => {
      const distinct = new URL(route.request().url()).searchParams.get('distinct') === 'true'
      requests.push(distinct)
      const issue = (id, key) => ({ id, bug_key: key, category: 'PRODUCT_BUG',
        action: 'EXISTING', error_summary: `Occurrence ${id}` })
      return route.fulfill({ json: {
        total: distinct ? 2 : 3, size: 50, nextCursor: null,
        kpis: { total: 3, opened: 0, distinctJira: 2 }, byCategory: [], byAction: [],
        bugs: distinct
          ? [{ ...issue('latest', 'RHOAIENG-1'), occurrenceCount: 2 }, issue('other', 'RHOAIENG-2')]
          : [issue('latest', 'RHOAIENG-1'), issue('older', 'RHOAIENG-1'), issue('other', 'RHOAIENG-2')]
      } })
    })
    await page.goto('/#/workflow-validation/activity')
    const toggle = page.getByRole('checkbox', { name: 'Show distinct issues only' })
    await expect(toggle).toBeChecked()
    await expect(page.getByRole('heading', { name: 'Jira Issues', exact: true })).toBeVisible()
    await expect(page.getByText('2 occurrences')).toBeVisible()
    await expect(page.getByText('Occurrence older')).toHaveCount(0)
    expect(requests.at(-1)).toBe(true)

    await toggle.uncheck()
    await expect(page).toHaveURL(/distinct=false/)
    await expect(page.getByRole('heading', { name: 'Jira Issue Occurrences' })).toBeVisible()
    await expect(page.getByText('Occurrence older')).toBeVisible()
    expect(requests.at(-1)).toBe(false)

    await page.reload()
    await expect(toggle).not.toBeChecked()
    await expect(page.getByText('Occurrence older')).toBeVisible()
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
    await expect(page.getByRole('heading', { name: 'Jira Issue Occurrences Over Time' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Jira Issue Frequency by RHOAI Version' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Issues opened' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Existing issues' })).toBeVisible()

    await page.goto('/#/workflow-validation/runs')
    await expect(page.getByRole('option', { name: 'Error', exact: true })).toHaveCount(1)
    await expect(page.getByRole('option', { name: 'Failed or error' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'When ↓' })).toBeVisible()
    await page.getByRole('button', { name: 'Test', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Test ↓' })).toBeVisible()

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
    await expect(page.getByText('Hidden automation finding')).toHaveCount(0)
    await expect(page.getByText('Hidden precondition finding')).toHaveCount(0)

    await page.goto('/#/workflow-validation/workflow-history?workflow=live-workflow')
    await expect(page.getByRole('heading', { name: 'Live workflow' })).toBeVisible()
    await expect(page.getByRole('main').getByRole('button', { name: 'Test Trends' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Execution History' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Compare this test across runs' })).toBeVisible()
    await page.getByRole('row', { name: /PASS.*3\.6/ }).click()
    await expect(page).toHaveURL(/runKey=opaque-id/)
    await expect(page.getByRole('heading', { name: 'Live workflow' })).toBeVisible()

  })
})
