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

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
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

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Packages Onboarded tab by default', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByRole('button', { name: /Packages Onboarded/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Daily Report/ })).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
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

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Package Search tab', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const searchTab = page.getByRole('button', { name: /Package Search/ });
    await expect(searchTab).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
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

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Nightly Analysis tab', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const nightlyTab = page.getByRole('button', { name: /Nightly/ });
    await expect(nightlyTab).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should navigate to Nightly Analysis and auto-load latest pipeline', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis?tab=nightly');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const hasData = await page.locator('text=Pipeline History').isVisible();
    if (hasData) {
      await expect(page.locator('text=Total Jobs')).toBeVisible();
      await expect(page.locator('text=Passed')).toBeVisible();
      await expect(page.locator('text=Failed')).toBeVisible();
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Chart/Strip toggle in Pipeline History', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis?tab=nightly');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const hasData = await page.locator('text=Pipeline History').isVisible();
    if (hasData) {
      await expect(page.getByRole('button', { name: 'Chart' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Strip' })).toBeVisible();
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should switch to Strip view and show dates', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis?tab=nightly');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const stripBtn = page.getByRole('button', { name: 'Strip' });
    if (await stripBtn.isVisible()) {
      await stripBtn.click();
      await page.waitForTimeout(500);

      const dateLabels = page.locator('text=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d+$/');
      const count = await dateLabels.count();
      expect(count).toBeGreaterThan(0);
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show collapsible Collections box', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis?tab=nightly');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const collectionsHeader = page.locator('summary').filter({ hasText: 'Collections' });
    const hasData = await page.locator('text=Pipeline History').isVisible();
    if (hasData) {
      await expect(collectionsHeader).toBeVisible();
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Root Cause Analysis section when RCA data is available', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis?tab=nightly');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const rcaSection = page.locator('summary').filter({ hasText: 'Root Cause Analysis' });
    const rcaLoading = page.locator('text=Loading failure analysis');
    await page.waitForTimeout(3000);

    const hasRca = await rcaSection.isVisible();
    const stillLoading = await rcaLoading.isVisible();
    if (hasRca) {
      await expect(rcaSection).toBeVisible();
      const issueGroupText = page.locator('text=/\\d+ issue group/');
      await expect(issueGroupText).toBeVisible();
    }
    expect(stillLoading).toBe(false);

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should show Jira ticket links in RCA issue groups', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis?tab=nightly');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME + 3000);

    const rcaSection = page.locator('summary').filter({ hasText: 'Root Cause Analysis' });
    if (await rcaSection.isVisible()) {
      const jiraBadge = page.locator('a').filter({ hasText: /^AIPCC-\d+/ });
      const count = await jiraBadge.count();
      if (count > 0) {
        const href = await jiraBadge.first().getAttribute('href');
        expect(href).toContain('redhat.atlassian.net/browse/AIPCC-');
      }
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });

  test('should click a different pipeline and update details', async ({ page }) => {
    await page.goto('/#/product-builds/package-analysis?tab=nightly');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const svgDots = page.locator('svg circle[r="16"]');
    const dotCount = await svgDots.count();
    if (dotCount > 1) {
      await svgDots.first().click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      await expect(page.locator('text=Total Jobs')).toBeVisible();
    }

    const appErrors = page.errors.filter(e => !/status of (429|404|503)/.test(e.message));
    expect(appErrors).toHaveLength(0);
  });
});
