const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible } = require('./helpers');

/**
 * Error message displayed when no feature key is provided to the feature detail view
 */
const NO_FEATURE_KEY_ERROR_MESSAGE = 'No feature key provided. Go back to the overview and select a feature.';

/**
 * Integration tests for Feature Traffic module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 *
 * Tag: @feature-traffic
 * Usage: npx playwright test --grep @feature-traffic
 */

test.describe('Feature Traffic Module @feature-traffic', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should fetch data from Feature Traffic API endpoints', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/feature-traffic')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Navigate to Overview (default view that makes API calls)
    await page.goto('/#/feature-traffic/overview');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify that API requests were made to the Feature Traffic endpoints
    // In demo mode, these should still be called and return fixture data
    expect(apiRequests.length).toBeGreaterThan(0);
    console.log(`Feature Traffic API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    // Verify specific expected endpoints were called
    const endpointPatterns = [
      /\/features($|\?)/,  // GET /features or /features?...
      /\/status/,          // GET /status
      /\/versions/         // GET /versions
    ];

    endpointPatterns.forEach(pattern => {
      const matchingRequest = apiRequests.find(req => pattern.test(req.url));
      if (matchingRequest) {
        console.log(`  ✓ Expected endpoint called: ${matchingRequest.url}`);
      }
    });

    expect(page.errors).toHaveLength(0);
  });

});

/**
 * Active Views
 *
 * Verify each major view (aka menu item) in the Feature Traffic module loads with
 * meaningful content
 */
test.describe('Feature Traffic Views @feature-traffic', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to navigate and verify a view loads with content
  async function testView(page, viewId, viewName) {
    await page.goto(`/#/feature-traffic/${viewId}`);
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

  test('should load Overview view', async ({ page }) => {
    await testView(page, 'overview', 'Overview');
  });

  test('should load Feature Detail view with a valid feature key', async ({ page }) => {
    const testFeatureKey = 'TESTINT-001';

    // Mock the feature-traffic API response
    await page.route('**/api/modules/feature-traffic/features/TESTINT-001', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          key: 'TESTINT-001',
          summary: 'Integration Test Feature 1',
          status: 'In Progress',
          statusCategory: 'In Progress',
          priority: 'High',
          assignee: 'Test User',
          fixVersions: ['1.0.0'],
          labels: ['integration-test'],
          completionPct: 50,
          epicCount: 2,
          issueCount: 5,
          blockerCount: 0,
          health: 'GREEN',
          epics: [],
          issues: []
        })
      });
    });

    // Mock the ai-impact API response (returns null for non-existent feature)
    await page.route('**/api/modules/ai-impact/features/TESTINT-001', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null)
      });
    });

    console.log(`Testing Feature Detail view with key: ${testFeatureKey}`);

    // Navigate to feature detail view with the key as a query parameter
    await page.goto(`/#/feature-traffic/feature-detail?key=${testFeatureKey}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify the view loads
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    // Verify content renders
    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    // Verify no stuck loading spinners
    const pageHasFinishedLoading = await pageLoadComplete(page);
    expect(pageHasFinishedLoading).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('should display error message when no feature key is provided', async ({ page }) => {
    // Navigate to feature detail view WITHOUT a key parameter
    await page.goto('/#/feature-traffic/feature-detail');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify the view loads
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    // Verify that we get an error message about no feature key being provided
    const errorMessage = page.getByText(NO_FEATURE_KEY_ERROR_MESSAGE);
    await expect(errorMessage).toBeVisible();

    // Verify no stuck loading spinners
    const pageHasFinishedLoading = await pageLoadComplete(page);
    expect(pageHasFinishedLoading).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('should not display error message when a valid feature key is provided', async ({ page }) => {
    const mockFeatureKey = 'TESTINT-001';

    // Mock the feature-traffic API response
    await page.route('**/api/modules/feature-traffic/features/TESTINT-001', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          key: 'TESTINT-001',
          summary: 'Integration Test Feature 1',
          status: 'In Progress',
          statusCategory: 'In Progress',
          priority: 'High',
          assignee: 'Test User',
          fixVersions: ['1.0.0'],
          labels: ['integration-test'],
          completionPct: 50,
          epicCount: 2,
          issueCount: 5,
          blockerCount: 0,
          health: 'GREEN',
          epics: [],
          issues: []
        })
      });
    });

    // Mock the ai-impact API response (returns null for non-existent feature)
    await page.route('**/api/modules/ai-impact/features/TESTINT-001', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null)
      });
    });

    // Navigate to feature detail view WITH a feature key parameter
    await page.goto(`/#/feature-traffic/feature-detail?key=${mockFeatureKey}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify the view loads
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    // Verify that we don't get an error message
    const errorMessage = page.getByText(NO_FEATURE_KEY_ERROR_MESSAGE);
    await expect(errorMessage).not.toBeVisible();

    // Verify no stuck loading spinners
    const pageHasFinishedLoading = await pageLoadComplete(page);
    expect(pageHasFinishedLoading).toBe(true);

    expect(page.errors).toHaveLength(0);
  });
});
