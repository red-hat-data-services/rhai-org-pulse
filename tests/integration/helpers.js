/**
 * Sets up error tracking for a Playwright page
 * 
 * Captures both page errors and console errors
 * @param {import('@playwright/test').Page} page - Playwright page object
 */
function setupErrorTracking(page) {
  page.errors = [];
  page.on('pageerror', error => {
    page.errors.push({
      type: 'pageerror',
      message: error.message,
      stack: error.stack
    });
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      page.errors.push({
        type: 'console.error',
        message: msg.text()
      });
    }
  });
}

/**
 * Logs any errors to the console that were captured during the test so that users
 * can debug any failing integration test.
 *
 * Use in test.afterEach hook
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {import('@playwright/test').TestInfo} testInfo - Test metadata
 */
function logCapturedErrors(page, testInfo) {
  if (page.errors?.length > 0) {
    console.error(`\nTest "${testInfo.title}" captured ${page.errors.length} error(s):`);
    page.errors.forEach((error, i) => {
      console.error(`  ${i + 1}. [${error.type}] ${error.message}`);
      if (error.stack) {
        console.error(`     ${error.stack.split('\n')[0]}`);
      }
    });
    console.error('');
  }
}

/**
 * Checks if a page has rendered meaningful content by looking for
 * data-bearing elements (not just empty containers or placeholders)
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if the page has content, false otherwise
 */
async function pageHasContent(page) {
  const hasButtons = await page.locator('button').count() > 0;
  const hasInputs = await page.locator('input, select, textarea').count() > 0;
  const hasList = await page.locator('ul li, ol li').count() > 0;
  const hasTable = await page.locator('table tbody tr').count() > 0; // Data rows, not just headers
  const hasHeadings = await page.locator('h1, h2, h3').count() > 0;
  const hasLinks = await page.locator('a[href]').count() > 0;
  const hasDataElements = await page.locator('[data-testid], [data-key], [data-id]').count() > 0;
  const hasSections = await page.locator('article, section').count() > 0;

  // If this value is 'false', then it indicates we've loaded an empty page.
  return hasButtons || hasInputs || hasList || hasTable ||
         hasHeadings || hasLinks || hasDataElements || hasSections;
}

/**
 * Checks if a page has finished loading by verifying no active loading spinners are present
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if loading is complete, false if still loading
 */
async function pageLoadComplete(page) {
  const loadingSpinners = await page.locator('[aria-busy="true"], [role="progressbar"], .loading, .spinner, [aria-label*="loading" i]').count();
  return loadingSpinners === 0;
}

/**
 * Checks if the main content container of the page is visible
 *
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if main content is visible, false otherwise
 */
async function mainContentIsVisible(page) {
  const mainContent = page.locator('main, [role="main"], .min-h-screen').first();
  return await mainContent.isVisible();
}

module.exports = {
  setupErrorTracking,
  logCapturedErrors,
  pageHasContent,
  pageLoadComplete,
  mainContentIsVisible
};
