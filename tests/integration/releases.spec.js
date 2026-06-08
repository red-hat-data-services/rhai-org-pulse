const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for Releases module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 *
 * Tag: @releases
 * Usage: npx playwright test --grep @releases
 */

test.describe('Releases Module @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should fetch data from Releases API endpoints', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/releases')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Navigate to Execute view (a data-driven view that makes API calls)
    await page.goto('/#/releases/execute');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify that API requests were made to the Releases endpoints
    // In demo mode, these should still be called and return fixture data
    expect(apiRequests.length).toBeGreaterThan(0);
    console.log(`Releases API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    expect(page.errors).toHaveLength(0);
  });

});

/**
 * RICE Config API
 *
 * Verify the single-field RICE config round-trip works end-to-end:
 * save riceScoreField → retrieve config → field is persisted.
 * Does not require a Jira connection.
 */
test.describe('Releases RICE Config API @releases', () => {
  test('saves and retrieves riceScoreField via health-admin/config', async ({ request }) => {
    const base = '/api/modules/releases/planning'

    const putRes = await request.put(`${base}/releases/health-admin/config`, {
      data: { riceScoreField: 'customfield_10864', enableRice: true }
    })
    expect(putRes.ok()).toBe(true)
    const putBody = await putRes.json()
    expect(putBody.saved).toBe(true)
    expect(putBody.customFieldIds.riceScoreField).toBe('customfield_10864')
    expect(putBody.enableRice).toBe(true)

    const getRes = await request.get(`${base}/releases/health-admin/config`)
    expect(getRes.ok()).toBe(true)
    const getBody = await getRes.json()
    expect(getBody.customFieldIds.riceScoreField).toBe('customfield_10864')
    expect(getBody.enableRice).toBe(true)
  })

  test('rejects riceScoreField with invalid characters', async ({ request }) => {
    const base = '/api/modules/releases/planning'
    const res = await request.put(`${base}/releases/health-admin/config`, {
      data: { riceScoreField: 'bad field!' }
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid riceScoreField')
  })
})

/**
 * Active Components
 *
 * Verify each major view (aka menu item) in the Releases module loads with
 * meaningful content
 */
test.describe('Releases Views @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to navigate and verify a view loads with content
  async function testView(page, viewId, viewName) {
    await page.goto(`/#/releases/${viewId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Before we verify content, we need to verify the overall view loads
    const mainContent = page.locator('main, [role="main"], .min-h-screen').first();
    await expect(mainContent).toBeVisible();

    // Verify the view has rendered some meaningful content by checking for
    // data-bearing elements (not just empty containers or placeholders)
    const hasButtons = await page.locator('button').count() > 0;
    const hasInputs = await page.locator('input, select, textarea').count() > 0;
    const hasList = await page.locator('ul li, ol li').count() > 0;
    const hasTable = await page.locator('table tbody tr').count() > 0;
    const hasHeadings = await page.locator('h1, h2, h3').count() > 0;
    const hasLinks = await page.locator('a[href]').count() > 0;
    const hasDataElements = await page.locator('[data-testid], [data-key], [data-id]').count() > 0;
    const hasSections = await page.locator('article, section').count() > 0;

    // If this value is 'false', then it indicates we've loaded an empty page.
    const hasContent = hasButtons || hasInputs || hasList || hasTable ||
                       hasHeadings || hasLinks || hasDataElements || hasSections;
    expect(hasContent).toBe(true);

    // Verify we're not stuck in an infinite loading state
    // Use specific selectors to avoid matching legitimate status regions
    const loadingSpinners = await page.locator('[aria-busy="true"], [role="progressbar"], .loading, .spinner, [aria-label*="loading" i]').count();
    expect(loadingSpinners).toBe(0);
    if (page.errors.length > 0) {
      console.error(`${viewName} errors:`, page.errors);
    }

    expect(page.errors).toHaveLength(0);
  }

  test('should load Plan view', async ({ page }) => {
    await testView(page, 'plan', 'Plan');
  });

  test('should load Execute view', async ({ page }) => {
    await testView(page, 'execute', 'Execute');
  });

  test('should load Deliver view', async ({ page }) => {
    await testView(page, 'deliver', 'Deliver');
  });

  test('should load Reports view', async ({ page }) => {
    await testView(page, 'reports', 'Reports');
  });

  test('should load Audit view', async ({ page }) => {
    await testView(page, 'audit', 'Audit');
  });
});

/**
 * PM Hub
 *
 * Verify the PM Hub tab loads under Plan, the Component Release Load Tracking
 * report card is visible and clickable, and the PM Hub API endpoints respond.
 */
test.describe('Releases PM Hub @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show PM Hub tab under Plan and load report card', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const pmHubTab = page.locator('button', { hasText: 'PM Hub' });
    await expect(pmHubTab).toBeVisible();

    await pmHubTab.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const reportCard = page.locator('text=Component Release Load Tracking');
    await expect(reportCard.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should open Component Release Load report with filter dropdowns', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.locator('button', { hasText: 'PM Hub' }).click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const reportCard = page.locator('.cursor-pointer', { hasText: 'Component Release Load Tracking' });
    await reportCard.first().click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const componentFilter = page.locator('text=Jira Component');
    const releaseFilter = page.locator('text=Release');
    await expect(componentFilter.first()).toBeVisible();
    await expect(releaseFilter.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('PM Hub API endpoints should respond', async ({ request }) => {
    const componentsRes = await request.get('/api/modules/releases/pm-hub/jira/components');
    expect(componentsRes.ok()).toBe(true);
    const componentsBody = await componentsRes.json();
    expect(componentsBody).toHaveProperty('components');
    expect(componentsBody).toHaveProperty('projects');
    expect(Array.isArray(componentsBody.components)).toBe(true);

    const versionsRes = await request.get('/api/modules/releases/pm-hub/jira/versions');
    expect(versionsRes.ok()).toBe(true);
    const versionsBody = await versionsRes.json();
    expect(versionsBody).toHaveProperty('versions');
    expect(versionsBody).toHaveProperty('projects');
    expect(Array.isArray(versionsBody.versions)).toBe(true);
  });

  test('component-release-load endpoint requires filters', async ({ request }) => {
    const res = await request.get('/api/modules/releases/pm-hub/component-release-load');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('filter');
  });
});
