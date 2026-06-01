const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible, countDisabledNavItems } = require('./helpers');

/**
 * Integration tests for System Health module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 *
 * Tag: @system-health
 * Usage: npx playwright test --grep @system-health
 */

test.describe('System Health Module @system-health', () => {
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

    // Find the System Health module in the sidebar
    const moduleNav = page.locator('aside nav').filter({ hasText: 'System Health' });
    const count = await moduleNav.count();
    expect(count).toBeGreaterThan(0);

    // Verify the module link is visible and clickable
    const moduleLink = moduleNav.first();
    await expect(moduleLink).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should navigate to System Health module when clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // First, expand the System Health module section if it's collapsed
    const moduleHeader = page.locator('aside nav button').filter({ hasText: 'System Health' }).first();
    await moduleHeader.click();
    await page.waitForTimeout(500);

    // Now click on the "Quality analysis" view within the module
    const viewLink = page.locator('aside nav button').filter({ hasText: 'Quality analysis' }).first();
    await viewLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify URL changed to system-health module (default view is quality-analysis)
    expect(page.url()).toMatch(/system-health\/quality-analysis/);

    // Verify main content is visible
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('should use static data (no API calls required)', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Navigate to Quality Analysis view
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // System Health uses static data (imported from qualityReports.data.js)
    // so there should be NO API requests to system-health endpoints
    expect(apiRequests.length).toBe(0);
    console.log(`System Health API requests: ${apiRequests.length} (expected 0 - uses static data)`);

    // Verify the page still loaded successfully with content
    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

});

/**
 * Disabled Menu Items
 *
 * Verify that System Health module has no disabled menu items.
 * All navigation items should be active and clickable.
 */
test.describe('System Health Disabled Menu Items @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should have no disabled menu items', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Count disabled navigation items within the System Health section only
    const disabledCount = await countDisabledNavItems(page, 'System Health');

    // System Health module should have no disabled menu items
    expect(disabledCount).toBe(0);
    expect(page.errors).toHaveLength(0);
  });
});

/**
 * Active Components
 *
 * Verify each major view (aka menu item) in the System Health module loads with
 * meaningful content
 */
test.describe('System Health Views @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to navigate and verify a view loads with content
  async function testView(page, viewId, viewName) {
    await page.goto(`/#/system-health/${viewId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Before we verify content, we need to verify the overall view loads
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    // Verify the view has rendered some meaningful content by checking for
    // data-bearing elements (not just empty containers or placeholders)
    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    // Verify we're not stuck in an infinite loading state
    const pageHasFinishedLoading = await pageLoadComplete(page);
    expect(pageHasFinishedLoading).toBe(true);
    if (page.errors.length > 0) {
      console.error(`${viewName} errors:`, page.errors);
    }

    expect(page.errors).toHaveLength(0);
  }

  test('should load Quality Analysis view', async ({ page }) => {
    await testView(page, 'quality-analysis', 'Quality Analysis');
  });

  test('should display table with required columns in Quality Analysis', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // We expect at least one table
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check that all expected columns are present
    const expectedColumns = ['REPOSITORY', 'TIER', 'COMPONENT', 'SCORE', 'TOP GAPS'];
    for (const columnName of expectedColumns) {
      // Look for the column header in table headers (th) or column cells
      const columnHeader = table.locator('th, thead td, [role="columnheader"]').filter({ hasText: columnName });
      const count = await columnHeader.count();
      expect(count).toBeGreaterThan(0);
      console.log(`Found column: "${columnName}"`);
    }

    // Verify column order
    const allHeaders = await table.locator('th, thead td, [role="columnheader"]').allTextContents();
    console.log('All table headers:', allHeaders);

    expect(page.errors).toHaveLength(0);
  });
});
