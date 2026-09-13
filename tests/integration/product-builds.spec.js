const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors, mainContentIsVisible } = require('./helpers');

/**
 * Integration tests for Product Builds module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - CHI column appears in artifacts table
 * - CHI badge renders in artifact detail view
 * - Artifacts without health_index don't show CHI
 * - Tests column appears in artifacts table
 *
 * Tag: @product-builds
 * Usage: npx playwright test --grep @product-builds
 */

test.describe('Product Builds Module @product-builds', () => {
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

    const moduleNav = page.locator('aside nav').filter({ hasText: 'Product Bu' });
    const count = await moduleNav.count();
    expect(count).toBeGreaterThan(0);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to RHAIIS view', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/rhaiis/);

    const mainContentVisible = await mainContentIsVisible(page);
    expect(mainContentVisible).toBe(true);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show CHI column header in artifacts tab', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const artifactsTab = page.locator('button').filter({ hasText: 'Artifacts' });
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      const chiHeader = page.locator('th').filter({ hasText: 'CHI' });
      await expect(chiHeader).toBeVisible();

      const testsHeader = page.locator('th').filter({ hasText: 'Tests' });
      await expect(testsHeader).toBeVisible();
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Health Index in artifact detail when data exists', async ({ page }) => {
    await page.goto('/#/product-builds/rhaiis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const artifactsTab = page.locator('button').filter({ hasText: 'Artifacts' });
    if (await artifactsTab.isVisible()) {
      await artifactsTab.click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      const firstArtifact = page.locator('tbody tr').first();
      if (await firstArtifact.isVisible()) {
        await firstArtifact.click();
        await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

        const healthLabel = page.locator('dt').filter({ hasText: 'Health Index' });
        const hasHealth = await healthLabel.count();
        if (hasHealth > 0) {
          await expect(healthLabel).toBeVisible();
          const gradeBadge = page.locator('.font-bold').first();
          const gradeText = await gradeBadge.textContent();
          if (gradeText && gradeText.trim() !== 'Unknown') {
            const vulnerabilities = page.locator('text=vulnerabilities');
            await expect(vulnerabilities).toBeVisible();
          }
        }
      }
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to Search view and show empty state', async ({ page }) => {
    await page.goto('/#/product-builds/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/product-builds\/search/);

    const searchInput = page.locator('input[type="text"]');
    await expect(searchInput).toBeVisible();
    await expect(page.locator('text=Enter a search query')).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should run a search and update the URL query param', async ({ page }) => {
    await page.goto('/#/product-builds/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const searchInput = page.locator('input[type="text"]');
    await searchInput.fill('rhaiis');
    await searchInput.press('Enter');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toMatch(/[?&]q=rhaiis/);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should return channel data from the API', async ({ request }) => {
    const list = await request.get('/api/modules/product-builds/channels');
    expect(list.ok()).toBe(true);
    const { channels } = await list.json();
    expect(channels.length).toBeGreaterThan(0);
    expect(channels.some(c => c.maturity === 'stable')).toBe(true);
    expect(channels.some(c => c.maturity === 'rolling')).toBe(true);

    const detail = await request.get(`/api/modules/product-builds/channels/${encodeURIComponent(channels[0].name)}`);
    expect(detail.ok()).toBe(true);
    const { channel } = await detail.json();
    expect(channel.name).toBe(channels[0].name);
    expect(Array.isArray(channel.drops)).toBe(true);
    expect(Array.isArray(channel.wheels)).toBe(true);

    const missing = await request.get('/api/modules/product-builds/channels/does-not-exist');
    expect(missing.status()).toBe(404);
  });

  test('should show the Channels view with matrix and table', async ({ page }) => {
    await page.goto('/#/product-builds/channels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const nav = page.locator('aside nav').getByText('Channels', { exact: true });
    await expect(nav).toBeVisible();

    await expect(page.locator('h1').filter({ hasText: 'Channels' })).toBeVisible();
    await expect(page.locator('[data-testid="channel-matrix"]')).toBeVisible();
    await expect(page.locator('[data-testid="channel-row"]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Rolling', exact: true }).click();
    const rows = page.locator('[data-testid="channel-row"]');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < rowCount; i++) {
      await expect(rows.nth(i)).toContainText('Rolling');
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should open a channel and browse its drops and wheels', async ({ page }) => {
    await page.goto('/#/product-builds/channels');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const cell = page.locator('[data-testid="channel-matrix"] button[data-channel]').first();
    const channelName = await cell.getAttribute('data-channel');
    await cell.click();

    const drawer = page.locator('[data-testid="channel-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(channelName);
    expect(page.url()).toContain(`channel=${encodeURIComponent(channelName)}`);
    await expect(drawer.locator('[data-testid="channel-drop"]').first()).toBeVisible();

    await drawer.getByRole('tab', { name: /Wheels/ }).click();
    await expect(drawer.locator('[data-testid="channel-wheel"]').first()).toBeVisible();
    const wheelFilter = drawer.getByLabel('Filter wheels by name');
    await wheelFilter.fill('numpy');
    await expect(drawer.locator('[data-testid="channel-wheel"]')).toHaveCount(1);

    // Escape clears the wheel filter first, then closes the drawer.
    await wheelFilter.press('Escape');
    await expect(wheelFilter).toHaveValue('');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    expect(page.url()).not.toContain('channel=');

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should deep link to a channel', async ({ page }) => {
    await page.goto('/#/product-builds/channels?channel=cpu-notorch-ubi9');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const drawer = page.locator('[data-testid="channel-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('cpu-notorch-ubi9');

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });
});
