import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../server/pipeline', () => ({
  runPipeline: vi.fn().mockReturnValue({
    features: [], rfes: [], tier1Features: 0, tier1Rfes: 0,
    tier2Features: 0, tier2Rfes: 0, tier3Features: 0,
    perRockStats: {}, outcomeSummaries: {}, release: '3.5',
    skippedCount: 0, terminalFilteredCount: 0, rocksWithoutOutcomes: []
  }),
  buildCandidateResponse: vi.fn().mockReturnValue({
    version: '3.5', features: [], rfes: [], bigRocks: [], summary: null
  })
}))

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

vi.mock('../../server/cache-reader', () => ({
  loadIndex: vi.fn().mockReturnValue({ features: [], rfes: [] }),
  validateKeysFromCache: vi.fn().mockReturnValue({})
}))

var registerRoutes = require('../../server/index')

function makeStorage(data) {
  var store = {}
  if (data) {
    for (var k in data) store[k] = data[k]
  }
  return {
    readFromStorage: function(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage: function(key, value) {
      store[key] = value
    },
    listStorageFiles: vi.fn().mockReturnValue([]),
    deleteFromStorage: vi.fn(),
    _store: store
  }
}

function makeRouter() {
  var routes = {}
  function reg(method) {
    return function(path) {
      var handlers = Array.prototype.slice.call(arguments, 1)
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
  var res = {
    _status: 200,
    _json: null,
    status: function(code) { res._status = code; return res },
    json: function(data) { res._json = data; return res }
  }
  return res
}

function makeReq(overrides) {
  return Object.assign({ isAdmin: true, userEmail: 'admin@test.com', body: {}, params: {}, query: {} }, overrides)
}

function callRoute(routes, method, path, req) {
  var key = method + ' ' + path
  var handlers = routes[key]
  if (!handlers) throw new Error('No route registered: ' + key)
  var handler = handlers[handlers.length - 1]
  var res = makeRes()
  var result = handler(req || makeReq(), res)
  if (result && typeof result.then === 'function') {
    return result.then(function() { return res })
  }
  return res
}

function makeConfig(version, bigRocks) {
  var releases = {}
  releases[version] = { release: version, bigRocks: bigRocks || [] }
  return { releases: releases }
}

var VALID_ROCK = {
  name: 'Test Rock',
  fullName: 'Test Rock Full',
  pillar: 'Platform',
  state: '',
  owner: 'Owner',
  architect: '',
  outcomeKeys: [],
  notes: '',
  description: ''
}

describe('release-planning routes', function() {
  var router, storage, context

  beforeEach(function() {
    vi.clearAllMocks()
    storage = makeStorage({
      'release-planning/config.json': makeConfig('3.5', []),
      'release-planning/pm-users.json': { emails: ['pm@test.com'] }
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

  // ─── Route Registration ───

  describe('route registration', function() {
    it('registers all expected routes', function() {
      var expected = [
        'GET /releases',
        'GET /releases/:version/candidates',
        'POST /releases/:version/refresh',
        'GET /refresh/status',
        'GET /config',
        'GET /permissions',
        'PUT /releases/:version/big-rocks/reorder',
        'PUT /releases/:version/big-rocks/:name',
        'POST /releases/:version/big-rocks',
        'DELETE /releases/:version/big-rocks/:name',
        'POST /releases',
        'DELETE /releases/:version',
        'POST /jira/validate-keys',
        'GET /pm-users',
        'POST /pm-users',
        'DELETE /pm-users/:email',
        'GET /audit-log'
      ]
      for (var i = 0; i < expected.length; i++) {
        expect(router._routes[expected[i]], 'Missing route: ' + expected[i]).toBeDefined()
      }
    })
  })

  // ─── Auth Guards ───

  describe('auth guards', function() {
    it('uses requireAuth on GET /releases', function() {
      var handlers = router._routes['GET /releases']
      expect(handlers.length).toBeGreaterThan(1)
    })

    it('uses requireAdmin on POST /releases/:version/refresh', function() {
      expect(router.post).toHaveBeenCalledWith(
        '/releases/:version/refresh',
        expect.any(Function),
        expect.any(Function)
      )
    })

    it('uses requireAuth on GET /audit-log', function() {
      expect(router.get).toHaveBeenCalledWith(
        '/audit-log',
        expect.any(Function),
        expect.any(Function)
      )
    })
  })

  // ─── GET /releases ───

  describe('GET /releases', function() {
    it('returns configured releases', function() {
      var res = callRoute(router._routes, 'GET', '/releases')
      expect(res._json).toEqual([{ version: '3.5', bigRockCount: 0 }])
    })

    it('returns empty array when no releases configured', function() {
      storage._store['release-planning/config.json'] = { releases: {} }
      var res = callRoute(router._routes, 'GET', '/releases')
      expect(res._json).toEqual([])
    })
  })

  // ─── GET /releases/:version/candidates ───

  describe('GET /releases/:version/candidates', function() {
    it('rejects invalid version format', function() {
      var req = makeReq({ params: { version: '../etc/passwd' } })
      var res = callRoute(router._routes, 'GET', '/releases/:version/candidates', req)
      expect(res._status).toBe(400)
      expect(res._json.error).toMatch(/Invalid version/)
    })

    it('returns cached data when available', function() {
      storage._store['release-planning/candidates-cache-3.5.json'] = {
        cachedAt: new Date().toISOString(),
        data: { features: [{ issueKey: 'TEST-1' }], rfes: [], bigRocks: [], summary: null }
      }
      var req = makeReq({ params: { version: '3.5' }, query: {} })
      var res = callRoute(router._routes, 'GET', '/releases/:version/candidates', req)
      expect(res._json.features).toHaveLength(1)
    })

    it('returns 202 when no cache exists', function() {
      var req = makeReq({ params: { version: '3.5' }, query: {} })
      var res = callRoute(router._routes, 'GET', '/releases/:version/candidates', req)
      expect(res._status).toBe(202)
      expect(res._json._noCache).toBe(true)
    })
  })

  // ─── Version validation ───

  describe('version validation', function() {
    it('rejects reserved version names', async function() {
      var req = makeReq({ params: { version: '__proto__' } })
      var res = callRoute(router._routes, 'POST', '/releases/:version/refresh', req)
      expect(res._status).toBe(400)
    })

    it('rejects versions with special characters', async function() {
      var req = makeReq({ params: { version: 'v1;rm -rf' } })
      var res = callRoute(router._routes, 'POST', '/releases/:version/refresh', req)
      expect(res._status).toBe(400)
    })

    it('accepts valid version formats', async function() {
      var req = makeReq({ params: { version: '3.5' } })
      var res = callRoute(router._routes, 'POST', '/releases/:version/refresh', req)
      expect(res._status).toBe(200)
    })
  })

  // ─── POST /releases/:version/big-rocks ───

  describe('POST /releases/:version/big-rocks', function() {
    it('creates a new big rock', async function() {
      var req = makeReq({
        params: { version: '3.5' },
        body: VALID_ROCK
      })
      var res = await callRoute(router._routes, 'POST', '/releases/:version/big-rocks', req)
      expect(res._status).toBe(201)
    })

    it('rejects invalid version', async function() {
      var req = makeReq({
        params: { version: '../../bad' },
        body: VALID_ROCK
      })
      var res = await callRoute(router._routes, 'POST', '/releases/:version/big-rocks', req)
      expect(res._status).toBe(400)
    })

    it('rejects missing name', async function() {
      var req = makeReq({
        params: { version: '3.5' },
        body: { pillar: 'Test' }
      })
      var res = await callRoute(router._routes, 'POST', '/releases/:version/big-rocks', req)
      expect(res._status).toBe(400)
    })

    it('writes audit log entry on success', async function() {
      var req = makeReq({
        params: { version: '3.5' },
        body: VALID_ROCK
      })
      await callRoute(router._routes, 'POST', '/releases/:version/big-rocks', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log).toBeDefined()
      expect(log.entries).toHaveLength(1)
      expect(log.entries[0].action).toBe('create_rock')
      expect(log.entries[0].user).toBe('admin@test.com')
    })
  })

  // ─── PUT /releases/:version/big-rocks/:name ───

  describe('PUT /releases/:version/big-rocks/:name', function() {
    beforeEach(function() {
      storage._store['release-planning/config.json'] = makeConfig('3.5', [VALID_ROCK])
    })

    it('updates an existing big rock', async function() {
      var req = makeReq({
        params: { version: '3.5', name: 'Test Rock' },
        body: Object.assign({}, VALID_ROCK, { notes: 'Updated' })
      })
      var res = await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/:name', req)
      expect(res._status).toBe(200)
    })

    it('writes audit log on update', async function() {
      var req = makeReq({
        params: { version: '3.5', name: 'Test Rock' },
        body: Object.assign({}, VALID_ROCK, { notes: 'Updated' })
      })
      await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/:name', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('update_rock')
    })

    it('handles malformed URI encoding', async function() {
      var req = makeReq({
        params: { version: '3.5', name: '%E0%A4%A' },
        body: VALID_ROCK
      })
      var res = await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/:name', req)
      expect(res._status).toBe(400)
      expect(res._json.error).toMatch(/Invalid parameter encoding/)
    })
  })

  // ─── DELETE /releases/:version/big-rocks/:name ───

  describe('DELETE /releases/:version/big-rocks/:name', function() {
    beforeEach(function() {
      storage._store['release-planning/config.json'] = makeConfig('3.5', [VALID_ROCK])
    })

    it('deletes a big rock', async function() {
      var req = makeReq({ params: { version: '3.5', name: 'Test Rock' } })
      var res = await callRoute(router._routes, 'DELETE', '/releases/:version/big-rocks/:name', req)
      expect(res._status).toBe(200)
    })

    it('returns 404 for nonexistent rock', async function() {
      var req = makeReq({ params: { version: '3.5', name: 'Nonexistent' } })
      var res = await callRoute(router._routes, 'DELETE', '/releases/:version/big-rocks/:name', req)
      expect(res._status).toBe(404)
    })

    it('writes audit log on delete', async function() {
      var req = makeReq({ params: { version: '3.5', name: 'Test Rock' } })
      await callRoute(router._routes, 'DELETE', '/releases/:version/big-rocks/:name', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('delete_rock')
    })
  })

  // ─── POST /releases ───

  describe('POST /releases', function() {
    it('creates a new release', async function() {
      var req = makeReq({ body: { version: '3.6' } })
      var res = await callRoute(router._routes, 'POST', '/releases', req)
      expect(res._status).toBe(201)
    })

    it('rejects missing version', async function() {
      var req = makeReq({ body: {} })
      var res = await callRoute(router._routes, 'POST', '/releases', req)
      expect(res._status).toBe(400)
    })

    it('rejects invalid version format', async function() {
      var req = makeReq({ body: { version: 'a'.repeat(51) } })
      var res = await callRoute(router._routes, 'POST', '/releases', req)
      expect(res._status).toBe(400)
    })

    it('writes audit log for create', async function() {
      var req = makeReq({ body: { version: '3.6' } })
      await callRoute(router._routes, 'POST', '/releases', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('create_release')
    })

    it('writes audit log for clone', async function() {
      var req = makeReq({ body: { version: '3.6', cloneFrom: '3.5' } })
      await callRoute(router._routes, 'POST', '/releases', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('clone_release')
    })
  })

  // ─── DELETE /releases/:version ───

  describe('DELETE /releases/:version', function() {
    it('deletes a release', async function() {
      var req = makeReq({ params: { version: '3.5' } })
      var res = await callRoute(router._routes, 'DELETE', '/releases/:version', req)
      expect(res._status).toBe(200)
    })

    it('writes audit log on delete', async function() {
      var req = makeReq({ params: { version: '3.5' } })
      await callRoute(router._routes, 'DELETE', '/releases/:version', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('delete_release')
    })
  })

  // ─── GET /permissions ───

  describe('GET /permissions', function() {
    it('returns canEdit true for admin', function() {
      var req = makeReq({ isAdmin: true, userEmail: 'admin@test.com' })
      var res = callRoute(router._routes, 'GET', '/permissions', req)
      expect(res._json.canEdit).toBe(true)
    })

    it('returns canEdit true for PM user', function() {
      var req = makeReq({ isAdmin: false, userEmail: 'pm@test.com' })
      var res = callRoute(router._routes, 'GET', '/permissions', req)
      expect(res._json.canEdit).toBe(true)
    })

    it('returns canEdit false for regular user', function() {
      var req = makeReq({ isAdmin: false, userEmail: 'user@test.com' })
      var res = callRoute(router._routes, 'GET', '/permissions', req)
      expect(res._json.canEdit).toBe(false)
    })
  })

  // ─── PM User Management ───

  describe('PM user management', function() {
    it('GET /pm-users returns PM list', function() {
      var res = callRoute(router._routes, 'GET', '/pm-users')
      expect(res._json.emails).toEqual(['pm@test.com'])
    })

    it('POST /pm-users adds a PM', function() {
      var req = makeReq({ body: { email: 'new@test.com' } })
      var res = callRoute(router._routes, 'POST', '/pm-users', req)
      expect(res._json.emails).toContain('new@test.com')
    })

    it('POST /pm-users rejects empty email', function() {
      var req = makeReq({ body: { email: '' } })
      var res = callRoute(router._routes, 'POST', '/pm-users', req)
      expect(res._status).toBe(400)
    })

    it('POST /pm-users writes audit log', function() {
      var req = makeReq({ body: { email: 'new@test.com' } })
      callRoute(router._routes, 'POST', '/pm-users', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('add_pm')
    })

    it('DELETE /pm-users/:email removes a PM', function() {
      var req = makeReq({ params: { email: 'pm@test.com' } })
      var res = callRoute(router._routes, 'DELETE', '/pm-users/:email', req)
      expect(res._json.emails).not.toContain('pm@test.com')
    })

    it('DELETE /pm-users/:email writes audit log', function() {
      var req = makeReq({ params: { email: 'pm@test.com' } })
      callRoute(router._routes, 'DELETE', '/pm-users/:email', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('remove_pm')
    })
  })

  // ─── Audit Log ───

  describe('GET /audit-log', function() {
    it('returns empty entries when no log exists', function() {
      var req = makeReq({ query: {} })
      var res = callRoute(router._routes, 'GET', '/audit-log', req)
      expect(res._json.entries).toEqual([])
      expect(res._json.total).toBe(0)
    })

    it('returns entries filtered by version', function() {
      storage._store['release-planning/audit-log.json'] = {
        entries: [
          { id: '1', timestamp: '2026-01-01T00:00:00Z', version: '3.5', action: 'create_rock', user: 'a@b.com', summary: 'test' },
          { id: '2', timestamp: '2026-01-02T00:00:00Z', version: '3.6', action: 'create_rock', user: 'a@b.com', summary: 'test2' }
        ]
      }
      var req = makeReq({ query: { version: '3.5' } })
      var res = callRoute(router._routes, 'GET', '/audit-log', req)
      expect(res._json.entries).toHaveLength(1)
      expect(res._json.total).toBe(1)
    })

    it('returns entries filtered by action', function() {
      storage._store['release-planning/audit-log.json'] = {
        entries: [
          { id: '1', timestamp: '2026-01-01T00:00:00Z', version: '3.5', action: 'create_rock', user: 'a@b.com', summary: 'test' },
          { id: '2', timestamp: '2026-01-02T00:00:00Z', version: '3.5', action: 'delete_rock', user: 'a@b.com', summary: 'test2' }
        ]
      }
      var req = makeReq({ query: { action: 'delete_rock' } })
      var res = callRoute(router._routes, 'GET', '/audit-log', req)
      expect(res._json.entries).toHaveLength(1)
      expect(res._json.entries[0].action).toBe('delete_rock')
    })

    it('respects limit and offset', function() {
      var entries = []
      for (var i = 0; i < 10; i++) {
        entries.push({ id: String(i), timestamp: '2026-01-0' + (i + 1) + 'T00:00:00Z', version: '3.5', action: 'create_rock', user: 'a@b.com', summary: 'entry ' + i })
      }
      storage._store['release-planning/audit-log.json'] = { entries: entries }
      var req = makeReq({ query: { limit: '3', offset: '2' } })
      var res = callRoute(router._routes, 'GET', '/audit-log', req)
      expect(res._json.entries).toHaveLength(3)
      expect(res._json.total).toBe(10)
    })

    it('clamps limit to max 500', function() {
      var req = makeReq({ query: { limit: '1000' } })
      var res = callRoute(router._routes, 'GET', '/audit-log', req)
      expect(res._json).toBeDefined()
    })
  })

  // ─── Reorder ───

  describe('PUT /releases/:version/big-rocks/reorder', function() {
    beforeEach(function() {
      storage._store['release-planning/config.json'] = makeConfig('3.5', [
        Object.assign({}, VALID_ROCK, { name: 'Rock A', priority: 1 }),
        Object.assign({}, VALID_ROCK, { name: 'Rock B', priority: 2 })
      ])
    })

    it('rejects non-array order', async function() {
      var req = makeReq({ params: { version: '3.5' }, body: { order: 'not-array' } })
      var res = await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/reorder', req)
      expect(res._status).toBe(400)
    })

    it('reorders big rocks', async function() {
      var req = makeReq({ params: { version: '3.5' }, body: { order: ['Rock B', 'Rock A'] } })
      var res = await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/reorder', req)
      expect(res._status).toBe(200)
    })

    it('writes audit log on reorder', async function() {
      var req = makeReq({ params: { version: '3.5' }, body: { order: ['Rock B', 'Rock A'] } })
      await callRoute(router._routes, 'PUT', '/releases/:version/big-rocks/reorder', req)
      var log = storage._store['release-planning/audit-log.json']
      expect(log.entries[0].action).toBe('reorder_rocks')
    })
  })

  // ─── Refresh Status ───

  describe('GET /refresh/status', function() {
    it('returns initial refresh state', function() {
      var res = callRoute(router._routes, 'GET', '/refresh/status')
      expect(res._json.running).toBe(false)
    })
  })
})
