const { test, expect } = require('@playwright/test');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

test.describe('OKR Hub timeline @okr-hub', function () {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('shows support-case snapshot dates in every Q1-Q3 product cell', async function ({ page }) {
    await page.route('**/api/modules/okr-hub/editable-status', async function (route) {
      await route.fulfill({ json: { entries: {} } });
    });
    await page.route('**/api/modules/okr-hub/reports/on-time-releases', async function (route) {
      await route.fulfill({ json: { releases: [] } });
    });
    await page.route('**/api/modules/releases/cve-sustaining', async function (route) {
      await route.fulfill({ status: 404, json: { error: 'No fixture required' } });
    });
    await page.route('**/api/modules/okr-hub/reports/support-cases', async function (route) {
      await route.fulfill({
        json: {
          products: ['RHOAI', 'RHEL-AI', 'RHAII'],
          quarters: {
            Q1: {
              RHOAI: { totalCases: 10, defects: 2, avgResolutionDays: 12 },
              'RHEL-AI': { totalCases: 10, defects: 1, avgResolutionDays: 11 },
              RHAII: { totalCases: 10, defects: 3, avgResolutionDays: 15 }
            },
            Q2: {
              RHOAI: { totalCases: 10, defects: 1, avgResolutionDays: 10 },
              'RHEL-AI': { totalCases: 10, defects: 1, avgResolutionDays: 9 },
              RHAII: { totalCases: 10, defects: 2, avgResolutionDays: 13 }
            }
          }
        }
      });
    });
    await page.route('**/api/modules/okr-hub/reports/tech-visibility', async function (route) {
      await route.fulfill({ json: { quarters: [] } });
    });
    await page.route('**/api/modules/okr-hub/reports/content-contributions', async function (route) {
      await route.fulfill({ json: { quarters: [] } });
    });

    await page.goto('/#/okr-hub/timeline');

    await expect(page.getByRole('heading', { name: 'AI Engineering OKR Scorecard — 2026' })).toBeVisible();
    await expect(page.getByText('Defect Rate for Product: 10%\nTime to Resolution Target: 10-14 days', { exact: true })).toHaveCount(3);
    await expect(page.locator('[data-testid="support-case-data-as-of"][data-quarter="Q1"]')).toHaveCount(3);
    await expect(page.getByText('Data as of April 1, 2026', { exact: true })).toHaveCount(3);
    await expect(page.locator('[data-testid="support-case-data-as-of"][data-quarter="Q2"]')).toHaveCount(3);
    await expect(page.getByText('Data as of July 1, 2026', { exact: true })).toHaveCount(3);
    await expect(page.locator('[data-testid="support-case-data-as-of"][data-quarter="Q3"]')).toHaveCount(3);
    await expect(page.getByText('Data as of Oct 1, 2026', { exact: true })).toHaveCount(3);
    await expect(page.locator('[data-testid="support-case-data-as-of"][data-quarter="Q4"]')).toHaveCount(0);
  });
});
