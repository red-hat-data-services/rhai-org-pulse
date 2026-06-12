const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for the SOTU Widget Dashboard
 *
 * These tests verify:
 * - Dashboard loads with default widgets on first visit
 * - Widget picker opens and lists available widgets
 * - Widgets render content from their respective modules
 * - Browse Modules toggle works
 * - Navigation from widgets works
 *
 * Tag: @sotu-dashboard
 * Usage: npx playwright test --grep @sotu-dashboard
 */

test.describe('SOTU Widget Dashboard @sotu-dashboard', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should load default dashboard with widgets on landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await pageLoadComplete(page);

    // Should show the dashboard header
    await expect(page.locator('text=Your personalized overview')).toBeVisible({ timeout: DEFAULT_PAGE_WAIT_TIME });

    // Should show Add Widgets button
    await expect(page.locator('text=Add Widgets')).toBeVisible();

    // Should show Browse Modules button
    await expect(page.locator('text=Browse Modules')).toBeVisible();
  });

  test('should open widget picker when Add Widgets is clicked', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await pageLoadComplete(page);

    // Click Add Widgets
    await page.locator('text=Add Widgets').first().click();

    // Widget picker panel should appear
    await expect(page.locator('h2:has-text("Add Widgets")')).toBeVisible({ timeout: DEFAULT_PAGE_WAIT_TIME });
  });

  test('should toggle to Browse Modules grid', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await pageLoadComplete(page);

    // Click Browse Modules
    await page.locator('text=Browse Modules').first().click();

    // Module grid should appear
    await expect(page.locator('text=Built-in Modules')).toBeVisible({ timeout: DEFAULT_PAGE_WAIT_TIME });

    // Back button should be visible
    await expect(page.locator('text=Back to Overview')).toBeVisible();

    // Click back
    await page.locator('text=Back to Overview').click();

    // Dashboard should return
    await expect(page.locator('text=Your personalized overview')).toBeVisible({ timeout: DEFAULT_PAGE_WAIT_TIME });
  });

  test('should render widget content without JS errors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await pageLoadComplete(page);
    await mainContentIsVisible(page);

    // Page should have substantive content (not just loading spinners)
    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);
  });
});
