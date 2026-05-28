const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible, countDisabledNavItems } = require('./helpers');

/**
 * Integration tests for People & Teams module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 *
 * Tag: @people-teams
 * Usage: npx playwright test --grep @people-teams
 */

test.describe('People & Teams Module @people-teams', () => {
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

    // Find the People & Teams module in the sidebar
    const moduleNav = page.locator('aside nav').filter({ hasText: 'People & Teams' });
    const count = await moduleNav.count();
    expect(count).toBeGreaterThan(0);

    // Verify the module link is visible and clickable
    const moduleLink = moduleNav.first();
    await expect(moduleLink).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should navigate to People & Teams module when clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand the People & Teams module section if it's collapsed
    const moduleHeader = page.locator('aside nav button').filter({ hasText: 'People & Teams' }).first();
    await moduleHeader.click();
    await page.waitForTimeout(500);

    // Click on the "Team Directory" view (default view)
    const viewLink = page.locator('aside nav button').filter({ hasText: 'Team Directory' }).first();
    await viewLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify URL changed to team-tracker module (default view is home)
    expect(page.url()).toMatch(/team-tracker\/home/);

    // Verify main content is visible
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('should fetch data from People & Teams API endpoints', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/team-tracker')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Navigate to Team Directory (makes API calls for teams and people)
    await page.goto('/#/team-tracker/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify that API requests were made to the team-tracker endpoints
    // In demo mode, these should still be called and return fixture data
    expect(apiRequests.length).toBeGreaterThan(0);
    console.log(`People & Teams API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    expect(page.errors).toHaveLength(0);
  });
});

/**
 * Disabled Menu Items
 *
 * Verify that People & Teams has no disabled menu items in the
 * publicly visible navigation (excluding role-gated items).
 */
test.describe('People & Teams Disabled Menu Items @people-teams', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should have no disabled menu items', async ({ page }) => {
    await page.goto('/#/team-tracker/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Count disabled navigation items within the People & Teams section only
    const disabledCount = await countDisabledNavItems(page, 'People & Teams');

    // People & Teams module should have no disabled menu items
    expect(disabledCount).toBe(0);
    expect(page.errors).toHaveLength(0);
  });
});

/**
 * Active Components
 *
 * Verify each major view (aka menu item) in the People & Teams module loads
 * with meaningful content.
 *
 * Note: "My Teams" and "Manage" views require specific roles (manager,
 * team-admin) and are not tested here since demo mode runs unauthenticated.
 */
test.describe('People & Teams Views @people-teams', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to navigate and verify a view loads with content
  async function testView(page, viewId, viewName) {
    await page.goto(`/#/team-tracker/${viewId}`);
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

  test('should load Team Directory view', async ({ page }) => {
    await testView(page, 'home', 'Team Directory');
  });

  test('should load People view', async ({ page }) => {
    await testView(page, 'people', 'People');
  });

  test('should load Reports view', async ({ page }) => {
    await testView(page, 'reports', 'Reports');
  });

  test('should load Org Dashboard view', async ({ page }) => {
    await testView(page, 'org-dashboard', 'Org Dashboard');
  });
});

/**
 * People Directory
 *
 * Verify the People Directory view shows roster data from fixtures
 */
test.describe('People & Teams People Directory @people-teams', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should display people from registry', async ({ page }) => {
    await page.goto('/#/team-tracker/people');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The people directory should render a list or table of people
    // from the fixture registry (which has 13 people)
    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    // Look for name-bearing elements — the fixture data includes
    // names like "Alice Chen", "Bob Smith", etc.
    const bodyText = await page.locator('main, [role="main"], .min-h-screen').first().textContent();
    const hasNames = bodyText.includes('Alice Chen') || bodyText.includes('Bob Smith');
    expect(hasNames).toBe(true);

    expect(page.errors).toHaveLength(0);
  });
});
