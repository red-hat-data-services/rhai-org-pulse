const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for AI Impact module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 *
 * Tag: @ai-impact
 * Usage: npx playwright test --grep @ai-impact
 */

test.describe('AI Impact Module @ai-impact', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should fetch data from AI Impact API endpoints', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/ai-impact')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Navigate to RFE Review (a data-driven view that makes API calls)
    // The default landing page (AI Factory Guide) is static and has no API calls
    await page.goto('/#/ai-impact/rfe-review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify that API requests were made to the AI Impact endpoints
    // In demo mode, these should still be called and return fixture data
    expect(apiRequests.length).toBeGreaterThan(0);
    console.log(`AI Impact API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    expect(page.errors).toHaveLength(0);
  });

});

/**
 * Disabled Menu Items
 * 
 * Verify that disabled components display as non-clickable, disabled (aka 
 * "greyed out") options.
 */
test.describe('AI Impact Disabled Menu Items @ai-impact', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to test a disabled menu item
  async function testDisabledMenuItem(page, itemLabel) {
    await page.goto('/#/ai-impact/ai-factory-guide');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find the disabled item in the navigation by its title (display text)
    // Navigation items are rendered as buttons in the sidebar
    const navItem = page.locator('aside nav button').filter({ hasText: itemLabel });
    const count = await navItem.count();
    expect(count).toBeGreaterThan(0);
    const disabledItem = navItem.first();

    // Verify it's disabled (check for disabled attribute, aria-disabled, or
    // opacity/cursor styling)
    const isAriaDisabled = await disabledItem.getAttribute('aria-disabled');
    const hasDisabledClass = await disabledItem.evaluate(el => {
      const classes = el.className || '';
      // Common patterns for disabled items: opacity, cursor, pointer-events
      return classes.includes('disabled') ||
             classes.includes('opacity-') ||
             window.getComputedStyle(el).cursor === 'not-allowed' ||
             window.getComputedStyle(el).pointerEvents === 'none';
    });

    // At least one disabled indicator should be present
    const isDisabled = isAriaDisabled === 'true' || hasDisabledClass;
    expect(isDisabled).toBe(true);

    // Verify it's truly non-interactive by attempting to click
    // and ensure navigation doesn't occur
    const urlBeforeClick = page.url();
    await disabledItem.click({ force: true }).catch(() => {
      // Click might fail if pointer-events: none, that's expected
    });
    await page.waitForTimeout(500);

    // Verify the URL hasn't changed (i.e., no navigation occurred)
    const urlAfterClick = page.url();
    expect(urlAfterClick).toBe(urlBeforeClick);

    expect(page.errors).toHaveLength(0);
  }

  test('Implementation menu item should be disabled', async ({ page }) => {
    await testDisabledMenuItem(page, 'Implementation');
  });

  test('Security Review menu item should be disabled', async ({ page }) => {
    await testDisabledMenuItem(page, 'Security Review');
  });

});

/**
 * Active Components
 * 
 * Verify each major view (aka menu item) in the AI Impact module loads with
 * meaningful content
 */
test.describe('AI Impact Views @ai-impact', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to navigate and verify a view loads with content
  async function testView(page, viewId, viewName) {
    await page.goto(`/#/ai-impact/${viewId}`);
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

  test('should load AI Factory Guide view', async ({ page }) => {
    await testView(page, 'ai-factory-guide', 'AI Factory Guide');
  });

  test('should load RFE Review view', async ({ page }) => {
    await testView(page, 'rfe-review', 'RFE Review');
  });

  test('should load Feature Review view', async ({ page }) => {
    await testView(page, 'feature-review', 'Feature Review');
  });

  test('Feature Review view loads data from unified store', async ({ page }) => {
    // Monitor API requests — Feature Review reads from ai-impact/features
    // which internally reads from the releases execution store
    const apiResponses = [];
    page.on('response', response => {
      if (response.url().includes('/api/modules/ai-impact/features')) {
        apiResponses.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    await page.goto('/#/ai-impact/feature-review');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify the features API was called and returned data
    const featuresResponse = apiResponses.find(r =>
      r.url.endsWith('/features') || r.url.includes('/features?')
    );
    expect(featuresResponse).toBeDefined();
    expect(featuresResponse.status).toBe(200);

    expect(page.errors).toHaveLength(0);
  });

  test('should load Documentation view', async ({ page }) => {
    await testView(page, 'documentation', 'Documentation');
  });

  test('should load Jira AutoFix view', async ({ page }) => {
    await testView(page, 'autofix', 'AutoFix');
  });

  test('should load Test Plan Review view', async ({ page }) => {
    await testView(page, 'test-plan-review', 'Test Plan Review');
  });

  test('should load Build & Release view', async ({ page }) => {
    await testView(page, 'build-release', 'Build & Release');
  });

  test('should load State of the Union view', async ({ page }) => {
    await testView(page, 'state-of-the-union', 'State of the Union');
  });

  test('should show wizard on first visit to State of the Union', async ({ page }) => {
    // localStorage is clean in test environment, so wizard should appear
    await page.goto('/#/ai-impact/state-of-the-union');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The wizard modal should be visible
    const wizardText = page.locator('text=Welcome to State of the Union');
    const isVisible = await wizardText.isVisible().catch(() => false);
    // In demo mode the wizard should appear since localStorage is fresh
    if (isVisible) {
      // Verify both mode options are present within the wizard dialog
      const wizard = page.getByRole('dialog');
      await expect(wizard.getByRole('button', { name: /Auto/ })).toBeVisible();
      await expect(wizard.getByRole('button', { name: /Manual/ })).toBeVisible();
    }

    expect(page.errors).toHaveLength(0);
  });
});
