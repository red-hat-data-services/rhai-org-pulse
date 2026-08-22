import { describe, it, expect, vi } from 'vitest';

// Mock fs before importing routes (matches sibling route tests)
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn()
}));

import registerDecomposerRoutes from '../../server/decomposer/routes.js';

function makeDoc() {
  return {
    schema_version: '1.0',
    generated_at: '2026-07-24T00:00:00Z',
    counts: { runs: 1, strategies: 2 },
    signal_names: [],
    investigation_signal_names: [],
    runs: [{ run_id: 'r1', started: '2026-07-20T00:00:00Z', submitted_epics: 9, total: 2, results: [] }],
    strategies: {
      'RHAISTRAT-1': { strat_id: 'RHAISTRAT-1', title: 'A', review: { pass: true }, epics: [], run_history: [] },
      'RHAISTRAT-2': { strat_id: 'RHAISTRAT-2', title: 'B', review: { pass: false }, epics: [], run_history: [] }
    },
    aggregates: { unique_strategies: 2, total_epics: 9 },
    epic_bodies: { x: 'md' }
  };
}

function makeContext(storageData = null) {
  return {
    storage: {
      readFromStorage: vi.fn().mockResolvedValue(storageData),
      writeToStorage: vi.fn().mockResolvedValue(undefined)
    },
    requireAdmin: (req, res, next) => next(),
    requireScope: () => (req, res, next) => next()
  };
}

function createRouter() {
  const routes = {};
  const router = {
    get: vi.fn((path, ...h) => { routes[`GET ${path}`] = h; }),
    post: vi.fn((path, ...h) => { routes[`POST ${path}`] = h; }),
    put: vi.fn((path, ...h) => { routes[`PUT ${path}`] = h; }),
    delete: vi.fn((path, ...h) => { routes[`DELETE ${path}`] = h; })
  };
  return { router, routes };
}

async function callHandler(routes, method, path, body = {}, params = {}) {
  const handlers = routes[`${method} ${path}`];
  if (!handlers) throw new Error(`No route for ${method} ${path}. Have: ${Object.keys(routes).join(', ')}`);
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  const req = { body, params, query: {} };
  await handlers[handlers.length - 1](req, res);
  return { req, res };
}

describe('decomposer routes registration', () => {
  it('registers /decomposer/status before /decomposer (static-first)', () => {
    const { router } = createRouter();
    registerDecomposerRoutes(router, makeContext());
    const getPaths = router.get.mock.calls.map(c => c[0]);
    expect(getPaths.indexOf('/decomposer/status')).toBeLessThan(getPaths.indexOf('/decomposer'));
  });
});

describe('GET /decomposer', () => {
  it('returns stored snapshot with jiraHost', async () => {
    const stored = { lastSyncedAt: 'x', runs: [{ run_id: 'r' }], strategies: [], aggregates: {} };
    const { router, routes } = createRouter();
    registerDecomposerRoutes(router, makeContext(stored));
    const { res } = await callHandler(routes, 'GET', '/decomposer');
    const payload = res.json.mock.calls[0][0];
    expect(payload.runs).toEqual([{ run_id: 'r' }]);
    expect(payload.jiraHost).toMatch(/^https?:\/\//);
  });

  it('returns an empty snapshot when nothing stored', async () => {
    const { router, routes } = createRouter();
    registerDecomposerRoutes(router, makeContext(null));
    const { res } = await callHandler(routes, 'GET', '/decomposer');
    const payload = res.json.mock.calls[0][0];
    expect(payload.runs).toEqual([]);
    expect(payload.counts).toEqual({ runs: 0, strategies: 0 });
  });
});

describe('GET /decomposer/status', () => {
  it('returns lastSyncedAt, generatedAt and counts', async () => {
    const stored = { lastSyncedAt: 't', generatedAt: 'g', counts: { runs: 3, strategies: 5 }, runs: [{}] };
    const { router, routes } = createRouter();
    registerDecomposerRoutes(router, makeContext(stored));
    const { res } = await callHandler(routes, 'GET', '/decomposer/status');
    expect(res.json).toHaveBeenCalledWith({ lastSyncedAt: 't', generatedAt: 'g', counts: { runs: 3, strategies: 5 } });
  });
});

describe('POST /decomposer', () => {
  it('stores the projected subset and reports counts', async () => {
    const ctx = makeContext(null);
    const { router, routes } = createRouter();
    registerDecomposerRoutes(router, ctx);

    const { res } = await callHandler(routes, 'POST', '/decomposer', makeDoc());
    expect(res.json).toHaveBeenCalledWith({ status: 'stored', runs: 1, strategies: 2 });

    // writeToStorage got a projected snapshot: stamped, no epic_bodies, slim arrays
    const [key, snapshot] = ctx.storage.writeToStorage.mock.calls[0];
    expect(key).toBe('ai-impact/decomposer.json');
    expect(snapshot.lastSyncedAt).toBeTruthy();
    expect(snapshot).not.toHaveProperty('epic_bodies');
    expect(Array.isArray(snapshot.strategies)).toBe(true);
    expect(snapshot.strategies).toHaveLength(2);
    expect(snapshot.runs[0]).not.toHaveProperty('results');
  });

  it('returns 400 for an invalid snapshot', async () => {
    const { router, routes } = createRouter();
    registerDecomposerRoutes(router, makeContext(null));
    const { res } = await callHandler(routes, 'POST', '/decomposer', { runs: 'bad' });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('DELETE /decomposer', () => {
  it('clears the snapshot', async () => {
    const ctx = makeContext(null);
    const { router, routes } = createRouter();
    registerDecomposerRoutes(router, ctx);
    const { res } = await callHandler(routes, 'DELETE', '/decomposer');
    expect(res.json).toHaveBeenCalledWith({ status: 'cleared' });
    expect(ctx.storage.writeToStorage).toHaveBeenCalled();
  });
});
