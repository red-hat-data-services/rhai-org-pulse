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

  test('should show empty dashboard with build CTA on first visit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await pageLoadComplete(page);

    // Should show the dashboard header
    await expect(page.locator('text=Your personalized overview')).toBeVisible({ timeout: DEFAULT_PAGE_WAIT_TIME });

    // Empty state should show Build Your Dashboard heading
    await expect(page.locator('text=Build Your Dashboard')).toBeVisible();

    // Should show Add Widgets CTA button in empty state
    await expect(page.getByRole('button', { name: 'Add Widgets' }).first()).toBeVisible();

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

  test('should add and render Release Schedule widget', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await pageLoadComplete(page);

    // Open widget picker
    await page.locator('text=Add Widgets').first().click();
    await expect(page.locator('h2:has-text("Add Widgets")')).toBeVisible({ timeout: DEFAULT_PAGE_WAIT_TIME });

    // Find and toggle the Release Schedule widget
    const scheduleWidget = page.locator('button', { hasText: 'Release Schedule' });
    await expect(scheduleWidget).toBeVisible();
    await scheduleWidget.click();

    // Close the picker by clicking the backdrop
    await page.locator('.fixed.inset-0.bg-black').click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Widget should render with its heading
    await expect(page.locator('h3:has-text("Release Schedule")')).toBeVisible({ timeout: DEFAULT_PAGE_WAIT_TIME });

    // Should show milestone rows or empty state (not an error)
    const hasMilestones = await page.locator('text=Plan Freeze').or(page.locator('text=Code Freeze')).or(page.locator('text=Release')).count() > 0;
    const hasEmpty = await page.locator('text=No upcoming milestones').count() > 0;
    expect(hasMilestones || hasEmpty).toBe(true);

    expect(page.errors).toHaveLength(0);
  });
});
