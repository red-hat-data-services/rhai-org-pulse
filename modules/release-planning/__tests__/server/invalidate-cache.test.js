import { describe, it, expect, vi, beforeEach } from 'vitest'

// These mocks are needed for registerRoutes to load without errors,
// but the real pipeline.js is used (vi.mock does not intercept CJS require
// for the pipeline module inside index.js in this test environment).
vi.mock('../../server/config-lock', () => ({
  withConfigLock: vi.fn(function(fn) { return fn() })
}))

vi.mock('../../server/config-backup', () => ({
  backupConfig: vi.fn()
}))

vi.mock('../../server/doc-import', () => ({
  previewDocImport: vi.fn(),
  executeDocImport: vi.fn()
}))

vi.mock('../../../shared/server/smartsheet', () => ({
  isConfigured: vi.fn().mockReturnValue(false),
  discoverReleases: vi.fn()
}))

const registerRoutes = require('../../server/index')

function makeStorage(data) {
  const store = {}
  if (data) {
    for (const k in data) store[k] = data[k]
  }
  return {
    readFromStorage: function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage: function(key, value) {
      store[key] = value
    },
    listStorageFiles: vi.fn().mockReturnValue([]),
    deleteFromStorage: vi.fn(function(key) {
      delete store[key]
    }),
    _store: store
  }
}

function makeRouter() {
  const routes = {}
  function reg(method) {
    return function(path) {
      const handlers = Array.prototype.slice.call(arguments, 1)
      routes[method + ' ' + path] = handlers
    }
  }
  return {
    get: vi.fn(reg('GET')),
    post: vi.fn(reg('POST')),
    put: vi.fn(reg('PUT')),
    delete: vi.fn(reg('DELETE')),
    use: vi.fn(),
    _routes: routes
  }
}

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    _ended: false,
    status: function(code) { res._status = code; return res },
    json: function(data) { res._json = data; return res },
    set: function(key, value) { res._headers[key] = value; return res },
    end: function() { res._ended = true; return res },
    send: function(body) {
      if (typeof body === 'string') {
        try { res._json = JSON.parse(body) } catch { res._json = body }
      } else {
        res._json = body
      }
      return res
    }
  }
  return res
}

function makeReq(overrides) {
  return Object.assign({ isAdmin: true, userEmail: 'admin@test.com', body: {}, params: {}, query: {}, headers: {} }, overrides)
}

function callRoute(routes, method, path, req) {
  const key = method + ' ' + path
  const handlers = routes[key]
  if (!handlers) throw new Error('No route registered: ' + key)
  const handler = handlers[handlers.length - 1]
  const res = makeRes()
  const result = handler(req || makeReq(), res)
  if (result && typeof result.then === 'function') {
    return result.then(function() { return res })
  }
  return res
}

const VALID_ROCK = {
  name: 'Test Rock',
  fullName: 'Test Rock Full',
  pillar: 'Platform',
  state: '',
  owner: 'Owner',
  architect: '',
  outcomeKeys: ['KEY-1'],
  notes: '',
  description: ''
}

describe('invalidateCache behavior', function() {
  let router, storage, context

  beforeEach(function() {
    vi.clearAllMocks()
    storage = makeStorage({
      'release-planning/config.json': { releases: { '3.5': { release: '3.5' } } },
      'release-planning/releases/3.5.json': { release: '3.5', bigRocks: [VALID_ROCK] },
      'release-planning/pm-users.json': { emails: ['pm@test.com'] },
      'feature-traffic/index.json': { features: [], rfes: [] }
    })
    router = makeRouter()
    context = {
      storage: storage,
      requireAuth: function(req, res, next) { next() },
      requireAdmin: function(req, res, next) { next() },
      registerDiagnostics: vi.fn()
    }
    registerRoutes(router, context)
  })

  it('after Big Rock edit, GET returns data (not empty 202)', async function() {
    // Pre-populate candidates cache
    storage._store['release-planning/candidates-cache-3.5.json'] = {
      cachedAt: new Date().toISOString(),
      data: {
        version: '3.5',
        features: [{ issueKey: 'EXISTING-1', bigRock: 'Test Rock' }],
        rfes: [],
        bigRocks: [{ name: 'Test Rock' }],
        summary: { totalFeatures: 1, totalRfes: 0 }
      }
    }

    // PUT to update a Big Rock (triggers invalidateCache)
    const putReq = makeReq({
      params: { version: '3.5', name: 'Test Rock' },
      body: Object.assign({}, VALID_ROCK, { notes: 'Updated' })
    })
    await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/:name', putReq)

    // Wait for background refresh to settle
    await new Promise(function(resolve) { setTimeout(resolve, 50) })

    // GET candidates -- should return data (not 202 with empty arrays)
    const getReq = makeReq({ params: { version: '3.5' }, query: {} })
    const res = callRoute(router._routes, 'GET', '/releases/:version/candidates', getReq)

    expect(res._status).toBe(200)
    expect(res._json.features).toBeDefined()
    // Must NOT be a 202 no-cache response
    expect(res._json._noCache).toBeUndefined()
  })

  it('after background refresh completes, cache has no _invalidatedAt', async function() {
    // Pre-populate candidates cache
    storage._store['release-planning/candidates-cache-3.5.json'] = {
      cachedAt: new Date().toISOString(),
      data: {
        version: '3.5',
        features: [{ issueKey: 'OLD-1' }],
        rfes: [],
        bigRocks: [],
        summary: null
      }
    }

    // Trigger a refresh
    const refreshReq = makeReq({ params: { version: '3.5' } })
    callRoute(router._routes, 'POST', '/releases/:version/refresh', refreshReq)

    // Wait for the background refresh promise to settle
    await new Promise(function(resolve) { setTimeout(resolve, 50) })

    // The cache should now contain fresh data without _invalidatedAt
    const cached = storage._store['release-planning/candidates-cache-3.5.json']
    expect(cached).toBeDefined()
    expect(cached.data).toBeDefined()
    expect(cached._invalidatedAt).toBeUndefined()
    expect(cached.cachedAt).toBeDefined()
  })

  it('health caches ARE deleted on invalidation, candidates cache is NOT', async function() {
    // Pre-populate health cache files and candidates cache
    storage._store['release-planning/health-cache-3.5-all.json'] = { data: 'health-all' }
    storage._store['release-planning/health-cache-3.5-EA1.json'] = { data: 'health-ea1' }
    storage._store['release-planning/health-cache-3.5-EA2.json'] = { data: 'health-ea2' }
    storage._store['release-planning/health-cache-3.5-GA.json'] = { data: 'health-ga' }
    storage._store['release-planning/candidates-cache-3.5.json'] = {
      cachedAt: new Date().toISOString(),
      data: { features: [], rfes: [], bigRocks: [], summary: null }
    }

    // PUT to trigger invalidation
    const putReq = makeReq({
      params: { version: '3.5', name: 'Test Rock' },
      body: Object.assign({}, VALID_ROCK, { notes: 'trigger invalidation' })
    })
    await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/:name', putReq)

    // Health caches should be deleted via deleteFromStorage
    expect(storage.deleteFromStorage).toHaveBeenCalledWith('release-planning/health-cache-3.5-all.json')
    expect(storage.deleteFromStorage).toHaveBeenCalledWith('release-planning/health-cache-3.5-EA1.json')
    expect(storage.deleteFromStorage).toHaveBeenCalledWith('release-planning/health-cache-3.5-EA2.json')
    expect(storage.deleteFromStorage).toHaveBeenCalledWith('release-planning/health-cache-3.5-GA.json')

    // Candidates cache should NOT have been deleted via deleteFromStorage
    const deleteArgs = storage.deleteFromStorage.mock.calls.map(function(c) { return c[0] })
    expect(deleteArgs).not.toContain('release-planning/candidates-cache-3.5.json')
  })

  it('outcome summary cache is deleted on invalidation', async function() {
    // Pre-populate outcome summary cache
    storage._store['release-planning/outcome-summaries-cache-3.5.json'] = { 'KEY-1': 'Summary' }
    storage._store['release-planning/candidates-cache-3.5.json'] = {
      cachedAt: new Date().toISOString(),
      data: { features: [], rfes: [], bigRocks: [], summary: null }
    }

    // PUT to trigger invalidation
    const putReq = makeReq({
      params: { version: '3.5', name: 'Test Rock' },
      body: Object.assign({}, VALID_ROCK, { notes: 'trigger' })
    })
    await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/:name', putReq)

    expect(storage.deleteFromStorage).toHaveBeenCalledWith('release-planning/outcome-summaries-cache-3.5.json')
  })

  it('_invalidatedAt marker is written to candidates cache during invalidation', async function() {
    // This test needs the writeToStorage spy set up BEFORE registerRoutes,
    // because invalidateCache captures writeToStorage at registration time.
    var markerWritten = false
    var spyStorage = makeStorage({
      'release-planning/config.json': { releases: { '3.5': { release: '3.5' } } },
      'release-planning/releases/3.5.json': { release: '3.5', bigRocks: [VALID_ROCK] },
      'release-planning/pm-users.json': { emails: ['pm@test.com'] },
      'feature-traffic/index.json': { features: [], rfes: [] },
      'release-planning/candidates-cache-3.5.json': {
        cachedAt: new Date().toISOString(),
        data: { features: [], rfes: [], bigRocks: [], summary: null }
      }
    })
    var origWrite = spyStorage.writeToStorage
    spyStorage.writeToStorage = function(key, value) {
      if (key === 'release-planning/candidates-cache-3.5.json' && value && value._invalidatedAt) {
        markerWritten = true
      }
      origWrite(key, value)
    }

    var spyRouter = makeRouter()
    registerRoutes(spyRouter, {
      storage: spyStorage,
      requireAuth: function(req, res, next) { next() },
      requireAdmin: function(req, res, next) { next() },
      registerDiagnostics: vi.fn()
    })

    // PUT to trigger invalidation
    const putReq = makeReq({
      params: { version: '3.5', name: 'Test Rock' },
      body: Object.assign({}, VALID_ROCK, { notes: 'trigger' })
    })
    await callRoute(spyRouter._routes, 'PUT', '/releases/:version/big-rocks/:name', putReq)

    // The _invalidatedAt marker was written (even if later overwritten by refresh)
    expect(markerWritten).toBe(true)
  })
})
