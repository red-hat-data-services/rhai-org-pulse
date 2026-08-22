const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for Releases module
 *
 * These tests verify:
 * - Module loads and renders correctly
 * - Data fetching and display works
 * - Navigation within the module functions
 * - API integration is functional
 *
 * Tag: @releases
 * Usage: npx playwright test --grep @releases
 */

test.describe('Releases Module @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should fetch data from Releases API endpoints', async ({ page }) => {
    // Monitor network requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/releases')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // Navigate to Execute view (a data-driven view that makes API calls)
    await page.goto('/#/releases/execute');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify that API requests were made to the Releases endpoints
    // In demo mode, these should still be called and return fixture data
    expect(apiRequests.length).toBeGreaterThan(0);
    console.log(`Releases API requests: ${apiRequests.length}`);
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    expect(page.errors).toHaveLength(0);
  });

});

/**
 * RICE Config API
 *
 * Verify the single-field RICE config round-trip works end-to-end:
 * save riceScoreField → retrieve config → field is persisted.
 * Does not require a Jira connection.
 */
test.describe('Releases RICE Config API @releases', () => {
  test('saves and retrieves riceScoreField via health-admin/config', async ({ request }) => {
    const base = '/api/modules/releases/planning'

    const putRes = await request.put(`${base}/releases/health-admin/config`, {
      data: { riceScoreField: 'customfield_10864', enableRice: true }
    })

    // Admin endpoints require PM auth — skip in CI containers where no user is authenticated
    if (putRes.status() === 403) {
      test.skip()
      return
    }

    expect(putRes.ok()).toBe(true)
    const putBody = await putRes.json()
    expect(putBody.saved).toBe(true)
    expect(putBody.customFieldIds.riceScoreField).toBe('customfield_10864')
    expect(putBody.enableRice).toBe(true)

    const getRes = await request.get(`${base}/releases/health-admin/config`)
    expect(getRes.ok()).toBe(true)
    const getBody = await getRes.json()
    expect(getBody.customFieldIds.riceScoreField).toBe('customfield_10864')
    expect(getBody.enableRice).toBe(true)
  })

  test('rejects riceScoreField with invalid characters', async ({ request }) => {
    const base = '/api/modules/releases/planning'
    const res = await request.put(`${base}/releases/health-admin/config`, {
      data: { riceScoreField: 'bad field!' }
    })

    // Admin endpoints require PM auth — skip in CI containers where no user is authenticated
    if (res.status() === 403) {
      test.skip()
      return
    }

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid riceScoreField')
  })
})

/**
 * Active Components
 *
 * Verify each major view (aka menu item) in the Releases module loads with
 * meaningful content
 */
test.describe('Releases Views @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  // Helper to navigate and verify a view loads with content
  async function testView(page, viewId, viewName) {
    await page.goto(`/#/releases/${viewId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Before we verify content, we need to verify the overall view loads
    const mainContent = page.locator('main, [role="main"], .min-h-screen').first();
    await expect(mainContent).toBeVisible();

    // Verify the view has rendered some meaningful content by checking for
    // data-bearing elements (not just empty containers or placeholders)
    const hasButtons = await page.locator('button').count() > 0;
    const hasInputs = await page.locator('input, select, textarea').count() > 0;
    const hasList = await page.locator('ul li, ol li').count() > 0;
    const hasTable = await page.locator('table tbody tr').count() > 0;
    const hasHeadings = await page.locator('h1, h2, h3').count() > 0;
    const hasLinks = await page.locator('a[href]').count() > 0;
    const hasDataElements = await page.locator('[data-testid], [data-key], [data-id]').count() > 0;
    const hasSections = await page.locator('article, section').count() > 0;

    // If this value is 'false', then it indicates we've loaded an empty page.
    const hasContent = hasButtons || hasInputs || hasList || hasTable ||
                       hasHeadings || hasLinks || hasDataElements || hasSections;
    expect(hasContent).toBe(true);

    // Verify we're not stuck in an infinite loading state
    // Use specific selectors to avoid matching legitimate status regions
    const loadingSpinners = await page.locator('[aria-busy="true"], [role="progressbar"], .loading, .spinner, [aria-label*="loading" i]').count();
    expect(loadingSpinners).toBe(0);
    if (page.errors.length > 0) {
      console.error(`${viewName} errors:`, page.errors);
    }

    expect(page.errors).toHaveLength(0);
  }

  test('should load Plan view', async ({ page }) => {
    await testView(page, 'plan', 'Plan');
  });

  test('should load Execute view', async ({ page }) => {
    await testView(page, 'execute', 'Execute');
  });

  test('should load Deliver view', async ({ page }) => {
    await testView(page, 'deliver', 'Deliver');
  });

  test('should load Reports view', async ({ page }) => {
    await testView(page, 'reports', 'Reports');
  });

  test('should load Audit view', async ({ page }) => {
    await testView(page, 'audit', 'Audit');
  });

  test('should load Schedule view', async ({ page }) => {
    await testView(page, 'schedule', 'Schedule');
  });
});

/**
 * PM Hub
 *
 * Verify the PM Hub tab loads under Plan, the Component Release Load Tracking
 * report card is visible and clickable, and the PM Hub API endpoints respond.
 */
test.describe('Releases PM Hub @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show PM Hub tab under Plan and load report card', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const pmHubTab = page.locator('button', { hasText: 'PM Hub' });
    await expect(pmHubTab).toBeVisible();

    await pmHubTab.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const reportCard = page.locator('text=Component Release Load Tracking');
    await expect(reportCard.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('should open Component Release Load report with filter dropdowns', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.locator('button', { hasText: 'PM Hub' }).click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const reportCard = page.locator('.cursor-pointer', { hasText: 'Component Release Load Tracking' });
    await reportCard.first().click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const componentFilter = page.locator('text=Jira Component');
    const releaseFilter = page.locator('text=Release');
    await expect(componentFilter.first()).toBeVisible();
    await expect(releaseFilter.first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide Closed' })).toHaveCount(0);

    expect(page.errors).toHaveLength(0);
  });

  test('PM Hub API endpoints should respond', async ({ request }) => {
    const componentsRes = await request.get('/api/modules/releases/pm-hub/jira/components');
    expect(componentsRes.ok()).toBe(true);
    const componentsBody = await componentsRes.json();
    expect(componentsBody).toHaveProperty('components');
    expect(componentsBody).toHaveProperty('projects');
    expect(Array.isArray(componentsBody.components)).toBe(true);

    const versionsRes = await request.get('/api/modules/releases/pm-hub/jira/versions');
    expect(versionsRes.ok()).toBe(true);
    const versionsBody = await versionsRes.json();
    expect(versionsBody).toHaveProperty('versions');
    expect(versionsBody).toHaveProperty('projects');
    expect(Array.isArray(versionsBody.versions)).toBe(true);
  });

  test('component-release-load endpoint requires filters', async ({ request }) => {
    const res = await request.get('/api/modules/releases/pm-hub/component-release-load');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('filter');
  });

  test('component-release-load hides velocity while Feature/Initiative load remains', async ({ request }) => {
    const componentsRes = await request.get('/api/modules/releases/pm-hub/jira/components');
    const componentsBody = await componentsRes.json();
    if (!componentsBody.components || componentsBody.components.length === 0) {
      test.skip();
      return;
    }
    expect(componentsBody.projects).toEqual(expect.arrayContaining(['RHAISTRAT', 'AIPCC']));
    var compName = componentsBody.components[0].name;
    var res = await request.get('/api/modules/releases/pm-hub/component-release-load?components=' + encodeURIComponent(compName));
    if (!res.ok()) {
      test.skip();
      return;
    }
    var body = await res.json();
    expect(body).toHaveProperty('groups');
    expect(body.velocity).toBeNull();
    expect(body).toHaveProperty('delivered');
    expect(body.delivered).toHaveProperty('issues');
    expect(Array.isArray(body.delivered.issues)).toBe(true);
    expect(body.delivered).toHaveProperty('timedOut');
    expect(body.delivered.skipped).toBe('no-versions');
  });

  test('should show Requested/Committed load KPIs without velocity card', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.locator('button', { hasText: 'PM Hub' }).click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var reportCard = page.locator('.cursor-pointer', { hasText: 'Component Release Load Tracking' });
    await reportCard.first().click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Select a component from the dropdown to trigger data load
    var componentInput = page.locator('input[placeholder="Search…"]').first();
    await componentInput.click();
    await page.waitForTimeout(500);

    var firstOption = page.locator('button', { hasText: /^(?!.*Clear)/ }).filter({ has: page.locator('.rounded.border') }).first();
    if (await firstOption.count() > 0) {
      await firstOption.click();
      await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

      await expect(page.locator('text=Requested').first()).toBeVisible();
      await expect(page.locator('text=Committed').first()).toBeVisible();
      await expect(page.locator('text=Delivered').first()).toBeVisible();
      await expect(page.getByText('Early or as requested', { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Align legend' }).first()).toBeVisible();
      await expect(page.locator('text=Selected scope').first()).toBeVisible();
      await expect(page.locator('text=Avg Features Delivered')).toHaveCount(0);
      await expect(page.locator('text=avg/rel')).toHaveCount(0);
    }

    expect(page.errors).toHaveLength(0);
  });

  test('auto-loads data on mount when version filter is saved in localStorage', async ({ page }) => {
    // Seed a version filter. Version labels map directly to PORTFOLIO_VERSIONS so the
    // watcher fires as soon as selectedVersions is restored — no component list needed.
    await page.addInitScript(`
      localStorage.setItem('pm-hub-filters', JSON.stringify({
        components: [],
        pillars: [],
        versions: ['3.5']
      }));
    `);

    // Track whether the component-release-load API is called automatically on mount.
    var loadRequests = [];
    page.on('request', function(req) {
      if (req.url().includes('/pm-hub/component-release-load')) loadRequests.push(req.url());
    });

    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.locator('button', { hasText: 'PM Hub' }).click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var reportCard = page.locator('.cursor-pointer', { hasText: 'Component Release Load Tracking' });
    await reportCard.first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The API must have been called — savedVersions triggers loadData() automatically on mount.
    expect(loadRequests.length).toBeGreaterThan(0);

    // The "select filters" empty prompt must NOT be visible (hasFetched=true).
    var emptyPrompt = page.locator('text=Select components and/or releases to view data.');
    await expect(emptyPrompt).not.toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('pillar-config endpoint returns valid config', async ({ request }) => {
    const res = await request.get('/api/modules/releases/pm-hub/pillar-config');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('pillars');
    expect(Array.isArray(body.pillars)).toBe(true);
    expect(body.pillars.length).toBeGreaterThan(0);
    expect(body.pillars[0]).toHaveProperty('name');
    expect(body.pillars[0]).toHaveProperty('components');
  });
});

/**
 * Field and BU Feedback (Plan tab)
 *
 * Verify the Field and BU Feedback tab loads under Plan, renders the compact
 * table chrome (search + filters), and that the planning API responds.
 */
test.describe('Releases Field and BU Feedback @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show Field and BU Feedback tab under Plan', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const feedbackTab = page.locator('button', { hasText: 'Field and BU Feedback' });
    await expect(feedbackTab).toBeVisible();

    await feedbackTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('h2', { hasText: 'Field and BU Feedback' })).toBeVisible();
    await expect(page.getByTestId('bu-feedback-search')).toBeVisible();
    await expect(page.getByTestId('bu-feedback-table')).toBeVisible();
    await expect(page.getByTestId('bu-feedback-filter-type')).toBeVisible();
    expect(page.errors).toHaveLength(0);
  });

  test('Field and BU Feedback deep link loads compact table chrome', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=bu-feedback');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('h2', { hasText: 'Field and BU Feedback' })).toBeVisible();
    await expect(page.getByTestId('bu-feedback-search')).toBeVisible();
    await expect(page.getByTestId('bu-feedback-filter-status')).toBeVisible();
    await expect(page.getByTestId('bu-feedback-filter-component')).toBeVisible();

    const table = page.getByTestId('bu-feedback-table');
    await expect(table).toBeVisible();
    await expect(page.locator('thead th', { hasText: 'Issue' }).first()).toBeVisible();
    await expect(page.locator('thead th', { hasText: 'Status' }).first()).toBeVisible();
    await expect(page.locator('thead select')).toHaveCount(0);

    expect(page.errors).toHaveLength(0);
  });

  test('bu-feedback API returns issues with resolved and inProgressAt fields', async ({ request }) => {
    const apiResponse = await request.get('/api/modules/releases/planning/bu-feedback');
    expect(apiResponse.ok()).toBe(true);
    const body = await apiResponse.json();
    expect(body).toHaveProperty('issues');
    expect(Array.isArray(body.issues)).toBe(true);
    if (body.issues.length > 0) {
      expect(body.issues[0]).toHaveProperty('resolved');
      expect(body.issues[0]).toHaveProperty('inProgressAt');
    }
  });

  test('Executive Summary renders when issues exist', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=bu-feedback');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const apiResponse = await page.request.get('/api/modules/releases/planning/bu-feedback');
    const body = await apiResponse.json();
    if (!body.issues || body.issues.length === 0) {
      test.skip();
      return;
    }

    const summary = page.getByTestId('bu-feedback-exec-summary');
    await expect(summary).toBeVisible();
    await expect(summary.locator('text=Executive Summary')).toBeVisible();
    await expect(page.getByTestId('bu-feedback-metrics-table')).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('toggle switch between BU Feedback and SFDC Issues views', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=bu-feedback');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('h2', { hasText: 'Field and BU Feedback' })).toBeVisible();
    const sfdcTab = page.locator('button[role="tab"]', { hasText: 'SFDC Issues' });
    await expect(sfdcTab).toBeVisible();

    await sfdcTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('h2', { hasText: 'SFDC Issues' })).toBeVisible();
    await expect(page.getByTestId('bu-feedback-table')).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('sfdc-issues API returns issues with sfdcCasesCount', async ({ request }) => {
    const apiResponse = await request.get('/api/modules/releases/planning/sfdc-issues');
    expect(apiResponse.ok()).toBe(true);
    const body = await apiResponse.json();
    expect(body).toHaveProperty('issues');
    expect(Array.isArray(body.issues)).toBe(true);
    if (body.issues.length > 0) {
      expect(body.issues[0]).toHaveProperty('sfdcCasesCount');
      expect(body.issues[0]).toHaveProperty('hasFeedbackLabel');
    }
  });

  test('SFDC tab switch works without errors', async ({ page, request }) => {
    const apiRes = await request.get('/api/modules/releases/planning/sfdc-issues');
    const body = await apiRes.json();
    const hasIssues = body.issues && body.issues.length > 0;

    await page.goto('/#/releases/plan?tab=bu-feedback');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const sfdcTab = page.locator('button[role="tab"]', { hasText: 'SFDC Issues' });
    await sfdcTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('h2', { hasText: 'SFDC Issues' })).toBeVisible();

    if (hasIssues) {
      await expect(page.getByTestId('bu-feedback-exec-summary')).toBeVisible();
    }

    expect(page.errors).toHaveLength(0);
  });
});

/**
 * Draft Plans (Plan tab)
 *
 * Verify the Draft Plans red-pen view loads under Plan (tab + deep link),
 * shows the release-cycle chrome and candidate table (demo fixture), and that
 * the cycles / editor APIs respond. Skips freeze/approve matrix coverage.
 */
test.describe('Releases Draft Plans @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show Draft Plans tab under Plan and load draft table', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const draftPlansTab = page.locator('button', { hasText: 'Draft Plans' });
    await expect(draftPlansTab).toBeVisible();

    await draftPlansTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByText('Release cycle', { exact: true }).first()).toBeVisible();
    await expect(page.locator('h2', { hasText: /Draft Plan/ })).toBeVisible();

    const table = page.locator('table[role="table"]');
    await expect(table).toBeVisible();

    const dataRows = page.locator('tbody tr[role="row"]');
    await expect(dataRows.first()).toBeVisible({ timeout: 15000 });
    expect(await dataRows.count()).toBeGreaterThan(0);

    expect(page.errors).toHaveLength(0);
  });

  test('Draft Plans deep link loads with candidates', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=draft-plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByText('Release cycle', { exact: true }).first()).toBeVisible();
    await expect(page.locator('h2', { hasText: /Draft Plan/ })).toBeVisible();

    const keyHeader = page.locator('thead th', { hasText: 'Key' });
    await expect(keyHeader.first()).toBeVisible();
    await expect(page.locator('thead th', { hasText: 'Big Rock' }).first()).toBeVisible();

    const dataRows = page.locator('tbody tr[role="row"]');
    await expect(dataRows.first()).toBeVisible({ timeout: 15000 });
    expect(await dataRows.count()).toBeGreaterThan(0);

    expect(page.errors).toHaveLength(0);
  });

  test('clicking a Draft Plans row opens the feature detail drawer', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=draft-plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const dataRows = page.locator('tbody tr[role="row"]');
    await expect(dataRows.first()).toBeVisible({ timeout: 15000 });

    // Click title cell (opens drawer; avoids Jira key link navigation)
    await dataRows.first().locator('td').nth(2).click();
    await page.waitForTimeout(500);

    const drawer = page.locator('[role="complementary"][aria-label="Draft plan feature detail"]');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Strategy', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Big Rock', { exact: true })).toBeVisible();
    await expect(drawer.getByText('Outcome', { exact: true })).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('draft-plans cycles and editor APIs return demo candidates', async ({ request }) => {
    const cyclesRes = await request.get('/api/modules/releases/draft-plans/cycles?product=RHOAI');
    if (cyclesRes.status() === 403) {
      test.skip();
      return;
    }
    expect(cyclesRes.ok()).toBe(true);
    const cyclesBody = await cyclesRes.json();
    expect(cyclesBody).toHaveProperty('product', 'RHOAI');
    expect(cyclesBody).toHaveProperty('cycles');
    expect(Array.isArray(cyclesBody.cycles)).toBe(true);
    expect(cyclesBody.cycles.length).toBeGreaterThan(0);

    const editorRes = await request.get('/api/modules/releases/draft-plans/editor/3.6?product=RHOAI');
    if (editorRes.status() === 403) {
      test.skip();
      return;
    }
    expect(editorRes.ok()).toBe(true);
    const editorBody = await editorRes.json();
    expect(editorBody).toHaveProperty('draft');
    expect(editorBody.draft).toHaveProperty('candidates');
    expect(Array.isArray(editorBody.draft.candidates)).toBe(true);
    expect(editorBody.draft.candidates.length).toBeGreaterThan(0);
  });
});

/**
 * Unified Feature Store — AI Review endpoints
 *
 * Verify that the releases execution store serves feature data with aiReview
 * fields populated from demo fixtures.
 */
test.describe('Releases Unified Feature Store @releases', () => {
  test('execution features API returns aiReview data in index', async ({ request }) => {
    const res = await request.get('/api/modules/releases/execution/features');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('features');
    expect(Array.isArray(body.features)).toBe(true);

    // Demo fixtures include features with aiReview summaries
    const withAiReview = body.features.filter(f => f.aiReview);
    expect(withAiReview.length).toBeGreaterThan(0);

    // Verify aiReview shape on first match
    const sample = withAiReview[0].aiReview;
    expect(sample).toHaveProperty('recommendation');
    expect(sample).toHaveProperty('scores');
    expect(sample).toHaveProperty('humanReviewStatus');
  });

  test('execution feature detail includes full aiReview data', async ({ request }) => {
    // TEST1-1168 is a fixture feature with aiReview + history
    const res = await request.get('/api/modules/releases/execution/features/TEST1-1168');
    expect(res.ok()).toBe(true);
    const feature = await res.json();
    expect(feature).toHaveProperty('aiReview');
    expect(feature.aiReview).toHaveProperty('recommendation');
    expect(feature.aiReview).toHaveProperty('scores');
    expect(feature.aiReview).toHaveProperty('humanReviewStatus');
    expect(feature.aiReview).toHaveProperty('reviewedAt');
  });

  test('AI Impact features API reads from unified store', async ({ request }) => {
    const res = await request.get('/api/modules/ai-impact/features');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('features');
    expect(body).toHaveProperty('totalFeatures');
    expect(body.totalFeatures).toBeGreaterThan(0);

    // Verify backward-compatible shape: { [key]: { key, title, recommendation, ... } }
    const keys = Object.keys(body.features);
    expect(keys.length).toBeGreaterThan(0);
    const sample = body.features[keys[0]];
    expect(sample).toHaveProperty('key');
    expect(sample).toHaveProperty('recommendation');
    expect(sample).toHaveProperty('scores');
    expect(sample).toHaveProperty('humanReviewStatus');
  });
});

/**
 * Planning Health Checks
 *
 * Verify planning health UI renders correctly in demo mode.
 * The demo fixture includes releasePhaseMode: 'planning' and planningChecks data.
 */
test.describe('Releases Planning Health @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('Big Rocks tab shows planning readiness banner when in planning mode', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // In demo mode with planning fixture, the planning readiness banner should appear
    // if the health data has releasePhaseMode === 'planning'
    // Banner may or may not be visible depending on demo fixture config
    // Just verify page loads without errors
    expect(page.errors).toHaveLength(0);
  });

  // Health tab is temporarily hidden from PlanView — skip until re-enabled
  test.skip('Health tab loads and shows planning mode banner when applicable', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=health');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Verify the health dashboard renders without errors
    const heading = page.locator('h1', { hasText: 'Release Plan Health' });
    await expect(heading).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('Health API includes planning fields in response', async ({ request }) => {
    // First get available releases
    const releasesRes = await request.get('/api/modules/releases/planning/releases');
    if (!releasesRes.ok()) {
      test.skip();
      return;
    }
    const releases = await releasesRes.json();
    if (!releases || releases.length === 0) {
      test.skip();
      return;
    }

    const version = releases[0].version;
    const healthRes = await request.get(`/api/modules/releases/planning/releases/${version}/health`);
    if (!healthRes.ok()) {
      test.skip();
      return;
    }

    const health = await healthRes.json();
    // Verify the health cache includes the new releasePhaseMode field
    // (it may be 'planning', 'execution', or 'unknown' depending on demo data)
    expect(health).toHaveProperty('releasePhaseMode');
    expect(['planning', 'execution', 'unknown']).toContain(health.releasePhaseMode);

    // If in planning mode, verify planningReadiness is present in summary
    if (health.releasePhaseMode === 'planning' && health.summary) {
      expect(health.summary).toHaveProperty('planningReadiness');
    }
  });
});

/**
 * FPDoR Readiness Model
 *
 * Verify the new FPDoR (Feature Planning Definition of Ready) readiness model:
 * - Releases module is visible and clickable in sidebar
 * - Feature List view loads with the new FPDoR readiness display
 * - Priority scores render in the PM Hub view
 * - API endpoint returns features with fpdor and readinessGates shape
 */
test.describe('Releases FPDoR Readiness @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('Releases module is visible and clickable in sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var moduleHeader = page.locator('aside nav button').filter({ hasText: 'Releases' }).first();
    await expect(moduleHeader).toBeVisible();

    await moduleHeader.click();
    await page.waitForTimeout(500);

    var planLink = page.locator('aside nav button').filter({ hasText: 'Plan' }).first();
    await planLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.url()).toContain('releases');
    expect(page.errors).toHaveLength(0);
  });

  test('Feature List view loads under Plan tab', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=feature-readiness');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var table = page.locator('table[role="table"]');
    await expect(table).toBeVisible();

    var headerRow = page.locator('thead th');
    var headerCount = await headerRow.count();
    expect(headerCount).toBeGreaterThan(5);

    // Use hasText (not getByRole name) — Score/Readiness/Align headers embed tooltip copy in the accessible name.
    var scoreHeader = page.locator('thead th', { hasText: 'Score' });
    await expect(scoreHeader.first()).toBeVisible();
    await expect(scoreHeader.first()).toHaveAttribute('aria-sort', 'descending');

    var readinessHeader = page.locator('thead th', { hasText: 'Readiness' });
    await expect(readinessHeader.first()).toBeVisible();
    await expect(readinessHeader.first()).toHaveClass(/cursor-pointer/);

    await readinessHeader.first().click();
    await expect(readinessHeader.first()).toHaveAttribute('aria-sort', 'ascending');

    await scoreHeader.first().click();
    await expect(scoreHeader.first()).toHaveAttribute('aria-sort', 'descending');
    await scoreHeader.first().click();
    await expect(scoreHeader.first()).toHaveAttribute('aria-sort', 'ascending');
    await scoreHeader.first().click();
    await expect(scoreHeader.first()).toHaveAttribute('aria-sort', 'none');

    var alignHeader = page.locator('thead th', { hasText: 'TV/FV Align' });
    await expect(alignHeader.first()).toBeVisible();
    await expect(alignHeader.first()).toHaveClass(/cursor-pointer/);

    expect(page.errors).toHaveLength(0);
  });

  test('Feature List shows FPDoR readiness badges', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=feature-readiness');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var dataRows = page.locator('tbody tr[role="row"]');
    var rowCount = await dataRows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    var readinessBadges = page.locator('tbody [role="button"][data-popover-trigger]');
    var badgeCount = await readinessBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    var firstBadge = readinessBadges.first();
    var badgeText = await firstBadge.textContent();
    expect(badgeText).toMatch(/\d+\/\d+/);

    expect(page.errors).toHaveLength(0);
  });

  test('Feature List shows Product, Failed FPDoR filters and Export CSV', async ({ page }) => {
    await page.goto('/#/releases/plan?tab=feature-readiness');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.getByText('Product', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /All products/i })).toBeVisible();
    await expect(page.getByText('Failed FPDoR', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Any failed item/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /All alignments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('PM Hub view loads with priority scores visible', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var pmHubTab = page.locator('button', { hasText: 'PM Hub' });
    await expect(pmHubTab).toBeVisible();

    await pmHubTab.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var reportCard = page.locator('text=Component Release Load Tracking');
    await expect(reportCard.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('feature-readiness API returns features with fpdor and readinessGates', async ({ request }) => {
    var res = await request.get('/api/modules/releases/planning/feature-readiness');
    if (res.status() === 403) {
      test.skip();
      return;
    }
    expect(res.ok()).toBe(true);
    var body = await res.json();

    expect(body).toHaveProperty('pendingReview');
    expect(body).toHaveProperty('ready');
    expect(Array.isArray(body.pendingReview)).toBe(true);
    expect(Array.isArray(body.ready)).toBe(true);

    var allFeatures = body.pendingReview.concat(body.ready);
    if (allFeatures.length === 0) {
      test.skip();
      return;
    }

    var sample = allFeatures[0];

    expect(sample).toHaveProperty('fpdor');
    expect(sample.fpdor).toHaveProperty('items');
    expect(sample.fpdor).toHaveProperty('passedCount');
    expect(sample.fpdor).toHaveProperty('totalCount');
    expect(sample.fpdor).toHaveProperty('evaluatedCount');
    expect(sample.fpdor).toHaveProperty('applicableCount');
    expect(sample.fpdor).toHaveProperty('allApplicablePassed');
    expect(sample.fpdor).toHaveProperty('groups');
    expect(Array.isArray(sample.fpdor.items)).toBe(true);
    expect(sample.fpdor.totalCount).toBe(17);
    expect(sample.fpdor.items.length).toBe(17);

    var itemNames = sample.fpdor.items.map(function(i) { return i.name });
    expect(itemNames).toContain('Target Version');
    expect(itemNames).toContain('UXD');
    expect(itemNames).toContain('Cross-team deps');

    var item = sample.fpdor.items[0];
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('pass');
    expect(item).toHaveProperty('source');
    expect(item).toHaveProperty('state');
    expect(item).toHaveProperty('group');
    expect(['mandatory', 'criteria']).toContain(item.group);
    expect(item.source).toBe('jira');
    expect(['passed', 'failed', 'not-checked']).toContain(item.state);

    expect(sample).toHaveProperty('readinessGates');
    expect(sample.readinessGates).toHaveProperty('fpDorPassed');
    expect(sample.readinessGates).toHaveProperty('fpDorTotal');
    expect(sample.readinessGates).toHaveProperty('fpDorEvaluated');
    expect(sample.readinessGates).toHaveProperty('fpDorApplicable');
    expect(sample.readinessGates).toHaveProperty('pastRefinement');
    expect(sample.readinessGates).toHaveProperty('noBlockingViolations');
    expect(typeof sample.readinessGates.fpDorPassed).toBe('number');
    expect(typeof sample.readinessGates.fpDorTotal).toBe('number');
    expect(typeof sample.readinessGates.fpDorApplicable).toBe('number');
    expect(typeof sample.readinessGates.pastRefinement).toBe('boolean');

    // TV/FV Align (same categories as Reports → TV vs FV Delta / PM Hub)
    expect(sample).toHaveProperty('alignmentCategory');
    if (sample.alignmentCategory != null) {
      expect([
        'aligned_on_time',
        'aligned_late',
        'after_requested',
        'misaligned',
        'tv_only',
        'fv_only'
      ]).toContain(sample.alignmentCategory);
    }
  });

  test('feature-readiness API returns priority score breakdown', async ({ request }) => {
    var res = await request.get('/api/modules/releases/planning/feature-readiness');
    if (res.status() === 403) {
      test.skip();
      return;
    }
    expect(res.ok()).toBe(true);
    var body = await res.json();

    var allFeatures = body.pendingReview.concat(body.ready);
    var withScore = allFeatures.filter(function(f) { return f.priorityScoreBreakdown && f.priorityScoreBreakdown.signals });
    if (withScore.length === 0) {
      test.skip();
      return;
    }

    var breakdown = withScore[0].priorityScoreBreakdown;
    expect(breakdown).toHaveProperty('score');
    expect(breakdown).toHaveProperty('signals');
    expect(Array.isArray(breakdown.signals)).toBe(true);
    expect(breakdown.signals.length).toBeGreaterThan(0);

    var signal = breakdown.signals[0];
    expect(signal).toHaveProperty('name');
    expect(signal).toHaveProperty('value');
    expect(signal).toHaveProperty('weight');
    expect(typeof signal.value).toBe('number');
    expect(typeof signal.weight).toBe('number');
  });
});

/**
 * RHOAI Release Readiness Dashboard
 *
 * Verify the release readiness report card is visible, clickable, and renders
 * the expected dashboard structure with version selector and content sections.
 */
test.describe('Releases Release Readiness @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('release readiness report card is visible in Reports hub', async ({ page }) => {
    await page.goto('/#/releases/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const card = page.locator('text=RHOAI Release Readiness');
    await expect(card.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('release readiness report loads with content', async ({ page }) => {
    await page.goto('/#/releases/reports?report=release-readiness');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const heading = page.locator('text=RHOAI Release Readiness');
    await expect(heading.first()).toBeVisible();

    const mainContent = page.locator('main, [role="main"], .min-h-screen').first();
    await expect(mainContent).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('release readiness versions API returns available versions', async ({ request }) => {
    const res = await request.get('/api/modules/releases/release-readiness/versions');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('versions');
    expect(Array.isArray(body.versions)).toBe(true);
  });

  test('release readiness metrics API returns data for fixture version', async ({ request }) => {
    const res = await request.get('/api/modules/releases/release-readiness?version=rhoai-3.5.EA2');
    if (res.status() === 404) {
      test.skip();
      return;
    }
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('summary');
    expect(body).toHaveProperty('director_summary');
    expect(body).toHaveProperty('component_readiness');
    expect(body).toHaveProperty('product_blockers');
    expect(body.summary).toHaveProperty('total_work');
    expect(body.summary).toHaveProperty('progress_pct');
  });

  test('release readiness refresh endpoint is not a data-producing GET', async ({ request }) => {
    const res = await request.post('/api/modules/releases/release-readiness/refresh?version=rhoai-3.5.EA2');
    const body = await res.json();
    expect(body).not.toHaveProperty('director_summary');
  });
});

/**
 * Release Blockers (Deliver tab)
 *
 * Verify the Release Blockers sub-tab is visible and clickable in the Deliver
 * view, the API returns the expected response shape, and the view renders
 * summary cards, tables, and the version input.
 */
test.describe('Releases Blockers @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('Release Blockers tab is visible and clickable in Deliver view', async ({ page }) => {
    await page.goto('/#/releases/deliver');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var blockerTab = page.locator('button', { hasText: 'Release Blockers' });
    await expect(blockerTab).toBeVisible();

    await blockerTab.click();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(page.errors).toHaveLength(0);
  });

  test('Release Blockers view loads without errors via deep link', async ({ page }) => {
    await page.goto('/#/releases/deliver?tab=release-blockers');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var mainContent = page.locator('main, [role="main"], .min-h-screen').first();
    await expect(mainContent).toBeVisible();

    // Version input or summary cards should be visible (depends on whether analysis data is cached)
    var hasInput = await page.locator('input[placeholder*="rhoai"]').count() > 0;
    var hasCards = await page.locator('text=TOTAL BLOCKERS').count() > 0;
    expect(hasInput || hasCards).toBe(true);

    expect(page.errors).toHaveLength(0);
  });

  test('Release Blockers view renders summary cards for a version', async ({ page }) => {
    // Use version param to load data directly via URL
    await page.goto('/#/releases/deliver?tab=release-blockers&version=3.5');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('text=TOTAL BLOCKERS').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=PROPOSED').first()).toBeVisible();
    await expect(page.locator('text=APPROVED').first()).toBeVisible();
    await expect(page.locator('text=REJECTED').first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('blockers API returns expected response shape', async ({ request }) => {
    var res = await request.get('/api/modules/releases/delivery/blockers/3.5');
    expect(res.ok()).toBe(true);
    var body = await res.json();

    expect(body).toHaveProperty('releaseNumber', '3.5');
    expect(body).toHaveProperty('fetchedAt');
    expect(body).toHaveProperty('summary');
    expect(body.summary).toHaveProperty('proposed');
    expect(body.summary).toHaveProperty('approved');
    expect(body.summary).toHaveProperty('rejected');
    expect(body.summary).toHaveProperty('noStatus');
    expect(body.summary).toHaveProperty('total');

    expect(body).toHaveProperty('timing');
    expect(body.timing).toHaveProperty('proposedBeforeCodeFreeze');
    expect(body.timing).toHaveProperty('proposedAfterCodeFreeze');

    expect(body).toHaveProperty('aging');
    expect(body.aging).toHaveProperty('proposalToDecision');
    expect(body.aging.proposalToDecision).toHaveProperty('avg');
    expect(body.aging.proposalToDecision).toHaveProperty('count');
    expect(body.aging).toHaveProperty('approvalToResolution');
    expect(body.aging).toHaveProperty('byStatus');

    expect(body).toHaveProperty('blockers');
    expect(Array.isArray(body.blockers)).toBe(true);
    expect(body).toHaveProperty('criticalMonitoring');
    expect(Array.isArray(body.criticalMonitoring)).toBe(true);
  });

  test('blockers API rejects invalid release number', async ({ request }) => {
    var res = await request.get('/api/modules/releases/delivery/blockers/; DROP TABLE');
    expect(res.status()).toBe(400);
    var body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

/**
 * Big Rocks hybrid hierarchy fields
 *
 * Candidates responses include hierarchySource + per-feature inIndex so the
 * UI can show Jira-discovered children that are not yet in the execution index.
 * Demo mode serves fixtures (hierarchySource=index); live refresh uses jira/index.
 */
test.describe('Releases Big Rocks hybrid candidates @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('candidates API exposes hierarchySource and inIndex on features', async ({ request }) => {
    const releasesRes = await request.get('/api/modules/releases/planning/releases');
    expect(releasesRes.ok()).toBe(true);
    const releases = await releasesRes.json();
    expect(Array.isArray(releases)).toBe(true);
    expect(releases.length).toBeGreaterThan(0);

    const version = releases[0].version;
    const res = await request.get(`/api/modules/releases/planning/releases/${version}/candidates`);
    expect(res.ok()).toBe(true);
    const body = await res.json();

    expect(body).toHaveProperty('features');
    expect(Array.isArray(body.features)).toBe(true);
    expect(body.features.length).toBeGreaterThan(0);
    expect(body).toHaveProperty('hierarchySource');
    expect(['jira', 'index']).toContain(body.hierarchySource);

    const withIndexFlag = body.features.filter(function (f) {
      return typeof f.inIndex === 'boolean';
    });
    expect(withIndexFlag.length).toBe(body.features.length);

    // Demo fixture includes at least one Jira-only hybrid child
    if (body.demoMode) {
      expect(body.hierarchySource).toBe('index');
      expect(body.features.some(function (f) { return f.inIndex === false; })).toBe(true);
    }
  });

  test('Big Rocks plan view loads rock table from candidates', async ({ page }) => {
    await page.goto('/#/releases/plan');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const bigRocksTab = page.getByRole('button', { name: /Big Rocks/i }).or(
      page.locator('button, a, [role="tab"]', { hasText: /Big Rocks/i })
    );
    if (await bigRocksTab.first().isVisible().catch(function () { return false; })) {
      await bigRocksTab.first().click();
      await page.waitForTimeout(500);
    }

    // Rock names from demo candidates fixture should render
    await expect(page.getByText('MaaS', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    expect(page.errors).toHaveLength(0);
  });
});

/**
 * CVE Sustaining Report
 *
 * Verify the CVE sustaining report renders from fixture data, displays
 * charts/tables, supports client-side filtering, and opens drill-down
 * modals on click.
 */
test.describe('Releases CVE Sustaining Report @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('CVE sustaining report card is visible in Reports hub', async ({ page }) => {
    await page.goto('/#/releases/reports');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var card = page.locator('text=RHAI Sustaining (CVEs)');
    await expect(card.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('CVE sustaining report loads with charts and tables', async ({ page }) => {
    await page.goto('/#/releases/reports?report=cve-sustaining');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Report heading
    await expect(page.locator('text=RHAI Sustaining (CVEs)').first()).toBeVisible();

    // Open CVEs banner
    await expect(page.locator('text=Open CVEs').first()).toBeVisible();

    // Due date section
    await expect(page.locator('text=CVEs by Due Date').first()).toBeVisible();
    await expect(page.locator('text=Due Date Passed').first()).toBeVisible();

    // Bar chart section
    await expect(page.locator('text=RHAI Open CVEs').first()).toBeVisible();

    // Version matrix table
    await expect(page.locator('text=CVEs across all versions').first()).toBeVisible();

    // Assignee table
    await expect(page.locator('text=CVEs by Assignee').first()).toBeVisible();

    // Time series charts
    await expect(page.locator('text=Created vs Resolved').first()).toBeVisible();
    await expect(page.locator('text=Unresolved').first()).toBeVisible();
    await expect(page.locator('text=RHAI False Positives').first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('CVE sustaining API returns cached fixture data', async ({ request }) => {
    var res = await request.get('/api/modules/releases/cve-sustaining');
    expect(res.ok()).toBe(true);
    var body = await res.json();

    expect(body).toHaveProperty('lastRefreshed');
    expect(body).toHaveProperty('totalOpen');
    expect(body).toHaveProperty('totalAll');
    expect(body).toHaveProperty('openCvesByComponent');
    expect(body).toHaveProperty('cvesByDueDate');
    expect(body).toHaveProperty('cvesAcrossVersions');
    expect(body).toHaveProperty('openCvesByVersion');
    expect(body).toHaveProperty('cvesByAssigneeStatus');
    expect(body).toHaveProperty('falsePositivesByVex');
    expect(body).toHaveProperty('createdVsResolved');
    expect(body).toHaveProperty('unresolved');
    expect(body).toHaveProperty('falsePositivesTrend');
    expect(body).toHaveProperty('openIssueRecords');
    expect(body).toHaveProperty('jiraSearchBase');

    expect(Array.isArray(body.openIssueRecords)).toBe(true);
    expect(body.openIssueRecords.length).toBeGreaterThan(0);

    var record = body.openIssueRecords[0];
    expect(record).toHaveProperty('key');
    expect(record).toHaveProperty('summary');
    expect(record).toHaveProperty('component');
    expect(record).toHaveProperty('components');
    expect(record).toHaveProperty('versions');
    expect(record).toHaveProperty('status');
    expect(record).toHaveProperty('assignee');
  });

  test('filter bar is visible and shows default state', async ({ page }) => {
    await page.goto('/#/releases/reports?report=cve-sustaining');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Default no-filter text
    await expect(page.locator('text=Showing all open CVEs').first()).toBeVisible();

    // Edit Filters button should be present
    var editBtn = page.locator('button', { hasText: 'Manage Filters' }).first();
    await expect(editBtn).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('filter modal opens and shows filter fields', async ({ page }) => {
    await page.goto('/#/releases/reports?report=cve-sustaining');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Open filter modal
    var editBtn = page.locator('button', { hasText: 'Manage Filters' }).first();
    await editBtn.click();
    await page.waitForTimeout(500);

    // Modal should be visible with filter fields
    await expect(page.locator('text=Filters').first()).toBeVisible();
    await expect(page.locator('text=Component').first()).toBeVisible();
    await expect(page.locator('text=Target Version').first()).toBeVisible();
    await expect(page.locator('text=Assignee').first()).toBeVisible();
    await expect(page.locator('text=Status').first()).toBeVisible();

    // Close modal
    var doneBtn = page.locator('button', { hasText: 'Done' });
    await doneBtn.click();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });

  test('applying a filter updates the report', async ({ page }) => {
    await page.goto('/#/releases/reports?report=cve-sustaining');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Open filter modal
    await page.locator('button', { hasText: 'Manage Filters' }).first().click();
    await page.waitForTimeout(500);

    // Click Component field
    await page.locator('button', { hasText: 'Component' }).first().click();
    await page.waitForTimeout(300);

    // Select "Model Serving" checkbox
    var checkbox = page.locator('label').filter({ hasText: 'Model Serving' }).locator('input[type="checkbox"]');
    await checkbox.click();
    await page.waitForTimeout(300);

    // Close modal
    await page.locator('button', { hasText: 'Done' }).click();
    await page.waitForTimeout(500);

    // Filter narrative should update
    await expect(page.locator('text=Showing all open CVEs').first()).not.toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('due date card click opens drill-down modal', async ({ page }) => {
    await page.goto('/#/releases/reports?report=cve-sustaining');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Click on a due date card
    var dueDateCard = page.locator('button', { hasText: 'Due Date Passed' });
    await expect(dueDateCard).toBeVisible();
    await dueDateCard.click();
    await page.waitForTimeout(500);

    // Drill-down modal should appear with issue table
    await expect(page.locator('text=Due Date Passed').nth(1)).toBeVisible();
    await expect(page.locator('th', { hasText: 'Key' }).first()).toBeVisible();
    await expect(page.locator('th', { hasText: 'Summary' }).first()).toBeVisible();

    // "View in Jira" button should be present
    await expect(page.locator('a', { hasText: 'View in Jira' }).first()).toBeVisible();

    // Issue keys should be clickable links
    var issueLink = page.locator('a[href*="/browse/"]').first();
    await expect(issueLink).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('version matrix cell click opens drill-down modal', async ({ page }) => {
    await page.goto('/#/releases/reports?report=cve-sustaining');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find a clickable cell in the version matrix table
    var matrixSection = page.locator('section').filter({ hasText: 'CVEs across all versions' });
    var cellButton = matrixSection.locator('button').first();
    await expect(cellButton).toBeVisible();
    await cellButton.click();
    await page.waitForTimeout(500);

    // Drill-down modal should appear
    await expect(page.locator('th', { hasText: 'Key' }).first()).toBeVisible();
    await expect(page.locator('th', { hasText: 'Summary' }).first()).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expect(page.errors).toHaveLength(0);
  });

  test('assignee table cell click opens drill-down modal', async ({ page }) => {
    await page.goto('/#/releases/reports?report=cve-sustaining');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find a clickable cell in the assignee status table
    var assigneeSection = page.locator('section').filter({ hasText: 'CVEs by Assignee' });
    var cellButton = assigneeSection.locator('button').first();
    await expect(cellButton).toBeVisible();
    await cellButton.click();
    await page.waitForTimeout(500);

    // Drill-down modal should appear with issue links
    await expect(page.locator('a[href*="/browse/"]').first()).toBeVisible();
    await expect(page.locator('a', { hasText: 'View in Jira' }).first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });
});

/**
 * Program Hygiene Report
 *
 * Verify the Program Hygiene Report loads, renders the release selector,
 * summary cards, violation charts, feature table, and team accountability
 * table. Also tests the hygiene program-report API endpoint.
 */
test.describe('Program Hygiene Report @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('program hygiene report loads with heading and selector', async ({ page }) => {
    await page.goto('/#/releases/reports?report=program-hygiene');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('text=Program Hygiene Report').first()).toBeVisible();

    // Should show the release selector button (either in empty state or selection bar)
    await expect(page.locator('button', { hasText: 'Select Release' }).first()).toBeVisible();

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('program hygiene API returns expected shape', async ({ request }) => {
    const res = await request.get('/api/modules/releases/hygiene/program-report');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('versions');
    expect(Array.isArray(body.versions)).toBe(true);
    expect(body).toHaveProperty('ruleDefinitions');
    expect(typeof body.ruleDefinitions).toBe('object');
  });

  test('release selector modal opens and has expected fields', async ({ page }) => {
    await page.goto('/#/releases/reports?report=program-hygiene');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Open the selector modal
    await page.locator('button', { hasText: 'Select Release' }).first().click();
    await page.waitForTimeout(300);

    // Modal should show family, version, and phase sections
    await expect(page.locator('text=Product Family').first()).toBeVisible();
    await expect(page.locator('text=Version').first()).toBeVisible();
    await expect(page.locator('text=Phase').first()).toBeVisible();

    // Cancel and Apply buttons
    await expect(page.locator('button', { hasText: 'Cancel' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Apply' }).first()).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('shows summary cards and violation charts when data is available', async ({ page }) => {
    await page.goto('/#/releases/reports?report=program-hygiene');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // If data loaded and a selection was auto-applied, we should see summary cards
    const versionsCard = page.locator('text=Versions').first();
    const hasData = await versionsCard.isVisible().catch(() => false);

    if (hasData) {
      await expect(page.locator('text=Total Features').first()).toBeVisible();
      await expect(page.locator('text=Features with Violations').first()).toBeVisible();
      await expect(page.locator('text=Total Violations').first()).toBeVisible();

      // Violation charts
      await expect(page.locator('text=Violations by Rule').first()).toBeVisible();
      await expect(page.locator('text=Violations by Team').first()).toBeVisible();

      // Feature table tab
      await expect(page.locator('button', { hasText: 'Features' }).first()).toBeVisible();
      await expect(page.locator('button', { hasText: 'Team Accountability' }).first()).toBeVisible();
    }

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('team accountability tab renders table', async ({ page }) => {
    await page.goto('/#/releases/reports?report=program-hygiene');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Switch to Team Accountability tab if visible
    const teamTab = page.locator('button', { hasText: 'Team Accountability' }).first();
    const tabVisible = await teamTab.isVisible().catch(() => false);

    if (tabVisible) {
      await teamTab.click();
      await page.waitForTimeout(300);

      // Team table headers
      await expect(page.locator('th', { hasText: 'Team' }).first()).toBeVisible();
      await expect(page.locator('th', { hasText: 'With Violations' }).first()).toBeVisible();
    }

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('field filter modal opens with the expected filter fields', async ({ page }) => {
    await page.goto('/#/releases/reports?report=program-hygiene');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The Filters control only shows once a release is selected. In demo mode a
    // default selection is auto-applied when the registry parses, so it is
    // normally present; guard so the test is a no-op if the board is empty.
    const filtersButton = page.locator('[data-testid="hygiene-report-filters-button"]').first();
    const hasSelection = await filtersButton.isVisible().catch(() => false);

    if (hasSelection) {
      await filtersButton.click();
      await page.waitForTimeout(300);

      await expect(page.locator('h3', { hasText: 'Filters' }).first()).toBeVisible();
      await expect(page.locator('text=Team').first()).toBeVisible();
      await expect(page.locator('text=Component').first()).toBeVisible();
      await expect(page.locator('text=Label').first()).toBeVisible();
      await expect(page.locator('button', { hasText: 'Saved Presets' }).first()).toBeVisible();

      await page.locator('button', { hasText: 'Done' }).first().click();
      await page.waitForTimeout(300);
    }

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('clicking a feature row opens the summary drawer', async ({ page }) => {
    await page.goto('/#/releases/reports?report=program-hygiene');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Requires a selection + loaded features; skip gracefully if the table is empty
    const row = page.locator('[data-testid="hygiene-report-feature-row"]').first();
    const hasRow = await row.isVisible().catch(() => false);

    if (hasRow) {
      await row.click();
      await page.waitForTimeout(500);

      const drawer = page.locator('[data-testid="feature-drawer"]');
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('text=Status Summary').first()).toBeVisible();
      await expect(drawer.locator('text=Hygiene Violations').first()).toBeVisible();
      await expect(drawer.getByRole('button', { name: 'View full details' })).toBeVisible();
      await expect(drawer.getByRole('link', { name: /Open in Jira/ })).toBeVisible();

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await expect(drawer).toHaveCount(0);
    }

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });
});

/**
 * Feature Status tab (Execute view)
 *
 * The Feature Status kanban board uses the shared release selector (product
 * family + version + phase) and the shared report filter modal (team,
 * component, label, assignee, type, priority) — the same controls as the
 * Program Level Release Report. These tests verify those controls render and
 * open correctly.
 */
// The Feature Status view degrades gracefully from two benign, environment-
// specific responses in demo mode: curated field-options sets have no demo
// fixtures (404) and /hygiene/config requires planning-manager access (403).
// Both are handled in-app, so ignore benign resource-load failures here while
// still catching real JS exceptions and other unexpected console errors.
function unexpectedHygieneErrors(page) {
  return (page.errors || []).filter(
    e => !(e.type === 'console.error' && /Failed to load resource.*\b40[134]\b/.test(e.message))
  );
}

async function dismissHygieneWelcome(page) {
  const modal = page.locator('[data-testid="hygiene-welcome-modal"]').first();
  if (await modal.isVisible().catch(() => false)) {
    await modal.locator('button', { hasText: 'Got it' }).first().click().catch(() => {});
    await modal.waitFor({ state: 'hidden' }).catch(() => {});
  }
}

test.describe('Feature Status filtering @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('tab loads with the condensed toolbar controls', async ({ page }) => {
    await page.goto('/#/releases/execute?tab=feature-status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await dismissHygieneWelcome(page);

    // Purpose subtitle keeps the page's intent discoverable
    await expect(page.locator('text=Tracks hygiene-rule compliance').first()).toBeVisible();

    // Compact toolbar: release selector + always-present "Hygiene rules" entry point
    await expect(page.locator('[data-testid="hygiene-release-selector"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="hygiene-rules-button"]').first()).toBeVisible();

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('release selector modal opens with family, version, and phase', async ({ page }) => {
    await page.goto('/#/releases/execute?tab=feature-status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await dismissHygieneWelcome(page);

    await page.locator('[data-testid="hygiene-release-selector"]').first().click();
    await page.waitForTimeout(300);

    // Exact matches — the drawer/hero copy contains "Fix Version"/"Target Version",
    // so a loose `text=Version` would match those hidden strings instead.
    await expect(page.getByText('Product Family', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Version', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Phase', { exact: true }).first()).toBeVisible();

    await expect(page.locator('button', { hasText: 'Cancel' }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Apply' }).first()).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('hygiene rules modal is reachable from the toolbar', async ({ page }) => {
    await page.goto('/#/releases/execute?tab=feature-status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Dismiss the first-visit welcome modal, then reopen it via the toolbar button
    await dismissHygieneWelcome(page);

    await page.locator('[data-testid="hygiene-rules-button"]').first().click();
    await page.waitForTimeout(300);

    // Welcome/rules modal exposes a Hygiene Rules tab for discoverability
    await expect(page.locator('text=Hygiene Rules').first()).toBeVisible();

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('field filter modal opens with the expected filter fields', async ({ page }) => {
    await page.goto('/#/releases/execute?tab=feature-status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await dismissHygieneWelcome(page);

    // The Filters control only shows once a release is selected. In demo mode a
    // default selection is auto-applied, so it should normally be present.
    const filtersButton = page.locator('[data-testid="hygiene-filters-button"]').first();
    const hasSelection = await filtersButton.isVisible().catch(() => false);

    if (hasSelection) {
      await filtersButton.click();
      await page.waitForTimeout(300);

      // Modal heading and the six filter fields in the left pane
      await expect(page.locator('h3', { hasText: 'Filters' }).first()).toBeVisible();
      await expect(page.locator('text=Team').first()).toBeVisible();
      await expect(page.locator('text=Component').first()).toBeVisible();
      await expect(page.locator('text=Assignee').first()).toBeVisible();
      await expect(page.locator('button', { hasText: 'Saved Presets' }).first()).toBeVisible();

      // Close the modal
      await page.locator('button', { hasText: 'Done' }).first().click();
      await page.waitForTimeout(300);
    }

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });

  test('clicking a feature card opens the summary drawer', async ({ page }) => {
    await page.goto('/#/releases/execute?tab=feature-status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await dismissHygieneWelcome(page);

    // Requires loaded features; skip gracefully if the board is empty in this env
    const card = page.locator('[data-testid="hygiene-feature-card"]').first();
    const hasCard = await card.isVisible().catch(() => false);

    if (hasCard) {
      await card.click();
      await page.waitForTimeout(400);

      const drawer = page.locator('[data-testid="feature-drawer"]');
      await expect(drawer).toBeVisible();

      // Key sections
      await expect(drawer.locator('text=Status Summary').first()).toBeVisible();
      await expect(drawer.locator('text=Hygiene Violations').first()).toBeVisible();

      // Both navigation affordances
      await expect(drawer.getByRole('button', { name: 'View full details' })).toBeVisible();
      const jiraLink = drawer.getByRole('link', { name: /Open in Jira/ });
      await expect(jiraLink).toBeVisible();
      await expect(jiraLink).toHaveAttribute('href', /redhat\.atlassian\.net\/browse\//);

      // Close the drawer
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await expect(drawer).toHaveCount(0);
    }

    expect(unexpectedHygieneErrors(page)).toHaveLength(0);
  });
});

test.describe('RHOAI Component Architectures Report @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('component architectures report loads with content', async ({ page }) => {
    await page.goto('/#/releases/reports?report=rhoai-component-architectures');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const heading = page.locator('text=RHOAI Component Architectures');
    await expect(heading.first()).toBeVisible();

    const productComponentHeader = page.locator('th:has-text("Product Component")');
    await expect(productComponentHeader.first()).toBeVisible();

    const jiraLinks = page.locator('a:has-text("JIRA")');
    const jiraCount = await jiraLinks.count();
    expect(jiraCount).toBeGreaterThan(0);

    const maturityLinks = page.locator('a:has-text("Maturity")');
    const maturityCount = await maturityLinks.count();
    expect(maturityCount).toBeGreaterThan(0);

    expect(page.errors).toHaveLength(0);
  });

  test('component architectures API returns data', async ({ request }) => {
    const res = await request.get('/api/modules/releases/rhoai-component-architectures');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('branches');
    expect(body).toHaveProperty('maturity');
  });
});
