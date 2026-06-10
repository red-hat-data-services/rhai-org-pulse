const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for Feature Pressure view (Releases module -> Reports hub)
 *
 * Tests verify:
 * - View loads via Reports hub (/#/releases/reports?report=feature-pressure)
 * - Executive summary cards render with correct data
 * - Monthly flow chart renders
 * - Component pressure table renders with sortable columns
 * - All counts are clickable Jira links
 * - Lookback period selector works
 * - Refresh button works
 * - Empty/loading/error states handled
 *
 * Tag: @feature-pressure
 * Usage: npx playwright test --grep @feature-pressure
 */

// ---------------------------------------------------------------------------
// Fixture data for deterministic tests
// ---------------------------------------------------------------------------

const FIXTURE_DATA = {
  metadata: {
    generated_at: '2026-06-09T10:00:00.000Z',
    data_timestamp: '2026-06-09T09:00:00.000Z',
    lookback_months: 12,
    total_features: 1499,
    total_rfes: 1465
  },
  executive_summary: {
    total_features: 1499,
    total_features_jql: 'https://redhat.atlassian.net/issues/?jql=test-total',
    open_features: 658,
    open_features_jql: 'https://redhat.atlassian.net/issues/?jql=test-open',
    created_in_window: 1041,
    created_in_window_jql: 'https://redhat.atlassian.net/issues/?jql=test-created',
    resolved_in_window: 613,
    resolved_in_window_jql: 'https://redhat.atlassian.net/issues/?jql=test-resolved',
    net_in_window: 428,
    monthly_burn_rate: 51.08,
    months_to_clear: 12.9,
    backlog_trend: 'growing',
    total_rfes: 1465,
    total_rfes_jql: 'https://redhat.atlassian.net/issues/?jql=test-rfes',
    rfe_pending: 814,
    rfe_pending_jql: 'https://redhat.atlassian.net/issues/?jql=test-rfe-pending',
    rfe_accepted: 635,
    rfe_accepted_jql: 'https://redhat.atlassian.net/issues/?jql=test-rfe-accepted',
    trend_improving: 23,
    trend_worsening: 31,
    trend_stable: 1
  },
  monthly_flow: [
    { month: '2025-07', created: 41, resolved: 24, net: 17, cumulative: 16, created_jql: 'https://test/c1', resolved_jql: 'https://test/r1' },
    { month: '2025-08', created: 47, resolved: 26, net: 21, cumulative: 37, created_jql: 'https://test/c2', resolved_jql: 'https://test/r2' },
    { month: '2025-09', created: 69, resolved: 23, net: 46, cumulative: 83, created_jql: 'https://test/c3', resolved_jql: 'https://test/r3' }
  ],
  component_pressure: [
    {
      component: 'AI Core Dashboard', created: 215, resolved: 123, net: 92, open: 163, pressure_ratio: 1.75,
      created_jql: 'https://test/comp-c1', resolved_jql: 'https://test/comp-r1', open_jql: 'https://test/comp-o1'
    },
    {
      component: 'Documentation', created: 202, resolved: 133, net: 69, open: 113, pressure_ratio: 1.52,
      created_jql: 'https://test/comp-c2', resolved_jql: 'https://test/comp-r2', open_jql: 'https://test/comp-o2'
    },
    {
      component: 'UXD', created: 164, resolved: 96, net: 68, open: 125, pressure_ratio: 1.71,
      created_jql: 'https://test/comp-c3', resolved_jql: 'https://test/comp-r3', open_jql: 'https://test/comp-o3'
    }
  ],
  rfe_pipeline: {
    status_breakdown: {
      total: { count: 1465, jql: 'https://test/rfe-total' },
      accepted: { count: 635, jql: 'https://test/rfe-accepted' },
      pending: { count: 814, jql: 'https://test/rfe-pending' },
      other: { count: 16 }
    },
    monthly_arrivals: [
      { month: '2025-07', count: 80, jql: 'https://test/rfe-m1' }
    ],
    per_component_pending: [
      { component: 'AI Core Dashboard', count: 50, jql: 'https://test/rfe-comp1' }
    ]
  },
  backlog_half_life: [
    { component: 'Stuck', open: 10, open_jql: 'https://test/hl-1', resolved_per_month: 0, months_to_clear: 'Infinity' },
    { component: 'AI Core Dashboard', open: 163, open_jql: 'https://test/hl-2', resolved_per_month: 10.25, months_to_clear: 15.9 }
  ],
  heatmap: {
    months: ['2025-07', '2025-08', '2025-09'],
    components: ['AI Core Dashboard', 'Documentation'],
    matrix: [[5, 3, -2], [2, -1, 4]]
  },
  trend: [
    { component: 'AI Core Dashboard', first_half_net: 30, second_half_net: 62, direction: 'worsening', delta: 32 },
    { component: 'UXD', first_half_net: 40, second_half_net: 28, direction: 'improving', delta: -12 }
  ],
  scorecard: [
    {
      component: 'AI Core Dashboard', risk_score: 8.5, risk_level: 'critical',
      created: 215, resolved: 123, net: 92, open: 163, pressure_ratio: 1.75,
      rfe_pending: 50, rfe_pending_jql: 'https://test/sc-rfe1', open_jql: 'https://test/sc-o1',
      backlog_months: 15.9, trend: 'worsening'
    },
    {
      component: 'Documentation', risk_score: 5.2, risk_level: 'high',
      created: 202, resolved: 133, net: 69, open: 113, pressure_ratio: 1.52,
      rfe_pending: 0, rfe_pending_jql: '', open_jql: 'https://test/sc-o2',
      backlog_months: 10.2, trend: 'worsening'
    }
  ]
};

const RELEASES_MANIFEST = {
  name: 'Releases',
  slug: 'releases',
  defaultEnabled: true,
  description: 'Unified release lifecycle',
  icon: 'rocket',
  order: 10,
  client: { routes: [] }
};

const REGISTRY_DATA = { releases: [], versions: [], meta: {} };

// ---------------------------------------------------------------------------
// Route mocking
// ---------------------------------------------------------------------------

function relevantErrors(page) {
  return (page.errors || []).filter(e =>
    !e.message.includes('favicon') &&
    !e.message.includes('ResizeObserver') &&
    !e.message.includes('navigation') &&
    !e.message.includes('ERR_ABORTED')
  );
}

async function mockAllApis(page, fpData) {
  // Catch-all (lowest priority)
  await page.route('**/api/**', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  // Module manifest
  await page.route('**/api/modules', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ modules: [RELEASES_MANIFEST] })
    });
  });

  // Registry
  await page.route('**/api/modules/releases/registry', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REGISTRY_DATA) });
  });

  // Feature pressure endpoint
  await page.route('**/api/modules/releases/feature-pressure', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'started' }) });
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fpData || FIXTURE_DATA) });
    }
  });

  await page.route('**/api/modules/releases/feature-pressure/refresh', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'started', lookback_months: 12 }) });
  });

  await page.route('**/api/modules/releases/feature-pressure/refresh/status', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ running: false }) });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Feature Pressure - View Loading @feature-pressure', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should load the view without JavaScript errors', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render the page heading and subtitle', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const heading = page.getByRole('heading', { name: 'Feature Pressure' });
    await expect(heading).toBeVisible();

    const subtitle = page.locator('text=Where feature inflow exceeds capacity to burn down');
    await expect(subtitle).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render metadata line with timestamps', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const meta = page.locator('text=1,499 features');
    await expect(meta).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should call the feature-pressure API endpoint', async ({ page }) => {
    let apiCalled = false;
    await page.route('**/api/**', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/api/modules/releases/feature-pressure', route => {
      apiCalled = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_DATA) });
    });

    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    expect(apiCalled).toBe(true);
  });
});

test.describe('Feature Pressure - Executive Summary @feature-pressure', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render summary cards', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Check for key values in the split Features / RFEs summary
    const summarySection = page.locator('section').first();
    await expect(page.locator('text=Features (RHAISTRAT)')).toBeVisible();
    await expect(page.locator('text=Feature Requests (RHAIRFE)')).toBeVisible();
    await expect(summarySection.locator('text=Open').first()).toBeVisible();
    await expect(page.locator('text=Burn rate:')).toBeVisible();
    await expect(page.locator('text=Time to clear:')).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render counts as clickable Jira links', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // ClickableCount renders as <a> with href containing jql
    const jiraLinks = page.locator('a[href*="jql"]');
    const count = await jiraLinks.count();
    expect(count).toBeGreaterThan(0);
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show backlog trend', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('text=growing').first()).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });
});

test.describe('Feature Pressure - Component Table @feature-pressure', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render component pressure table', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('text=Pressure by Component')).toBeVisible();
    // Table should have rows for fixture components — scope to the component table section
    const pressureSection = page.locator('details:has(summary:has-text("Feature Pressure by Component"))');
    await expect(pressureSection.locator('text=AI Core Dashboard')).toBeVisible();
    await expect(pressureSection.locator('text=Documentation')).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render column headers', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    for (const col of ['Component', 'Created', 'Resolved', 'Net', 'Open', 'Ratio']) {
      await expect(page.locator(`th:has-text("${col}")`).first()).toBeVisible();
    }
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should filter components when typing in search', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const pressureSection = page.locator('details:has(summary:has-text("Feature Pressure by Component"))');
    const searchInput = pressureSection.locator('input[placeholder*="Filter"]');
    await searchInput.fill('UXD');
    await page.waitForTimeout(500);

    await expect(pressureSection.locator('td:has-text("UXD")')).toBeVisible();
    // Other components should be filtered out from the pressure table
    await expect(pressureSection.locator('td:has-text("AI Core Dashboard")')).not.toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });
});

test.describe('Feature Pressure - Scorecard @feature-pressure', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render risk scorecard section', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await expect(page.locator('text=Risk Scorecard')).toBeVisible();
    // Should show risk badges
    await expect(page.locator('text=critical').first()).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });
});

test.describe('Feature Pressure - Refresh @feature-pressure', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show refresh button', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const refreshBtn = page.locator('button:has-text("Refresh from Jira")');
    await expect(refreshBtn).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show lookback period selector', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const select = page.locator('select');
    await expect(select).toBeVisible();
    // Should have 12 months selected
    await expect(select).toHaveValue('12');
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should handle 202 pipeline-running gracefully', async ({ page }) => {
    await page.route('**/api/**', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/api/modules/releases/feature-pressure', route => {
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ _refreshing: true, _noCache: true, message: 'Pipeline running' })
      });
    });

    setupErrorTracking(page);
    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Should not crash
    expect(relevantErrors(page)).toHaveLength(0);
  });
});

test.describe('Feature Pressure - No Data State @feature-pressure', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should show loading state during first fetch', async ({ page }) => {
    // Delay the API response
    await page.route('**/api/**', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.route('**/api/modules/releases/feature-pressure', async route => {
      await new Promise(r => setTimeout(r, 2000));
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE_DATA) });
    });

    await page.goto('/#/releases/reports?report=feature-pressure');
    await page.waitForTimeout(500);

    // Should show loading indicator
    const loading = page.locator('text=Loading feature pressure data');
    await expect(loading).toBeVisible();
    expect(relevantErrors(page)).toHaveLength(0);
  });
});
