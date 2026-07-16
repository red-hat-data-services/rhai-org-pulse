import { describe, it, expect, vi } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn()
}));

vi.mock('../../../../shared/server/jira', () => ({
  jiraRequest: vi.fn(),
  fetchAllJqlResults: vi.fn()
}));

import registerTestPlanRoutes from '../../server/test-plans/routes.js';

function makeValidBody() {
  return {
    feature: 'GPU Observability',
    sourceKey: 'RHAISTRAT-1168',
    score: 8,
    verdict: 'Ready',
    scores: { specificity: 2, grounding: 2, scope_fidelity: 2, actionability: 1, consistency: 1 },
    autoRevised: false,
    reviewedAt: '2026-05-10T12:00:00Z'
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
    get: vi.fn((path, ...handlers) => { routes[`GET ${path}`] = handlers; }),
    post: vi.fn((path, ...handlers) => { routes[`POST ${path}`] = handlers; }),
    put: vi.fn((path, ...handlers) => { routes[`PUT ${path}`] = handlers; }),
    delete: vi.fn((path, ...handlers) => { routes[`DELETE ${path}`] = handlers; })
  };
  return { router, routes };
}

function mockReqRes(body = {}, params = {}) {
  return {
    req: { body, params, query: {} },
    res: { json: vi.fn(), status: vi.fn().mockReturnThis() }
  };
}

async function callHandler(routes, method, path, body = {}, params = {}) {
  const key = `${method} ${path}`;
  const handlers = routes[key];
  if (!handlers) throw new Error(`No route for ${key}. Routes: ${Object.keys(routes).join(', ')}`);
  const { req, res } = mockReqRes(body, params);
  await handlers[handlers.length - 1](req, res);
  return { req, res };
}

describe('route registration order', () => {
  it('registers static routes before parameterized routes', () => {
    const { router } = createRouter();
    registerTestPlanRoutes(router, makeContext());

    const getCalls = router.get.mock.calls.map(c => c[0]);
    const statusIdx = getCalls.indexOf('/test-plans/status');
    const syncStatusIdx = getCalls.indexOf('/test-plans/sync/status');
    const listIdx = getCalls.indexOf('/test-plans');
    const paramIdx = getCalls.indexOf('/test-plans/:key');

    expect(statusIdx).toBeLessThan(paramIdx);
    expect(syncStatusIdx).toBeLessThan(paramIdx);
    expect(listIdx).toBeLessThan(paramIdx);
  });
});

describe('GET /test-plans/status', () => {
  it('returns status with counts', async () => {
    const data = {
      lastSyncedAt: '2026-05-10T12:00:00Z',
      totalTestPlans: 2,
      testPlans: {
        A: { latest: {}, history: [1, 2] },
        B: { latest: {}, history: [1] }
      }
    };
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(data));

    const { res } = await callHandler(routes, 'GET', '/test-plans/status');
    expect(res.json).toHaveBeenCalledWith({
      lastSyncedAt: '2026-05-10T12:00:00Z',
      lastJiraSyncAt: null,
      totalTestPlans: 2,
      totalHistoryEntries: 3
    });
  });
});

describe('GET /test-plans', () => {
  it('returns slim projection', async () => {
    const data = {
      lastSyncedAt: '2026-05-10T12:00:00Z',
      totalTestPlans: 1,
      testPlans: {
        A: {
          latest: {
            key: 'A', feature: 'F', sourceKey: 'RHAISTRAT-1', score: 8, verdict: 'Ready',
            scores: { specificity: 2, grounding: 2, scope_fidelity: 2, actionability: 1, consistency: 1 },
            autoRevised: false, criterionNotes: { specificity: 'notes' }, feedback: 'text',
            components: ['dashboard'], testCaseCount: 10, reviewedAt: '2026-05-10T12:00:00Z'
          },
          history: []
        }
      }
    };
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(data));

    const { res } = await callHandler(routes, 'GET', '/test-plans');
    const payload = res.json.mock.calls[0][0];
    expect(payload.testPlans.A.score).toBe(8);
    expect(payload.testPlans.A.criterionNotes).toBeUndefined();
    expect(payload.testPlans.A.feedback).toBeUndefined();
  });

  it('returns empty state when no data', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'GET', '/test-plans');
    expect(res.json.mock.calls[0][0].testPlans).toEqual({});
  });
});

describe('GET /test-plans/:key', () => {
  it('returns full detail + history for existing key', async () => {
    const entry = { latest: makeValidBody(), history: [{ score: 5 }] };
    const data = { lastSyncedAt: 'x', totalTestPlans: 1, testPlans: { 'RHAISTRAT-1168': entry } };
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(data));

    const { res } = await callHandler(routes, 'GET', '/test-plans/:key', {}, { key: 'RHAISTRAT-1168' });
    const payload = res.json.mock.calls[0][0];
    expect(payload.latest).toBeDefined();
    expect(payload.history).toHaveLength(1);
  });

  it('returns 404 for missing key', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext({ lastSyncedAt: null, totalTestPlans: 0, testPlans: {} }));

    const { res } = await callHandler(routes, 'GET', '/test-plans/:key', {}, { key: 'NONE' });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('PUT /test-plans/:key', () => {
  it('creates a new test plan', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'PUT', '/test-plans/:key', makeValidBody(), { key: 'RHAISTRAT-1168' });
    expect(res.json).toHaveBeenCalledWith({ status: 'created' });
  });

  it('returns 400 for invalid body', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'PUT', '/test-plans/:key', { bad: true }, { key: 'A' });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('POST /test-plans/bulk', () => {
  it('processes valid bulk payload', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const body = {
      testPlans: [
        { key: 'A', ...makeValidBody() },
        { key: 'B', ...makeValidBody(), reviewedAt: '2026-05-11T00:00:00Z' }
      ]
    };
    const { res } = await callHandler(routes, 'POST', '/test-plans/bulk', body);
    const payload = res.json.mock.calls[0][0];
    expect(payload.created).toBe(2);
    expect(payload.errors).toEqual([]);
  });

  it('returns 400 for non-array testPlans', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'POST', '/test-plans/bulk', { testPlans: 'bad' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when exceeding bulk cap', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const testPlans = Array.from({ length: 5001 }, (_, i) => ({ key: `A-${i}`, ...makeValidBody() }));
    const { res } = await callHandler(routes, 'POST', '/test-plans/bulk', { testPlans });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain('5000');
  });

  it('handles partial success', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const body = {
      testPlans: [
        { key: 'GOOD', ...makeValidBody() },
        { key: 'BAD', scores: 'invalid' },
        { noKey: true }
      ]
    };
    const { res } = await callHandler(routes, 'POST', '/test-plans/bulk', body);
    const payload = res.json.mock.calls[0][0];
    expect(payload.created).toBe(1);
    expect(payload.errors).toHaveLength(2);
  });
});

describe('DELETE /test-plans', () => {
  it('clears data', async () => {
    const { router, routes } = createRouter();
    registerTestPlanRoutes(router, makeContext(null));

    const { res } = await callHandler(routes, 'DELETE', '/test-plans');
    expect(res.json).toHaveBeenCalledWith({ status: 'cleared' });
  });
});
