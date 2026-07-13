const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for Command Palette search accuracy
 *
 * These tests verify:
 * - The command palette opens with the / key
 * - Search results narrow progressively as the query lengthens
 * - No partial-prefix false positives (e.g., "conforma" does not return "configuration" items)
 * - Correct items appear for specific queries
 *
 * Tag: @command-palette
 * Usage: npx playwright test --grep @command-palette
 */

test.describe('Command Palette @command-palette', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('opens with / key and shows search input', async ({ page }) => {
    await page.keyboard.press('/');
    const input = page.locator('input[placeholder*="Where do you want to go"]');
    await expect(input).toBeVisible({ timeout: 2000 });
  });

  test('search results narrow as query lengthens', async ({ page }) => {
    await page.keyboard.press('/');
    const input = page.locator('input[placeholder*="go"], input[placeholder*="Search"]');
    await expect(input).toBeVisible({ timeout: 2000 });

    await input.fill('con');
    await page.waitForTimeout(300);
    const countAtCon = await page.locator('.command-palette-suggestions > div').count();

    await input.fill('conforma');
    await page.waitForTimeout(300);
    const countAtConforma = await page.locator('.command-palette-suggestions > div').count();

    expect(countAtCon).toBeGreaterThan(countAtConforma);
  });

  test('"conforma" shows Conforma Insights, not "configuration" items', async ({ page }) => {
    await page.keyboard.press('/');
    const input = page.locator('input[placeholder*="go"], input[placeholder*="Search"]');
    await expect(input).toBeVisible({ timeout: 2000 });

    await input.fill('conforma');
    await page.waitForTimeout(500);

    const suggestions = page.locator('.command-palette-suggestions > div');
    const count = await suggestions.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const allText = [];
    for (let i = 0; i < count; i++) {
      allText.push(await suggestions.nth(i).textContent());
    }
    const joined = allText.join('\n');

    expect(joined).toContain('Conforma Insights');
    expect(joined).not.toContain('configuration');
    expect(joined).not.toContain('concurrent');
  });

  test('closes on Escape key', async ({ page }) => {
    await page.keyboard.press('/');
    const input = page.locator('input[placeholder*="go"], input[placeholder*="Search"]');
    await expect(input).toBeVisible({ timeout: 2000 });

    await page.keyboard.press('Escape');
    await expect(input).not.toBeVisible({ timeout: 2000 });
  });
});
