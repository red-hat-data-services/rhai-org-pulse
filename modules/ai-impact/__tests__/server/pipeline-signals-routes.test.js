import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/features/storage', () => ({
  readFeatures: vi.fn().mockResolvedValue({ features: {} })
}));

vi.mock('../../server/test-plans/storage', () => ({
  readTestPlans: vi.fn().mockResolvedValue({ testPlans: {} })
}));

vi.mock('../../server/decomposer/storage', () => ({
  readDecomposer: vi.fn().mockResolvedValue({ strategies: [] })
}));

vi.mock('../../server/component-onboarding/storage', () => ({
  readComponentOnboarding: vi.fn().mockResolvedValue({ components: {} }),
  projectComponent: vi.fn((entry) => entry.latest)
}));

import registerPipelineSignalRoutes from '../../server/pipeline-signals/routes.js';

function makeContext(storageOverrides = {}) {
  const defaultData = {
    'ai-impact/rfe-data.json': {
      issues: [
        {
          key: 'RHAIRFE-100',
          aiInvolvement: 'both',
          linkedFeature: { key: 'RHAISTRAT-123', status: 'In Progress' }
        }
      ]
    },
    'ai-impact/doc-data.json': { issues: [] }
  };
  const data = { ...defaultData, ...storageOverrides };

  return {
    storage: {
      readFromStorage: vi.fn((key) => Promise.resolve(data[key] || null))
    },
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

async function callHandler(routes, method, path, { params = {}, query = {} } = {}) {
  const handlers = routes[`${method} ${path}`];
  if (!handlers) throw new Error(`No route for ${method} ${path}. Have: ${Object.keys(routes).join(', ')}`);
  const res = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  const req = { params, query, body: {} };
  await handlers[handlers.length - 1](req, res);
  return { req, res };
}

describe('pipeline-signals routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers GET /pipeline-signals/:featureKey', () => {
    const { router } = createRouter();
    registerPipelineSignalRoutes(router, makeContext());
    expect(router.get).toHaveBeenCalledWith(
      '/pipeline-signals/:featureKey',
      expect.any(Function),
      expect.any(Function)
    );
  });

  it('returns resolved signals for a valid feature key', async () => {
    const { router, routes } = createRouter();
    registerPipelineSignalRoutes(router, makeContext());

    const { res } = await callHandler(routes, 'GET', '/pipeline-signals/:featureKey', {
      params: { featureKey: 'RHAISTRAT-123' }
    });

    const payload = res.json.mock.calls[0][0];
    expect(payload.featureKey).toBe('RHAISTRAT-123');
    expect(payload.phases).toBeDefined();
    expect(payload.phases['rfe-review']).toBeDefined();
    expect(payload.phases['rfe-review'].completed).toBe(true);
    expect(payload.phases['rfe-review'].linkedKey).toBe('RHAIRFE-100');
    expect(payload.phases['feature-review']).toBeDefined();
    expect(payload.phases['decomposer']).toBeDefined();
    expect(payload.phases['test-plan-review']).toBeDefined();
    expect(payload.phases['documentation']).toBeDefined();
    expect(payload.phases['build-release']).toBeDefined();
    expect(payload.jiraHost).toBeTruthy();
    expect(payload.rfeKey).toBe('RHAIRFE-100');
  });

  it('returns 400 for invalid feature key format', async () => {
    const { router, routes } = createRouter();
    registerPipelineSignalRoutes(router, makeContext());

    const { res } = await callHandler(routes, 'GET', '/pipeline-signals/:featureKey', {
      params: { featureKey: 'invalid-key' }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid feature key format' });
  });

  it('returns 400 for empty feature key', async () => {
    const { router, routes } = createRouter();
    registerPipelineSignalRoutes(router, makeContext());

    const { res } = await callHandler(routes, 'GET', '/pipeline-signals/:featureKey', {
      params: { featureKey: '' }
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for lowercase key', async () => {
    const { router, routes } = createRouter();
    registerPipelineSignalRoutes(router, makeContext());

    const { res } = await callHandler(routes, 'GET', '/pipeline-signals/:featureKey', {
      params: { featureKey: 'rhaistrat-123' }
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('accepts RHOAIENG-style keys', async () => {
    const { router, routes } = createRouter();
    registerPipelineSignalRoutes(router, makeContext());

    const { res } = await callHandler(routes, 'GET', '/pipeline-signals/:featureKey', {
      params: { featureKey: 'RHOAIENG-567' }
    });

    expect(res.json).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.featureKey).toBe('RHOAIENG-567');
  });

  it('returns 500 when storage throws', async () => {
    const ctx = makeContext();
    ctx.storage.readFromStorage = vi.fn().mockRejectedValue(new Error('storage failure'));

    const { router, routes } = createRouter();
    registerPipelineSignalRoutes(router, ctx);

    const { res } = await callHandler(routes, 'GET', '/pipeline-signals/:featureKey', {
      params: { featureKey: 'RHAISTRAT-123' }
    });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to resolve pipeline signals' });
  });

  it('returns all phases even when feature has no matching data', async () => {
    const { router, routes } = createRouter();
    registerPipelineSignalRoutes(router, makeContext({
      'ai-impact/rfe-data.json': { issues: [] },
      'ai-impact/doc-data.json': { issues: [] }
    }));

    const { res } = await callHandler(routes, 'GET', '/pipeline-signals/:featureKey', {
      params: { featureKey: 'RHAISTRAT-999' }
    });

    const payload = res.json.mock.calls[0][0];
    expect(payload.featureKey).toBe('RHAISTRAT-999');
    expect(payload.rfeKey).toBeNull();
    expect(Object.keys(payload.phases)).toHaveLength(6);
    expect(payload.phases['rfe-review'].completed).toBe(false);
    expect(payload.phases['feature-review'].completed).toBe(false);
  });

  it('uses requireScope middleware', () => {
    const ctx = makeContext();
    ctx.requireScope = vi.fn(() => (req, res, next) => next());

    const { router } = createRouter();
    registerPipelineSignalRoutes(router, ctx);

    expect(ctx.requireScope).toHaveBeenCalledWith('ai-impact:read');
  });
});
