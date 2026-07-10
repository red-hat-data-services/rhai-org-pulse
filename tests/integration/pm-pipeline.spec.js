const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for PM Pipeline module
 *
 * Tag: @pm-pipeline
 * Usage: npx playwright test --grep @pm-pipeline
 */

test.describe('PM Pipeline Module @pm-pipeline', () => {
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

    const moduleNav = page.locator('aside nav').filter({ hasText: 'PM Pipeline' });
    expect(await moduleNav.count()).toBeGreaterThan(0);
    await expect(moduleNav.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should navigate to Planning Prep view', async ({ page }) => {
    await page.goto('/#/pm-pipeline/planning-prep');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/pm-pipeline\/planning-prep/);
    await expect(page.getByRole('heading', { name: 'PM Pipeline', level: 1 })).toBeVisible();

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('should load Learn view with glossary content', async ({ page }) => {
    await page.goto('/#/pm-pipeline/learn');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/pm-pipeline\/learn/);
    await expect(page.getByRole('heading', { name: 'Learn the pipeline' })).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should fetch data from PM Pipeline API endpoints', async ({ page }) => {
    const apiResponses = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/modules/pm-pipeline/')) {
        apiResponses.push({ url, status: response.status() });
      }
    });

    await page.goto('/#/pm-pipeline/planning-prep');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const resourcesHit = apiResponses.some(r => r.url.includes('/resources') && r.status === 200);
    const rosterHit = apiResponses.some(r => r.url.includes('/pm-roster') && r.status === 200);

    expect(resourcesHit || rosterHit).toBe(true);

    expect(page.errors).toHaveLength(0);
  });
});
