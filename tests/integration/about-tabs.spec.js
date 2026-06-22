const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for extensible About page tabs
 *
 * These tests verify:
 * - Core About page tabs load correctly
 * - Platform-contributed Docs tab appears and renders content
 * - Tab switching works without errors
 * - URL hash updates on tab change
 *
 * Tag: @about-tabs
 * Usage: npx playwright test --grep @about-tabs
 */

function jsErrors(page) {
  return page.errors.filter(e =>
    e.type === 'pageerror' || !e.message.includes('Failed to load resource')
  );
}

test.describe('About Page Tabs @about-tabs', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should load About page with core tabs', async ({ page }) => {
    await page.goto('/#/about');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    const aboutTab = page.locator('nav button', { hasText: 'About' });
    await expect(aboutTab).toBeVisible();

    const helpTab = page.locator('nav button', { hasText: 'Help & Debug' });
    await expect(helpTab).toBeVisible();

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should display the Docs tab from platform extensions', async ({ page }) => {
    await page.goto('/#/about');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const docsTab = page.locator('nav button', { hasText: 'Docs' });
    await expect(docsTab).toBeVisible();

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should render Docs tab content when clicked', async ({ page }) => {
    await page.goto('/#/about');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const docsTab = page.locator('nav button', { hasText: 'Docs' });
    await docsTab.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const releasePlanning = page.locator('text=Release Planning Materials');
    const aiSdlc = page.locator('text=AI SDLC Materials');

    const hasReleasePlanning = await releasePlanning.isVisible().catch(() => false);
    const hasAiSdlc = await aiSdlc.isVisible().catch(() => false);

    expect(hasReleasePlanning || hasAiSdlc).toBe(true);

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should switch between tabs without errors', async ({ page }) => {
    await page.goto('/#/about');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const docsTab = page.locator('nav button', { hasText: 'Docs' });
    await docsTab.click();
    await page.waitForTimeout(1000);

    const aboutTab = page.locator('nav button', { hasText: 'About' });
    await aboutTab.click();
    await page.waitForTimeout(1000);

    const orgPulseHeading = page.locator('h2', { hasText: 'Org Pulse' });
    await expect(orgPulseHeading).toBeVisible();

    const helpTab = page.locator('nav button', { hasText: 'Help & Debug' });
    await helpTab.click();
    await page.waitForTimeout(1000);

    const appInfo = page.locator('text=App Info');
    await expect(appInfo).toBeVisible();

    expect(jsErrors(page)).toHaveLength(0);
  });

  test('should update URL hash when switching tabs', async ({ page }) => {
    await page.goto('/#/about');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const docsTab = page.locator('nav button', { hasText: 'Docs' });
    await docsTab.click();
    await page.waitForTimeout(1000);

    const url = page.url();
    expect(url).toContain('tab=docs');

    expect(jsErrors(page)).toHaveLength(0);
  });
});
