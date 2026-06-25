const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, pageHasContent, pageLoadComplete, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for AI Catalyst Showcase module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Catalog view displays entries and filters
 * - Detail view navigates and renders entry content
 * - API endpoints return expected data
 *
 * Tag: @catalyst-showcase
 * Usage: npx playwright test --grep @catalyst-showcase
 */

test.describe('Catalyst Showcase Module @catalyst-showcase', () => {
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

    const moduleNav = page.locator('aside nav').filter({ hasText: 'AI Catalyst Showcase' });
    const count = await moduleNav.count();
    expect(count).toBeGreaterThan(0);

    const moduleLink = moduleNav.first();
    await expect(moduleLink).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to catalog view when clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const moduleHeader = page.locator('aside nav button').filter({ hasText: 'AI Catalyst Showcase' }).first();
    await moduleHeader.click();
    await page.waitForTimeout(500);

    const viewLink = page.locator('aside nav button').filter({ hasText: 'Catalog' }).first();
    await viewLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/catalyst-showcase\/catalog/);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });
});

test.describe('Catalyst Showcase Catalog @catalyst-showcase', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should display entries in card grid', async ({ page }) => {
    await page.goto('/#/catalyst-showcase/catalog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const hasContent = await pageHasContent(page);
    expect(hasContent).toBe(true);

    const pageHasFinishedLoading = await pageLoadComplete(page);
    expect(pageHasFinishedLoading).toBe(true);

    const heading = page.locator('h1').filter({ hasText: 'AI Catalyst Showcase' });
    await expect(heading).toBeVisible();

    const cards = page.locator('main .grid .rounded-xl');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
    console.log(`Catalog card count: ${cardCount}`);

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should display pillar filter tiles', async ({ page }) => {
    await page.goto('/#/catalyst-showcase/catalog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const allPillarsButton = page.locator('button').filter({ hasText: 'All Pillars' });
    await expect(allPillarsButton).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should have search and filter controls', async ({ page }) => {
    await page.goto('/#/catalyst-showcase/catalog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const searchInput = page.locator('input[placeholder="Search projects..."]');
    await expect(searchInput).toBeVisible();

    const needFilter = page.locator('select').filter({ hasText: 'All customer needs' });
    await expect(needFilter).toBeVisible();

    const capFilter = page.locator('select').filter({ hasText: 'All capabilities' });
    await expect(capFilter).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to detail view on card click', async ({ page }) => {
    await page.goto('/#/catalyst-showcase/catalog');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const firstCardTitle = page.locator('main .grid h3').first();
    await firstCardTitle.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/catalyst-showcase\/detail\?slug=/);

    const backButton = page.locator('button').filter({ hasText: 'Back to catalog' });
    await expect(backButton).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });
});

test.describe('Catalyst Showcase API @catalyst-showcase', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should return entries from API', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const response = await page.request.get('/api/modules/catalyst-showcase/entries');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('entries');
    expect(data).toHaveProperty('pillars');
    expect(data).toHaveProperty('totalEntries');
    expect(data.entries.length).toBeGreaterThan(0);
    expect(data.pillars.length).toBeGreaterThan(0);
    console.log(`API returned ${data.totalEntries} entries, ${data.pillars.length} pillars`);
  });
});
