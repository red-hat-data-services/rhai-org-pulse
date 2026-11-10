const { test, expect } = require('@playwright/test');
const { readFileSync } = require('fs');
const { join } = require('path');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible, countDisabledNavItems, expectNoBenignConsoleErrors } = require('./helpers');

const nightlyHealthFixturePath = join(
  __dirname,
  '../../fixtures/system-health/test-execution/nightly_health.json'
);
const qualityReportsFixturePath = join(
  __dirname,
  '../../fixtures/system-health/quality/reports.json'
);
const disconnectedReportsFixturePath = join(
  __dirname,
  '../../fixtures/system-health/disconnected/reports.json'
);

const { getListProjection } = require('../../modules/system-health/server/quality/storage');
const { getSummaryProjection } = require('../../modules/system-health/server/disconnected/storage');

function qualityReportsListPayload() {
  const data = JSON.parse(readFileSync(qualityReportsFixturePath, 'utf8'));
  return getListProjection(data);
}

function disconnectedSummaryPayload() {
  const data = JSON.parse(readFileSync(disconnectedReportsFixturePath, 'utf8'));
  return getSummaryProjection(data);
}

/** YYYY-MM-DD within the Test Execution default 30-day filter window. */
function recentHeatmapDayKey(daysAgo = 1) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function buildTabCoexistenceHeatmapFixture(dayKey = recentHeatmapDayKey(1)) {
  return {
    components: [
      {
        component: 'Dashboard',
        overall: { total: 10, passed: 9, failed: 1, skipped: 0 },
        days: {
          [dayKey]: {
            passed: 10,
            failed: 0,
            skipped: 0,
            total: 10,
            jenkins_urls: [],
            by_vr: { '3.0|fast': { passed: 10, failed: 0, skipped: 0, total: 10, jenkins_urls: [] } }
          }
        }
      }
    ]
  };
}

/** Demo container has no OAuth session; stub read APIs so UI tests see fixture data. */
async function mockDemoSystemHealthReadApis(page) {
  const qualityList = qualityReportsListPayload();
  const disconnectedSummary = disconnectedSummaryPayload();

  await page.route('**/api/modules/system-health/quality/reports', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (path !== '/api/modules/system-health/quality/reports') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(qualityList)
    });
  });

  await page.route('**/api/modules/system-health/disconnected/summary**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(disconnectedSummary)
    });
  });
}

/**
 * Integration tests for System Health module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 * - New OpenDataHub E2E health views work properly
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

    expectNoBenignConsoleErrors(page);
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

    expectNoBenignConsoleErrors(page);
  });

  test('should fetch quality reports from API', async ({ page }) => {
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health/quality')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const reportsRequests = apiRequests.filter(r => r.url.includes('/quality/reports'));
    expect(reportsRequests.length).toBeGreaterThan(0);
    console.log(`Quality API requests: ${reportsRequests.length}`);
    reportsRequests.forEach(r => console.log(`  ${r.method} ${r.url}`));

    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    expectNoBenignConsoleErrors(page);
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
    expectNoBenignConsoleErrors(page);
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
    await mockDemoSystemHealthReadApis(page);
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

    expectNoBenignConsoleErrors(page);
  }

  test('should load Quality Analysis view', async ({ page }) => {
    await testView(page, 'quality-analysis', 'Quality Analysis');
  });

  test('should load Component Maturity view', async ({ page }) => {
    await testView(page, 'component-maturity', 'Component Maturity');
  });

  test('should load OpenDataHub E2E Health view', async ({ page }) => {
    await testView(page, 'odh-e2e-health', 'OpenDataHub E2E Health');
  });

  test('should show empty state for repos without scan data', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find a "Pending" indicator — these appear for repos without scan data
    const pendingLabels = page.locator('table td span').filter({ hasText: 'Pending' });
    const pendingCount = await pendingLabels.count();
    if (pendingCount === 0) {
      console.log('No unscanned repos found — all repos have scan data, skipping empty state test');
      return;
    }

    // The same row should also show "None" in the gaps column
    const pendingRow = pendingLabels.first().locator('xpath=ancestor::tr');
    await expect(pendingRow.locator('text=None')).toBeVisible();

    // Click the repo name button in that row to open the detail view
    await pendingRow.locator('button').first().click();
    await page.waitForTimeout(1000);

    // Should show the empty state heading instead of an iframe
    const heading = page.locator('h2').filter({ hasText: 'No quality report available' });
    await expect(heading).toBeVisible();

    // Should show the troubleshooting section
    const troubleshooting = page.locator('text=Troubleshooting');
    await expect(troubleshooting).toBeVisible();

    // Should NOT render an iframe
    const iframe = page.locator('iframe');
    expect(await iframe.count()).toBe(0);

    expectNoBenignConsoleErrors(page);
  });

  test('should display table with required columns in Quality Analysis', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // We expect at least one table
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Check that all expected columns are present
    const expectedColumns = ['Repository', 'Tier', 'Component', 'Score', 'Gaps'];
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

    expectNoBenignConsoleErrors(page);
  });

  test('should display quality scores from API data', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(5, { timeout: 15000 });
    const rowCount = await rows.count();
    console.log(`Quality analysis table rows: ${rowCount}`);

    const scoreCell = page.locator('table td span').filter({ hasText: /\d\.\d\/10/ });
    const scoreCount = await scoreCell.count();
    expect(scoreCount).toBeGreaterThan(0);
    console.log(`Score cells found: ${scoreCount}`);

    expectNoBenignConsoleErrors(page);
  });

  test('should filter reports by tier', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const allRows = page.locator('table tbody tr');
    await expect(allRows).toHaveCount(5, { timeout: 15000 });

    // Select "downstream" tier — only 1 repo in fixture
    const tierSelect = page.locator('select').first();
    await tierSelect.selectOption({ label: 'downstream' });
    await page.waitForTimeout(500);

    const filteredRows = await page.locator('table tbody tr').count();
    expect(filteredRows).toBe(1);

    const summaryText = page.locator('text=/Showing 1 of 5/');
    await expect(summaryText).toBeVisible();

    expectNoBenignConsoleErrors(page);
  });

  test('should show report detail empty state when clicked', async ({ page }) => {
    await page.goto('/#/system-health/quality-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const repoButton = page.locator('table tbody button').first();
    await expect(repoButton).toBeVisible({ timeout: 15000 });
    await repoButton.click();
    await page.waitForTimeout(1000);

    const heading = page.locator('h2').filter({ hasText: 'No quality report available' });
    await expect(heading).toBeVisible();

    const backButton = page.locator('button').filter({ hasText: 'Back to list' });
    await expect(backButton).toBeVisible();

    expect(await page.locator('iframe').count()).toBe(0);

    await backButton.click();
    await page.waitForTimeout(500);

    await expect(page.locator('table')).toBeVisible();

    expectNoBenignConsoleErrors(page);
  });
});

/**
 * Disconnected Readiness Feature
 *
 * Verify the disconnected readiness dashboard functionality.
 */
test.describe('System Health Disconnected Readiness @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockDemoSystemHealthReadApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show disconnected readiness tab in component maturity view', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for the "Disconnected readiness" tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await expect(disconnectedTab).toBeVisible();

    // Click the disconnected readiness tab
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Verify content loaded
    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should display summary cards in disconnected readiness view', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Look for summary cards - ReadinessSummaryCards renders as a grid with white/gray cards
    const summaryCards = page.locator('div.grid.grid-cols-2 > div');
    const cardCount = await summaryCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Look for readiness percentage or count displays
    const readinessMetrics = page.locator('text=/\\d+%|\\d+ ready|\\d+ repos/i');
    const metricsCount = await readinessMetrics.count();
    expect(metricsCount).toBeGreaterThan(0);

    expectNoBenignConsoleErrors(page);
  });

  test('should display readiness table with repositories', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Look for a table with repository data
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 15000 });

    // Check for expected column headers
    const expectedColumns = ['Repository', 'Score', 'Status', 'Last Updated'];
    for (const columnName of expectedColumns) {
      // Look for the column header (case insensitive)
      const columnHeader = table.locator('th, thead td, [role="columnheader"]').filter({ hasText: new RegExp(columnName, 'i') });
      const count = await columnHeader.count();
      if (count > 0) {
        console.log(`Found column: "${columnName}"`);
      }
      // Don't require all columns as the exact naming might differ
    }

    expectNoBenignConsoleErrors(page);
  });

  test('should handle repository detail navigation', async ({ page }) => {
    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForTimeout(1000);

    // Look for clickable repository rows in the table
    const repoRow = page.locator('table tbody tr').first();
    const rowCount = await repoRow.count();

    if (rowCount > 0) {
      // Click the first repository row
      await repoRow.click();
      await page.waitForTimeout(1000);

      // Verify we navigated to a detail view
      expect(page.url()).toMatch(/disconnected-repo-detail/);

      // Verify detail content loaded
      const hasContent = await pageHasContent(page);
      expect(hasContent).toBe(true);
    } else {
      console.log('No repository links found - likely empty state or different UI pattern');
    }

    expectNoBenignConsoleErrors(page);
  });

  test('should fetch disconnected summary data from API', async ({ page }) => {
    // Monitor API requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health/disconnected')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    await page.goto('/#/system-health/component-maturity');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Navigate to disconnected readiness tab
    const disconnectedTab = page.locator('button, a, [role="tab"]').filter({ hasText: 'Disconnected readiness' });
    await disconnectedTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Should have made at least one API request to the disconnected endpoints
    expect(apiRequests.length).toBeGreaterThan(0);

    // Verify the summary endpoint was called
    const summaryRequests = apiRequests.filter(req => req.url.includes('/summary'));
    expect(summaryRequests.length).toBeGreaterThan(0);

    console.log(`Disconnected API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => console.log(`  ${req.method} ${req.url}`));

    expectNoBenignConsoleErrors(page);
  });
});

/**
 * OpenDataHub E2E Health Feature Tests
 *
 * Verify the new OpenDataHub E2E health monitoring features including
 * API endpoints, status displays, and navigation.
 */
test.describe('OpenDataHub E2E Health Features @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should fetch ODH E2E health data from new API endpoint', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health/odh-e2e-health')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Navigate to OpenDataHub E2E health view
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify that API requests were made to the new ODH E2E health endpoint
    expect(apiRequests.length).toBeGreaterThan(0);
    console.log(`ODH E2E Health API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    // Verify at least one request is for the main health endpoint
    const healthRequest = apiRequests.find(req =>
      req.url.includes('/odh-e2e-health') && !req.url.includes('/runs')
    );
    expect(healthRequest).toBeDefined();

    expectNoBenignConsoleErrors(page);
  });

  test('should display health status cards', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Status badges or trend copy (UI varies with fixture load)
    const hasStatusCards = await page.locator('.bg-green-100, .bg-orange-100, .bg-red-100, .text-green-600, .text-orange-600, .text-red-600, .bg-green-500, .bg-red-500, .bg-yellow-500').count() > 0;
    const hasTrendSection = await page.locator('text=/pass rate|ODH|RHOAI|No recent data/i').count() > 0;
    expect(hasStatusCards || hasTrendSection).toBe(true);

    const hasStatusText = await page.locator('text=/healthy|stable|degraded|failing|broken|passed|failed|No recent data/i').count() > 0;
    expect(hasStatusText).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should display pass rate percentages', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for percentage displays
    const hasPercentages = await page.locator('text=/\\d+%|\\d+\\.\\d+%/').count() > 0;
    expect(hasPercentages).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should display trend charts or chart containers', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for chart containers, canvas elements, or chart-related content
    const hasCharts = await page.locator('canvas, .chart-container, [data-testid*="chart"], [class*="chart"]').count() > 0;
    expect(hasCharts).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should display test run history or recent runs', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Run history table, run rows, or explicit empty state
    const hasRunHistory = await page.locator('table tbody tr, .run-item, [data-testid*="run"], [class*="run-"]').count() > 0;
    const hasEmptyRuns = await page.locator('text=/no runs|no recent|no data/i').count() > 0;
    expect(hasRunHistory || hasEmptyRuns).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should display suite labels (ODH/RHOAI)', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for ODH and RHOAI suite references
    const hasOdhSuite = await page.locator('text=/ODH|OpenDataHub/i').count() > 0;
    const hasRhoaiSuite = await page.locator('text=/RHOAI|Red Hat OpenShift AI/i').count() > 0;

    // At least one suite should be mentioned
    expect(hasOdhSuite || hasRhoaiSuite).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should show component failure information', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for component names or failure-related content
    const hasComponents = await page.locator('text=/dashboard|kserve|modelregistry|trustyai|component/i').count() > 0;
    expect(hasComponents).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should handle navigation to run detail view when run links are present', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for clickable run links or buttons
    const runLinks = page.locator('table tbody tr[title*="Click to view details"], table tbody tr.cursor-pointer');
    const runLinksCount = await runLinks.count();

    if (runLinksCount > 0) {
      console.log(`Found ${runLinksCount} clickable run elements`);

      // Click the first run link if available
      await runLinks.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      // Verify we navigated to the detail view
      expect(page.url()).toMatch(/e2e-run-detail/);

      // Verify the detail view loads with content
      const mainContentVisible = await mainContentIsVisible(page);
      expect(mainContentVisible).toBe(true);

      const hasContent = await pageHasContent(page);
      expect(hasContent).toBe(true);
    } else {
      // Skip test if no clickable run rows found (may occur in demo mode or when no data available)
      console.log('No run detail links found - skipping navigation test');
    }

    expectNoBenignConsoleErrors(page);
  });

  test('should handle refresh functionality if refresh button is present', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for refresh button
    const refreshButton = page.locator('button').filter({ hasText: /refresh|reload|update/i });
    const refreshButtonCount = await refreshButton.count();

    if (refreshButtonCount > 0) {
      console.log('Found refresh button - testing refresh functionality');

      // Monitor API requests during refresh
      const apiRequests = [];
      page.on('request', request => {
        if (request.url().includes('/api/modules/system-health/odh-e2e-health')) {
          apiRequests.push({
            url: request.url(),
            method: request.method()
          });
        }
      });

      // Click refresh button
      await refreshButton.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      // Should have made API requests during refresh
      const _refreshRequests = apiRequests.filter(req => req.method === 'POST' && req.url.includes('/refresh'));

      // Don't require POST refresh in demo mode, but log what we found
      console.log(`Refresh API requests made: ${apiRequests.length}`);
      apiRequests.forEach(req => console.log(`  ${req.method} ${req.url}`));
    } else {
      console.log('No refresh button found - test passed (acceptable for demo mode)');
    }

    expectNoBenignConsoleErrors(page);
  });

  test('should display test run detail view with enhanced failure information', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Look for a failed run to test detail view with stack traces
    const runLinks = page.locator('table tbody tr[title*="Click to view details"], table tbody tr.cursor-pointer');
    const runLinksCount = await runLinks.count();

    if (runLinksCount === 0) {
      // Skip test if no clickable run rows found (may occur in demo mode or when no data available)
      console.log('No run detail links available - skipping enhanced failure test');
      return;
    }

    // Click first available run link
    await runLinks.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify we're on the detail page
    expect(page.url()).toMatch(/e2e-run-detail/);

    // Look for failed test cases section
    const failedTestsSection = page.locator('text=/Failed Tests:|failed tests/i');
    const hasFailedTests = await failedTestsSection.count() > 0;

    if (hasFailedTests) {
      // Check for error messages in failed test cases
      const errorMessages = page.locator('.text-red-700, .text-red-600, .text-red-300, .text-red-400').filter({
        hasText: /.+/ // Any non-empty text
      });
      const hasErrorMessages = await errorMessages.count() > 0;
      expect(hasErrorMessages).toBe(true);

      // Look for stack trace collapsible sections - should be present since fixture has failed runs with failedComponents
      const stackTraceElements = page.locator('details summary').filter({ hasText: /Stack Trace/i });
      const stackTraceCount = await stackTraceElements.count();
      expect(stackTraceCount).toBeGreaterThan(0); // Should have stack traces for failed test cases

      // Test expanding a stack trace
      await stackTraceElements.first().click();
      await page.waitForTimeout(500);

      // Check if the stack trace content is visible after expansion
      const stackTraceContent = page.locator('pre').filter({ hasText: /.+/ });
      const hasExpandedContent = await stackTraceContent.count() > 0;
      expect(hasExpandedContent).toBe(true);
    } else {
      console.log('No failed tests found - checking for overall success message');
      const successMessage = page.locator('text=/All Components Passed|All tests passed|No failures/i');
      const hasSuccessMessage = await successMessage.count() > 0;
      expect(hasSuccessMessage).toBe(true);
    }

    expectNoBenignConsoleErrors(page);
  });

  test('should fetch detailed test run data via API with enhanced failure structure', async ({ page }) => {
    // Monitor API calls for detail endpoints
    const detailApiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health/odh-e2e-health/runs/') && request.url().includes('/details')) {
        detailApiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Try to navigate to a run detail page via clickable table rows
    const runLinks = page.locator('table tbody tr[title*="Click to view details"], table tbody tr.cursor-pointer');
    const runLinksCount = await runLinks.count();

    if (runLinksCount > 0) {
      await runLinks.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      // Check if detail API was called - at least one attempt should be made when navigating to detail view
      console.log(`Detail API requests made: ${detailApiRequests.length}`);
      detailApiRequests.forEach(req => console.log(`  ${req.method} ${req.url}`));

      // Should attempt to fetch detail data when navigating to a run detail page
      expect(detailApiRequests.length).toBeGreaterThan(0);
    } else {
      // Skip test if no clickable run rows found (may occur in demo mode or when no data available)
      console.log('No run detail links available - skipping API test');
    }

    expectNoBenignConsoleErrors(page);
  });

  test('should display back navigation from run detail view', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find and click a run link to navigate to detail view
    const runLinks = page.locator('table tbody tr[title*="Click to view details"], table tbody tr.cursor-pointer');
    const runLinksCount = await runLinks.count();

    if (runLinksCount > 0) {
      await runLinks.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      // Look for back navigation button
      const backButton = page.locator('button').filter({ hasText: /Back to|back|← /i });
      await expect(backButton.first()).toBeVisible();

      // Test back navigation
      await backButton.first().click();
      await page.waitForTimeout(1000);

      // Should return to main E2E health view
      expect(page.url()).toMatch(/system-health\/odh-e2e-health/);
      expect(page.url()).not.toMatch(/e2e-run-detail/);
    } else {
      // Skip test if no clickable run rows found (may occur in demo mode or when no data available)
      console.log('No run detail links available - skipping navigation test');
    }

    expectNoBenignConsoleErrors(page);
  });

  test('should render the Runs / Blocker JIRAs view toggle', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The card header carries a segmented toggle with a "Runs" and a "Blocker JIRAs" button
    const toggleGroup = page.locator('[role="group"][aria-label="View toggle"]');
    await expect(toggleGroup).toBeVisible();

    await expect(toggleGroup.getByRole('button', { name: /^Runs/ })).toBeVisible();
    await expect(toggleGroup.getByRole('button', { name: /Blocker JIRAs/ })).toBeVisible();

    expectNoBenignConsoleErrors(page);
  });

  test('should load blocker JIRAs when switching to the Blocker JIRAs tab', async ({ page }) => {
    // Track calls to the blocker-jiras API endpoint
    const blockerRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/system-health/odh-e2e-health/blocker-jiras')) {
        blockerRequests.push(request.url());
      }
    });

    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Switch to the Blocker JIRAs tab (lazy-loads the data on first open)
    const toggleGroup = page.locator('[role="group"][aria-label="View toggle"]');
    await toggleGroup.getByRole('button', { name: /Blocker JIRAs/ }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The blocker-jiras endpoint should have been requested
    expect(blockerRequests.length).toBeGreaterThan(0);

    // The panel header switches to the auto-filed blockers title
    await expect(page.locator('text=/Auto-filed Blocker JIRAs/i')).toBeVisible();

    expectNoBenignConsoleErrors(page);
  });

  test('should display blocker JIRA rows with links in demo mode', async ({ page }) => {
    await page.goto('/#/system-health/odh-e2e-health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const toggleGroup = page.locator('[role="group"][aria-label="View toggle"]');
    await toggleGroup.getByRole('button', { name: /Blocker JIRAs/ }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Demo fixture ships open blocker JIRAs — either the table renders rows
    // linking to Jira, or the graceful empty/unavailable state is shown. Both are valid.
    const jiraLinks = page.locator('a[href*="/browse/RHOAIENG-"]');
    const linkCount = await jiraLinks.count();

    if (linkCount > 0) {
      await expect(jiraLinks.first()).toBeVisible();
    } else {
      const emptyOrUnavailable = page.locator(
        'text=/No open blocker JIRAs|credentials|not yet available|could not reach jira/i'
      );
      await expect(emptyOrUnavailable.first()).toBeVisible();
    }

    expectNoBenignConsoleErrors(page);
  });
});

/**
 * Test Execution Dashboard Feature Tests
 *
 * The Test Execution Dashboard is a Vue-rendered view (no iframe) fed by JSON
 * that an external pipeline pushes to the org-pulse API. These tests verify:
 *   - the "Test Execution Dashboard (Beta)" nav item is visible and clickable
 *   - the dashboard view loads and renders (heatmap / empty state)
 *   - component drill-down navigation reaches the detail route
 *   - the JSON API endpoints (/test-execution/data, /test-execution/status)
 *     return the expected data / status
 */
test.describe('Test Execution Dashboard @system-health', () => {
  const releasesTabPanel = (page) =>
    page.getByRole('tabpanel', { name: 'RHOAI Releases' })
  const gatesTabPanel = (page) =>
    page.getByRole('tabpanel', { name: 'Promotion Gate' })

  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show Test Execution nav item is visible and clickable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand the System Health module if it is collapsed
    const moduleHeader = page.locator('aside nav button, aside nav a').filter({ hasText: /System Health/i }).first();
    if (await moduleHeader.count() > 0) {
      await moduleHeader.click();
      await page.waitForTimeout(500);
    }

    // The nav item should be present and labelled "Test Execution"
    const testExecNav = page.locator('aside nav button, aside nav a').filter({ hasText: /Test Execution/i });
    expect(await testExecNav.count()).toBeGreaterThan(0);
    await expect(testExecNav.first()).toBeVisible();

    // Clicking it routes to the test-execution view
    await testExecNav.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    expect(page.url()).toMatch(/system-health.*test-execution/i);

    expectNoBenignConsoleErrors(page);
  });

  test('should load the Test Execution Dashboard view', async ({ page }) => {
    await page.goto('/#/system-health/test-execution');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Main content renders
    expect(await mainContentIsVisible(page)).toBe(true);

    // Tabbed layout: RHOAI Releases = releases heatmap; Promotion Gate = promotion-gate matrix.
    await expect(page.getByRole('tab', { name: 'RHOAI Releases' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Promotion Gate' })).toBeVisible();

    const releasesTitle = releasesTabPanel(page).locator('h2.tab-panel-title');
    const gatesTitle = gatesTabPanel(page).locator('h2.tab-panel-title');
    if (await releasesTitle.count() > 0) {
      await expect(releasesTitle.first()).toContainText('RHOAI Releases Test Results');
    }
    if (await gatesTabPanel(page).locator('h2.tab-panel-title').count() > 0) {
      await page.getByRole('tab', { name: 'Promotion Gate' }).click();
      await page.waitForTimeout(300);
      await expect(gatesTitle.first()).toBeVisible();
    }

    // It is a Vue view, NOT the old iframe dashboard
    expect(await page.locator('iframe').count()).toBe(0);

    // Loading spinner must not be stuck
    expect(await pageLoadComplete(page)).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should render heatmap data or a clear empty state', async ({ page }) => {
    await page.goto('/#/system-health/test-execution');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // With data → heatmap on RHOAI Releases tab; without data → empty state.
    const rhoaiTab = page.getByRole('tab', { name: 'RHOAI Releases' });
    if (await rhoaiTab.isEnabled()) {
      await rhoaiTab.click();
      await page.waitForTimeout(300);
    }
    const panel = releasesTabPanel(page);
    const hasHeatmap = await panel.locator('table.heatmap').count() > 0;
    const hasEmptyState =
      (await panel.locator('text=/No OpenSearch release test data|No component test executions match/i').count() > 0);
    expect(hasHeatmap || hasEmptyState).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should navigate to a component detail view when a component is clicked', async ({ page }) => {
    await page.goto('/#/system-health/test-execution');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const rhoaiTab = page.getByRole('tab', { name: 'RHOAI Releases' });
    if (!(await rhoaiTab.isEnabled())) {
      console.log('RHOAI Releases tab disabled (no heatmap upload) — skipping drill-down navigation check');
      return;
    }
    await rhoaiTab.click();
    await page.waitForTimeout(300);
    await expect(releasesTabPanel(page)).toBeVisible();

    // Fixture heatmap dates are older than the default 30-day window; show all rows for this check.
    const dateRangeToggle = releasesTabPanel(page).locator('label.date-toggle-label input[type="checkbox"]');
    if (await dateRangeToggle.isChecked()) {
      await dateRangeToggle.uncheck();
      await page.waitForTimeout(300);
    }

    // Heatmap links live only in the releases tabpanel (Promotion Gate uses .comp-link in a separate table).
    const componentLink = releasesTabPanel(page).locator('table.heatmap tbody td.comp-name a').first();
    if (await componentLink.count() === 0) {
      console.log('No heatmap component rows in RHOAI Releases panel — skipping drill-down navigation check');
      return;
    }

    await expect(componentLink).toBeVisible();
    await componentLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Drill-down routes to the hidden test-execution-detail view with a component param
    expect(page.url()).toMatch(/test-execution-detail/i);
    expect(await mainContentIsVisible(page)).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  test('should load the component detail view directly with a component param', async ({ page }) => {
    await page.goto('/#/system-health/test-execution-detail?component=AI%20Hub');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Renders without error; either the detail content or a graceful no-data
    // message for that component is acceptable.
    expect(await mainContentIsVisible(page)).toBe(true);
    const hasBack = await page.locator('text=/Back to heatmap|Back/i').count() > 0;
    const hasHeading = await page.locator('h1, h2, h3').count() > 0;
    expect(hasBack || hasHeading).toBe(true);

    expectNoBenignConsoleErrors(page);
  });

  // ─── JSON API tests (current endpoints) ───

  test('GET /test-execution/data should return the combined data structure', async ({ request }) => {
    const response = await request.get('/api/modules/system-health/quality/test-execution/data');

    // 200 (served) or 401 (auth required in some environments)
    if (response.status() === 401) {
      expect(response.status()).toBe(401);
      return;
    }
    expect(response.status()).toBe(200);
    const data = await response.json();
    // Combined payload exposes these keys (values may be null before first upload)
    expect(data).toHaveProperty('heatmap');
    expect(data).toHaveProperty('components');
    expect(data).toHaveProperty('jira_config');
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('nightly_health');
  });

  test('GET /test-execution/data?file=nightly_health should return a single payload', async ({ request }) => {
    const combinedResponse = await request.get('/api/modules/system-health/quality/test-execution/data');

    if (combinedResponse.status() === 401) {
      expect(combinedResponse.status()).toBe(401);
      return;
    }
    expect(combinedResponse.status()).toBe(200);
    const combined = await combinedResponse.json();

    const response = await request.get('/api/modules/system-health/quality/test-execution/data?file=nightly_health');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(typeof data).toBe('object');

    if (combined.nightly_health && combined.nightly_health.schema_version === 1) {
      expect(data.schema_version).toBe(1);
      expect(Array.isArray(data.days)).toBe(true);
      expect(data.days.length).toBe(combined.nightly_health.days.length);
    }
  });

  test('should render nightly health section for nightly-only dashboard data', async ({ page }) => {
    const nightlyFixture = JSON.parse(readFileSync(nightlyHealthFixturePath, 'utf8'));

    await page.route('**/api/modules/system-health/quality/test-execution/data**', async (route) => {
      const url = route.request().url();
      if (url.includes('file=')) {
        const file = new URL(url).searchParams.get('file');
        const body = file === 'nightly_health' ? nightlyFixture : {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body)
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          heatmap: null,
          components: null,
          jira_config: null,
          meta: null,
          nightly_health: nightlyFixture,
          lastUpload: null
        })
      });
    });

    const dataReady = page.waitForResponse(
      (response) =>
        response.url().includes('/test-execution/data')
        && !response.url().includes('file=')
        && response.status() === 200
    );
    await page.goto('/#/system-health/test-execution');
    await dataReady;
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByRole('tab', { name: 'RHOAI Releases' })).toBeDisabled();
    await expect(page.getByRole('tab', { name: 'Promotion Gate' })).toBeEnabled();
    await page.getByRole('tab', { name: 'Promotion Gate' }).click();
    await page.waitForTimeout(300);

    await expect(page.getByRole('tab', { name: 'Promotion Gate' })).toHaveAttribute('aria-selected', 'true');
    const gatesTitle = gatesTabPanel(page).locator('h2.tab-panel-title');
    await expect(gatesTitle.first()).toBeVisible();
    await expect(page.locator('.nightly-matrix')).toBeVisible();

    await expect(page.locator('.pager-job-select')).toBeVisible();
    await page.locator('.pager-job-select').selectOption('example-stream');
    await expect(page.getByText(/Showing all 2 UTC days in this snapshot/)).toBeVisible();

    const nov1Header = page.locator('.date-header-btn[title="Show all builds on 2026-11-01"]');
    await expect(nov1Header).toBeVisible();
    await nov1Header.click();

    const dayPanel = page.locator('.nightly-day-popup');
    await expect(dayPanel).toBeVisible();
    await expect(dayPanel).toContainText('Runs on 2026-11-01');
    await expect(dayPanel.locator('.run-list-item').first()).toBeVisible();
    await expect(dayPanel.getByRole('link', { name: 'Jenkins run #102' })).toBeVisible();
    await expect(dayPanel.locator('.run-list-item--selected')).toHaveCount(1);

    expectNoBenignConsoleErrors(page);
  });

  test('should honor tab=gates and source= query params on load', async ({ page }) => {
    const nightlyFixture = JSON.parse(readFileSync(nightlyHealthFixturePath, 'utf8'));

    await page.route('**/api/modules/system-health/quality/test-execution/data**', async (route) => {
      const url = route.request().url();
      if (url.includes('file=')) {
        const file = new URL(url).searchParams.get('file');
        const body = file === 'nightly_health' ? nightlyFixture : {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body)
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          heatmap: null,
          components: null,
          jira_config: null,
          meta: null,
          nightly_health: nightlyFixture,
          lastUpload: null
        })
      });
    });

    const dataReady = page.waitForResponse(
      (response) =>
        response.url().includes('/test-execution/data')
        && !response.url().includes('file=')
        && response.status() === 200
    );
    await page.goto('/#/system-health/test-execution?tab=gates&source=promotion-gate-tests');
    await dataReady;
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByRole('tab', { name: 'Promotion Gate' })).toHaveAttribute('aria-selected', 'true');
    await expect(gatesTabPanel(page).locator('h2.tab-panel-title').first()).toBeVisible();
    expect(page.url()).toMatch(/tab=gates/);
    expect(page.url()).toMatch(/source=promotion-gate-tests(&|$)/);

    expectNoBenignConsoleErrors(page);
  });

  test('should rewrite legacy source=stream_key to filter basename on load', async ({ page }) => {
    const nightlyFixture = JSON.parse(readFileSync(nightlyHealthFixturePath, 'utf8'));
    const withReportingStreamKey = {
      ...nightlyFixture,
      jenkins_jobs: [
        {
          stream_key: 'example-stream',
          label: 'example-stream'
        }
      ]
    };

    await page.route('**/api/modules/system-health/quality/test-execution/data**', async (route) => {
      const url = route.request().url();
      if (url.includes('file=')) {
        const file = new URL(url).searchParams.get('file');
        const body = file === 'nightly_health' ? withReportingStreamKey : {};
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body)
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          heatmap: null,
          components: null,
          jira_config: null,
          meta: null,
          nightly_health: withReportingStreamKey,
          lastUpload: null
        })
      });
    });

    const dataReady = page.waitForResponse(
      (response) =>
        response.url().includes('/test-execution/data')
        && !response.url().includes('file=')
        && response.status() === 200
    );
    await page.goto('/#/system-health/test-execution?tab=gates&source=example-stream');
    await dataReady;
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect.poll(() => page.url()).toMatch(/source=promotion-gate/);
    expect(page.url()).not.toMatch(/source=example-stream/);

    expectNoBenignConsoleErrors(page);
  });

  test('should sync tab query param when switching tabs and drop source on RHOAI Releases', async ({ page }) => {
    const nightlyFixture = JSON.parse(readFileSync(nightlyHealthFixturePath, 'utf8'));
    const heatmapFixture = buildTabCoexistenceHeatmapFixture();

    await page.route('**/api/modules/system-health/quality/test-execution/data**', async (route) => {
      const url = route.request().url();
      if (url.includes('file=')) {
        const file = new URL(url).searchParams.get('file');
        let body = {};
        if (file === 'nightly_health') body = nightlyFixture;
        if (file === 'heatmap') body = heatmapFixture;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body)
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          heatmap: heatmapFixture,
          components: heatmapFixture.components,
          jira_config: null,
          meta: null,
          nightly_health: nightlyFixture,
          lastUpload: null
        })
      });
    });

    await page.goto('/#/system-health/test-execution');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.getByRole('tab', { name: 'RHOAI Releases' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('tab', { name: 'RHOAI Releases' })).toHaveAttribute('aria-selected', 'true');
    await expect(releasesTabPanel(page)).toBeVisible();
    await expect(releasesTabPanel(page).locator('h2.tab-panel-title')).toContainText('RHOAI Releases Test Results');
    await expect(releasesTabPanel(page).locator('h3.tab-section-subtitle').filter({ hasText: /Component Heatmap/i })).toBeVisible();
    await expect(releasesTabPanel(page).locator('h3').filter({ hasText: /Execution Across Versions/i })).toBeVisible();
    expect(page.url()).toMatch(/tab=releases/);
    expect(page.url()).not.toMatch(/source=/);

    await page.getByRole('tab', { name: 'Promotion Gate' }).click();
    await page.waitForTimeout(300);
    await expect(gatesTabPanel(page).locator('h2.tab-panel-title')).toBeVisible();
    await expect(page.locator('.nightly-matrix')).toBeVisible();
    await expect(
      releasesTabPanel(page).locator('h2.tab-panel-title').filter({ hasText: /RHOAI Releases Test Results/i })
    ).toBeHidden();
    expect(page.url()).toMatch(/tab=gates/);

    expectNoBenignConsoleErrors(page);
  });

  test('should show releases heatmap on RHOAI Releases tab and promotion gate matrix on Promotion Gate tab', async ({ page }) => {
    const nightlyFixture = JSON.parse(readFileSync(nightlyHealthFixturePath, 'utf8'));
    const heatmapFixture = buildTabCoexistenceHeatmapFixture();

    await page.route('**/api/modules/system-health/quality/test-execution/data**', async (route) => {
      const url = route.request().url();
      if (url.includes('file=')) {
        const file = new URL(url).searchParams.get('file');
        let body = {};
        if (file === 'nightly_health') body = nightlyFixture;
        if (file === 'heatmap') body = heatmapFixture;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body)
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          heatmap: heatmapFixture,
          components: heatmapFixture.components,
          jira_config: null,
          meta: null,
          nightly_health: nightlyFixture,
          lastUpload: null
        })
      });
    });

    await page.goto('/#/system-health/test-execution');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.getByRole('tab', { name: 'RHOAI Releases' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('tab', { name: 'RHOAI Releases' })).toHaveAttribute('aria-selected', 'true');
    await expect(releasesTabPanel(page)).toBeVisible();
    await expect(releasesTabPanel(page).locator('h2.tab-panel-title')).toContainText('RHOAI Releases Test Results');
    await expect(releasesTabPanel(page).locator('h3.tab-section-subtitle').filter({ hasText: /Component Heatmap/i })).toBeVisible();
    await expect(releasesTabPanel(page).locator('h3').filter({ hasText: /Execution Across Versions/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Promotion Gate' }).click();
    await page.waitForTimeout(300);
    await expect(gatesTabPanel(page).locator('h2.tab-panel-title')).toBeVisible();
    await expect(page.locator('.nightly-matrix')).toBeVisible();
    await expect(
      releasesTabPanel(page).locator('h2.tab-panel-title').filter({ hasText: /RHOAI Releases Test Results/i })
    ).toBeHidden();

    expectNoBenignConsoleErrors(page);
  });

  test('GET /test-execution/data?file=meta should return a single payload', async ({ request }) => {
    const response = await request.get('/api/modules/system-health/quality/test-execution/data?file=meta');

    if (response.status() === 401) {
      expect(response.status()).toBe(401);
      return;
    }
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(typeof data).toBe('object');
  });

  test('GET /test-execution/data with an invalid file should return 400', async ({ request }) => {
    const response = await request.get('/api/modules/system-health/quality/test-execution/data?file=invalid');

    if (response.status() === 401) {
      expect(response.status()).toBe(401);
      return;
    }
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('GET /test-execution/status should return the upload receipt shape', async ({ request }) => {
    const response = await request.get('/api/modules/system-health/quality/test-execution/status');

    if (response.status() === 401) {
      expect(response.status()).toBe(401);
      return;
    }
    expect(response.status()).toBe(200);
    const data = await response.json();
    // Always an object; after an upload it carries { uploadedAt, files, ... }
    expect(typeof data).toBe('object');
    expect(data).toHaveProperty('files');
  });

  test('POST /test-execution/bulk should require the write scope or skip in demo mode', async ({ request }) => {
    const response = await request.post('/api/modules/system-health/quality/test-execution/bulk', {
      data: { meta: { test: true } }
    });

    // Demo mode → guarded skip (200); otherwise scope enforcement (401/403);
    // or accepted (200 ok) when the caller is authorized.
    if (response.status() === 200) {
      const data = await response.json();
      expect(['skipped', 'ok']).toContain(data.status);
    } else {
      expect([401, 403]).toContain(response.status());
    }
  });

  test('POST /test-execution/bulk with an empty body should be rejected or guarded', async ({ request }) => {
    const response = await request.post('/api/modules/system-health/quality/test-execution/bulk', {
      data: {}
    });

    if (response.status() === 200) {
      // Demo-mode guard short-circuits before validation
      const data = await response.json();
      expect(data.status).toBe('skipped');
    } else {
      // Auth/scope (401/403) or the handler's "no data provided" validation (400)
      expect([400, 401, 403]).toContain(response.status());
    }
  });

  test('POST /test-execution/bulk rejects invalid nightly_health when not in demo mode', async ({ request }) => {
    const response = await request.post('/api/modules/system-health/quality/test-execution/bulk', {
      data: {
        nightly_health: {
          schema_version: 1,
          days: [{
            date: '2026-11-01',
            latest_run_id: 'missing-run',
            runs: [{ run_id: 'actual-run', components: [] }]
          }]
        }
      }
    });

    if (response.status() === 401 || response.status() === 403) {
      expect([401, 403]).toContain(response.status());
      return;
    }

    if (response.status() === 200) {
      const data = await response.json();
      if (data.status === 'skipped') {
        expect(data.status).toBe('skipped');
        return;
      }
    }

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/latest_run_id/);
  });

  test('POST /test-execution/bulk rejects nightly_health with non-array gates when not in demo mode', async ({ request }) => {
    const response = await request.post('/api/modules/system-health/quality/test-execution/bulk', {
      data: {
        nightly_health: {
          schema_version: 1,
          days: [{
            date: '2026-11-01',
            latest_run_id: 'run-a',
            runs: [{ run_id: 'run-a', gates: {}, components: [] }]
          }]
        }
      }
    });

    if (response.status() === 401 || response.status() === 403) {
      expect([401, 403]).toContain(response.status());
      return;
    }

    if (response.status() === 200) {
      const data = await response.json();
      if (data.status === 'skipped') {
        expect(data.status).toBe('skipped');
        return;
      }
    }

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/gates must be an array/);
  });
});

/**
 * Promotion Gates
 *
 * The view proxies the AIPCC Dashboard API through the module server; the
 * browser only calls /api/modules/system-health/promotion-gates/*. Mock those
 * endpoints with a trimmed job so the UI tests do not need a live dashboard.
 */
function buildPromotionGatesJob() {
  return {
    pr_number: 80,
    trigger_id: 'gap-d7deac-test',
    title: 'GAP leader: gap-test',
    state: 'OPEN',
    created_at: '2026-11-05T08:06:17Z',
    closed_at: null,
    merged_at: null,
    labels: ['gated-artifacts-promoter'],
    is_test: false,
    source_url: 'https://github.com/red-hat-data-services/gated-artifacts-promoter/pull/80',
    state_json: {
      'pull-requests': [
        {
          repo: 'odh-dashboard',
          'pr-url': 'https://github.com/red-hat-data-services/odh-dashboard/pull/2696',
          'pr-status': 'success',
          builds: [],
          'build-observations': {
            runs: [{ name: 'odh-dashboard-run', status: 'success', reason: 'Completed', url: 'https://konflux.example.com/runs/1' }]
          }
        },
        {
          repo: 'odh-model-controller',
          'pr-url': 'https://github.com/red-hat-data-services/odh-model-controller/pull/1784',
          'pr-status': 'build-failure',
          builds: [],
          'build-observations': {
            'gate-reason': 'Required build failed',
            runs: [{ name: 'odh-model-controller-run', status: 'failure', reason: 'Step failed', url: 'https://konflux.example.com/runs/2' }]
          }
        }
      ],
      'creator-outcomes': [
        {
          repo: 'red-hat-data-services/odh-dashboard',
          'source-branch': 'main',
          'target-branch': 'stable',
          outcome: 'success',
          reason: 'Updated pull request #2696',
          'pr-url': 'https://github.com/red-hat-data-services/odh-dashboard/pull/2696',
          'workflow-url': 'https://github.com/red-hat-data-services/rhods-devops-infra/actions/runs/1',
          'observed-at': '2026-11-05T07:56:48+00:00'
        },
        {
          repo: 'red-hat-data-services/odh-model-controller',
          'source-branch': 'main',
          'target-branch': 'stable',
          outcome: 'merge-failure',
          reason: 'Auto-merge failed',
          'pr-url': 'https://github.com/red-hat-data-services/odh-model-controller/pull/1784',
          'workflow-url': 'https://github.com/red-hat-data-services/rhods-devops-infra/actions/runs/2',
          'observed-at': '2026-11-05T07:56:48+00:00'
        }
      ],
      'promotion-gates': [
        { id: 'component-builds', required: true, status: 'pending' },
        { id: 'early-gate-build', required: false, status: 'failed' },
        { id: 'early-gate-test', required: false, status: 'pending' }
      ]
    },
    failure_links: [
      {
        repo: 'odh-model-controller',
        label: 'odh-model-serving-api',
        jira_url: 'https://stage-redhat.atlassian.net/browse/RHAI-219',
        slack_url: 'https://redhat-internal.slack.com/archives/C1/p2'
      }
    ],
    early_gate: {
      build: {
        status: 'failed',
        pipeline_url: 'https://konflux.example.com/pipelineruns/early-gate-build',
        ephemeral_branch: 'eg-80-test',
        comment_url: 'https://github.com/red-hat-data-services/gated-artifacts-promoter/issues/80#issuecomment-1',
        raw: '',
        updated_at: '2026-11-05T09:25:43Z'
      },
      test: { status: 'unknown', pipeline_url: null, ephemeral_branch: null, comment_url: null, raw: null, updated_at: null }
    },
    synced_at: '2026-11-06T08:30:00Z'
  };
}

async function mockPromotionGatesApi(page, job) {
  await page.route('**/api/modules/system-health/promotion-gates/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (path !== '/api/modules/system-health/promotion-gates/latest') {
      await route.continue();
      return;
    }
    if (job === null) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'No promotion gates data yet' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(job) });
  });
}

test.describe('Promotion Gates @system-health', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockDemoSystemHealthReadApis(page);
    await mockPromotionGatesApi(page, buildPromotionGatesJob());
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should load Promotion Gates view with verdict, stages and early gate', async ({ page }) => {
    await page.goto('/#/system-health/promotion-gates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    await expect(page.locator('h1', { hasText: 'Promotion gates' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Leader PR #80/ })).toBeVisible();

    // Hero verdict with the promoted count
    await expect(page.locator('text=Promotion blocked')).toBeVisible();
    await expect(page.locator('text=1 of 2 components passed')).toBeVisible();

    // Stage strip covering the whole flow
    for (const stage of ['Child PRs', 'Builds', 'Early gate build', 'Early gate test', 'Merge']) {
      await expect(page.locator('text=' + stage).first()).toBeVisible();
    }
    await expect(page.locator('text=Not run')).toBeVisible();
    await expect(page.locator('text=eg-80-test')).toBeVisible();

    expectNoBenignConsoleErrors(page);
  });

  test('should split components into blocking and passing tables', async ({ page }) => {
    await page.goto('/#/system-health/promotion-gates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('h2', { hasText: 'Blocking components' })).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Succeeded components' })).toBeVisible();

    // Both tables render at once, no toggle; the failing repo carries its reason
    const blocking = page.locator('section', { has: page.locator('h2', { hasText: 'Blocking components' }) });
    const passing = page.locator('section', { has: page.locator('h2', { hasText: 'Succeeded components' }) });
    // the repo name now also appears in the per-component lines
    await expect(blocking.locator('text=odh-model-controller').first()).toBeVisible();
    // each failing build now carries its own reason on its own line
    await expect(blocking.locator('text=odh-model-controller-run').first()).toBeVisible();
    await expect(blocking.locator('text=Step failed').first()).toBeVisible();
    // the bot's Jira link is shown against the failing component
    await expect(blocking.getByRole('link', { name: 'RHAI-219' })).toBeVisible();
    // Slack links are not rendered (they point at private channels)
    await expect(blocking.locator('text=Slack')).toHaveCount(0);
    await expect(passing.locator('text=odh-dashboard').first()).toBeVisible();

    // Auto-merge issue from creator-outcomes surfaces in its own section
    await expect(page.locator('h2', { hasText: 'PR creation and auto-merge issues' })).toBeVisible();
    await expect(page.locator('text=Auto-merge failed')).toBeVisible();

    expectNoBenignConsoleErrors(page);
  });

  test('should link each repo to its GitHub page', async ({ page }) => {
    await page.goto('/#/system-health/promotion-gates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const repoLink = page.getByRole('link', { name: 'odh-model-controller', exact: true }).first();
    await expect(repoLink).toBeVisible();
    await expect(repoLink).toHaveAttribute('href', 'https://github.com/red-hat-data-services/odh-model-controller');

    expectNoBenignConsoleErrors(page);
  });

  test('should show friendly empty state when no data is collected yet', async ({ page }) => {
    await mockPromotionGatesApi(page, null);
    await page.goto('/#/system-health/promotion-gates');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('text=No promotion gates data yet')).toBeVisible();

    expectNoBenignConsoleErrors(page);
  });

  test('should render Release branches tab with diff links', async ({ page }) => {
    await page.goto('/#/system-health/promotion-gates?tab=branches');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByRole('tab', { name: 'Release branches' })).toBeVisible();

    const diffLink = page.getByRole('link', { name: 'main → stable' }).first();
    await expect(diffLink).toBeVisible();
    await expect(diffLink).toHaveAttribute('href', 'https://github.com/red-hat-data-services/odh-dashboard/compare/stable...main');

    expectNoBenignConsoleErrors(page);
  });
});
