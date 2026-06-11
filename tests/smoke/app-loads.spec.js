const { test, expect } = require('@playwright/test');

/**
 * Comprehensive smoke tests for Org Pulse frontend
 *
 * These tests verify critical functionality:
 * - Application loads without JavaScript errors
 * - Core UI structure renders correctly
 * - Data/API integration works (no stuck loading states)
 * - Client-side routing functions properly
 */

test.describe('Frontend Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Keep track of test errors
    page.errors = [];

    // Listen for unhandled JavaScript exceptions
    page.on('pageerror', error => {
      page.errors.push({
        type: 'pageerror',
        message: error.message,
        stack: error.stack
      });
    });

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.errors.push({
          type: 'console.error',
          message: msg.text()
        });
      }
    });
  });

  test('should load without JavaScript errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Fail test if any unhandled errors occurred
    if (page.errors.length > 0) {
      console.error('JavaScript errors detected:');
      page.errors.forEach((err, idx) => {
        console.error(`  ${idx + 1}. [${err.type}] ${err.message}`);
        if (err.stack) console.error(`     ${err.stack}`);
      });
    }

    expect(page.errors).toHaveLength(0);
  });

  test('should render core layout structure', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Org Pulse/);

    // appContainer rendering
    const appContainer = page.locator('#app').first();
    await expect(appContainer).toBeVisible();

    // sidebar rendering
    const sidebar = page.locator('aside, nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // mainContent rendering
    const mainContent = page.locator('main, [role="main"], .min-h-screen').first();
    await expect(mainContent).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should load data successfully (no stuck loading states)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Add buffer in case the page needs time to load
    await page.waitForTimeout(2000);

    // Check that no permanent loading spinners remain
    // (temporary spinners during initial load are OK, but they should auto-resolve!)
    const loadingSpinners = page.locator('[role="status"], [aria-busy="true"], .loading');
    const spinnerCount = await loadingSpinners.count();

    // If spinners exist, verify they're not stuck
    if (spinnerCount > 0) {
      await page.waitForTimeout(3000);
      const stillLoading = await loadingSpinners.count();
      expect(stillLoading).toBe(0);
    }

    // Confirm we didn't encounter API errors
    const errorMessages = page.locator('text=/error|failed|unavailable/i').filter({
      hasNot: page.locator('[style*="display: none"]')
    });
    const errorCount = await errorMessages.count();

    if (errorCount > 0) {
      const errorText = await errorMessages.first().textContent();
      throw new Error(`API error state detected: ${errorText}`);
    }

    expect(page.errors).toHaveLength(0);
  });

  test('should navigate between pages (client-side routing)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Capture initial URL (hash-based routing)
    const initialUrl = page.url();

    // Find and click a navigation link (settings, or any secondary nav item)
    // Using multiple selectors to be resilient to UI changes
    const navLink = page.locator('a[href*="settings"], a:has-text("Settings"), nav a').first();

    if (await navLink.count() > 0) {
      await navLink.click();

      // Add buffer in case the page needs time to load
      await page.waitForTimeout(1000);

      // Verify URL changed (hash routing)
      const newUrl = page.url();
      expect(newUrl).not.toBe(initialUrl);

      // Verify page still renders without errors
      const appContainer = page.locator('#app');
      await expect(appContainer).toBeVisible();
    } else {
      // If no settings link found, try any navigation link
      const anyNavLink = page.locator('nav a, aside a').nth(1); // Second nav item

      if (await anyNavLink.count() > 0) {
        await anyNavLink.click();
        await page.waitForTimeout(1000);

        const newUrl = page.url();
        expect(newUrl).not.toBe(initialUrl);
      } else {
        console.warn('No navigation links found to test routing');
      }
    }
    expect(page.errors).toHaveLength(0);
  });

  test('should export test data successfully', async ({ page }) => {
    const response = await page.request.get('/api/export/test-data');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/octet-stream');
    expect(response.headers()['content-disposition']).toContain('org-pulse-test-data.tgz');

    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);

    // Verify gzip magic bytes (1f 8b)
    expect(body[0]).toBe(0x1f);
    expect(body[1]).toBe(0x8b);
  });

  test('should render without critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Page should have a main landmark
    const mainLandmark = page.locator('main, [role="main"]');
    const hasMain = await mainLandmark.count() > 0;

    // 2. Navigation should be identifiable
    const navLandmark = page.locator('nav, [role="navigation"]');
    const hasNav = await navLandmark.count() > 0;

    // At least one of these should exist for basic user accessibility
    expect(hasMain || hasNav).toBe(true);

    expect(page.errors).toHaveLength(0);
  });
});
