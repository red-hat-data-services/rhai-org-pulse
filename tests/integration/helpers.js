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

module.exports = {
  setupErrorTracking,
  logCapturedErrors
};
