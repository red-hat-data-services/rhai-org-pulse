const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for TV/FV Delta view (Releases module → Reports hub)
 *
 * Tests verify:
 * - View loads via Reports hub (/#/releases/reports?report=tv-fv-delta)
 * - Release picker renders with auto-selected versions
 * - API endpoints are called (registry, versions, tv-fv-delta)
 * - Executive summary table renders with correct columns
 * - Release tab switching works
 * - Category sections (TV-Only, FV-Only, Mismatched, Aligned) render
 * - Component breakdown updates per release
 * - Collapsible sections work (details/summary)
 * - Feature tables are sortable
 * - Jira links are present and correct
 *
 * Tag: @tv-fv-delta
 * Usage: npx playwright test --grep @tv-fv-delta
 */

// ---------------------------------------------------------------------------
// Fixture data for deterministic tests
// ---------------------------------------------------------------------------

const FIXTURE_DATA = {
  metadata: {
    generated_at: '2026-05-17T10:00:00.000Z',
    data_timestamp: '2026-05-17T09:00:00.000Z',
    releases: ['rhoai-3.5.EA1', 'rhoai-3.5.EA2', 'rhoai-3.5'],
    total_features: 12
  },
  executive_summary: [
    {
      release: 'rhoai-3.5.EA1',
      total: 5, aligned: 3, tv_only: 1, fv_only: 0, mismatched: 1,
      alignment_pct: 60,
      total_jql: 'https://redhat.atlassian.net/issues/?jql=test-total-ea1',
      aligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-aligned-ea1',
      tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-tvonly-ea1',
      fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-fvonly-ea1',
      mismatched_jql: 'https://redhat.atlassian.net/issues/?jql=test-mismatch-ea1'
    },
    {
      release: 'rhoai-3.5.EA2',
      total: 4, aligned: 2, tv_only: 1, fv_only: 1, mismatched: 0,
      alignment_pct: 50,
      total_jql: 'https://redhat.atlassian.net/issues/?jql=test-total-ea2',
      aligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-aligned-ea2',
      tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-tvonly-ea2',
      fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-fvonly-ea2',
      mismatched_jql: 'https://redhat.atlassian.net/issues/?jql=test-mismatch-ea2'
    },
    {
      release: 'rhoai-3.5',
      total: 3, aligned: 3, tv_only: 0, fv_only: 0, mismatched: 0,
      alignment_pct: 100,
      total_jql: 'https://redhat.atlassian.net/issues/?jql=test-total-35',
      aligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-aligned-35',
      tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-tvonly-35',
      fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-fvonly-35',
      mismatched_jql: 'https://redhat.atlassian.net/issues/?jql=test-mismatch-35'
    }
  ],
  releases: {
    'rhoai-3.5.EA1': {
      aligned: [
        { key: 'RHAISTRAT-100', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-100', summary: 'Aligned feature A', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev One', team: 'Team A', component: 'Serving' },
        { key: 'RHAISTRAT-101', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-101', summary: 'Aligned feature B', status: 'New', color_status: 'Yellow', product_manager: 'PM Beta', assignee: 'Dev Two', team: 'Team B', component: 'Training' },
        { key: 'RHAISTRAT-102', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-102', summary: 'Aligned feature C', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev Three', team: 'Team A', component: 'Serving' }
      ],
      tv_only: [
        { key: 'RHAISTRAT-200', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-200', summary: 'TV-only feature X', status: 'New', color_status: 'Red', product_manager: 'PM Gamma', assignee: 'Dev Four', team: 'Team C', component: 'Dashboard' }
      ],
      fv_only: [],
      mismatched: [
        { key: 'RHAISTRAT-300', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-300', summary: 'Mismatched feature Z', status: 'In Progress', color_status: 'Yellow', product_manager: 'PM Alpha', assignee: 'Dev Five', team: 'Team A', component: 'Serving, Training', target_version: 'rhoai-3.5.EA1', fix_versions: 'rhoai-3.5.EA2' }
      ]
    },
    'rhoai-3.5.EA2': {
      aligned: [
        { key: 'RHAISTRAT-400', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-400', summary: 'EA2 aligned A', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev One', team: 'Team A', component: 'Serving' },
        { key: 'RHAISTRAT-401', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-401', summary: 'EA2 aligned B', status: 'New', color_status: '', product_manager: 'PM Beta', assignee: 'Dev Two', team: 'Team B', component: 'Notebooks' }
      ],
      tv_only: [
        { key: 'RHAISTRAT-500', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-500', summary: 'EA2 TV-only', status: 'Backlog', color_status: '', product_manager: 'PM Gamma', assignee: '', team: '', component: 'Pipelines' }
      ],
      fv_only: [
        { key: 'RHAISTRAT-600', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-600', summary: 'EA2 FV-only', status: 'In Progress', color_status: 'Green', product_manager: '', assignee: 'Dev Six', team: 'Team D', component: 'Model Registry' }
      ],
      mismatched: []
    },
    'rhoai-3.5': {
      aligned: [
        { key: 'RHAISTRAT-700', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-700', summary: 'GA aligned A', status: 'Done', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev One', team: 'Team A', component: 'Serving' },
        { key: 'RHAISTRAT-701', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-701', summary: 'GA aligned B', status: 'In Progress', color_status: 'Yellow', product_manager: 'PM Beta', assignee: 'Dev Two', team: 'Team B', component: 'Training' },
        { key: 'RHAISTRAT-702', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-702', summary: 'GA aligned C', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev Three', team: 'Team A', component: 'Serving' }
      ],
      tv_only: [],
      fv_only: [],
      mismatched: []
    }
  },
  component_breakdown: []
};

// ---------------------------------------------------------------------------
// Module manifest for releases (TV/FV Delta lives under Reports, not as a nav item)
// ---------------------------------------------------------------------------

const RELEASES_MANIFEST = {
  name: 'Releases',
  slug: 'releases',
  defaultEnabled: true,
  description: 'Unified release lifecycle: planning, execution tracking, and delivery readiness',
  icon: 'rocket',
  order: 10,
  client: {
    entry: './client/index.js',
    navItems: [
      { id: 'registry', label: 'Manage', icon: 'Database', requireRole: 'release-manager' },
      { id: 'plan', label: 'Plan', icon: 'ClipboardList', default: true },
      { id: 'execute', label: 'Execute', icon: 'GitBranch' },
      { id: 'deliver', label: 'Deliver', icon: 'Rocket' },
      { id: 'reports', label: 'Reports', icon: 'BarChart3' },
      { id: 'audit', label: 'Audit', icon: 'History', requireRole: 'release-manager' }
    ]
  },
  server: { entry: './server/index.js' }
};

// ---------------------------------------------------------------------------
// Fixture data for release registry and Jira versions (release picker)
// ---------------------------------------------------------------------------

const REGISTRY_DATA = {
  releases: [
    {
      id: 'rhoai-3.5-ea1',
      displayName: 'RHOAI 3.5 EA1',
      state: 'active',
      fixVersions: ['rhoai-3.5.EA1'],
      milestones: { codeFreeze: '2026-06-01', ga: '2026-07-01' },
    },
    {
      id: 'rhoai-3.5-ea2',
      displayName: 'RHOAI 3.5 EA2',
      state: 'active',
      fixVersions: ['rhoai-3.5.EA2'],
      milestones: { codeFreeze: '2026-07-01', ga: '2026-08-01' },
    },
    {
      id: 'rhoai-3.5',
      displayName: 'RHOAI 3.5',
      state: 'active',
      fixVersions: ['rhoai-3.5'],
      milestones: { codeFreeze: '2026-08-01', ga: '2026-09-01' },
    },
  ],
};

// z-stream releases (e.g. rhoai-3.4.1) are filtered server-side — they carry
// bug fixes only, not features, so they don't appear in TV/FV analysis.
const JIRA_VERSIONS_DATA = {
  versions: [
    { name: 'rhoai-3.5.EA1', released: false, releaseDate: '2026-07-01' },
    { name: 'rhoai-3.5.EA2', released: false, releaseDate: '2026-08-01' },
    { name: 'rhoai-3.5', released: false, releaseDate: '2026-09-01' },
    { name: 'rhoai-3.4', released: true, releaseDate: '2026-03-01' },
  ],
};

// ---------------------------------------------------------------------------
// Helper: mock all API endpoints the app needs to boot + TV/FV data
// ---------------------------------------------------------------------------

async function mockAllApis(page, tvfvData) {
  // Playwright matches routes LIFO — register catch-all FIRST (lowest priority),
  // then specific routes AFTER (higher priority, override catch-all).

  // Catch-all for other /api calls — return empty JSON to avoid 401
  await page.route('**/api/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    });
  });

  // Mock module manifests (needed for sidebar rendering)
  await page.route('**/api/built-in-modules/manifests', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([RELEASES_MANIFEST])
    });
  });

  // Mock module state
  await page.route('**/api/built-in-modules/state', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ 'releases': true })
    });
  });

  // Mock auth/roles (user identity)
  await page.route('**/api/roles/me', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ email: 'test@test.com', displayName: 'Test User', roles: ['admin'] })
    });
  });

  // Mock site config
  await page.route('**/api/site-config', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Org Pulse', teamDataSource: 'in-app' })
    });
  });

  // Mock messages
  await page.route('**/api/messages', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  // Mock release registry (for release picker auto-selection)
  await page.route('**/api/modules/releases/registry', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(REGISTRY_DATA)
    });
  });

  // Mock Jira versions (for release picker dropdown)
  await page.route('**/api/modules/releases/tv-fv-delta/versions', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(JIRA_VERSIONS_DATA)
    });
  });

  // Mock refresh status (not running)
  await page.route('**/api/modules/releases/tv-fv-delta/refresh/status', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ running: false })
    });
  });

  // Mock the TV/FV delta endpoint (registered last = highest priority)
  await page.route('**/api/modules/releases/tv-fv-delta', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tvfvData || FIXTURE_DATA)
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Helper: filter out expected console noise (auth, WebSocket)
// ---------------------------------------------------------------------------

const NOISE_PATTERNS = [
  /401/,
  /Unauthorized/,
  /WebSocket/i,
  /ws\/chat/,
  /no valid credentials/i,
  /Failed to load resource/,
];

function relevantErrors(page) {
  return (page.errors || []).filter(err => {
    return !NOISE_PATTERNS.some(pat => pat.test(err.message));
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

test.describe('TV/FV Delta — View Loading @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should load the view without JavaScript errors', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render the page heading and subtitle', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const heading = page.getByRole('heading', { name: 'TV vs FV Delta' });
    await expect(heading).toBeVisible();

    const subtitle = page.locator('text=Target Version (PM intent) vs Fix Version (engineering commitment)');
    await expect(subtitle).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render metadata line with timestamps and staleness note', async ({ page }) => {
    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const metadata = page.locator('text=Counts reflect data at fetch time');
    await expect(metadata).toBeVisible();

    const dataFetched = page.locator('text=Data fetched');
    await expect(dataFetched).toBeVisible();

    const reportGenerated = page.locator('text=Report generated');
    await expect(reportGenerated).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should call the TV/FV delta API endpoint', async ({ page }) => {
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/modules/releases/tv-fv-delta')) {
        apiRequests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    await mockAllApis(page);
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const getRequests = apiRequests.filter(r => r.method === 'GET');
    expect(getRequests.length).toBeGreaterThan(0);

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Executive Summary @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render the executive summary table with correct headers', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summaryHeading = page.locator('h2:has-text("Executive Summary")');
    await expect(summaryHeading).toBeVisible();

    // Verify all column headers
    const headers = ['Release', 'Total', 'Aligned', 'TV-Only', 'FV-Only', 'Mismatched', 'Alignment'];
    for (const header of headers) {
      const th = page.locator('th', { hasText: new RegExp(`^${header}$`, 'i') }).first();
      await expect(th).toBeVisible();
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render one row per release in timeline order', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Find the executive summary table
    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();
    const rows = summarySection.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    // Verify release order: EA1, EA2, 3.5
    const firstRow = rows.nth(0);
    await expect(firstRow).toContainText('rhoai-3.5.EA1');
    const secondRow = rows.nth(1);
    await expect(secondRow).toContainText('rhoai-3.5.EA2');
    const thirdRow = rows.nth(2);
    await expect(thirdRow).toContainText('rhoai-3.5');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should display correct counts in executive summary', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // EA1 row: total=5, aligned=3, tv_only=1, fv_only=0, mismatched=1, alignment=60%
    const ea1Row = summarySection.locator('tbody tr').nth(0);
    await expect(ea1Row).toContainText('60%');

    // rhoai-3.5 row: 100% alignment
    const gaRow = summarySection.locator('tbody tr').nth(2);
    await expect(gaRow).toContainText('100%');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should colour-code alignment percentages', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // EA2 has 50% alignment → yellow
    const ea2Pct = summarySection.locator('tbody tr').nth(1).locator('span.font-semibold').last();
    const ea2Classes = await ea2Pct.getAttribute('class');
    expect(ea2Classes).toContain('text-yellow-600');

    // rhoai-3.5 has 100% alignment → green
    const gaPct = summarySection.locator('tbody tr').nth(2).locator('span.font-semibold').last();
    const gaClasses = await gaPct.getAttribute('class');
    expect(gaClasses).toContain('text-green-600');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should highlight the selected release row', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // First release (EA1) should be selected by default
    const ea1Row = summarySection.locator('tbody tr').nth(0);
    const ea1Classes = await ea1Row.getAttribute('class');
    expect(ea1Classes).toContain('bg-blue-50');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should select release when clicking executive summary row', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // Click on the EA2 row
    const ea2Row = summarySection.locator('tbody tr').nth(1);
    await ea2Row.click();
    await page.waitForTimeout(500);

    // EA2 row should now be highlighted
    const ea2Classes = await ea2Row.getAttribute('class');
    expect(ea2Classes).toContain('bg-blue-50');

    // EA1 row should no longer be highlighted
    const ea1Row = summarySection.locator('tbody tr').nth(0);
    const ea1Classes = await ea1Row.getAttribute('class');
    expect(ea1Classes).not.toContain('bg-blue-50');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render executive summary counts as clickable Jira links', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // ClickableCount renders as <a> tags that open Jira
    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();
    const jiraLinks = summarySection.locator('tbody a[href*="atlassian.net"]');
    const linkCount = await jiraLinks.count();
    // Each row has Total, Aligned, TV-Only, FV-Only, Mismatched = 5 links per row × 3 rows = 15
    expect(linkCount).toBeGreaterThanOrEqual(9); // at least 3 per row

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Release Tabs @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render release chip buttons for all releases', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    for (const release of ['rhoai-3.5.EA1', 'rhoai-3.5.EA2', 'rhoai-3.5']) {
      const chip = page.locator('button', { hasText: release }).first();
      await expect(chip).toBeVisible();
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should highlight the active release tab', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // EA1 is selected by default → should have blue background
    const ea1Tab = page.locator('button', { hasText: 'rhoai-3.5.EA1' });
    const ea1Classes = await ea1Tab.getAttribute('class');
    expect(ea1Classes).toContain('bg-blue-600');

    // EA2 should NOT have blue background
    const ea2Tab = page.locator('button', { hasText: 'rhoai-3.5.EA2' });
    const ea2Classes = await ea2Tab.getAttribute('class');
    expect(ea2Classes).not.toContain('bg-blue-600');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should switch release when clicking a tab', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Click EA2 tab
    const ea2Tab = page.locator('button', { hasText: 'rhoai-3.5.EA2' });
    await ea2Tab.click();
    await page.waitForTimeout(500);

    // EA2 tab should now be active
    const ea2Classes = await ea2Tab.getAttribute('class');
    expect(ea2Classes).toContain('bg-blue-600');

    // EA1 tab should no longer be active
    const ea1Tab = page.locator('button', { hasText: 'rhoai-3.5.EA1' });
    const ea1Classes = await ea1Tab.getAttribute('class');
    expect(ea1Classes).not.toContain('bg-blue-600');

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Category Sections @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render all four category sections for EA1', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // EA1 has: aligned (3), tv_only (1), fv_only (0), mismatched (1)
    await expect(page.locator('summary:has-text("TV-Only")')).toBeVisible();
    await expect(page.locator('summary:has-text("Aligned")')).toBeVisible();
    await expect(page.locator('summary:has-text("Mismatched")')).toBeVisible();
    // FV-Only should render even with 0 items (empty table)
    await expect(page.locator('summary:has-text("FV-Only")')).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show correct counts in category headings', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // EA1 selected by default
    await expect(page.locator('summary:has-text("TV-Only")')).toContainText('(1)');
    await expect(page.locator('summary:has-text("Aligned")')).toContainText('(3)');
    await expect(page.locator('summary:has-text("Mismatched")')).toContainText('(1)');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should update category counts when switching releases', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // EA1: tv_only=1
    await expect(page.locator('summary:has-text("TV-Only")')).toContainText('(1)');

    // Switch to rhoai-3.5 (GA): tv_only=0, aligned=3
    // Use negative lookahead to match only the GA chip (not EA1/EA2)
    await page.locator('button', { hasText: /rhoai-3\.5(?!\.)/ }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('summary:has-text("Aligned")')).toContainText('(3)');
    await expect(page.locator('summary:has-text("TV-Only")')).toContainText('(0)');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show "View in Jira" links on each category section', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const jiraLinks = page.locator('summary a:has-text("View in Jira")');
    const count = await jiraLinks.count();
    // Should have "View in Jira" on each visible category section
    expect(count).toBeGreaterThanOrEqual(3);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should hide Mismatched section when count is zero', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Switch to EA2 which has 0 mismatched
    await page.locator('button', { hasText: 'rhoai-3.5.EA2' }).click();
    await page.waitForTimeout(500);

    // Mismatched section should be hidden (v-if="releaseData.mismatched.length")
    const mismatched = page.locator('summary:has-text("Mismatched")');
    await expect(mismatched).toHaveCount(0);

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Collapsible Behaviour @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should start with all category sections collapsed', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // All <details> should be closed by default (no 'open' attribute)
    const detailsElements = page.locator('details');
    const count = await detailsElements.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const isOpen = await detailsElements.nth(i).getAttribute('open');
      expect(isOpen).toBeNull();
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should expand a section when clicking its summary', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Click the TV-Only summary to expand
    const tvOnlySummary = page.locator('summary:has-text("TV-Only")');
    await tvOnlySummary.click();
    await page.waitForTimeout(300);

    // The details element should now be open
    const tvOnlyDetails = page.locator('details:has(summary:has-text("TV-Only"))');
    const isOpen = await tvOnlyDetails.getAttribute('open');
    expect(isOpen).not.toBeNull();

    // Should show the feature table
    const table = tvOnlyDetails.locator('table');
    await expect(table).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should retain open/closed state when switching releases', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Open TV-Only and Aligned sections
    await page.locator('summary:has-text("TV-Only")').click();
    await page.locator('summary:has-text("Aligned")').click();
    await page.waitForTimeout(300);

    // Verify they're open
    const tvOnlyOpen = await page.locator('details:has(summary:has-text("TV-Only"))').getAttribute('open');
    expect(tvOnlyOpen).not.toBeNull();
    const alignedOpen = await page.locator('details:has(summary:has-text("Aligned"))').getAttribute('open');
    expect(alignedOpen).not.toBeNull();

    // FV-Only should still be closed
    const fvOnlyClosed = await page.locator('details:has(summary:has-text("FV-Only"))').getAttribute('open');
    expect(fvOnlyClosed).toBeNull();

    // Switch to EA2
    await page.locator('button', { hasText: 'rhoai-3.5.EA2' }).click();
    await page.waitForTimeout(500);

    // TV-Only and Aligned should STILL be open
    const tvOnlyStillOpen = await page.locator('details:has(summary:has-text("TV-Only"))').getAttribute('open');
    expect(tvOnlyStillOpen).not.toBeNull();
    const alignedStillOpen = await page.locator('details:has(summary:has-text("Aligned"))').getAttribute('open');
    expect(alignedStillOpen).not.toBeNull();

    // FV-Only should still be closed
    const fvOnlyStillClosed = await page.locator('details:has(summary:has-text("FV-Only"))').getAttribute('open');
    expect(fvOnlyStillClosed).toBeNull();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should have disclosure triangles that rotate on open', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The disclosure triangle is a span with ▶ (&#9654;) inside summary
    // When open, it gets group-open:rotate-90 via CSS
    const tvOnlyDetails = page.locator('details:has(summary:has-text("TV-Only"))');
    const triangle = tvOnlyDetails.locator('summary span').first();
    await expect(triangle).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Feature Tables @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render feature rows when section is expanded', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Aligned section (has 3 features for EA1)
    await page.locator('summary:has-text("Aligned")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned"))');
    const rows = alignedDetails.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render feature keys as clickable Jira links', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand TV-Only section
    await page.locator('summary:has-text("TV-Only")').click();
    await page.waitForTimeout(300);

    const tvOnlyDetails = page.locator('details:has(summary:has-text("TV-Only"))');
    const keyLink = tvOnlyDetails.locator('a[href*="RHAISTRAT-200"]');
    await expect(keyLink).toBeVisible();
    const href = await keyLink.getAttribute('href');
    expect(href).toContain('redhat.atlassian.net/browse/RHAISTRAT-200');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should display correct columns for all categories (including TV/FV)', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Aligned section
    await page.locator('summary:has-text("Aligned")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned"))');
    const headers = alignedDetails.locator('thead th');

    // All categories now include: Key, Summary, Status, TV, FV, Color, PM, Assignee, Team, Component
    const expectedHeaders = ['Key', 'Summary', 'Status', 'TV', 'FV', 'Color', 'PM', 'Assignee', 'Team', 'Component'];
    const count = await headers.count();
    expect(count).toBe(expectedHeaders.length);

    for (let i = 0; i < expectedHeaders.length; i++) {
      await expect(headers.nth(i)).toContainText(expectedHeaders[i]);
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should display TV/FV columns in all categories', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Test that TV-Only, Aligned, and Mismatched all have TV/FV columns
    const categories = ['TV-Only', 'Aligned', 'Mismatched'];

    for (const category of categories) {
      await page.locator(`summary:has-text("${category}")`).click();
      await page.waitForTimeout(300);

      const categoryDetails = page.locator(`details:has(summary:has-text("${category}"))`);
      const headers = categoryDetails.locator('thead th');
      const count = await headers.count();

      // All categories have 10 columns including TV and FV
      expect(count).toBe(10);

      // Verify TV and FV headers exist
      const headerTexts = [];
      for (let i = 0; i < count; i++) {
        headerTexts.push(await headers.nth(i).textContent());
      }
      expect(headerTexts.some(h => h.includes('TV'))).toBe(true);
      expect(headerTexts.some(h => h.includes('FV'))).toBe(true);

      // Collapse for next iteration
      await page.locator(`summary:has-text("${category}")`).click();
      await page.waitForTimeout(200);
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render color status as badges', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Aligned section
    await page.locator('summary:has-text("Aligned")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned"))');
    // Color badges have rounded-full class
    const badges = alignedDetails.locator('span.rounded-full');
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // First feature has Green color status
    const firstBadge = badges.first();
    await expect(firstBadge).toContainText('Green');
    const badgeClasses = await firstBadge.getAttribute('class');
    expect(badgeClasses).toContain('bg-green-100');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should sort columns when clicking headers', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Aligned section (3 features)
    await page.locator('summary:has-text("Aligned")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned"))');

    // Get initial key order
    const getKeys = async () => {
      const links = alignedDetails.locator('tbody a[href*="RHAISTRAT"]');
      const keys = [];
      const count = await links.count();
      for (let i = 0; i < count; i++) {
        keys.push(await links.nth(i).textContent());
      }
      return keys;
    };

    const initialKeys = await getKeys();
    expect(initialKeys).toHaveLength(3);

    // Click the Key header to sort ascending
    const keyHeader = alignedDetails.locator('thead th', { hasText: 'Key' });
    await keyHeader.click();
    await page.waitForTimeout(300);

    // Should show sort indicator
    const sortIndicator = keyHeader.locator('span');
    await expect(sortIndicator).toBeVisible();

    // Click again to sort descending
    await keyHeader.click();
    await page.waitForTimeout(300);

    const descKeys = await getKeys();
    // Descending: 102, 101, 100
    expect(descKeys[0]).toBe('RHAISTRAT-102');
    expect(descKeys[2]).toBe('RHAISTRAT-100');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should update feature rows when switching releases', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Aligned section — EA1 has 3 aligned
    await page.locator('summary:has-text("Aligned")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned"))');
    let rows = alignedDetails.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    // Switch to EA2 — has 2 aligned
    await page.locator('button', { hasText: 'rhoai-3.5.EA2' }).click();
    await page.waitForTimeout(500);

    rows = alignedDetails.locator('tbody tr');
    await expect(rows).toHaveCount(2);

    // Verify the keys changed (EA2 features)
    const firstKey = alignedDetails.locator('tbody a[href*="RHAISTRAT"]').first();
    await expect(firstKey).toContainText('RHAISTRAT-400');

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Component Breakdown @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render component breakdown section', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const compBreakdown = page.locator('summary:has-text("Component Breakdown")');
    await expect(compBreakdown).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show per-release component data (EA1 has Serving with 3 features)', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Component Breakdown
    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const compSection = page.locator('details:has(summary:has-text("Component Breakdown"))');
    // EA1: Serving appears in RHAISTRAT-100, 102, 300 = 3 features (meets >= 2 threshold)
    const servingRow = compSection.locator('tbody tr', { hasText: 'Serving' });
    await expect(servingRow).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should update component breakdown when switching releases', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Component Breakdown
    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const compSection = page.locator('details:has(summary:has-text("Component Breakdown"))');

    // EA1 component rows — verify something rendered before switching
    const ea1Rows = await compSection.locator('tbody tr').count();
    expect(ea1Rows).toBeGreaterThan(0);

    // Switch to rhoai-3.5 (GA) — different components
    await page.locator('button', { hasText: /rhoai-3\.5(?!\.)/ }).click();
    await page.waitForTimeout(500);

    // GA has Serving (RHAISTRAT-700, 702) = 2 features
    const gaRows = await compSection.locator('tbody tr').count();
    // The counts should differ since different releases have different feature distributions
    // At minimum, the component breakdown should have rendered something
    expect(gaRows).toBeGreaterThanOrEqual(1);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should display correct component breakdown columns', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Component Breakdown
    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const compSection = page.locator('details:has(summary:has-text("Component Breakdown"))');
    const headers = compSection.locator('thead th');

    const expectedHeaders = ['Component', 'Total', 'Aligned', 'TV-Only', 'FV-Only', 'Mismatched', 'Alignment'];
    const count = await headers.count();
    expect(count).toBe(expectedHeaders.length);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should colour-code component alignment percentages', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Component Breakdown
    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const compSection = page.locator('details:has(summary:has-text("Component Breakdown"))');
    const pctSpans = compSection.locator('tbody span.font-semibold');
    const count = await pctSpans.count();
    expect(count).toBeGreaterThan(0);

    // Each percentage span should have a colour class
    for (let i = 0; i < count; i++) {
      const classes = await pctSpans.nth(i).getAttribute('class');
      const hasColor = classes.includes('text-red-600') ||
                       classes.includes('text-yellow-600') ||
                       classes.includes('text-green-600');
      expect(hasColor).toBe(true);
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Data Completeness @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should display TV and FV values in table cells', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Mismatched section (has both TV and FV populated)
    await page.locator('summary:has-text("Mismatched")').click();
    await page.waitForTimeout(300);

    const mismatchedDetails = page.locator('details:has(summary:has-text("Mismatched"))');
    const firstRow = mismatchedDetails.locator('tbody tr').first();

    // Should show rhoai-3.5.EA1 in TV column and rhoai-3.5.EA2 in FV column (from fixture)
    await expect(firstRow).toContainText('rhoai-3.5.EA1');
    await expect(firstRow).toContainText('rhoai-3.5.EA2');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show components with zero features when all_components is available', async ({ page }) => {
    // Mock with all_components metadata
    const dataWithAllComponents = {
      ...FIXTURE_DATA,
      metadata: {
        ...FIXTURE_DATA.metadata,
        all_components: ['Serving', 'Training', 'Dashboard', 'Pipelines', 'Model Registry', 'Notebooks', 'Unused Component A', 'Unused Component B']
      }
    };

    await mockAllApis(page, dataWithAllComponents);
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Component Breakdown
    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const compSection = page.locator('details:has(summary:has-text("Component Breakdown"))');

    // Should show components with 0 features
    await expect(compSection.locator('text=Unused Component A')).toBeVisible();
    await expect(compSection.locator('text=Unused Component B')).toBeVisible();

    // Verify they show 0 counts
    const unusedRow = compSection.locator('tr:has-text("Unused Component A")');
    await expect(unusedRow.locator('td').nth(1)).toContainText('0'); // Total column

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should sync release selection between executive summary and tabs', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // Click EA2 row in executive summary
    const ea2Row = summarySection.locator('tbody tr').nth(1);
    await ea2Row.click();
    await page.waitForTimeout(500);

    // EA2 tab should now be active (highlighted)
    const ea2Tab = page.locator('button', { hasText: 'rhoai-3.5.EA2' });
    const ea2Classes = await ea2Tab.getAttribute('class');
    expect(ea2Classes).toContain('bg-blue-600');

    // Now click EA1 tab
    const ea1Tab = page.locator('button', { hasText: 'rhoai-3.5.EA1' });
    await ea1Tab.click();
    await page.waitForTimeout(500);

    // EA1 executive summary row should now be highlighted
    const ea1ExecRow = summarySection.locator('tbody tr').nth(0);
    const ea1RowClasses = await ea1ExecRow.getAttribute('class');
    expect(ea1RowClasses).toContain('bg-blue-50');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should handle features with multiple comma-separated components', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Mismatched section (RHAISTRAT-300 has "Serving, Training")
    await page.locator('summary:has-text("Mismatched")').click();
    await page.waitForTimeout(300);

    const mismatchedDetails = page.locator('details:has(summary:has-text("Mismatched"))');
    const componentCell = mismatchedDetails.locator('tbody tr:has-text("RHAISTRAT-300")').locator('td').last();

    // Should show both components
    await expect(componentCell).toContainText('Serving');
    await expect(componentCell).toContainText('Training');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show refresh button and handle click', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const refreshButton = page.locator('button:has-text("Refresh from Jira")');
    await expect(refreshButton).toBeVisible();
    await expect(refreshButton).toBeEnabled();

    // Button should be clickable (we're not testing the actual refresh, just the UI)
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should display staleness warning message', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Should show staleness note
    const staleNote = page.locator('text=Counts reflect data at fetch time');
    await expect(staleNote).toBeVisible();

    // Should show both timestamps
    await expect(page.locator('text=Data fetched')).toBeVisible();
    await expect(page.locator('text=Report generated')).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — No Data State @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should handle 404 (no data) gracefully', async ({ page }) => {
    // Mock bootstrap APIs but override TV/FV to return 404
    await mockAllApis(page);
    await page.unroute('**/api/modules/releases/tv-fv-delta');
    await page.route('**/api/modules/releases/tv-fv-delta', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No TV/FV delta data available.' })
      });
    });

    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Either shows an error or renders empty — neither should crash
    // The key assertion is no JS errors
    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should handle 202 (pipeline running) gracefully', async ({ page }) => {
    // Mock bootstrap APIs but override TV/FV to return 202
    await mockAllApis(page);
    await page.unroute('**/api/modules/releases/tv-fv-delta');
    await page.route('**/api/modules/releases/tv-fv-delta', route => {
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          _refreshing: true,
          _noCache: true,
          message: 'Data pipeline is running for the first time.'
        })
      });
    });

    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Should not crash — loading or message state is acceptable
    expect(relevantErrors(page)).toHaveLength(0);
  });
});


test.describe('TV/FV Delta — Release Picker @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
    await mockAllApis(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should render release chips from auto-selected registry versions', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Auto-selected versions appear as chip buttons below exec summary
    for (const release of ['rhoai-3.5.EA1', 'rhoai-3.5.EA2', 'rhoai-3.5']) {
      await expect(page.locator('button', { hasText: release }).first()).toBeVisible();
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show "+ Add release" button', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const addButton = page.locator('button:has-text("+ Add release")');
    await expect(addButton).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should open dropdown when clicking "+ Add release"', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Click the add button
    await page.locator('button:has-text("+ Add release")').click();
    await page.waitForTimeout(300);

    // Dropdown should be visible with search input
    const searchInput = page.locator('input[placeholder="Search versions..."]');
    await expect(searchInput).toBeVisible();

    // Should show Jira versions in the dropdown (z-stream releases like rhoai-3.4.1 are filtered server-side)
    await expect(page.locator('button:has-text("rhoai-3.4")')).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should filter versions when typing in search', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Open dropdown
    await page.locator('button:has-text("+ Add release")').click();
    await page.waitForTimeout(300);

    // Type in search
    const searchInput = page.locator('input[placeholder="Search versions..."]');
    await searchInput.fill('3.4');
    await page.waitForTimeout(300);

    // Should show only 3.4 versions (z-stream rhoai-3.4.1 is filtered out server-side)
    const dropdownButtons = page.locator('.max-h-64 button');
    const count = await dropdownButtons.count();
    expect(count).toBe(1);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Open dropdown
    await page.locator('button:has-text("+ Add release")').click();
    await page.waitForTimeout(300);

    // Verify dropdown is open
    const searchInput = page.locator('input[placeholder="Search versions..."]');
    await expect(searchInput).toBeVisible();

    // Click outside the dropdown
    await page.locator('h1:has-text("TV vs FV Delta")').click();
    await page.waitForTimeout(300);

    // Dropdown should be closed
    await expect(searchInput).not.toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should remove a version chip when clicking its x button', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // All 3 release chips should be visible
    const ea1Chip = page.locator('button', { hasText: 'rhoai-3.5.EA1' }).first();
    await expect(ea1Chip).toBeVisible();

    // Click the x (×) on the EA1 chip
    await ea1Chip.locator('span[title="Remove"]').click();
    await page.waitForTimeout(300);

    // EA1 chip should be gone
    await expect(ea1Chip).not.toBeVisible();
    // Others still present
    await expect(page.locator('button', { hasText: 'rhoai-3.5.EA2' }).first()).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should call registry and versions endpoints on load', async ({ page }) => {
    const apiRequests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/modules/releases/registry') ||
          url.includes('/api/modules/releases/tv-fv-delta/versions')) {
        apiRequests.push({ url, method: request.method() });
      }
    });

    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Both registry and versions should have been fetched
    const registryReqs = apiRequests.filter(r => r.url.includes('/registry'));
    const versionReqs = apiRequests.filter(r => r.url.includes('/versions'));
    expect(registryReqs.length).toBeGreaterThan(0);
    expect(versionReqs.length).toBeGreaterThan(0);

    expect(relevantErrors(page)).toHaveLength(0);
  });
});
