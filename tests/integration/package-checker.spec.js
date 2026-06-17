const { test, expect } = require('@playwright/test')
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants')
const { setupErrorTracking, logCapturedErrors, mainContentIsVisible } = require('./helpers')

/**
 * Integration tests for Package Search (within Product Builds module)
 *
 * Tag: @package-search
 * Usage: npx playwright test --grep @package-search
 */

test.describe('Package Search @package-search', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page)
  })

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo)
  })

  test('should be visible in Product Builds sidebar', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME)

    const moduleNav = page.locator('aside nav').filter({ hasText: 'Package Search' })
    const count = await moduleNav.count()
    expect(count).toBeGreaterThan(0)

    expect(page.errors).toHaveLength(0)
  })

  test('should navigate to Package Search and show form', async ({ page }) => {
    await page.goto('/#/product-builds/package-search')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME)

    const mainContentVisible = await mainContentIsVisible(page)
    expect(mainContentVisible).toBe(true)

    const searchButton = page.locator('button[type="submit"]')
    await expect(searchButton).toBeVisible()
    await expect(searchButton).toContainText('Search')

    expect(page.errors).toHaveLength(0)
  })
})
