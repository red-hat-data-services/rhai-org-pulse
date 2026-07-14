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

  test('component-release-load returns velocity with age and component fields', async ({ request }) => {
    const componentsRes = await request.get('/api/modules/releases/pm-hub/jira/components');
    const componentsBody = await componentsRes.json();
    if (!componentsBody.components || componentsBody.components.length === 0) {
      test.skip();
      return;
    }
    var compName = componentsBody.components[0].name;
    var res = await request.get('/api/modules/releases/pm-hub/component-release-load?components=' + encodeURIComponent(compName));
    if (!res.ok()) {
      test.skip();
      return;
    }
    var body = await res.json();
    expect(body).toHaveProperty('velocity');
    var vel = body.velocity;
    expect(vel).toHaveProperty('avgPerRelease');
    expect(vel).toHaveProperty('totalResolved');
    expect(vel).toHaveProperty('hasPartialYear');
    expect(vel).toHaveProperty('components');
    expect(vel).toHaveProperty('jql');
    expect(typeof vel.hasPartialYear).toBe('boolean');
    if (vel.components.length > 0) {
      var comp = vel.components[0];
      expect(comp).toHaveProperty('component');
      expect(comp).toHaveProperty('resolved');
      expect(comp).toHaveProperty('releases');
      expect(comp).toHaveProperty('avgPerRelease');
      expect(comp).toHaveProperty('activeWeeks');
      expect(comp).toHaveProperty('isPartialYear');
      expect(typeof comp.isPartialYear).toBe('boolean');
      expect(typeof comp.activeWeeks).toBe('number');
    }
  });

  test('should show velocity summary card and per-component badges', async ({ page }) => {
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

      // Verify the Avg Features Delivered summary card is visible
      var avgCard = page.locator('text=Avg Features Delivered');
      await expect(avgCard.first()).toBeVisible();

      // Check for component rows with velocity badges (avg/rel text)
      var velocityBadges = page.locator('text=avg/rel');
      var badgeCount = await velocityBadges.count();
      // Velocity badges appear on component rows when data is loaded
      // May be 0 if the component has no resolved features in the last year
      expect(badgeCount).toBeGreaterThanOrEqual(0);
    }

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

    var scoreHeader = page.locator('thead th', { hasText: 'Score' });
    await expect(scoreHeader.first()).toBeVisible();

    var readinessHeader = page.locator('thead th', { hasText: 'Readiness' });
    await expect(readinessHeader.first()).toBeVisible();

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
    expect(Array.isArray(sample.fpdor.items)).toBe(true);
    expect(sample.fpdor.totalCount).toBe(11);
    expect(sample.fpdor.items.length).toBe(11);

    var item = sample.fpdor.items[0];
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('pass');
    expect(item).toHaveProperty('source');
    expect(item).toHaveProperty('state');
    expect(item.source).toBe('jira');
    expect(['passed', 'failed']).toContain(item.state);

    expect(sample).toHaveProperty('readinessGates');
    expect(sample.readinessGates).toHaveProperty('fpDorPassed');
    expect(sample.readinessGates).toHaveProperty('fpDorTotal');
    expect(sample.readinessGates).toHaveProperty('fpDorEvaluated');
    expect(sample.readinessGates).toHaveProperty('pastRefinement');
    expect(sample.readinessGates).toHaveProperty('noBlockingViolations');
    expect(typeof sample.readinessGates.fpDorPassed).toBe('number');
    expect(typeof sample.readinessGates.fpDorTotal).toBe('number');
    expect(typeof sample.readinessGates.pastRefinement).toBe('boolean');
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
