const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, mainContentIsVisible } = require('./helpers');

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
    for (const project of ['AIPCC', 'RHAI']) {
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

  test('should show CHI column header in artifacts tab', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const artifactsTab = page.locator('button').filter({ hasText: 'Artifacts' });
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      const chiHeader = page.locator('th').filter({ hasText: 'CHI' });
      await expect(chiHeader).toBeVisible();

      const testsHeader = page.locator('th').filter({ hasText: 'Tests' });
      await expect(testsHeader).toBeVisible();
    }

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
});
