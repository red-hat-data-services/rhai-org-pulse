import { describe, it, expect, vi, afterEach } from 'vitest';

const registerAiAdoptionRoutes = require('../../../server/ai-adoption/routes');
const { RELEASE_GROUPS } = require('../../../server/ai-adoption/pipeline');

const STORAGE_KEY = 'releases/ai-adoption/latest.json';

function makeStorage(cached) {
  return {
    readFromStorage: vi.fn(async () => cached),
    writeToStorage: vi.fn(async () => {})
  };
}

function makeRouter() {
  const routes = { get: {}, post: {} };
  return {
    get: vi.fn((path, ...handlers) => { routes.get[path] = handlers; }),
    post: vi.fn((path, ...handlers) => { routes.post[path] = handlers; }),
    _routes: routes
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function register({ cached, jira }) {
  const router = makeRouter();
  const storage = makeStorage(cached);
  registerAiAdoptionRoutes(router, {
    storage,
    jira,
    requireAuth: (req, res, next) => next(),
    requireScope: () => (req, res, next) => next()
  });
  return {
    storage,
    getHandler: router._routes.get['/'].at(-1)
  };
}

function currentCache() {
  return {
    releaseConfigVersion: 2,
    fetchedAt: '2026-09-22T12:00:00.000Z',
    releaseGroups: RELEASE_GROUPS.map(group => ({ releaseGroup: group.name }))
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI adoption cache compatibility', () => {
  it('refreshes and persists data when the cache predates the 3.6 release groups', async () => {
    const cached = {
      fetchedAt: '2026-08-14T02:08:16.425Z',
      releaseGroups: [{ releaseGroup: '3.4 GA' }, { releaseGroup: '3.5 GA' }]
    };
    const jira = { fetchAllJqlResults: vi.fn(async () => []) };
    const { storage, getHandler } = register({ cached, jira });
    const res = makeRes();

    await getHandler({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.releaseGroups.map(group => group.releaseGroup)).toEqual(
      RELEASE_GROUPS.map(group => group.name)
    );
    expect(storage.writeToStorage).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.objectContaining({
        releaseConfigVersion: 2,
        releaseGroups: expect.any(Array)
      })
    );
  });

  it('serves the previous cache when the compatibility refresh cannot reach Jira', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cached = {
      fetchedAt: '2026-08-14T02:08:16.425Z',
      releaseGroups: [{ releaseGroup: '3.4 GA' }, { releaseGroup: '3.5 GA' }]
    };
    const jira = {
      fetchAllJqlResults: vi.fn(async () => { throw new Error('Jira unavailable'); })
    };
    const { storage, getHandler } = register({ cached, jira });
    const res = makeRes();

    await getHandler({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.releaseGroups).toEqual(cached.releaseGroups);
    expect(storage.writeToStorage).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Cache upgrade failed; serving existing data')
    );
  });

  it('reuses a cache that already matches the configured releases', async () => {
    const cached = currentCache();
    const jira = { fetchAllJqlResults: vi.fn(async () => []) };
    const { storage, getHandler } = register({ cached, jira });
    const res = makeRes();

    await getHandler({ query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(jira.fetchAllJqlResults).not.toHaveBeenCalled();
    expect(storage.writeToStorage).not.toHaveBeenCalled();
  });
});
