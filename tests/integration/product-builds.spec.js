const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, mainContentIsVisible } = require('./helpers');
const dashboardChannels = require('../../fixtures/product-builds/channels-api.json');

/**
 * Integration tests for Product Builds module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - CHI column appears in artifacts table
 * - CHI badge renders in artifact detail view
 * - Artifacts without health_index don't show CHI
 * - Tests column appears in artifacts table
 *
 * Tag: @product-builds
 * Usage: npx playwright test --grep @product-builds
 */

test.describe('Product Builds Module @product-builds', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should be visible in sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const moduleNav = page.locator('aside nav').filter({ hasText: 'Product Bu' });
    const count = await moduleNav.count();
    expect(count).toBeGreaterThan(0);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should expose the Request Package navigation item and form', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME)

    await page.locator('aside').getByRole('button', { name: 'Product Builds', exact: true }).click()
    const requestLink = page.locator('aside').getByText('Request Package', { exact: true })
    await expect(requestLink).toBeVisible()
    await requestLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME)

    expect(page.url()).toMatch(/product-builds\/package-request/)
    await expect(page.getByRole('heading', { name: 'Request Package' })).toBeVisible()
    const team = page.getByRole('combobox', { name: 'Team', exact: true })
    await expect(team).toBeVisible()
    await expect(team).toBeEnabled()
    for (const project of ['RHAI', 'RHAISTRAT']) {
      const responsePromise = page.waitForResponse(response => response.url().includes(`/package-requests/teams?project=${project}`))
      await page.locator('#req-team-project').selectOption(project)
      const response = await responsePromise
      expect(response.ok()).toBe(true)
      const options = await response.json()
      expect(options.length).toBeGreaterThan(0)
      for (const option of options) {
        expect(option).toEqual({ value: expect.any(String), label: expect.any(String) })
      }
      await team.selectOption(options[0].value)
      await expect(team).toHaveValue(options[0].value)
    }
    await expect(page.locator('#req-package-name')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit request' })).toBeVisible()

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message))
    expect(appErrors).toHaveLength(0)
  })

  test('should retry a failed package request with the selected team', async ({ page }) => {
    // Only the submission response is simulated; the form and team endpoint are real.
    const submissions = []
    await page.route('**/api/modules/product-builds/package-requests', async route => {
      submissions.push(route.request().postDataJSON())
      if (submissions.length === 1) {
        await route.fulfill({ status: 502, json: { error: 'Failed to create Jira Epic' } })
      } else {
        await route.fulfill({ status: 201, json: {
          status: 'created', jira: { key: 'AIPCC-999', url: 'https://redhat.atlassian.net/browse/AIPCC-999' },
          pipeline: { triggered: true, web_url: 'https://gitlab.com/example/-/pipelines/777' }
        } })
      }
    })
    await page.goto('/#/product-builds/package-request')
    await page.locator('#req-team-project').selectOption('RHAI')
    const team = page.locator('#req-team')
    await expect(team).toBeEnabled()
    const option = await team.locator('option:not([disabled])').first().getAttribute('value')
    await team.selectOption(option)
    await page.locator('#req-package-name').fill('vllm')
    await page.locator('#req-jira-id').fill('RHAI-892')
    await page.locator('#req-justification').fill('Package required for the release')
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + 30)
    await page.locator('#req-delivery-timeline').fill(date.toISOString().slice(0, 10))
    await page.locator('#req-hardware-ack').check()
    await page.locator('#req-testing-ack').check()
    await page.getByRole('button', { name: 'Submit request', exact: true }).click()
    await expect(page.getByText(/Failed to create Jira Epic/)).toBeVisible()
    await expect(team).toHaveValue(option)
    await page.getByRole('button', { name: 'Submit request', exact: true }).click()
    await expect(page.getByText('Package request submitted')).toBeVisible()
    await expect(page.getByRole('link', { name: 'View pipeline' })).toBeVisible()
    expect(submissions).toHaveLength(2)
    expect(submissions[0].team).toBe(option)
    expect(submissions[0].project).toBe('RHAI')
    expect(submissions[1]).toEqual(submissions[0])
  })

  test('should navigate to RHAIIS view', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/rhaiis/);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Package Analysis tracking AIPCC and RHAI Epics', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/package-analysis/);
    await expect(page.getByRole('heading', { name: 'Package Analysis' })).toBeVisible();
    await expect(page.getByText('Package epic analysis and tracking for AIPCC and RHAI', { exact: false })).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to release status view', async ({ page }) => {
    await page.goto('/#/product-builds/release-status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/release-status/);
    await expect(page.getByRole('heading', { name: 'Release status' })).toBeVisible();
    const triggerRelease = page.getByRole('button', { name: 'Trigger release', exact: true });
    await expect(triggerRelease).toBeEnabled();
    await triggerRelease.click();
    const triggerForm = page.locator('[data-release-form="trigger-release"]');
    await expect(triggerForm).toBeVisible();
    await expect(triggerForm.getByText('Readiness card', { exact: false })).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should filter the release list and show MR and PipelineRun links', async ({ page }) => {
    const run = {
      namespace: 'aipcc-claudio--runtime-int',
      name: 'create-release-mr-run-abc',
      url: 'https://console-openshift-console.apps.prod-stable-spoke1-dc-iad2.itup.redhat.com/k8s/ns/aipcc-claudio--runtime-int/tekton.dev~v1~PipelineRun/create-release-mr-run-abc',
      logs_url: 'https://rhcorporate.sumologic.com/log-search/create?query=itup',
      triggered_at: '2026-10-12T10:00:00Z',
    };
    const mr = {
      iid: 796, state: 'merged',
      web_url: 'https://gitlab.com/redhat/rhel-ai/ci-cd/aipcc-product-management-configs/-/merge_requests/796',
    };
    const epic = (key, summary, labels, children = []) => ({
      key, summary,
      status: { name: 'In Progress', category: 'indeterminate' },
      labels, updated: '2026-10-15T10:00:00Z',
      details: { version: '3.6.0-ea.2', target: 'prod' },
      children,
    });
    await page.route('**/api/modules/product-builds/release-status', route => route.fulfill({ json: {
      total: 2,
      groups: [
        { key: 'rhaiis', label: 'RHAII', epics: [epic('RHAI-2450', 'Release rhaiis 3.6.0-ea.2 (prod)', ['release-automation'], [
          {
            key: 'RHAI-2452', summary: 'Send a release announcement email',
            status: { name: 'To Do', category: 'new' },
            labels: [], updated: '2026-10-15T10:00:00Z',
          },
          {
            key: 'RHAI-2453', summary: 'Release rhaiis 3.6.0-ea.2 (prod)',
            status: { name: 'Triggered', category: 'indeterminate' },
            labels: ['triggered'], updated: '2026-10-15T10:00:00Z',
          },
        ])] },
        { key: 'rhel-ai', label: 'RHEL AI', epics: [epic('RHAI-2460', 'Release rhelai 3.5.2 GA', ['release-automation'])] },
      ],
    } }))
    await page.route('**/api/modules/product-builds/release-status/links', route => route.fulfill({ json: { links: {
      'RHAI-2450': { merge_requests: [mr], pipeline_runs: [run] },
      'RHAI-2452': { merge_requests: [], pipeline_run: null },
      'RHAI-2453': { merge_requests: [mr], pipeline_run: run },
    } } }))

    await page.goto('/#/product-builds/release-status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('[data-tree-root="RHAI-2450"]')).toBeVisible();
    await expect(page.locator('[data-tree-root="RHAI-2460"]')).toBeVisible();
    await expect(page.locator('[data-tree-child="RHAI-2453"] [data-mr-link="796"]')).toHaveAttribute(
      'href', 'https://gitlab.com/redhat/rhel-ai/ci-cd/aipcc-product-management-configs/-/merge_requests/796');
    await expect(page.locator('[data-tree-child="RHAI-2453"] [data-pipelinerun-link="create-release-mr-run-abc"]')).toHaveAttribute('href', run.url);
    await expect(page.locator('[data-tree-child="RHAI-2453"] [data-logs-link="create-release-mr-run-abc"]')).toHaveAttribute('href', run.logs_url);

    const renderedCards = page.locator('[data-tree-branch] [data-tree-child]');
    await expect(await renderedCards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-tree-child'))))
      .toEqual(['RHAI-2453', 'RHAI-2452']);
    await expect(page.locator('[data-tree-child="RHAI-2453"]')).toHaveAttribute('data-release-card', 'true');
    await expect(page.locator('[data-tree-child="RHAI-2452"]')).toHaveAttribute('data-release-card', 'false');

    await page.locator('[data-filter-product="rhel-ai"]').click();
    await expect(page.locator('[data-tree-root="RHAI-2450"]')).toBeHidden();
    await expect(page.locator('[data-tree-root="RHAI-2460"]')).toBeVisible();

    await page.locator('[data-filter-product="rhaiis"]').click();
    await expect(page.locator('[data-tree-root="RHAI-2450"]')).toBeVisible();
    await expect(page.locator('[data-tree-root="RHAI-2460"]')).toBeVisible();

    await page.locator('[data-filter-product="rhaiis"]').click();
    await page.locator('[data-filter-status="released"]').click();
    await expect(page.getByText('No releases match the current filters.')).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should submit config-family-qualified release readiness components', async ({ page }) => {
    const submissions = []
    await page.route('**/api/modules/product-builds/release-status', route => route.fulfill({ json: { total: 0, groups: [] } }))
    await page.route('**/api/modules/product-builds/release-trigger/options', route => route.fulfill({ json: {
      sha: 'a'.repeat(40),
      cards: [{
        key: 'RHAI-925', summary: 'RHEL AI 3.4.5 production readiness', state: 'planned', target: 'prod',
        input_type: 'git-tag', input_value: '3.4.5', pipeline_components: 'all',
        parent: { key: 'RHAI-924', application: 'rhelai', product: 'rhelai', version: '3.4.5', branch: '3.4', release_type: 'GA', advisory_type: 'RHEA' },
      }],
    } }))
    await page.route('**/api/modules/product-builds/release-trigger', async route => {
      submissions.push(route.request().postDataJSON())
      await route.fulfill({ json: { tasks: [
        { key: 'RHAI-925', operation: 'updated', state: 'planned' },
        { key: 'RHAI-926', operation: 'created', state: 'ready' },
        { key: 'RHAI-927', operation: 'created', state: 'skip' },
      ] } })
    })

    await page.goto('/#/product-builds/release-status')
    await page.getByRole('button', { name: 'Trigger release', exact: true }).click()
    const form = page.locator('[data-release-form="trigger-release"]')
    await form.getByText('Component list examples').click()
    await expect(form.getByText('bootc-gaudi:containers', { exact: false }).first()).toBeVisible()
    await form.getByPlaceholder('all or cuda, rocm, model-opt').fill('bootc-gaudi:containers')
    await form.locator('textarea[placeholder="cuda, rocm, model-opt"]').fill('bootc-gaudi-iso-disk-image:disk-images,bootc-gaudi-qcow2-disk-image:disk-images')
    await form.getByRole('button', { name: 'Apply release readiness' }).click()
    await expect(form.getByText('Updated release readiness:')).toBeVisible()

    expect(submissions).toHaveLength(1)
    expect(submissions[0].components).toBe('bootc-gaudi:containers')
    expect(submissions[0].skipped_components).toBe('bootc-gaudi-iso-disk-image:disk-images,bootc-gaudi-qcow2-disk-image:disk-images')
    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message))
    expect(appErrors).toHaveLength(0)
  })

  test('should explain image-list pullspec mapping formats', async ({ page }) => {
    await page.route('**/api/modules/product-builds/release-status', route => route.fulfill({ json: { total: 0, groups: [] } }))
    await page.route('**/api/modules/product-builds/release-trigger/options', route => route.fulfill({ json: {
      sha: 'c'.repeat(40),
      cards: [{
        key: 'RHAI-1912', summary: 'Release rhaiis 3.6.0-fast.2 (stage-rc)', state: 'planned', target: 'stage-rc',
        input_type: 'image-list', input_value: '', pipeline_components: 'all',
        parent: { key: 'RHAI-1910', application: 'rhaiis-3-6-fast2', product: 'rhaiis', version: '3.6.0-fast.2', branch: '3.6-fast2', release_type: 'EA', advisory_type: 'RHEA' },
      }],
    } }))

    await page.goto('/#/product-builds/release-status')
    await page.getByRole('button', { name: 'Trigger release', exact: true }).click()
    const form = page.locator('[data-release-form="trigger-release"]')
    await form.getByText('How to fill the input value').click()
    await expect(form.getByPlaceholder('pullspecs or component=pullspec, one per line')).toBeVisible()
    await expect(form.getByText('Raw pullspecs', { exact: false })).toBeVisible()
    await expect(form.getByText('Explicit component mappings', { exact: false })).toBeVisible()
    await expect(form.getByText('bootc-gaudi:containers=<pullspec>', { exact: false })).toBeVisible()
    await expect(form.getByText('rocm=quay.io/aipcc/rhaiis/rocm-ubi9:3.6.0-fast.2-1790234469', { exact: false })).toBeVisible()
    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message))
    expect(appErrors).toHaveLength(0)
  })

  test('should show actionable errors for checklist cards that failed to create', async ({ page }) => {
    const result = {
      epic: { key: 'RHAI-4333', summary: 'Release rhelai 3.4.5 GA' },
      cards: [{ key: 'RHAI-4334', summary: 'Production release checklist' }],
      not_created: [],
      failures: [{ summary: 'Release rhelai 3.4.5 (stage-rc): bootc-gaudi', error: 'Jira rejected the stage-rc card: required field is missing' }],
      warnings: ['Some checklist cards failed to create; see failures.'],
      created_keys: ['RHAI-4333', 'RHAI-4334'],
    }
    await page.route('**/api/modules/product-builds/release-status', route => route.fulfill({ json: { total: 0, groups: [] } }))
    await page.route('**/api/modules/product-builds/release-epic/options**', route => route.fulfill({ json: {
      sha: 'b'.repeat(40),
      products: [{ key: 'rhelai', branches: [{ branch: '3.4', configured_versions: ['3.4.5'] }] }],
    } }))
    await page.route('**/api/modules/product-builds/release-epic', route => route.fulfill({ status: 201, json: result }))

    await page.goto('/#/product-builds/release-status')
    await page.getByRole('button', { name: 'Create release epic', exact: true }).click()
    const form = page.locator('[data-release-form="create-epic"]')
    await form.locator('select[name="product"]').selectOption('rhelai')
    await form.locator('select[name="branch"]').selectOption('3.4')
    await form.locator('select[name="version"]').selectOption('3.4.5')
    await form.locator('select[name="feature-mode"]').selectOption('none')
    await form.getByRole('button', { name: 'Create release epic', exact: true }).click()

    await expect(form.getByText('Jira rejected the stage-rc card: required field is missing')).toBeVisible()
    await expect(form.getByText('[release-epic] Checklist card creation failed', { exact: false })).toBeVisible()
    await expect(form.getByRole('link', { name: 'RHAI-4333' })).toBeVisible()
    await expect(form.getByText('at createReleaseEpic')).toHaveCount(0)
    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message))
    expect(appErrors).toHaveLength(0)
  })

  test('should offer and submit the template-derived version for a timestamp-only branch', async ({ page }) => {
    const submissions = []
    await page.route('**/api/modules/product-builds/release-status', route => route.fulfill({ json: { total: 0, groups: [] } }))
    await page.route('**/api/modules/product-builds/release-epic/options**', route => route.fulfill({ json: {
      sha: 'e'.repeat(40),
      products: [{ key: 'rhaiis', branches: [{ branch: '3.2.2', tags: ['3.2.2-{{ timestamp }}'], configured_versions: ['3.2.2'] }] }],
    } }))
    await page.route('**/api/modules/product-builds/release-epic', async route => {
      submissions.push(route.request().postDataJSON())
      await route.fulfill({ status: 201, json: {
        epic: { key: 'RHAI-4057', summary: 'Release rhaiis 3.2.2 GA' },
        cards: [{ key: 'RHAI-4058', summary: 'Release rhaiis 3.2.2 (prod): cuda' }],
        not_created: [], failures: [], warnings: [], created_keys: ['RHAI-4057', 'RHAI-4058'],
      } })
    })

    await page.goto('/#/product-builds/release-status')
    await page.getByRole('button', { name: 'Create release epic', exact: true }).click()
    const form = page.locator('[data-release-form="create-epic"]')
    await form.locator('select[name="product"]').selectOption('rhaiis')
    await form.locator('select[name="branch"]').selectOption('3.2.2')
    await expect(form.locator('select[name="version"] option[value="3.2.2"]')).toHaveCount(1)
    await form.locator('select[name="version"]').selectOption('3.2.2')
    await form.locator('select[name="feature-mode"]').selectOption('none')
    await form.getByRole('button', { name: 'Create release epic', exact: true }).click()

    expect(submissions).toHaveLength(1)
    expect(submissions[0].version).toBe('3.2.2')
    expect(submissions[0].branch).toBe('3.2.2')
    await expect(form.getByRole('link', { name: 'RHAI-4057' })).toBeVisible()
    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message))
    expect(appErrors).toHaveLength(0)
  })

  test('should show CHI column header in artifacts tab', async ({ page }) => {
    await page.route('**/api/modules/product-builds/products/rhaiis', route => route.fulfill({ json: {
      key: 'rhaiis', product_name: 'Red Hat AI Inference Server', short_name: 'RHAIIS',
    } }));
    await page.route('**/api/modules/product-builds/artifacts?*', route => route.fulfill({ json: [{
      key: 'quay.io/example/rhaiis:test', variant: 'cuda', archs: ['x86_64'], environments: ['stage'],
      health_index: { grade: 'A', vulnerability_count: 0 }, konflux_data: { tests: [] },
    }] }));
    await page.goto('/#/product-builds/rhaiis');
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'CHI', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Tests', exact: true })).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Health Index in artifact detail when data exists', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const artifactsTab = page.locator('button').filter({ hasText: 'Artifacts' });
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      const firstArtifact = page.locator('tbody tr').first();
      if (await firstArtifact.isVisible()) {
        await firstArtifact.click();
        await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

        const healthLabel = page.locator('dt').filter({ hasText: 'Health Index' });
        const hasHealth = await healthLabel.count();
        if (hasHealth > 0) {
          await expect(healthLabel).toBeVisible();
          const gradeBadge = page.locator('.font-bold').first();
          const gradeText = await gradeBadge.textContent();
          if (gradeText && gradeText.trim() !== 'Unknown') {
            const vulnerabilities = page.locator('text=vulnerabilities');
            await expect(vulnerabilities).toBeVisible();
          }
        }
      }
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to Search view and show empty state', async ({ page }) => {
    await page.goto('/#/product-builds/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/search/);

    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput).toBeVisible();
    await expect(page.locator('text=Enter a search query')).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should run a search and update the URL query param', async ({ page }) => {
    await page.goto('/#/product-builds/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill('rhaiis');
    await searchInput.press('Enter');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/[?&]q=rhaiis/);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should return channel data from the API', async ({ request }) => {
    const list = await request.get('/api/modules/product-builds/channels');
    expect(list.ok()).toBe(true);
    const { channels } = await list.json();
    expect(channels.length).toBeGreaterThan(0);
    expect(channels.some(c => c.maturity === 'stable')).toBe(true);
    expect(channels.some(c => c.maturity === 'rolling')).toBe(true);

    const detail = await request.get(`/api/modules/product-builds/channels/${encodeURIComponent(channels[0].name)}`);
    expect(detail.ok()).toBe(true);
    const { channel } = await detail.json();
    expect(channel.name).toBe(channels[0].name);
    expect(Array.isArray(channel.drops)).toBe(true);
    expect(Array.isArray(channel.wheels)).toBe(true);

    const missing = await request.get('/api/modules/product-builds/channels/does-not-exist');
    expect(missing.status()).toBe(404);
  });

  test('should show the Channels view with matrix and table', async ({ page }) => {
    await page.goto('/#/product-builds/channels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const nav = page.locator('aside nav').getByText('Channels', { exact: true });
    await expect(nav).toBeVisible();

    await expect(page.locator('h1').filter({ hasText: 'Channels' })).toBeVisible();
    await expect(page.locator('[data-testid="channel-matrix"]')).toBeVisible();
    await expect(page.locator('[data-testid="channel-row"]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Rolling', exact: true }).click();
    const rows = page.locator('[data-testid="channel-row"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < rowCount; i++) {
      await expect(rows.nth(i)).toContainText('Rolling');
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should order Torch columns numerically from oldest to newest with No torch last', async ({ page }) => {
    const base = dashboardChannels.list.channels[0];
    const channels = ['2.15', '2.9', null, '2.11', '2.10'].map(version => ({
      ...base,
      name: `cuda13.0-${version ? `torch${version}` : 'notorch'}-el9.8`,
      torch_version: version,
    }));
    await page.route('**/api/modules/product-builds/channels?*', route => route.fulfill({
      json: { ...dashboardChannels.list, channels },
    }));
    await page.goto('/#/product-builds/channels');

    const matrix = page.getByTestId('channel-matrix');
    await expect(matrix.locator('thead th')).toHaveText([
      'Accelerator', /^Torch\s*2\.9$/, '2.10', '2.11', '2.15', 'No torch',
    ]);
    const cells = matrix.locator('tbody tr').first().getByRole('button');
    for (const [index, version] of ['2.9', '2.10', '2.11', '2.15', null].entries()) {
      const name = `cuda13.0-${version ? `torch${version}` : 'notorch'}-el9.8`;
      await expect(cells.nth(index)).toHaveAttribute('data-channel', name);
    }
    expect(page.errors).toHaveLength(0);
  });

  test('should sort every All channels column in both directions and retain sorting when filtering', async ({ page }) => {
    const base = dashboardChannels.list.channels[0];
    const channels = [
      { ...base, name: 'cuda13.0-torch2.9-el9.8', torch_version: '2.9', compatible_releases: ['RHOAI 3.9'],
        latest_drop: { name: 'z-drop', created_at: '2026-10-15T10:00:00Z' }, wheel_count: 2 },
      { ...base, name: 'cuda12.9-torch2.10-el10.0', maturity: 'rolling', accelerator_version: '12.9', torch_version: '2.10',
        rhel_version: '10.0', compatible_releases: ['RHOAI 3.10'], latest_drop: { name: 'a-drop', created_at: '2026-10-16T10:00:00Z' }, wheel_count: 10 },
      { ...base, name: 'rocm7.2-torch2.15-el9.10', accelerator: 'rocm', accelerator_version: '7.2', torch_version: '2.15',
        rhel_version: '9.10', compatible_releases: ['RHOAI 3.6'], latest_drop: { name: 'm-drop', created_at: '2026-10-14T10:00:00Z' }, wheel_count: 0 },
      { ...base, name: 'cpu-notorch-ubi9', accelerator: 'cpu', accelerator_version: '', torch_version: null,
        rhel_version: 'ubi9', compatible_releases: [], latest_drop: null, wheel_count: undefined },
    ];
    await page.route('**/api/modules/product-builds/channels?*', route => route.fulfill({
      json: { ...dashboardChannels.list, channels },
    }));
    await page.goto('/#/product-builds/channels');

    const table = page.getByTestId('channels-table');
    const rowNames = table.getByTestId('channel-row').locator('td:first-child button');
    const expectOrder = indices => expect(rowNames).toHaveText(indices.map(index => channels[index].name));
    const cases = [
      { label: 'Channel', asc: [3, 1, 0, 2], desc: [2, 0, 1, 3] },
      { label: 'Maturity', asc: [1, 3, 0, 2], desc: [3, 0, 2, 1] },
      { label: 'Accelerator', asc: [3, 1, 0, 2], desc: [2, 0, 1, 3] },
      { label: 'Torch', asc: [0, 1, 2, 3], desc: [2, 1, 0, 3] },
      { label: 'OS', asc: [0, 2, 1, 3], desc: [3, 1, 2, 0] },
      { label: 'Compatible releases', asc: [2, 0, 1, 3], desc: [1, 0, 2, 3] },
      { label: 'Latest RHAIBI drop', asc: [2, 0, 1, 3], desc: [1, 0, 2, 3] },
      { label: 'Wheels', asc: [2, 0, 1, 3], desc: [1, 0, 2, 3] },
    ];
    await expect(table.getByRole('button', { name: /^Sort by / })).toHaveCount(8);
    for (const { label, asc, desc } of cases) {
      const button = table.getByRole('button', { name: `Sort by ${label}`, exact: true });
      const header = table.getByRole('columnheader').filter({
        has: page.getByRole('button', { name: `Sort by ${label}`, exact: true }),
      });
      await button.click();
      await expectOrder(asc);
      await expect(header).toHaveAttribute('aria-sort', 'ascending');
      await button.click();
      await expectOrder(desc);
      await expect(header).toHaveAttribute('aria-sort', 'descending');
      await expect(table.locator('th[aria-sort]')).toHaveCount(1);
    }

    const torchSort = table.getByRole('button', { name: 'Sort by Torch', exact: true });
    await torchSort.focus();
    await torchSort.press('Enter');
    await expectOrder([0, 1, 2, 3]);
    await torchSort.press('Space');
    await expectOrder([2, 1, 0, 3]);
    await page.getByRole('button', { name: 'Stable', exact: true }).click();
    await expectOrder([2, 0, 3]);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expectOrder([2, 1, 0, 3]);
    await expect(page.getByTestId('channel-matrix').locator('thead th')).toHaveText([
      'Accelerator', /^Torch\s*2\.9$/, '2.10', '2.15', 'No torch',
    ]);
    await expect(page.getByTestId('channel-drawer')).toHaveCount(0);
    expect(page.errors).toHaveLength(0);
  });

  test('should combine multiselect channel pills with sorting and existing filters', async ({ page }) => {
    const base = dashboardChannels.list.channels[0];
    const channels = [
      { ...base, name: 'cuda13.0-torch2.9-ubi9', torch_version: '2.9', rhel_version: 'ubi9' },
      { ...base, name: 'cuda13.0-torch2.10-ubi10', torch_version: '2.10', rhel_version: 'ubi10', maturity: 'rolling' },
      { ...base, name: 'rocm7.14-torch2.10-ubi9', accelerator: 'rocm', accelerator_version: '7.14', torch_version: '2.10', rhel_version: 'ubi9' },
      { ...base, name: 'cpu-notorch-ubi9', accelerator: 'cpu', accelerator_version: '', torch_version: null, rhel_version: 'ubi9' },
      { ...base, name: 'cuda12.9-torch2.9-ubi9', accelerator_version: '12.9', torch_version: '2.9', rhel_version: 'ubi9' },
      { ...base, name: 'cuda13.0-torch2.15-ubi9', torch_version: '2.15', rhel_version: 'ubi9' },
    ];
    await page.route('**/api/modules/product-builds/channels?*', route => route.fulfill({
      json: { ...dashboardChannels.list, channels },
    }));
    await page.goto('/#/product-builds/channels');

    const section = page.getByTestId('all-channels');
    const rowNames = section.getByTestId('channel-row').locator('td:first-child button');
    const expectOrder = indices => expect(rowNames).toHaveText(indices.map(index => channels[index].name));
    const accelerator = section.getByRole('button', { name: /^Accelerator filter/ });
    const torch = section.getByRole('button', { name: /^Torch filter/ });
    const os = section.getByRole('button', { name: /^OS filter/ });
    const maturityPill = section.getByRole('button', { name: /^Maturity filter/ });

    await section.getByRole('button', { name: 'Sort by Torch', exact: true }).click();
    await expectOrder([4, 0, 1, 2, 5, 3]);
    await accelerator.click();
    const acceleratorOptions = section.getByRole('group', { name: 'Accelerator options', exact: true });
    await acceleratorOptions.getByRole('checkbox', { name: 'CUDA 13.0', exact: true }).check();
    await expectOrder([0, 1, 5]);
    await acceleratorOptions.getByRole('checkbox', { name: 'ROCm 7.14', exact: true }).check();
    await expectOrder([0, 1, 2, 5]);
    await expect(accelerator).toHaveAccessibleName('Accelerator filter, 2 selected');
    await expect(section.getByRole('status')).toHaveText('4 of 6 channels');
    await expect(page.getByTestId('channel-matrix').locator('[data-channel="cpu-notorch-ubi9"]')).not.toHaveClass(/opacity-30/);

    await torch.focus();
    await torch.press('ArrowDown');
    await expect(acceleratorOptions).toHaveCount(0);
    const torchOptions = section.getByRole('group', { name: 'Torch options', exact: true });
    await expect(torchOptions.locator('label')).toHaveText(['2.9', '2.10', '2.15', 'No torch']);
    await expect(torchOptions.getByRole('checkbox', { name: '2.9', exact: true })).toBeFocused();
    await page.keyboard.press('Space');
    await torchOptions.getByRole('checkbox', { name: '2.10', exact: true }).check();
    await expectOrder([0, 1, 2]);
    await torchOptions.getByRole('checkbox', { name: '2.10', exact: true }).press('Escape');
    await expect(torch).toHaveAttribute('aria-expanded', 'false');
    await expect(torch).toBeFocused();

    await maturityPill.click();
    const maturityOptions = section.getByRole('group', { name: 'Maturity options', exact: true });
    await maturityOptions.getByRole('checkbox', { name: 'Stable', exact: true }).check();
    await expectOrder([0, 2]);
    await maturityOptions.getByRole('checkbox', { name: 'Rolling', exact: true }).check();
    await expectOrder([0, 1, 2]);
    await maturityOptions.getByRole('checkbox', { name: 'Stable', exact: true }).uncheck();
    await expectOrder([1]);
    await expect(maturityPill).toHaveAccessibleName('Maturity filter, 1 selected');
    await maturityOptions.getByRole('button', { name: 'Clear Maturity filter', exact: true }).click();
    await expectOrder([0, 1, 2]);

    await os.click();
    const osOptions = section.getByRole('group', { name: 'OS options', exact: true });
    await osOptions.getByRole('checkbox', { name: 'UBI 9', exact: true }).check();
    await expectOrder([0, 2]);
    await osOptions.getByRole('checkbox', { name: 'UBI 10', exact: true }).check();
    await expectOrder([0, 1, 2]);
    await osOptions.getByRole('checkbox', { name: 'UBI 9', exact: true }).uncheck();
    await expectOrder([1]);
    await osOptions.getByRole('checkbox', { name: 'UBI 10', exact: true }).press('Escape');
    await maturityPill.click();
    await maturityOptions.getByRole('checkbox', { name: 'Stable', exact: true }).check();
    await expect(section).toContainText('No channels match these filters.');
    await maturityOptions.getByRole('checkbox', { name: 'Stable', exact: true }).press('Escape');
    await page.getByRole('button', { name: 'Stable', exact: true }).click();
    await expect(section).toContainText('No channels match these filters.');
    await expect(section.getByRole('status')).toHaveText('0 of 5 channels');
    await section.getByRole('button', { name: 'Clear table filters', exact: true }).click();
    await expectOrder([4, 0, 2, 5, 3]);
    await expect(accelerator).toHaveAccessibleName('Accelerator filter');
    await expect(maturityPill).toHaveAccessibleName('Maturity filter');

    await torch.click();
    await torchOptions.getByRole('checkbox', { name: 'No torch', exact: true }).check();
    await expectOrder([3]);
    await torchOptions.getByRole('button', { name: 'Clear Torch filter', exact: true }).click();
    await expectOrder([4, 0, 2, 5, 3]);
    await section.getByRole('heading', { name: 'All channels', exact: true }).click();
    await expect(torchOptions).toHaveCount(0);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await section.getByRole('button', { name: 'Sort by Torch', exact: true }).click();
    await expectOrder([5, 1, 2, 4, 0, 3]);

    await page.setViewportSize({ width: 390, height: 844 });
    await os.click();
    await expect(osOptions).toBeVisible();
    const bounds = await osOptions.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    expect(page.errors).toHaveLength(0);
  });

  test('should omit adoption placeholders for channels without compatible releases', async ({ page }) => {
    const unadopted = dashboardChannels.list.channels[1];
    await page.route('**/api/modules/product-builds/channels?*', route => route.fulfill({ json: dashboardChannels.list }));
    await page.route(`**/api/modules/product-builds/channels/${unadopted.name}`, route => route.fulfill({
      json: { source: 'dashboard', channel: { ...unadopted, drops: [], wheels: [] } },
    }));
    await page.goto('/#/product-builds/channels');

    const matrix = page.getByTestId('channel-matrix');
    await expect(matrix).toContainText('RHOAI 3.6-EA2');
    const cell = matrix.getByRole('button', { name: `Open channel ${unadopted.name}`, exact: true });
    await expect(cell).toHaveText('Rolling');
    await cell.click();
    const drawer = page.getByTestId('channel-drawer');
    await expect(drawer).toContainText(unadopted.description);
    await expect(drawer.getByRole('heading', { name: 'Compatible releases', exact: true })).toHaveCount(0);
    await expect(page.getByText(/not adopted yet|no product release has adopted this channel yet/i)).toHaveCount(0);
    expect(page.errors).toHaveLength(0);
  });

  test('should open a channel and browse its drops and wheels', async ({ page, request }) => {
    const { channels } = await (await request.get('/api/modules/product-builds/channels?limit=1000')).json();
    const selected = channels.find(c => c.wheel_count > 0);
    expect(selected).toBeTruthy();
    const { channel } = await (await request.get(`/api/modules/product-builds/channels/${encodeURIComponent(selected.name)}`)).json();
    await page.goto('/#/product-builds/channels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const channelName = selected.name;
    const cell = page.getByRole('button', { name: `Open channel ${channelName}`, exact: true });
    await cell.click();

    const drawer = page.locator('[data-testid="channel-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(channelName);
    expect(page.url()).toContain(`channel=${encodeURIComponent(channelName)}`);
    if (channel.drops.length) {
      await expect(drawer.locator('[data-testid="channel-drop"]').first()).toBeVisible();
    } else {
      await expect(drawer.getByText('No RHAIBI drop includes this channel yet.')).toBeVisible();
    }

    await drawer.getByRole('tab', { name: /Wheels/ }).click();
    await expect(drawer.locator('[data-testid="channel-wheel"]').first()).toBeVisible();
    const wheelFilter = drawer.getByLabel('Filter wheels by name');
    const wheelName = channel.wheels[0].name;
    await wheelFilter.fill(wheelName);
    await expect(drawer.locator('[data-testid="channel-wheel"]')).toHaveCount(
      channel.wheels.filter(w => w.name.toLowerCase().includes(wheelName.toLowerCase())).length
    );

    // Escape clears the wheel filter first, then closes the drawer.
    await wheelFilter.press('Escape');
    await expect(wheelFilter).toHaveValue('');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    expect(page.url()).not.toContain('channel=');

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should deep link to a channel', async ({ page, request }) => {
    const { channels } = await (await request.get('/api/modules/product-builds/channels')).json();
    const channelName = channels[0].name;
    await page.goto(`/#/product-builds/channels?channel=${encodeURIComponent(channelName)}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const drawer = page.locator('[data-testid="channel-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(channelName);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should render the dashboard channel contract with empty history and unclassified wheels', async ({ page }) => {
    await page.route('**/api/modules/product-builds/channels?*', route => route.fulfill({ json: dashboardChannels.list }));
    await page.route('**/api/modules/product-builds/channels/*', route => route.fulfill({ json: dashboardChannels.detail }));
    await page.goto(`/#/product-builds/channels?channel=${dashboardChannels.detail.channel.name}`);

    await expect(page.getByTestId('channels-source-note')).toContainText('Dashboard data');
    await expect(page.getByTestId('channels-sample-note')).toHaveCount(0);
    await expect(page.getByTestId('channel-matrix')).toContainText('RHOAI 3.6-EA2');
    const drawer = page.getByTestId('channel-drawer');
    await expect(drawer).toContainText('RHEL 9.8');
    const registryLink = drawer.getByRole('link', { name: dashboardChannels.detail.channel.base_image, exact: true });
    await expect(registryLink).toBeVisible();
    await expect(registryLink).toHaveAttribute('href', 'https://quay.io/repository/aipcc/base-images/cuda13.0-torch2.11-el9.8?tab=tags');
    await expect(registryLink).toHaveAttribute('target', '_blank');
    await expect(registryLink).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(drawer).toContainText('No RHAIBI drop includes this channel yet.');
    await expect(drawer.getByRole('button', { name: 'Copy', exact: true })).toBeVisible();
    await drawer.getByRole('tab', { name: /Wheels/ }).click();
    await expect(drawer.getByTestId('channel-wheel')).toHaveCount(2);
    await expect(drawer).toContainText('2.11.0');
    await expect(drawer.getByText('Accelerator builds', { exact: false })).toHaveCount(0);
    expect(page.errors).toHaveLength(0);
  });
});
