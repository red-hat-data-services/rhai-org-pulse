const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for Package Analysis (within Product Builds module)
 *
 * These tests verify:
 * - Package Analysis nav item is visible under Product Builds
 * - Navigating to Package Analysis loads the view
 * - Packages Onboarded tab renders
 * - Daily Report tab renders
 *
 * Tag: @package-analysis
 * Usage: npx playwright test --grep @package-analysis
 */

test.describe('Package Analysis @package-analysis', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show Package Analysis in Product Builds sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const moduleHeader = page.locator('aside nav button').filter({ hasText: 'Product Builds' }).first();
    await expect(moduleHeader).toBeVisible();
    await moduleHeader.click();
    await page.waitForTimeout(500);

    const packageAnalysisLink = page.locator('aside nav a, aside nav button').filter({ hasText: 'Package Analysis' });
    await expect(packageAnalysisLink.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should navigate to Package Analysis and show content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const moduleHeader = page.locator('aside nav button').filter({ hasText: 'Product Builds' }).first();
    await moduleHeader.click();
    await page.waitForTimeout(500);

    const packageAnalysisLink = page.locator('aside nav a, aside nav button').filter({ hasText: 'Package Analysis' }).first();
    await packageAnalysisLink.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByRole('heading', { name: 'Package Analysis' })).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should show Packages Onboarded tab by default', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByRole('button', { name: /Packages Onboarded/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Daily Report/ })).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should switch to Daily Report tab', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const dailyTab = page.getByRole('button', { name: /Daily Report/ });
    await dailyTab.click();
    await page.waitForTimeout(1000);

    const hasReport = await page.locator('text=Generate Today').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=No reports generated').isVisible().catch(() => false);
    expect(hasReport || hasEmpty).toBeTruthy();

    expect(page.errors).toHaveLength(0);
  });

  test('should show Package Search tab', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const searchTab = page.getByRole('button', { name: /Package Search/ });
    await expect(searchTab).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should switch to Package Search tab and show form', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const searchTab = page.getByRole('button', { name: /Package Search/ });
    await searchTab.click();
    await page.waitForTimeout(1000);

    const searchButton = page.locator('button[type="submit"]');
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toContainText('Search');

    expect(page.errors).toHaveLength(0);
  });
});
