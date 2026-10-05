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
      await route.fulfill({ json: { quarters: [], overall: { associates: 0, completed: 0, pct: 0 } } });
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

  test('opens RHAI Sustaining when a CVE SLA quarter cell is selected', async function ({ page }) {
    await page.route('**/api/modules/okr-hub/editable-status', async function (route) {
      await route.fulfill({ json: { entries: {} } });
    });
    await page.route('**/api/modules/okr-hub/reports/on-time-releases', async function (route) {
      await route.fulfill({ json: { releases: [] } });
    });
    await page.route('**/api/modules/releases/cve-sustaining', async function (route) {
      await route.fulfill({
        json: {
          slaCompliance: {
            quarters: [
              { label: 'Q1 2026', pct: 79, metSla: 1840, missedSla: 477, total: 2317 },
              { label: 'Q2 2026', pct: 74, metSla: 1375, missedSla: 481, total: 1856 },
              { label: 'Q3 2026', pct: 67, metSla: 4738, missedSla: 2350, total: 7088 },
              { label: 'Q4 2026', pct: 88, metSla: 88, missedSla: 12, total: 100 }
            ]
          }
        }
      });
    });
    await page.route('**/api/modules/okr-hub/reports/support-cases', async function (route) {
      await route.fulfill({ json: { products: [], quarters: {} } });
    });
    await page.route('**/api/modules/okr-hub/reports/tech-visibility', async function (route) {
      await route.fulfill({ json: { quarters: [], overall: { weeksMet: 0, totalWeeks: 0, pct: 0 } } });
    });
    await page.route('**/api/modules/okr-hub/reports/content-contributions', async function (route) {
      await route.fulfill({ json: { quarters: [], overall: { associates: 0, completed: 0, pct: 0 } } });
    });

    await page.goto('/#/okr-hub/timeline');

    var cveRow = page.getByRole('row').filter({ hasText: 'CVE SLA Compliance' });
    await expect(cveRow.getByRole('link')).toHaveCount(4);
    await expect(cveRow).not.toContainText('88%');
    await expect(cveRow.getByRole('link').nth(3)).toHaveText('—');
    await cveRow.getByRole('link').filter({ hasText: '79%' }).click();
    await expect(page).toHaveURL(/#\/releases\/reports\?report=cve-sustaining$/);
  });

  test('shows the updated Q3 associate content snapshot', async function ({ page }) {
    await page.route('**/api/modules/okr-hub/reports/tech-visibility', async function (route) {
      await route.fulfill({ json: { quarters: [], overall: { weeksMet: 0, totalWeeks: 0, pct: 0 }, target: 5 } });
    });
    await page.route('**/api/modules/okr-hub/reports/content-contributions', async function (route) {
      await route.fulfill({
        json: {
          quarters: [{
            label: 'Q3 2026',
            teams: [
              { name: "Steven's Directs", associates: 14, completed: 1, pct: 7, performance: 'Behind (43% to go)', endQPct: 7 },
              { name: 'Cat Agentics & AI Eng Tooling', associates: 58, completed: 30, pct: 52, performance: 'On Track', endQPct: 52 },
              { name: 'Sherard AI Platform', associates: 192, completed: 40, pct: 21, performance: 'Behind (29% to go)', endQPct: 21 },
              { name: 'Taneem Inf Engineering', associates: 59, completed: 27, pct: 45, performance: 'Behind (5% to go)', endQPct: 45 },
              { name: 'Kai AI Innovation', associates: 13, completed: 2, pct: 15, performance: 'Behind (35% to go)', endQPct: 15 },
              { name: 'Tom AIPCC', associates: 147, completed: 32, pct: 22, performance: 'Behind (28% to go)', endQPct: 22 },
              { name: 'Monica watsonx', associates: 48, completed: 22, pct: 46, performance: 'Behind (4% to go)', endQPct: 46 }
            ],
            total: { associates: 531, completed: 154, pct: 29, performance: 'Behind (21% to go)', endQPct: 29 },
            targetDate: '12/31/2026'
          }],
          overall: { associates: 531, completed: 154, pct: 29 },
          target: '1 piece of content per associate',
          fetchedAt: '2026-09-30T12:00:00.000Z'
        }
      });
    });

    await page.goto('/#/okr-hub/reports?report=tech-visibility');
    await page.getByRole('button', { name: /KR2: Associate Content Contributions/ }).click();

    await expect(page.getByRole('button', { name: /Q3 2026 154 of 531 associates completed 29%/ })).toBeVisible();
    var catRow = page.getByRole('row').filter({ hasText: 'Cat Agentics & AI Eng Tooling' });
    await expect(catRow).toContainText('30');
    await expect(catRow).toContainText('On Track');
    await expect(catRow).toContainText('12/31/2026');
    await expect(catRow.getByText('52%', { exact: true })).toHaveCount(2);
    var totalRow = page.getByRole('row').filter({ hasText: 'TOTAL' });
    await expect(totalRow).toContainText('Behind (21% to go)');
  });

  test('shows the September 25 KR1 fallback entry', async function ({ page }) {
    await page.route('**/api/modules/okr-hub/reports/tech-visibility', async function (route) {
      await route.fulfill({
        json: {
          quarters: [{
            label: 'Q3 2026',
            weeks: [{ weekOf: '2026-09-25', count: 0, met: false }],
            weeksMet: 2,
            totalWeeks: 12,
            pct: 17
          }],
          overall: { weeksMet: 9, totalWeeks: 37, pct: 24 },
          target: 5,
          source: '(sample data)',
          fetchedAt: '2026-09-30T12:00:00.000Z'
        }
      });
    });
    await page.route('**/api/modules/okr-hub/reports/content-contributions', async function (route) {
      await route.fulfill({ json: { quarters: [], overall: { associates: 0, completed: 0, pct: 0 } } });
    });

    await page.goto('/#/okr-hub/reports?report=tech-visibility');
    await page.getByRole('button', { name: /KR1: Weekly Posts/ }).click();
    await expect(page.getByRole('button', { name: /Q3 2026 2 of 12 weeks met 17%/ })).toBeVisible();

    var septemberRow = page.getByRole('row').filter({ hasText: 'Sep 25, 2026' });
    await expect(septemberRow).toContainText('0');
    await expect(septemberRow).toContainText('Missed');
  });

  test('filters post-release defects by Jira component and priority', async function ({ page }) {
    var bugRequests = [];
    var summaryRequests = [];

    await page.route('**/api/modules/releases/delivery/quality/versions', async function (route) {
      await route.fulfill({
        json: [
          { name: 'rhoai-3.4', releaseDate: '2026-03-20', released: true, bugCount: 2 },
          { name: 'rhelai-3.4', releaseDate: '2026-03-20', released: true, bugCount: 1 },
          { name: 'RHAII-3.4', releaseDate: '2026-03-20', released: true, bugCount: 1 },
          { name: '3.6 GA RHOAI RELEASE', releaseDate: '2026-11-18', released: false, bugCount: 0 },
          { name: '3.6 GA RHELAI RELEASE', releaseDate: '2026-11-24', released: false, bugCount: 0 },
          { name: '3.6 GA RHAII RELEASE', releaseDate: '2026-11-05', released: false, bugCount: 0 },
          { name: 'rhoai-3.3', releaseDate: '2026-01-15', bugCount: 1 }
        ]
      });
    });
    await page.route('**/api/modules/releases/delivery/quality/components', async function (route) {
      await route.fulfill({ json: [
        { name: 'Dashboard', count: 2 },
        { name: 'Model Serving', count: 1 }
      ] });
    });
    await page.route('**/api/modules/releases/delivery/quality/priorities', async function (route) {
      await route.fulfill({
        json: [
          { name: 'Critical', count: 2 },
          { name: 'Major', count: 1 }
        ]
      });
    });
    await page.route('**/api/modules/releases/delivery/quality/bugs**', async function (route) {
      bugRequests.push(route.request().url());
      await route.fulfill({
        json: {
          labels: [0, 1],
          datasets: [{ label: 'rhoai-3.4', data: [0, 1] }]
        }
      });
    });
    await page.route('**/api/modules/okr-hub/reports/90day-tracking-config', async function (route) {
      await route.fulfill({ json: { releases: [] } });
    });
    await page.route('**/api/modules/releases/delivery/quality/90day-summary', async function (route) {
      summaryRequests.push(route.request().method());
      await route.fulfill({ json: { releases: [] } });
    });

    await page.goto('/#/okr-hub/reports?report=post-release-defects');

    var quickGroup = page.getByRole('button', { name: '3.4 GA', exact: true });
    await expect(quickGroup).toBeVisible();
    await expect(quickGroup).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('Select versions to view cumulative bug trends')).toBeVisible();
    expect(summaryRequests).toEqual([]);
    await expect(page.locator('#post-release-component')).toHaveText('All Components');
    await expect(page.locator('#post-release-priority')).toHaveText('All Priorities');

    await quickGroup.click();
    await expect(quickGroup).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { name: 'Priority' })).toBeVisible();
    await expect(page.locator('#post-release-component')).toHaveText('All Components');
    await expect(page.locator('#post-release-priority')).toHaveText('All Priorities');

    var componentRequest = page.waitForRequest(function (request) {
      var url = new URL(request.url());
      return url.pathname.endsWith('/api/modules/releases/delivery/quality/bugs') && url.searchParams.get('component') === 'Dashboard,Model Serving';
    });
    await page.locator('#post-release-component').click();
    await page.getByRole('option', { name: /Dashboard\s+2/ }).click();
    await page.getByRole('option', { name: /Model Serving\s+1/ }).click();
    await componentRequest;
    await expect(page.locator('#post-release-component')).toHaveText('2 components selected');

    var priorityRequest = page.waitForRequest(function (request) {
      var url = new URL(request.url());
      return url.pathname.endsWith('/api/modules/releases/delivery/quality/bugs') && url.searchParams.get('priority') === 'Critical,Major';
    });
    await page.locator('#post-release-priority').click();
    await page.getByRole('option', { name: /Critical\s+2/ }).click();
    await page.getByRole('option', { name: /Major\s+1/ }).click();
    await priorityRequest;
    await expect(page.locator('#post-release-priority')).toHaveText('2 priorities selected');
    expect(bugRequests.some(function (url) {
      return new URL(url).searchParams.get('priority') === 'Critical,Major';
    })).toBe(true);

    await page.getByRole('button', { name: '3.6 GA', exact: true }).click();
    await expect(page.getByText('Unreleased versions are excluded from the graph: 3.6 GA RHOAI RELEASE, 3.6 GA RHELAI RELEASE, 3.6 GA RHAII RELEASE.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cumulative Bug Count vs Days Since Release' })).toBeVisible();
    expect(summaryRequests).toEqual([]);

    await page.getByRole('button', { name: '3.4 GA', exact: true }).click();
    await expect(page.getByText('3.6 GA RHOAI RELEASE, 3.6 GA RHELAI RELEASE, 3.6 GA RHAII RELEASE have not been released yet.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cumulative Bug Count vs Days Since Release' })).toHaveCount(0);
  });

  test('uses saved 90-day release configuration and can delete a release chart', async function ({ page }) {
    var savedConfig = {
      releases: [{
        version: '3.6',
        products: [{ name: 'rhoai-3.6', gaDate: '2026-09-01' }]
      }]
    };

    await page.route('**/api/modules/releases/delivery/quality/versions', async function (route) {
      await route.fulfill({ json: [] });
    });
    await page.route('**/api/modules/releases/delivery/quality/components', async function (route) {
      await route.fulfill({ json: [] });
    });
    await page.route('**/api/modules/releases/delivery/quality/priorities', async function (route) {
      await route.fulfill({ json: [] });
    });
    await page.route('**/api/modules/releases/delivery/quality/bugs**', async function (route) {
      await route.fulfill({ json: { labels: [], datasets: [] } });
    });
    await page.route('**/api/modules/okr-hub/reports/90day-tracking-config', async function (route) {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: savedConfig });
        return;
      }

      savedConfig = JSON.parse(route.request().postData());
      await route.fulfill({ json: { ok: true } });
    });
    await page.route('**/api/modules/releases/delivery/quality/90day-summary', async function (route) {
      var body = JSON.parse(route.request().postData() || '{}');
      if (!body.releases || body.releases.length === 0) {
        await route.fulfill({ json: { releases: [] } });
        return;
      }

      await route.fulfill({
        json: {
          releases: [{
            version: '3.6',
            products: [{
              name: 'rhoai-3.6',
              bugCount: 1,
              daysElapsed: 34,
              isComplete: false,
              releaseDate: '2026-09-01'
            }],
            total: 1
          }]
        }
      });
    });

    await page.goto('/#/okr-hub/reports?report=post-release-defects');

    await expect(page.getByRole('heading', { name: 'Bug Trend Filters' })).toBeVisible();
    await expect(page.getByText('Release 3.6', { exact: true })).toBeVisible();
    await expect(page.getByText('rhoai-3.6', { exact: true })).toBeVisible();
    await expect(page.getByTitle('Delete this release chart')).toBeVisible();

    await page.getByTitle('Delete this release chart').click();

    await expect(page.getByText('No release data available.', { exact: true })).toBeVisible();
    expect(savedConfig).toEqual({ releases: [] });
  });
});
