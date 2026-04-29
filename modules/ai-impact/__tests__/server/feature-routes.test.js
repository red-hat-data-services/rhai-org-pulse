import { describe, it, expect, vi } from 'vitest';

// Mock fs before importing routes (for writeFeaturesAtomic)
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn()
}));

import registerFeatureRoutes from '../../server/features/routes.js';

function makeValidBody() {
  return {
    key: 'RHAISTRAT-1168',
    title: 'GPU-as-a-Service Observability',
    sourceRfe: 'RHAIRFE-262',
    priority: 'Major',
    status: 'Refined',
    size: 'L',
    recommendation: 'approve',
    needsAttention: false,
    scores: { feasibility: 1, testability: 1, scope: 2, architecture: 2, total: 6 },
    reviewers: { feasibility: 'approve', testability: 'revise', scope: 'approve', architecture: 'approve' },
    labels: ['strat-creator-auto-created'],
    reviewedAt: '2026-04-19T01:30:35Z'
  };
}

function makeContext(storageData = null) {
  return {
    storage: {
      readFromStorage: vi.fn().mockReturnValue(storageData)
    },
    requireAdmin: (req, res, next) => next()
  };
}

function createRouter() {
  const routes = {};
  const router = {
    get: vi.fn((path, ...handlers) => { routes[`GET ${path}`] = handlers; }),
    post: vi.fn((path, ...handlers) => { routes[`POST ${path}`] = handlers; }),
    put: vi.fn((path, ...handlers) => { routes[`PUT ${path}`] = handlers; }),
    delete: vi.fn((path, ...handlers) => { routes[`DELETE ${path}`] = handlers; })
  };
  return { router, routes };
}

function mockReqRes(body = {}, params = {}) {
  const res = {
    json: vi.fn(),
    status: vi.fn().mockReturnThis()
  };
  const req = { body, params, query: {} };
  return { req, res };
}

async function callHandler(routes, method, path, body = {}, params = {}) {
  const key = `${method} ${path}`;
  const handlers = routes[key];
  if (!handlers) throw new Error(`No route for ${key}. Routes: ${Object.keys(routes).join(', ')}`);
  const { req, res } = mockReqRes(body, params);
  const handler = handlers[handlers.length - 1];
  await handler(req, res);
  return { req, res };
}

describe('feature routes registration order', () => {
  it('registers static routes before parameterized routes', () => {
    const { router } = createRouter();
    registerFeatureRoutes(router, makeContext());

    const getCalls = router.get.mock.calls.map(c => c[0]);
    const statusIdx = getCalls.indexOf('/features/status');
    const listIdx = getCalls.indexOf('/features');
    const paramIdx = getCalls.indexOf('/features/:key');

    expect(statusIdx).toBeLessThan(paramIdx);
    expect(listIdx).toBeLessThan(paramIdx);
  });
});

describe('GET /features/status', () => {
  it('returns status with counts', async () => {
    const data = {
      lastSyncedAt: '2026-04-19T12:00:00Z',
      totalFeatures: 2,
      features: {
        A: { latest: {}, history: [1, 2] },
        B: { latest: {}, history: [1] }
      }
    };
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(data));

    const { res } = await callHandler(routes, 'GET', '/features/status');
    expect(res.json).toHaveBeenCalledWith({
      lastSyncedAt: '2026-04-19T12:00:00Z',
      totalFeatures: 2,
      totalHistoryEntries: 3
    });
  });
});

describe('GET /features', () => {
  it('returns slim projection of all features', async () => {
    const data = {
      lastSyncedAt: '2026-04-19T12:00:00Z',
      totalFeatures: 1,
      features: {
        A: {
          latest: {
            key: 'RHAISTRAT-1',
            title: 'Test',
            sourceRfe: 'RHAIRFE-1',
            priority: 'Major',
            status: 'New',
            size: 'M',
            recommendation: 'approve',
            needsAttention: false,
            humanReviewStatus: 'approved',
            scores: { feasibility: 2, testability: 2, scope: 2, architecture: 2, total: 8 },
            reviewers: { feasibility: 'approve', testability: 'approve', scope: 'approve', architecture: 'approve' },
            labels: ['some-label'],
            runId: 'run-1',
            runTimestamp: '2026-04-19T00:00:00Z',
            reviewedAt: '2026-04-19T12:00:00Z'
          },
          history: []
        }
      }
    };
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(data));

    const { res } = await callHandler(routes, 'GET', '/features');
    const payload = res.json.mock.calls[0][0];
    expect(payload.features.A.scores).toBeDefined();
    expect(payload.features.A.labels).toBeUndefined();
    expect(payload.features.A.runId).toBeUndefined();
    expect(payload.features.A.runTimestamp).toBeUndefined();
  });

  it('returns empty state when no data', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'GET', '/features');
    const payload = res.json.mock.calls[0][0];
    expect(payload.features).toEqual({});
    expect(payload.totalFeatures).toBe(0);
  });
});

describe('GET /features/:key', () => {
  it('returns full feature + history for existing key', async () => {
    const entry = {
      latest: makeValidBody(),
      history: [{ scores: {}, recommendation: 'revise', needsAttention: false, humanReviewStatus: 'needs-review', reviewedAt: '2026-04-10T00:00:00Z' }]
    };
    const data = { lastSyncedAt: 'x', totalFeatures: 1, features: { 'RHAISTRAT-1': entry } };
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(data));

    const { res } = await callHandler(routes, 'GET', '/features/:key', {}, { key: 'RHAISTRAT-1' });
    const payload = res.json.mock.calls[0][0];
    expect(payload.latest).toBeDefined();
    expect(payload.history).toHaveLength(1);
  });

  it('returns 404 for non-existent key', async () => {
    const data = { lastSyncedAt: null, totalFeatures: 0, features: {} };
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(data));

    const { res } = await callHandler(routes, 'GET', '/features/:key', {}, { key: 'NONEXIST' });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('PUT /features/:key', () => {
  it('creates a new feature and returns created status', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'PUT', '/features/:key', makeValidBody(), { key: 'RHAISTRAT-1168' });
    expect(res.json).toHaveBeenCalledWith({ status: 'created' });
  });

  it('returns 400 for invalid body', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'PUT', '/features/:key', { bad: true }, { key: 'RHAISTRAT-1' });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('POST /features/bulk', () => {
  it('processes valid bulk payload', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const body = {
      features: [
        makeValidBody(),
        { ...makeValidBody(), key: 'RHAISTRAT-1169', reviewedAt: '2026-04-20T00:00:00Z' }
      ]
    };
    const { res } = await callHandler(routes, 'POST', '/features/bulk', body);
    const payload = res.json.mock.calls[0][0];
    expect(payload.created).toBe(2);
    expect(payload.errors).toEqual([]);
  });

  it('returns 400 for non-array features', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'POST', '/features/bulk', { features: 'bad' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when exceeding bulk cap', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const features = Array.from({ length: 5001 }, (_, i) => ({ ...makeValidBody(), key: `RHAISTRAT-${i}` }));
    const { res } = await callHandler(routes, 'POST', '/features/bulk', { features });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('5000');
  });

  it('handles partial success (valid + invalid entries)', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const body = {
      features: [
        makeValidBody(),
        { key: 'RHAISTRAT-BAD', scores: 'invalid' },
        { noKey: true }
      ]
    };
    const { res } = await callHandler(routes, 'POST', '/features/bulk', body);
    const payload = res.json.mock.calls[0][0];
    expect(payload.created).toBe(1);
    expect(payload.errors).toHaveLength(2);
  });

  it('accepts snake_case strat_id in bulk entries', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const entry = makeValidBody();
    delete entry.key;
    entry.strat_id = 'RHAISTRAT-999';

    const body = { features: [entry] };
    const { res } = await callHandler(routes, 'POST', '/features/bulk', body);
    const payload = res.json.mock.calls[0][0];
    expect(payload.created).toBe(1);
    expect(payload.errors).toEqual([]);
  });
});

describe('DELETE /features', () => {
  it('clears feature data', async () => {
    const { router, routes } = createRouter();
    registerFeatureRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'DELETE', '/features');
    expect(res.json).toHaveBeenCalledWith({ status: 'cleared' });
  });
});
