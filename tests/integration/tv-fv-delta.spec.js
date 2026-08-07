const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for TV/FV Delta view (Releases module → Reports hub)
 *
 * Tests verify:
 * - View loads via Reports hub (/#/releases/reports?report=tv-fv-delta)
 * - Release picker renders with the 18 default product-family versions
 * - API endpoints are called (registry, versions, tv-fv-delta)
 * - Executive summary table renders with correct columns
 * - Executive summary / selector ordered cycle → milestone → product (numeric desc)
 * - Release tab switching works
 * - Category sections (TV-Only, FV-Only, Misaligned, Aligned on time, Aligned late) render
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

/** Empty summary row for default versions without detailed fixture features */
function emptySummaryRow(release) {
  return {
    release,
    total: 0, aligned_on_time: 0, aligned_late: 0, tv_only: 0, fv_only: 0, misaligned: 0,
    alignment_pct: 0,
    total_jql: 'https://redhat.atlassian.net/issues/?jql=test-empty',
    aligned_on_time_jql: 'https://redhat.atlassian.net/issues/?jql=test-empty',
    tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-empty',
    fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-empty',
    misaligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-empty'
  };
}

/** Matches client DEFAULT_SELECTED_VERSIONS — keep fixture in sync */
const DEFAULT_FIXTURE_RELEASES = [
  '3.6 GA RHOAI RELEASE',
  '3.6 GA RHAII RELEASE',
  '3.6 GA RHELAI RELEASE',
  '3.6 EA2 RHOAI RELEASE',
  '3.6 EA2 RHAII RELEASE',
  '3.6 EA2 RHELAI RELEASE',
  '3.6 EA1 RHOAI RELEASE',
  '3.6 EA1 RHAII RELEASE',
  '3.6 EA1 RHELAI RELEASE',
  '3.5 GA RHOAI RELEASE',
  '3.5 GA RHAII RELEASE',
  '3.5 GA RHELAI RELEASE',
  '3.5 EA2 RHOAI RELEASE',
  '3.5 EA2 RHAII RELEASE',
  '3.5 EA2 RHELAI RELEASE',
  '3.5 EA1 RHOAI RELEASE',
  '3.5 EA1 RHAII RELEASE',
  '3.5 EA1 RHELAI RELEASE',
];

const FIXTURE_DATA = {
  metadata: {
    generated_at: '2026-05-17T10:00:00.000Z',
    data_timestamp: '2026-05-17T09:00:00.000Z',
    releases: DEFAULT_FIXTURE_RELEASES.slice(),
    total_features: 12
  },
  executive_summary: [
    ...DEFAULT_FIXTURE_RELEASES.filter(r => ![
      '3.5 EA1 RHOAI RELEASE',
      '3.5 EA1 RHAII RELEASE',
      '3.5 EA2 RHOAI RELEASE',
      '3.5 GA RHOAI RELEASE',
    ].includes(r)).map(emptySummaryRow),
    {
      release: '3.5 EA1 RHOAI RELEASE',
      total: 5, aligned_on_time: 3, aligned_late: 0, tv_only: 1, fv_only: 0, misaligned: 1,
      alignment_pct: 60,
      total_jql: 'https://redhat.atlassian.net/issues/?jql=test-total-ea1',
      aligned_on_time_jql: 'https://redhat.atlassian.net/issues/?jql=test-aligned-ea1',
      tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-tvonly-ea1',
      fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-fvonly-ea1',
      misaligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-mismatch-ea1'
    },
    {
      release: '3.5 EA1 RHAII RELEASE',
      total: 1, aligned_on_time: 1, aligned_late: 0, tv_only: 0, fv_only: 0, misaligned: 0,
      alignment_pct: 100,
      total_jql: 'https://redhat.atlassian.net/issues/?jql=test-total-ea1-rhaii',
      aligned_on_time_jql: 'https://redhat.atlassian.net/issues/?jql=test-aligned-ea1-rhaii',
      tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-tvonly-ea1-rhaii',
      fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-fvonly-ea1-rhaii',
      misaligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-mismatch-ea1-rhaii'
    },
    {
      release: '3.5 EA2 RHOAI RELEASE',
      total: 4, aligned_on_time: 2, aligned_late: 0, tv_only: 1, fv_only: 1, misaligned: 0,
      alignment_pct: 50,
      total_jql: 'https://redhat.atlassian.net/issues/?jql=test-total-ea2',
      aligned_on_time_jql: 'https://redhat.atlassian.net/issues/?jql=test-aligned-ea2',
      tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-tvonly-ea2',
      fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-fvonly-ea2',
      misaligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-mismatch-ea2'
    },
    {
      release: '3.5 GA RHOAI RELEASE',
      total: 3, aligned_on_time: 3, aligned_late: 0, tv_only: 0, fv_only: 0, misaligned: 0,
      alignment_pct: 100,
      total_jql: 'https://redhat.atlassian.net/issues/?jql=test-total-35',
      aligned_on_time_jql: 'https://redhat.atlassian.net/issues/?jql=test-aligned-35',
      tv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-tvonly-35',
      fv_only_jql: 'https://redhat.atlassian.net/issues/?jql=test-fvonly-35',
      misaligned_jql: 'https://redhat.atlassian.net/issues/?jql=test-mismatch-35'
    }
  ],
  releases: {
    '3.5 EA1 RHOAI RELEASE': {
      aligned_on_time: [
        { key: 'RHAISTRAT-100', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-100', summary: 'Aligned feature A', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev One', team: 'Team A', component: 'Serving' },
        { key: 'RHAISTRAT-101', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-101', summary: 'Aligned feature B', status: 'New', color_status: 'Yellow', product_manager: 'PM Beta', assignee: 'Dev Two', team: 'Team B', component: 'Training' },
        { key: 'RHAISTRAT-102', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-102', summary: 'Aligned feature C', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev Three', team: 'Team A', component: 'Serving' }
      ],
      aligned_late: [],
      tv_only: [
        { key: 'RHAISTRAT-200', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-200', summary: 'TV-only feature X', status: 'New', color_status: 'Red', product_manager: 'PM Gamma', assignee: 'Dev Four', team: 'Team C', component: 'Dashboard' }
      ],
      fv_only: [],
      misaligned: [
        { key: 'RHAISTRAT-300', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-300', summary: 'Misaligned feature Z', status: 'In Progress', color_status: 'Yellow', product_manager: 'PM Alpha', assignee: 'Dev Five', team: 'Team A', component: 'Serving, Training', target_version: '3.5 EA1 RHOAI RELEASE', fix_versions: '3.5 EA2 RHOAI RELEASE' }
      ]
    },
    '3.5 EA1 RHAII RELEASE': {
      aligned_on_time: [
        { key: 'RHAISTRAT-110', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-110', summary: 'RHAII EA1 aligned', status: 'In Progress', color_status: 'Green', product_manager: 'PM Delta', assignee: 'Dev Seven', team: 'Team E', component: 'Serving' }
      ],
      aligned_late: [],
      tv_only: [],
      fv_only: [],
      misaligned: []
    },
    '3.5 EA2 RHOAI RELEASE': {
      aligned_on_time: [
        { key: 'RHAISTRAT-400', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-400', summary: 'EA2 aligned A', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev One', team: 'Team A', component: 'Serving' },
        { key: 'RHAISTRAT-401', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-401', summary: 'EA2 aligned B', status: 'New', color_status: '', product_manager: 'PM Beta', assignee: 'Dev Two', team: 'Team B', component: 'Notebooks' }
      ],
      aligned_late: [],
      tv_only: [
        { key: 'RHAISTRAT-500', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-500', summary: 'EA2 TV-only', status: 'Backlog', color_status: '', product_manager: 'PM Gamma', assignee: '', team: '', component: 'Pipelines' }
      ],
      fv_only: [
        { key: 'RHAISTRAT-600', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-600', summary: 'EA2 FV-only', status: 'In Progress', color_status: 'Green', product_manager: '', assignee: 'Dev Six', team: 'Team D', component: 'Model Registry' }
      ],
      misaligned: []
    },
    '3.5 GA RHOAI RELEASE': {
      aligned_on_time: [
        { key: 'RHAISTRAT-700', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-700', summary: 'GA aligned A', status: 'Done', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev One', team: 'Team A', component: 'Serving' },
        { key: 'RHAISTRAT-701', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-701', summary: 'GA aligned B', status: 'In Progress', color_status: 'Yellow', product_manager: 'PM Beta', assignee: 'Dev Two', team: 'Team B', component: 'Training' },
        { key: 'RHAISTRAT-702', url: 'https://redhat.atlassian.net/browse/RHAISTRAT-702', summary: 'GA aligned C', status: 'In Progress', color_status: 'Green', product_manager: 'PM Alpha', assignee: 'Dev Three', team: 'Team A', component: 'Serving' }
      ],
      aligned_late: [],
      tv_only: [],
      fv_only: [],
      misaligned: []
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
      { id: 'registry', label: 'Manage', icon: 'Database', requireRole: 'planning-manager' },
      { id: 'plan', label: 'Plan', icon: 'ClipboardList', default: true },
      { id: 'execute', label: 'Execute', icon: 'GitBranch' },
      { id: 'deliver', label: 'Deliver', icon: 'Rocket' },
      { id: 'reports', label: 'Reports', icon: 'BarChart3' },
      { id: 'audit', label: 'Audit', icon: 'History' }
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
      fixVersions: ['3.5 EA1 RHOAI RELEASE'],
      milestones: { codeFreeze: '2026-06-01', ga: '2026-07-01' },
    },
    {
      id: 'rhoai-3.5-ea2',
      displayName: 'RHOAI 3.5 EA2',
      state: 'active',
      fixVersions: ['3.5 EA2 RHOAI RELEASE'],
      milestones: { codeFreeze: '2026-07-01', ga: '2026-08-01' },
    },
    {
      id: 'rhoai-3.5',
      displayName: 'RHOAI 3.5',
      state: 'active',
      fixVersions: ['3.5 GA RHOAI RELEASE'],
      milestones: { codeFreeze: '2026-08-01', ga: '2026-09-01' },
    },
  ],
};

// z-stream releases (e.g. rhoai-3.4.1) are filtered server-side — they carry
// bug fixes only, not features, so they don't appear in TV/FV analysis.
const JIRA_VERSIONS_DATA = {
  versions: [
    { name: '3.6 GA RHOAI RELEASE', released: false, releaseDate: '2026-11-19' },
    { name: '3.6 EA2 RHOAI RELEASE', released: false, releaseDate: '2026-10-15' },
    { name: '3.6 EA1 RHOAI RELEASE', released: false, releaseDate: '2026-09-17' },
    { name: '3.5 EA1 RHOAI RELEASE', released: false, releaseDate: '2026-07-01' },
    { name: '3.5 EA2 RHOAI RELEASE', released: false, releaseDate: '2026-08-01' },
    { name: '3.5 GA RHOAI RELEASE', released: false, releaseDate: '2026-09-01' },
    { name: 'rhoai-3.4', released: true, releaseDate: '2026-03-01' },
  ],
};

/** Version picker chip (has Remove control) — distinct from family-filter pills */
function versionChip(page, release) {
  return page.locator('button', { hasText: release }).filter({ has: page.locator('span[title="Remove"]') });
}

/** First-column labels from the Executive Summary tbody, in DOM order */
async function summaryReleaseLabels(page) {
  const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();
  const texts = await summarySection.locator('tbody tr td:first-child').allTextContents();
  return texts.map(t => t.replace(/\s+/g, ' ').trim());
}

/** Assert needle appears before other in an ordered string list */
function expectBefore(ordered, needle, other) {
  const i = ordered.findIndex(t => t.includes(needle));
  const j = ordered.findIndex(t => t.includes(other));
  expect(i, `"${needle}" should be present`).toBeGreaterThanOrEqual(0);
  expect(j, `"${other}" should be present`).toBeGreaterThanOrEqual(0);
  expect(i, `"${needle}" should appear before "${other}"`).toBeLessThan(j);
}

/**
 * First default version that has detail fixture data (GA before EA in DEFAULT list).
 * Auto-selection prefers this when present in data.releases.
 */
const DEFAULT_SELECTED_DETAIL_RELEASE = '3.5 GA RHOAI RELEASE';

/** Select a version chip (used when a test needs EA1/EA2 detail instead of the auto-selected GA). */
async function selectVersion(page, release) {
  await versionChip(page, release).click();
  await page.waitForTimeout(300);
}

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

  // Mock refresh trigger
  await page.route('**/api/modules/releases/tv-fv-delta/refresh', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'started' })
    });
  });

  // Mock PM Hub pillar-config (component → PM/ENG leads for Component Breakdown)
  await page.route('**/api/modules/releases/pm-hub/pillar-config', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pillars: [
          {
            name: 'Inference',
            components: [
              { name: 'Serving', pmLead: 'PM Alpha', engLead: 'Eng Alpha' },
              { name: 'Training', pmLead: 'PM Beta', engLead: 'Eng Beta' },
            ],
          },
        ],
      }),
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

    // Verify bucket/summary column headers (ⓘ help marker may follow the label)
    const summaryTable = page.locator('div:has(> div > h2:has-text("Executive Summary")) table').first();
    const headers = ['Release', 'Total', 'Aligned On Time', 'Aligned Late', 'TV-Only', 'FV-Only', 'Misaligned', 'Alignment %'];
    for (const header of headers) {
      const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const th = summaryTable.locator('th', { hasText: new RegExp(escaped, 'i') }).first();
      await expect(th).toBeVisible();
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render product rows plus cycle/milestone rollups', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // 18 product rows + 2 cycle headers + 6 milestone headers (GA/EA2/EA1 × 3.6/3.5)
    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();
    const rows = summarySection.locator('tbody tr');
    await expect(rows).toHaveCount(26);

    await expect(summarySection.locator('tbody tr', { hasText: '3.6 Release Cycle' })).toBeVisible();
    await expect(summarySection.locator('tbody tr', { hasText: '3.5 Release Cycle' })).toBeVisible();
    await expect(summarySection.locator('tbody tr', { hasText: '3.6 GA Release' })).toBeVisible();
    await expect(summarySection.locator('tbody tr', { hasText: '3.5 EA1 RHOAI RELEASE' })).toBeVisible();
    await expect(summarySection.locator('tbody tr', { hasText: '3.6 GA RHOAI RELEASE' })).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should order executive summary cycle → milestone → product descending', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const labels = await summaryReleaseLabels(page);

    // Cycles: newer first
    expectBefore(labels, '3.6 Release Cycle', '3.5 Release Cycle');
    // Within 3.6: EA1 → EA2 → GA
    expectBefore(labels, '3.6 EA1 Release', '3.6 EA2 Release');
    expectBefore(labels, '3.6 EA2 Release', '3.6 GA Release');
    // Within a milestone: RHOAI → RHAII → RHELAI
    expectBefore(labels, '3.6 GA RHOAI RELEASE', '3.6 GA RHAII RELEASE');
    expectBefore(labels, '3.6 GA RHAII RELEASE', '3.6 GA RHELAI RELEASE');
    // Product rows sit under their milestone header
    expectBefore(labels, '3.6 EA1 Release', '3.6 EA1 RHOAI RELEASE');
    expectBefore(labels, '3.6 EA2 RHELAI RELEASE', '3.6 GA Release');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render cycle filter pills in numeric descending order', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const filterRow = page.locator('div.flex.items-center.gap-1\\.5.mb-4').first();
    const texts = (await filterRow.locator('button').allTextContents()).map(t => t.trim());
    expect(texts[0]).toBe('All');
    expect(texts.slice(1)).toEqual(['3.6', '3.5']);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should display correct counts in executive summary', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // EA1 row: total=5, aligned_on_time=3, aligned_late=0, tv_only=1, fv_only=0, misaligned=1, alignment=60%
    const ea1Row = summarySection.locator('tbody tr', { hasText: '3.5 EA1 RHOAI RELEASE' });
    await expect(ea1Row).toContainText('60%');

    // 3.5 GA RHOAI RELEASE row: 100% alignment
    const gaRow = summarySection.locator('tbody tr', { hasText: '3.5 GA RHOAI RELEASE' });
    await expect(gaRow).toContainText('100%');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should colour-code alignment percentages', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // EA2 has 50% alignment → yellow
    const ea2Pct = summarySection.locator('tbody tr', { hasText: '3.5 EA2 RHOAI RELEASE' }).locator('span.font-semibold').last();
    const ea2Classes = await ea2Pct.getAttribute('class');
    expect(ea2Classes).toContain('text-yellow-600');

    // 3.5 GA has 100% alignment → green
    const gaPct = summarySection.locator('tbody tr', { hasText: '3.5 GA RHOAI RELEASE' }).locator('span.font-semibold').last();
    const gaClasses = await gaPct.getAttribute('class');
    expect(gaClasses).toContain('text-green-600');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should highlight the selected release row', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // Auto-selects first default version that has detail data (3.5 GA precedes EA in the list)
    const gaRow = summarySection.locator('tbody tr', { hasText: DEFAULT_SELECTED_DETAIL_RELEASE });
    const gaClasses = await gaRow.getAttribute('class');
    expect(gaClasses).toContain('bg-blue-50');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should select release when clicking executive summary row', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // Click on the EA2 row
    const ea2Row = summarySection.locator('tbody tr', { hasText: '3.5 EA2 RHOAI RELEASE' });
    await ea2Row.click();
    await page.waitForTimeout(500);

    // EA2 row should now be highlighted
    const ea2Classes = await ea2Row.getAttribute('class');
    expect(ea2Classes).toContain('bg-blue-50');

    // EA1 row should no longer be highlighted
    const ea1Row = summarySection.locator('tbody tr', { hasText: '3.5 EA1 RHOAI RELEASE' });
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
    // Each row has Total, On Time, TV-Only, FV-Only = 4 clickable links per row × 18 rows
    expect(linkCount).toBeGreaterThanOrEqual(18);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render compound aligned_on_time JQL link when fixture contains OR clause (Cases 1-3)', async ({ page }) => {
    // Fixture where 3.5 GA has compound JQL: Case 1+2 (earlier FV) OR Case 3 (later TV)
    const compoundJql = encodeURIComponent(
      'project = RHAISTRAT AND (("Target Version" in ("3.5 GA RHOAI RELEASE") AND fixVersion in ("3.5 GA RHOAI RELEASE", "3.5 EA2 RHOAI RELEASE", "3.5 EA1 RHOAI RELEASE")) OR (fixVersion in ("3.5 GA RHOAI RELEASE") AND "Target Version" in ("3.6 EA1 RHOAI RELEASE")))'
    );
    const compoundFixture = {
      ...FIXTURE_DATA,
      executive_summary: FIXTURE_DATA.executive_summary.map(row =>
        row.release === '3.5 GA RHOAI RELEASE'
          ? { ...row, aligned_on_time_jql: 'https://redhat.atlassian.net/issues/?jql=' + compoundJql }
          : row
      )
    };

    await page.unroute('**/api/modules/releases/tv-fv-delta');
    await page.route('**/api/modules/releases/tv-fv-delta', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(compoundFixture) });
      }
    });

    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();
    const gaRow = summarySection.locator('tbody tr', { hasText: '3.5 GA RHOAI RELEASE' });

    // Aligned On Time is the second Jira link in the row (after Total)
    const alignedLink = gaRow.locator('a[href*="atlassian.net"]').nth(1);
    await expect(alignedLink).toBeVisible();

    const href = await alignedLink.getAttribute('href');
    expect(href).toContain('3.5%20EA2%20RHOAI%20RELEASE');
    expect(href).toContain('3.5%20EA1%20RHOAI%20RELEASE');
    expect(href).toContain('3.6%20EA1%20RHOAI%20RELEASE');

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

  test('should render release chip buttons for all default releases', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    for (const release of DEFAULT_FIXTURE_RELEASES) {
      const chip = versionChip(page, release);
      await expect(chip).toBeVisible();
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should organize version selector by cycle → milestone → product', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Hierarchical chip groups live in the space-y-4 selector stack below the summary
    const selector = page.locator('div.mb-6.space-y-4');
    const cycleHeaders = selector.locator('div.uppercase.tracking-wide', { hasText: 'Release Cycle' });
    await expect(cycleHeaders).toHaveCount(2);
    await expect(cycleHeaders.nth(0)).toHaveText(/3\.6 Release Cycle/i);
    await expect(cycleHeaders.nth(1)).toHaveText(/3\.5 Release Cycle/i);

    const cycle36 = selector.locator('div.rounded-lg.border').filter({ hasText: '3.6 Release Cycle' }).first();
    // Milestone "All products" chips expose accessible names like "3.6 EA1 Release all products"
    const milestoneButtons = cycle36.getByRole('button', { name: /all products/i });
    const milestoneCount = await milestoneButtons.count();
    const milestoneLabels = [];
    for (let i = 0; i < milestoneCount; i++) {
      const label = await milestoneButtons.nth(i).getAttribute('aria-label');
      milestoneLabels.push(String(label || '').replace(/\s+all products$/i, '').trim());
    }
    expect(milestoneLabels).toEqual([
      '3.6 EA1 Release',
      '3.6 EA2 Release',
      '3.6 GA Release',
    ]);
    await expect(milestoneButtons.first()).toHaveAttribute('aria-pressed', /.+/);

    // Product chips under the first milestone (EA1), in product order
    const ea1Group = cycle36.locator('div.border-t').first();
    const ea1ChipTexts = (await ea1Group.locator('button').filter({ has: page.locator('span[title="Remove"]') }).allTextContents())
      .map(t => t.replace(/×/g, '').replace(/\s+/g, ' ').trim());
    expect(ea1ChipTexts).toEqual([
      '3.6 EA1 RHOAI RELEASE',
      '3.6 EA1 RHAII RELEASE',
      '3.6 EA1 RHELAI RELEASE',
    ]);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should group Add release dropdown by cycle → milestone', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await page.getByRole('button', { name: '+ Add release' }).click();
    const dropdown = page.locator('div.absolute.z-20').filter({ has: page.getByPlaceholder('Search versions...') });
    await expect(dropdown).toBeVisible();

    const cycleLabels = (await dropdown.locator('div.sticky').allTextContents()).map(t => t.trim());
    expect(cycleLabels[0]).toMatch(/3\.6 Release Cycle/i);
    expect(cycleLabels).toEqual(expect.arrayContaining([
      expect.stringMatching(/3\.6 Release Cycle/i),
      expect.stringMatching(/3\.5 Release Cycle/i),
    ]));
    expectBefore(cycleLabels, '3.6 Release Cycle', '3.5 Release Cycle');

    const milestoneLabels = (await dropdown.locator('div.pt-2').allTextContents()).map(t => t.trim());
    expectBefore(milestoneLabels, '3.6 EA1 Release', '3.6 GA Release');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should highlight the active release tab', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Auto-selected GA chip should have blue background
    const gaTab = versionChip(page, DEFAULT_SELECTED_DETAIL_RELEASE);
    const gaClasses = await gaTab.getAttribute('class');
    expect(gaClasses).toContain('bg-blue-600');

    // EA2 should NOT have blue background
    const ea2Tab = versionChip(page, '3.5 EA2 RHOAI RELEASE');
    const ea2Classes = await ea2Tab.getAttribute('class');
    expect(ea2Classes).not.toContain('bg-blue-600');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should switch release when clicking a tab', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Click EA2 tab
    const ea2Tab = versionChip(page, '3.5 EA2 RHOAI RELEASE');
    await ea2Tab.click();
    await page.waitForTimeout(500);

    // EA2 tab should now be active
    const ea2Classes = await ea2Tab.getAttribute('class');
    expect(ea2Classes).toContain('bg-blue-600');

    // EA1 tab should no longer be active
    const ea1Tab = versionChip(page, '3.5 EA1 RHOAI RELEASE');
    const ea1Classes = await ea1Tab.getAttribute('class');
    expect(ea1Classes).not.toContain('bg-blue-600');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should select milestone group to show all products for a release event', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const selector = page.locator('div.mb-6.space-y-4');
    await selector.getByRole('button', { name: /3\.5 EA1 Release\s+all products/ }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/Showing features for\s+3\.5 EA1 Release/)).toBeVisible();
    await expect(page.getByText(/all products \(2\)/)).toBeVisible();

    // Product chips in the group get group highlight (not sole solid blue)
    const rhoaiChip = versionChip(page, '3.5 EA1 RHOAI RELEASE');
    const rhaiiChip = versionChip(page, '3.5 EA1 RHAII RELEASE');
    await expect(rhoaiChip).toHaveClass(/bg-blue-100/);
    await expect(rhaiiChip).toHaveClass(/bg-blue-100/);
    expect(await rhoaiChip.getAttribute('class')).not.toContain('bg-blue-600');

    // Merged aligned on time = RHOAI 3 + RHAII 1
    await expect(page.locator('summary:has-text("Aligned On Time")')).toContainText('(4)');
    await page.locator('summary:has-text("Aligned On Time")').click();
    await page.waitForTimeout(200);
    await expect(page.locator('text=RHAISTRAT-110')).toBeVisible();
    await expect(page.locator('text=RHAISTRAT-100')).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should return to product-specific view when clicking a product chip', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const selector = page.locator('div.mb-6.space-y-4');
    await selector.getByRole('button', { name: /3\.5 EA1 Release\s+all products/ }).click();
    await page.waitForTimeout(200);

    await versionChip(page, '3.5 EA1 RHOAI RELEASE').click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Showing features for')).toContainText('3.5 EA1 RHOAI RELEASE');
    await expect(page.getByText(/all products \(2\)/)).toHaveCount(0);

    const rhoaiChip = versionChip(page, '3.5 EA1 RHOAI RELEASE');
    expect(await rhoaiChip.getAttribute('class')).toContain('bg-blue-600');

    // Single-product aligned on time count is 3 again
    await expect(page.locator('summary:has-text("Aligned On Time")')).toContainText('(3)');

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
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // EA1 has: aligned_on_time (3), aligned_late (0), tv_only (1), fv_only (0), misaligned (1)
    await expect(page.locator('summary:has-text("TV-Only")')).toBeVisible();
    await expect(page.locator('summary:has-text("Aligned On Time")')).toBeVisible();
    await expect(page.locator('summary:has-text("Misaligned")')).toBeVisible();
    // FV-Only should render even with 0 items (empty table)
    await expect(page.locator('summary:has-text("FV-Only")')).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show correct counts in category headings', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    await expect(page.locator('summary:has-text("TV-Only")')).toContainText('(1)');
    await expect(page.locator('summary:has-text("Aligned On Time")')).toContainText('(3)');
    await expect(page.locator('summary:has-text("Misaligned")')).toContainText('(1)');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should update category counts when switching releases', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // EA1: tv_only=1
    await expect(page.locator('summary:has-text("TV-Only")')).toContainText('(1)');

    // Switch to GA: tv_only=0, aligned_on_time=3
    await selectVersion(page, DEFAULT_SELECTED_DETAIL_RELEASE);

    await expect(page.locator('summary:has-text("Aligned On Time")')).toContainText('(3)');
    await expect(page.locator('summary:has-text("TV-Only")')).toContainText('(0)');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show "View in Jira" links on each category section', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Default GA fixture only has aligned_on_time; pick EA1 (aligned + TV-only + misaligned)
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    const jiraLinks = page.locator('summary a:has-text("View in Jira")');
    const count = await jiraLinks.count();
    // Should have "View in Jira" on each non-empty category section
    expect(count).toBeGreaterThanOrEqual(3);
    // Links use exact key-in JQL for the rows shown in the section
    await expect(jiraLinks.first()).toHaveAttribute('href', /key\+in|key%20in|key in/);

    // Also available in all-products (milestone) scope
    const selector = page.locator('div.mb-6.space-y-4');
    await selector.getByRole('button', { name: /3\.5 EA1 Release\s+all products/ }).click();
    await page.waitForTimeout(300);
    expect(await page.locator('summary a:has-text("View in Jira")').count()).toBeGreaterThanOrEqual(3);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should hide Misaligned section when count is zero', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Switch to EA2 which has 0 misaligned
    await versionChip(page, '3.5 EA2 RHOAI RELEASE').click();
    await page.waitForTimeout(500);

    // Misaligned section should be hidden (v-if="releaseData.misaligned.length")
    const misaligned = page.locator('summary:has-text("Misaligned")');
    await expect(misaligned).toHaveCount(0);

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

    // Open TV-Only and Aligned On Time sections
    await page.locator('summary:has-text("TV-Only")').click();
    await page.locator('summary:has-text("Aligned On Time")').click();
    await page.waitForTimeout(300);

    // Verify they're open
    const tvOnlyOpen = await page.locator('details:has(summary:has-text("TV-Only"))').getAttribute('open');
    expect(tvOnlyOpen).not.toBeNull();
    const alignedOpen = await page.locator('details:has(summary:has-text("Aligned On Time"))').getAttribute('open');
    expect(alignedOpen).not.toBeNull();

    // FV-Only should still be closed
    const fvOnlyClosed = await page.locator('details:has(summary:has-text("FV-Only"))').getAttribute('open');
    expect(fvOnlyClosed).toBeNull();

    // Switch to EA2
    await versionChip(page, '3.5 EA2 RHOAI RELEASE').click();
    await page.waitForTimeout(500);

    // TV-Only and Aligned On Time should STILL be open
    const tvOnlyStillOpen = await page.locator('details:has(summary:has-text("TV-Only"))').getAttribute('open');
    expect(tvOnlyStillOpen).not.toBeNull();
    const alignedStillOpen = await page.locator('details:has(summary:has-text("Aligned On Time"))').getAttribute('open');
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

    // Expand Aligned On Time section (has 3 features for EA1)
    await page.locator('summary:has-text("Aligned On Time")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned On Time"))');
    const rows = alignedDetails.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render feature keys as clickable Jira links', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // Expand TV-Only section
    await page.locator('summary:has-text("TV-Only")').click();
    await page.waitForTimeout(300);

    const tvOnlyDetails = page.locator('details:has(summary:has-text("TV-Only"))');
    // Prefer /browse/ so the section "View in Jira" key-in link does not also match
    const keyLink = tvOnlyDetails.locator('a[href*="/browse/RHAISTRAT-200"]');
    await expect(keyLink).toBeVisible();
    const href = await keyLink.getAttribute('href');
    expect(href).toContain('redhat.atlassian.net/browse/RHAISTRAT-200');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should display correct columns for all categories (including TV/FV)', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Aligned On Time section
    await page.locator('summary:has-text("Aligned On Time")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned On Time"))');
    const headers = alignedDetails.locator('thead th');

    // All categories now include: Key, Summary, TV, FV, Status, Color, PM, Assignee, Team, Component
    const expectedHeaders = ['Key', 'Summary', 'TV', 'FV', 'Status', 'Color', 'PM', 'Assignee', 'Team', 'Component'];
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
    // EA1 has Misaligned + TV-Only sections; GA does not
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // Test that TV-Only, Aligned On Time, and Misaligned all have TV/FV columns
    const categories = ['TV-Only', 'Aligned On Time', 'Misaligned'];

    for (const category of categories) {
      await page.locator(`summary:has-text("${category}")`).click();
      await page.waitForTimeout(300);

      const categoryDetails = page.locator(`details:has(summary:has-text("${category}"))`);
      const headers = categoryDetails.locator('thead th');
      const count = await headers.count();

      // All categories have 10 columns including TV and FV
      expect(count).toBe(10);

      // Verify TV and FV headers exist immediately after Summary
      const headerTexts = [];
      for (let i = 0; i < count; i++) {
        headerTexts.push(await headers.nth(i).textContent());
      }
      expect(headerTexts.map(h => h.trim().replace(/[▲▼]/g, '').trim()).slice(0, 4)).toEqual([
        'Key', 'Summary', 'TV', 'FV',
      ]);

      // Collapse for next iteration
      await page.locator(`summary:has-text("${category}")`).click();
      await page.waitForTimeout(200);
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show misaligned TV and FV values side by side', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    await page.locator('summary:has-text("Misaligned")').click();
    await page.waitForTimeout(300);

    const mismatchDetails = page.locator('details:has(summary:has-text("Misaligned"))');
    const row = mismatchDetails.locator('tbody tr', { hasText: 'RHAISTRAT-300' });
    await expect(row).toBeVisible();
    const cells = row.locator('td');
    // Key, Summary, TV, FV
    await expect(cells.nth(2)).toContainText('3.5 EA1 RHOAI RELEASE');
    await expect(cells.nth(3)).toContainText('3.5 EA2 RHOAI RELEASE');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should render color status as badges', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Expand Aligned On Time section
    await page.locator('summary:has-text("Aligned On Time")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned On Time"))');
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
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // Expand Aligned On Time section (3 features)
    await page.locator('summary:has-text("Aligned On Time")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned On Time"))');

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

    // Expand Aligned On Time section — EA1 has 3 aligned_on_time
    await page.locator('summary:has-text("Aligned On Time")').click();
    await page.waitForTimeout(300);

    const alignedDetails = page.locator('details:has(summary:has-text("Aligned On Time"))');
    let rows = alignedDetails.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    // Switch to EA2 — has 2 aligned_on_time
    await versionChip(page, '3.5 EA2 RHOAI RELEASE').click();
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
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // Expand Component Breakdown
    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const compSection = page.locator('details:has(summary:has-text("Component Breakdown"))');
    // EA1: Serving appears in RHAISTRAT-100, 102, 300 = 3 features (meets >= 2 threshold)
    const servingRow = compSection.locator('tbody tr', { hasText: 'Serving' });
    await expect(servingRow).toBeVisible();

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should link non-zero component counts to Jira key-in lists', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const servingRow = page.locator('details:has(summary:has-text("Component Breakdown"))')
      .locator('tbody tr', { hasText: 'Serving' });
    await expect(servingRow).toBeVisible();

    // Total (3) and Aligned On Time (2) should be key-in Jira links
    const totalLink = servingRow.getByRole('link', { name: '3', exact: true });
    await expect(totalLink).toBeVisible();
    await expect(totalLink).toHaveAttribute('href', /key%20in|key\+in|key in/);
    await expect(totalLink).toHaveAttribute('href', /RHAISTRAT-100/);

    const alignedLink = servingRow.getByRole('link', { name: '2', exact: true });
    await expect(alignedLink).toBeVisible();
    await expect(alignedLink).toHaveAttribute('href', /RHAISTRAT-100/);
    await expect(alignedLink).toHaveAttribute('href', /RHAISTRAT-102/);

    // Zero cells stay plain text (no Jira link)
    await expect(servingRow.getByRole('link', { name: '0', exact: true })).toHaveCount(0);

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

    // Switch to 3.5 GA RHOAI RELEASE (GA) — different components
    await versionChip(page, '3.5 GA RHOAI RELEASE').click();
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

    const expectedHeaders = ['Component', 'PM', 'ENG', 'Total', 'Aligned On Time', 'Aligned Late', 'TV-Only', 'FV-Only', 'Misaligned', 'Alignment %'];
    const count = await headers.count();
    expect(count).toBe(expectedHeaders.length);
    for (let i = 0; i < expectedHeaders.length; i++) {
      await expect(headers.nth(i)).toHaveText(expectedHeaders[i]);
    }

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should show PM and ENG leads from PM Hub pillar-config', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');
    await page.locator('summary:has-text("Component Breakdown")').click();
    await page.waitForTimeout(300);

    const compSection = page.locator('details:has(summary:has-text("Component Breakdown"))');
    const servingRow = compSection.locator('tbody tr', { hasText: 'Serving' });
    await expect(servingRow).toBeVisible();
    await expect(servingRow).toContainText('PM Alpha');
    await expect(servingRow).toContainText('Eng Alpha');

    const trainingRow = compSection.locator('tbody tr', { hasText: 'Training' });
    await expect(trainingRow).toContainText('PM Beta');
    await expect(trainingRow).toContainText('Eng Beta');

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
    // Alignment % is the last column — avoid matching ClickableCount zero spans
    const pctSpans = compSection.locator('tbody td:last-child span.font-semibold');
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
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // Expand Misaligned section (has both TV and FV populated)
    await page.locator('summary:has-text("Misaligned")').click();
    await page.waitForTimeout(300);

    const misalignedDetails = page.locator('details:has(summary:has-text("Misaligned"))');
    const firstRow = misalignedDetails.locator('tbody tr').first();

    // Should show 3.5 EA1 RHOAI RELEASE in TV column and 3.5 EA2 RHOAI RELEASE in FV column (from fixture)
    await expect(firstRow).toContainText('3.5 EA1 RHOAI RELEASE');
    await expect(firstRow).toContainText('3.5 EA2 RHOAI RELEASE');

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

    // Verify they show 0 counts (columns: Component, PM, ENG, Total, …)
    const unusedRow = compSection.locator('tr:has-text("Unused Component A")');
    await expect(unusedRow.locator('td').nth(3)).toContainText('0'); // Total column
    await expect(unusedRow.locator('td').nth(1)).toContainText('—'); // PM (no pillar-config lead)
    await expect(unusedRow.locator('td').nth(2)).toContainText('—'); // ENG

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should sync release selection between executive summary and tabs', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();

    // Click EA2 row in executive summary
    const ea2Row = summarySection.locator('tbody tr', { hasText: '3.5 EA2 RHOAI RELEASE' });
    await ea2Row.click();
    await page.waitForTimeout(500);

    // EA2 tab should now be active (highlighted)
    const ea2Tab = versionChip(page, '3.5 EA2 RHOAI RELEASE');
    const ea2Classes = await ea2Tab.getAttribute('class');
    expect(ea2Classes).toContain('bg-blue-600');

    // Now click EA1 tab
    const ea1Tab = versionChip(page, '3.5 EA1 RHOAI RELEASE');
    await ea1Tab.click();
    await page.waitForTimeout(500);

    // EA1 executive summary row should now be highlighted
    const ea1ExecRow = summarySection.locator('tbody tr', { hasText: '3.5 EA1 RHOAI RELEASE' });
    const ea1RowClasses = await ea1ExecRow.getAttribute('class');
    expect(ea1RowClasses).toContain('bg-blue-50');

    expect(relevantErrors(page)).toHaveLength(0);
  });

  test('should handle features with multiple comma-separated components', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);
    await selectVersion(page, '3.5 EA1 RHOAI RELEASE');

    // Expand Misaligned section (RHAISTRAT-300 has "Serving, Training")
    await page.locator('summary:has-text("Misaligned")').click();
    await page.waitForTimeout(300);

    const misalignedDetails = page.locator('details:has(summary:has-text("Misaligned"))');
    const componentCell = misalignedDetails.locator('tbody tr:has-text("RHAISTRAT-300")').locator('td').last();

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

  test('should render release chips from default-selected product-family versions', async ({ page }) => {
    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // All 18 default-selected versions appear as chip buttons below exec summary
    for (const release of DEFAULT_FIXTURE_RELEASES) {
      await expect(versionChip(page, release)).toBeVisible();
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
    const dropdown = page.locator('div.absolute.z-20').filter({ has: page.getByPlaceholder('Search versions...') });
    const dropdownButtons = dropdown.locator('button');
    const count = await dropdownButtons.count();
    expect(count).toBe(1);
    await expect(dropdownButtons.first()).toContainText('rhoai-3.4');

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

    // Default EA1 chip should be visible
    const ea1Chip = versionChip(page, '3.5 EA1 RHOAI RELEASE').first();
    await expect(ea1Chip).toBeVisible();

    // Click the x (×) on the EA1 chip
    await ea1Chip.locator('span[title="Remove"]').click();
    await page.waitForTimeout(300);

    // EA1 chip should be gone
    await expect(ea1Chip).not.toBeVisible();
    // Others still present
    await expect(versionChip(page, '3.5 EA2 RHOAI RELEASE').first()).toBeVisible();

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


test.describe('TV/FV Delta — Registry fixVersions Edge Cases @tv-fv-delta', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('should load without errors when registry has empty fixVersions', async ({ page }) => {
    // Simulate the pre-fix bug: registry returns releases with empty fixVersions.
    // The view should still load without errors (fallback to cached metadata).
    const emptyFvRegistry = {
      releases: [
        { id: 'rhoai-3.5-ea1', displayName: 'RHOAI 3.5 EA1', state: 'active', fixVersions: [], milestones: {} },
        { id: 'rhoai-3.5-ea2', displayName: 'RHOAI 3.5 EA2', state: 'active', fixVersions: [], milestones: {} },
        { id: 'rhoai-3.5', displayName: 'RHOAI 3.5', state: 'active', fixVersions: [], milestones: {} },
      ],
    };

    await mockAllApis(page);
    await page.unroute('**/api/modules/releases/registry');
    await page.route('**/api/modules/releases/registry', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyFvRegistry)
      });
    });

    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Page should load without errors — data comes from cached TV/FV delta endpoint
    expect(relevantErrors(page)).toHaveLength(0);

    // The view should still render from the fixture data
    const heading = page.getByRole('heading', { name: 'TV vs FV Delta' });
    await expect(heading).toBeVisible();
  });

  test('should render releases after registry migration populates fixVersions', async ({ page }) => {
    // Simulate the post-fix state: registry returns clean IDs with populated fixVersions
    // (after migrateNormalizedIds merged .z entries and carried fixVersions over)
    const migratedRegistry = {
      releases: [
        { id: 'rhoai-3.5-ea1', displayName: 'RHOAI 3.5 EA1', state: 'active', fixVersions: ['3.5 EA1 RHOAI RELEASE'], milestones: { ga: '2026-07-01' } },
        { id: 'rhoai-3.5-ea2', displayName: 'RHOAI 3.5 EA2', state: 'active', fixVersions: ['3.5 EA2 RHOAI RELEASE'], milestones: { ga: '2026-08-01' } },
        { id: 'rhoai-3.5', displayName: 'RHOAI 3.5', state: 'active', fixVersions: ['3.5 GA RHOAI RELEASE'], milestones: { ga: '2026-09-01' } },
      ],
    };

    await mockAllApis(page);
    await page.unroute('**/api/modules/releases/registry');
    await page.route('**/api/modules/releases/registry', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(migratedRegistry)
      });
    });

    await page.goto('/#/releases/reports?report=tv-fv-delta');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    expect(relevantErrors(page)).toHaveLength(0);

    // Default product-family versions should appear as chips
    for (const release of DEFAULT_FIXTURE_RELEASES) {
      await expect(versionChip(page, release)).toBeVisible();
    }

    // 18 product rows + 2 cycle headers + 6 milestone headers = 26
    const summarySection = page.locator('div:has(> div > h2:has-text("Executive Summary"))').first();
    const rows = summarySection.locator('tbody tr');
    await expect(rows).toHaveCount(26);
  });
});
