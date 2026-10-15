const { test: base, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');
const coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'));
const storage = require(path.join(coreDir, 'shared/server/storage'));
const { createTestContext } = require(path.join(coreDir, 'shared/server/module-context'));
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for the AI Catalyst feed sync against a local stub
 *
 * Each test owns a non-demo Express backend, temporary storage, a dummy
 * credential and a loopback feed stub. Browser module requests are routed
 * to that backend; BASE_URL is only used to load the frontend shell.
 * No configured deployment or developer data is changed, and no feed tests
 * skip themselves when the frontend shell uses demo mode.
 *
 * Tag: @ai-catalyst
 * Usage: npx playwright test tests/integration/ai-catalyst-feed-sync.spec.js --workers=1
 */

const test = base.extend({
  backend: async ({ playwright }, use) => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-catalyst-feed-'));
    const previousDataDir = storage.DATA_DIR;
    const previousDemoMode = process.env.DEMO_MODE;
    process.env.DEMO_MODE = 'false';
    const registerPath = require.resolve('../../modules/ai-catalyst/server');
    delete require.cache[registerPath];
    const registerRoutes = require(registerPath);
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
    const { clearCache } = require('../../modules/ai-catalyst/server/showcase/feed-sync');
    storage.initStorage({ dataDir });
    clearCache();
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerRoutes(router, createTestContext({
      storage,
      secrets: { POC_EXPLORER_FEED_TOKEN: 'integration-dummy-token' },
      resolveSecret: key => key === 'POC_EXPLORER_ALLOW_LOOPBACK' ? '1' : undefined,
      requireAdmin: (req, res, next) => req.get('authorization') === 'Bearer integration-admin'
        ? next() : res.status(403).json({ error: 'Admin required' }),
    }));
    app.use('/api/modules/ai-catalyst', router);
    const server = http.createServer(app);
    let request;
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      request = await playwright.request.newContext({
        baseURL: baseUrl, extraHTTPHeaders: { Authorization: 'Bearer integration-admin' },
      });
      await use({ request, baseUrl, dataDir });
    } finally {
      if (request) await request.dispose();
      if (server.listening) await new Promise(resolve => server.close(resolve));
      clearCache();
      storage.initStorage({ dataDir: previousDataDir });
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  },
  request: async ({ backend }, use) => use(backend.request),
  page: async ({ page, backend }, use) => {
    await page.route('**/api/modules/ai-catalyst/**', async route => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: backend.baseUrl + url.pathname + url.search });
      await route.fulfill({ response });
    });
    await use(page);
  },
});

const STUB_BOARD_MONTH = '2026-04';
const STUB_BOARD_PAYLOAD = {
  kind: 'board',
  name: `board-${STUB_BOARD_MONTH}`,
  count: 2,
  columns: ['title', 'unique_id', 'impact_score', 'gpu_required'],
  rows: [
    { title: 'Stub Board Candidate', unique_id: 'org/stub-candidate', source: 'github', category: 'model-inference', impact_score: '8.5', gpu_required: 'yes', has_dockerfile: 'yes' },
    { title: 'Second Stub Candidate', unique_id: 'org/stub-candidate-2', source: 'hn', category: 'agentic-ai', impact_score: '7', gpu_required: 'no' },
  ],
};

// Distinctive showcase entry served only by the stub, so rendering tests can
// prove the catalog displays data that round-tripped through the sync. It
// deliberately avoids the data-science-engineering pillar to stay compatible
// with the "No projects match your filters" test in ai-catalyst.spec.js.
const STUB_SHOWCASE_MARKER_ENTRY = {
  slug: 'stub-synced-entry',
  title: 'Stub Synced Showcase Entry',
  status: 'active',
  sort_order: 99,
  short_summary: 'Entry served by the local feed stub',
  strategy_pillar_key: 'model-inference',
};

const SHOWCASE_ENTRY_FEED_KEYS = {
  slug: 'slug', title: 'title', status: 'status', sort_order: 'sortOrder',
  short_summary: 'shortSummary', customer_problem: 'customerProblem',
  solution_summary: 'solutionSummary', capability_tags: 'capabilityTags',
  customer_need_tags: 'customerNeedTags', strategy_pillar_key: 'strategyPillarKey',
};
const SHOWCASE_PILLAR_FEED_KEYS = {
  pillar_key: 'pillarKey', title: 'title', short_title: 'shortTitle',
  summary: 'summary', sort_order: 'sortOrder', visual_url: 'visualUrl', color: 'color',
};

function toFeedRows(items, keyMap) {
  return items.map(item => Object.fromEntries(
    Object.entries(keyMap).map(([feedKey, prop]) => [feedKey, item[prop]]),
  ));
}

function loadFixtureShowcaseData() {
  return require('../../fixtures/ai-catalyst/showcase/showcase-data.json');
}

function startFeedStub() {
  const fixtureShowcase = loadFixtureShowcaseData();
  const stub = {
    requests: [],
    malformedBoards: new Set(),
    showcasePayload: null,
    boardPayload: structuredClone(STUB_BOARD_PAYLOAD),
    baseUrl: null,
    server: null,
  };

  stub.server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    stub.requests.push({ path: req.url, auth: req.headers.authorization || '' });
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
      return send(401, { error: 'unauthorized' });
    }
    if (url.pathname === '/feed/boards.json') {
      return send(200, { boards: [`board-${STUB_BOARD_MONTH}`] });
    }
    if (url.pathname === '/feed/board.json') {
      const board = url.searchParams.get('board');
      if (stub.malformedBoards.has(board)) return send(200, {});
      return send(200, stub.boardPayload);
    }
    if (url.pathname === '/feed/showcase.json') {
      if (stub.showcasePayload) return send(200, stub.showcasePayload);
      return send(200, {
        showcase_entries: [...toFeedRows(fixtureShowcase.entries, SHOWCASE_ENTRY_FEED_KEYS), STUB_SHOWCASE_MARKER_ENTRY],
        strategy_pillars: toFeedRows(fixtureShowcase.pillars, SHOWCASE_PILLAR_FEED_KEYS),
        site_config: {},
        generated_at: new Date().toISOString(),
      });
    }
    return send(404, { error: 'not found' });
  });

  return new Promise(resolve => {
    stub.server.listen(0, '127.0.0.1', () => {
      stub.baseUrl = `http://127.0.0.1:${stub.server.address().port}`;
      resolve(stub);
    });
  });
}

test.describe('AI Catalyst feed sync (local stub) @ai-catalyst', () => {
  test.describe.configure({ mode: 'default' });

  let stub = null;

  test.beforeEach(async () => {
    stub = await startFeedStub();
  });

  test.afterEach(async () => {
    if (stub && stub.server.listening) await new Promise(resolve => stub.server.close(resolve));
  });

  // Seed helper: point the module at this test's own stub and run one
  // successful board sync, so every test starts from known state.
  async function seedSyncedBoard(request) {
    const saveRes = await request.post('/api/modules/ai-catalyst/board-config', {
      data: { feedUrl: stub.baseUrl },
    });
    expect(saveRes.ok()).toBe(true);
    // Board reads load pillar data through the showcase read path; point it
    // at the stub so board tests never depend on external network egress.
    const showcaseRes = await request.post('/api/modules/ai-catalyst/showcase/config', {
      data: { feedUrl: stub.baseUrl },
    });
    expect(showcaseRes.ok()).toBe(true);
    stub.malformedBoards.clear();
    const syncRes = await request.post('/api/modules/ai-catalyst/sync');
    expect(syncRes.ok()).toBe(true);
    expect(await syncRes.json()).toMatchObject({ status: 'ok', synced: 1, total: 1, failed: [] });
  }

  test('should save the stub feed URL through the board config API', async ({ request, backend }) => {
    const saveRes = await request.post('/api/modules/ai-catalyst/board-config', {
      data: { feedUrl: stub.baseUrl },
    });
    expect(saveRes.ok()).toBe(true);
    expect(await saveRes.json()).toEqual({ status: 'saved' });

    const configRes = await request.get('/api/modules/ai-catalyst/board-config');
    expect(await configRes.json()).toEqual({ feedUrl: stub.baseUrl });
    expect(JSON.parse(fs.readFileSync(path.join(backend.dataDir, 'ai-catalyst/board-config.json'), 'utf8')))
      .toEqual({ feedUrl: stub.baseUrl });

    const statusRes = await request.get('/api/modules/ai-catalyst/config');
    expect(await statusRes.json()).toMatchObject({ configured: true, demoMode: false });
  });

  test('should sync boards from the local feed stub', async ({ request }) => {
    await seedSyncedBoard(request);

    const boardRequests = stub.requests.filter(r => r.path.includes('/feed/board.json'));
    expect(boardRequests).toHaveLength(1);
    expect(boardRequests[0].auth).toBe('Bearer integration-dummy-token');

    const boardsRes = await request.get('/api/modules/ai-catalyst/boards');
    const { boards } = await boardsRes.json();
    const stubEntry = boards.find(b => b.month === STUB_BOARD_MONTH);
    expect(stubEntry).toMatchObject({ month: STUB_BOARD_MONTH, candidateCount: 2 });
    expect(stubEntry.lastSynced).toEqual(expect.any(String));
  });

  test('should expose persisted sync results through the module API', async ({ request }) => {
    await seedSyncedBoard(request);

    const res = await request.get(`/api/modules/ai-catalyst/boards/${STUB_BOARD_MONTH}`);
    expect(res.ok()).toBe(true);

    const data = await res.json();
    expect(data.month).toBe(STUB_BOARD_MONTH);
    expect(data.total).toBe(2);
    expect(data.candidates[0]).toMatchObject({
      title: 'Stub Board Candidate',
      uniqueId: 'org/stub-candidate',
      impactScore: 8.5,
      gpuRequired: true,
      hasDockerfile: true,
    });
  });

  test('should clear old candidates when the feed returns a valid empty snapshot', async ({ request }) => {
    await seedSyncedBoard(request);
    stub.boardPayload = { name: `board-${STUB_BOARD_MONTH}`, count: 0, rows: [] };

    const result = await request.post('/api/modules/ai-catalyst/sync');

    expect(await result.json()).toMatchObject({ synced: 1, failed: [] });
    const board = await request.get(`/api/modules/ai-catalyst/boards/${STUB_BOARD_MONTH}`);
    expect(await board.json()).toMatchObject({ total: 0, candidates: [] });
  });

  test('should preserve the requested month when the response names another board', async ({ request, backend }) => {
    await seedSyncedBoard(request);
    const boardFile = path.join(backend.dataDir, `ai-catalyst/boards/${STUB_BOARD_MONTH}.json`);
    const before = fs.readFileSync(boardFile);
    stub.boardPayload.name = 'board-2026-10';

    const result = await request.post('/api/modules/ai-catalyst/sync');

    expect(await result.json()).toMatchObject({ synced: 0, failed: [{ board: `board-${STUB_BOARD_MONTH}`, error: expect.stringContaining('board name') }] });
    expect(fs.readFileSync(boardFile)).toEqual(before);
  });

  test('should preserve usable candidates when a row has neither an ID nor source link', async ({ request }) => {
    await seedSyncedBoard(request);
    stub.boardPayload.rows[0].unique_id = '';
    stub.boardPayload.rows[0].link = '';

    const result = await request.post('/api/modules/ai-catalyst/sync');

    expect(await result.json()).toMatchObject({ synced: 0, failed: [{ error: expect.stringContaining('identity') }] });
    const board = await request.get(`/api/modules/ai-catalyst/boards/${STUB_BOARD_MONTH}`);
    expect((await board.json()).candidates[0].uniqueId).toBe('org/stub-candidate');
  });

  test('should open legacy candidates with no producer ID using their source link', async ({ page, request }) => {
    stub.boardPayload.rows[0].unique_id = '';
    stub.boardPayload.rows[0].link = 'https://github.com/org/legacy';
    await seedSyncedBoard(request);

    await page.goto('/#/ai-catalyst/board');
    await page.locator('main .grid h3').filter({ hasText: 'Stub Board Candidate' }).click();

    await expect(page.locator('main h1')).toHaveText('Stub Board Candidate');
    const detail = await request.get(`/api/modules/ai-catalyst/candidates/${encodeURIComponent('https://github.com/org/legacy')}`);
    expect(await detail.json()).toMatchObject({ uniqueId: '', link: 'https://github.com/org/legacy' });
  });

  test('should reject non-admin configuration and refresh requests', async ({ request }) => {
    for (const route of ['board-config', 'showcase/config', 'sync', 'showcase/refresh']) {
      const response = await request.post(`/api/modules/ai-catalyst/${route}`, {
        headers: { Authorization: 'Bearer integration-reader' }, data: { feedUrl: stub.baseUrl },
      });
      expect(response.status()).toBe(403);
    }
    expect(stub.requests).toHaveLength(0);
  });

  test('should keep synced board data when the feed serves a malformed 200', async ({ request }) => {
    await seedSyncedBoard(request);

    const boardsBefore = await (await request.get('/api/modules/ai-catalyst/boards')).json();
    const entryBefore = boardsBefore.boards.find(b => b.month === STUB_BOARD_MONTH);

    stub.malformedBoards.add(`board-${STUB_BOARD_MONTH}`);
    // Ensure a re-stamped timestamp would differ from the one captured above.
    await new Promise(resolve => setTimeout(resolve, 25));

    const syncRes = await request.post('/api/modules/ai-catalyst/sync');
    expect(syncRes.ok()).toBe(true);
    const syncBody = await syncRes.json();
    expect(syncBody).toMatchObject({ status: 'ok', synced: 0, total: 1 });
    expect(syncBody.failed).toHaveLength(1);
    expect(syncBody.failed[0].board).toBe(`board-${STUB_BOARD_MONTH}`);
    expect(syncBody.failed[0].error).toContain('rows');

    const boardRes = await request.get(`/api/modules/ai-catalyst/boards/${STUB_BOARD_MONTH}`);
    expect(boardRes.ok()).toBe(true);
    const boardData = await boardRes.json();
    expect(boardData.total).toBe(2);
    expect(boardData.candidates.map(c => c.uniqueId)).toEqual(['org/stub-candidate', 'org/stub-candidate-2']);

    const boardsAfter = await (await request.get('/api/modules/ai-catalyst/boards')).json();
    const entryAfter = boardsAfter.boards.find(b => b.month === STUB_BOARD_MONTH);
    expect(entryAfter.candidateCount).toBe(2);
    expect(entryAfter.lastSynced).toBe(entryBefore.lastSynced);
  });

  test('should render synced board data in the monthly board view', async ({ page, request }) => {
    // Vite compiles this route on demand; container runs (especially under
    // architecture emulation) need a patient first-render budget.
    test.setTimeout(120000);
    await seedSyncedBoard(request);

    setupErrorTracking(page);
    await page.goto('/#/ai-catalyst/board');
    await page.waitForLoadState('networkidle');

    // The default month is whatever the index holds (newest first) — derive
    // it from the synced state instead of assuming local data, then pick the
    // month this test synced.
    const boards = await (await request.get('/api/modules/ai-catalyst/boards')).json();
    const monthSelect = page.locator('select').first();
    await expect(monthSelect).toHaveValue(boards.boards[0].month, { timeout: 30000 });
    await monthSelect.selectOption(STUB_BOARD_MONTH);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('main .grid h3').filter({ hasText: 'Stub Board Candidate' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('main .grid h3').filter({ hasText: 'Second Stub Candidate' })).toBeVisible();

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
    logCapturedErrors(page, { title: 'render synced board data' });
  });

  test('should sync the showcase from the stub and render it in the catalog', async ({ page, request, backend }) => {
    test.setTimeout(120000);
    setupErrorTracking(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const saveRes = await request.post('/api/modules/ai-catalyst/showcase/config', {
      data: { feedUrl: stub.baseUrl },
    });
    expect(saveRes.ok()).toBe(true);

    const refreshRes = await request.post('/api/modules/ai-catalyst/showcase/refresh');
    expect(refreshRes.ok()).toBe(true);
    expect(await refreshRes.json()).toMatchObject({ status: 'refreshed', entries: 5, pillars: 5 });
    expect(stub.requests.some(r => r.path.includes('/feed/showcase.json'))).toBe(true);

    const entriesRes = await request.get('/api/modules/ai-catalyst/showcase/entries');
    const entriesData = await entriesRes.json();
    expect(entriesData.entries.map(e => e.slug)).toContain('stub-synced-entry');

    const persisted = JSON.parse(fs.readFileSync(
      path.join(backend.dataDir, 'ai-catalyst/showcase/showcase-data.json'), 'utf-8',
    ));
    expect(persisted.entries.map(e => e.slug)).toContain('stub-synced-entry');

    await page.goto('/#/ai-catalyst/catalog');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('main .grid h3').filter({ hasText: 'Stub Synced Showcase Entry' })).toBeVisible({ timeout: 30000 });

    const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
    expect(appErrors).toHaveLength(0);
    logCapturedErrors(page, { title: 'render synced showcase data' });
  });

  for (const [field, rows] of [
    ['showcase_entries', [null]],
    ['slug', [{ slug: { broken: true } }]],
    ['capability_tags', [{ slug: 'bad-tags', capability_tags: [{}] }]],
  ]) {
    test(`should preserve the showcase catalog when ${field} is malformed`, async ({ page, request, backend }) => {
      test.setTimeout(120000);

      const saveRes = await request.post('/api/modules/ai-catalyst/showcase/config', {
        data: { feedUrl: stub.baseUrl },
      });
      expect(saveRes.ok()).toBe(true);
      const refreshRes = await request.post('/api/modules/ai-catalyst/showcase/refresh');
      expect(refreshRes.ok()).toBe(true);
      expect(await refreshRes.json()).toMatchObject({ status: 'refreshed', entries: 5, pillars: 5 });

      const showcaseFile = path.join(backend.dataDir, 'ai-catalyst/showcase/showcase-data.json');
      const bytesBefore = fs.readFileSync(showcaseFile);
      stub.showcasePayload = { showcase_entries: rows, strategy_pillars: [] };
      // Make an accidental timestamp rewrite observable.
      await new Promise(resolve => setTimeout(resolve, 25));

      const failedRefresh = await request.post('/api/modules/ai-catalyst/showcase/refresh');
      expect(failedRefresh.status()).toBe(500);
      expect((await failedRefresh.json()).details).toContain(field);
      expect(fs.readFileSync(showcaseFile)).toEqual(bytesBefore);

      const entriesRes = await request.get('/api/modules/ai-catalyst/showcase/entries');
      expect(entriesRes.ok()).toBe(true);
      expect((await entriesRes.json()).entries.map(e => e.slug)).toContain('stub-synced-entry');

      setupErrorTracking(page);
      await page.goto('/#/ai-catalyst/catalog');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main .grid h3').filter({ hasText: 'Stub Synced Showcase Entry' })).toBeVisible({ timeout: 30000 });

      const appErrors = page.errors.filter(e => !/status of (429|404)/.test(e.message));
      expect(appErrors).toHaveLength(0);
      logCapturedErrors(page, { title: 'render preserved showcase data' });
    });
  }

  test('should reject feed URLs with unapproved origins before fetching', async ({ request }) => {
    const saveRes = await request.post('/api/modules/ai-catalyst/board-config', {
      data: { feedUrl: 'https://evil.example.test' },
    });
    expect(saveRes.ok()).toBe(true);

    const syncRes = await request.post('/api/modules/ai-catalyst/sync');
    expect(syncRes.status()).toBe(500);

    const body = await syncRes.json();
    expect(body.error).toContain('not an approved origin');
    expect(stub.requests).toHaveLength(0);
  });
});
