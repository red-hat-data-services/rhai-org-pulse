import { describe, it, expect, vi, beforeEach } from 'vitest'

const registerRoutes = require('../../server/index')
const { _setFetchFn, stopScheduler } = require('../../server/scheduler')

const mockFetchArtifacts = vi.fn()

function makeStorage(data = {}) {
  const store = { ...data }
  return {
    readFromStorage(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage(key, value) {
      store[key] = value
    }
  }
}

function makeRouter() {
  const routes = { get: {}, post: {} }
  return {
    get: vi.fn(function (path, ...handlers) {
      routes.get[path] = handlers
    }),
    post: vi.fn(function (path, ...handlers) {
      routes.post[path] = handlers
    }),
    _routes: routes
  }
}

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res }
  }
  return res
}

describe('feature-traffic routes', () => {
  let router, requireAdmin, context, storage

  beforeEach(() => {
    vi.clearAllMocks()
    _setFetchFn(mockFetchArtifacts)
    stopScheduler()
    delete process.env.FEATURE_TRAFFIC_GITLAB_TOKEN
    delete process.env.GITLAB_TOKEN

    storage = makeStorage()
    router = makeRouter()
    requireAdmin = vi.fn()
    context = {
      storage,
      requireAdmin,
      registerDiagnostics: vi.fn()
    }
    registerRoutes(router, context)
  })

  describe('route registration', () => {
    it('registers all expected GET routes', () => {
      const paths = Object.keys(router._routes.get)
      expect(paths).toContain('/features')
      expect(paths).toContain('/features/:key')
      expect(paths).toContain('/status')
      expect(paths).toContain('/versions')
      expect(paths).toContain('/config')
    })

    it('registers all expected POST routes', () => {
      const paths = Object.keys(router._routes.post)
      expect(paths).toContain('/refresh')
      expect(paths).toContain('/config')
    })
  })

  describe('requireAdmin middleware', () => {
    it('gates POST /refresh behind requireAdmin', () => {
      expect(router.post).toHaveBeenCalledWith('/refresh', requireAdmin, expect.any(Function))
    })

    it('gates GET /config behind requireAdmin', () => {
      expect(router.get).toHaveBeenCalledWith('/config', requireAdmin, expect.any(Function))
    })

    it('gates POST /config behind requireAdmin', () => {
      expect(router.post).toHaveBeenCalledWith('/config', requireAdmin, expect.any(Function))
    })
  })

  describe('GET /status', () => {
    it('returns expected shape when no data', () => {
      const handler = router._routes.get['/status'].at(-1)
      const res = makeRes()
      handler({}, res)

      expect(res._json).toMatchObject({
        dataAvailable: false,
        fetchedAt: null,
        schemaVersion: null,
        featureCount: 0,
        configured: false,
        tokenSource: null
      })
      expect(res._json.dataSource).toMatch(/gitlab-ci/)
    })

    it('includes lastFetch when present', () => {
      const storageWithData = makeStorage({
        'feature-traffic/last-fetch.json': { status: 'success', timestamp: '2026-04-08T06:00:00Z' }
      })
      const r = makeRouter()
      registerRoutes(r, { storage: storageWithData, requireAdmin: vi.fn(), registerDiagnostics: vi.fn() })

      const handler = r._routes.get['/status'].at(-1)
      const res = makeRes()
      handler({}, res)

      expect(res._json.lastFetch).toBeDefined()
      expect(res._json.lastFetch.status).toBe('success')
    })
  })

  describe('POST /refresh', () => {
    it('returns 429 on cooldown', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockResolvedValue({ status: 'success', timestamp: new Date().toISOString() })

      const storageWithConfig = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })
      const r = makeRouter()
      registerRoutes(r, { storage: storageWithConfig, requireAdmin: vi.fn(), registerDiagnostics: vi.fn() })

      const handler = r._routes.post['/refresh'].at(-1)

      // First refresh succeeds
      const res1 = makeRes()
      await handler({}, res1)
      expect(res1._json.status).toBe('success')

      // Second refresh hits cooldown
      const res2 = makeRes()
      await handler({}, res2)
      expect(res2._status).toBe(429)
      expect(res2._json.status).toBe('cooldown')
      expect(res2._json.retryAfter).toBeGreaterThan(0)

      stopScheduler()
    })
  })

  describe('POST /config', () => {
    it('saves and loads config round-trip', async () => {
      process.env.GITLAB_TOKEN = 'token'

      const storageForConfig = makeStorage()
      const r = makeRouter()
      registerRoutes(r, { storage: storageForConfig, requireAdmin: vi.fn(), registerDiagnostics: vi.fn() })

      const postHandler = r._routes.post['/config'].at(-1)
      const res1 = makeRes()
      await postHandler({
        body: {
          gitlabBaseUrl: 'https://custom.gitlab.com',
          projectPath: 'my/project',
          branch: 'develop',
          jobName: 'build',
          artifactPath: 'dist',
          refreshIntervalHours: 6,
          enabled: false
        }
      }, res1)
      expect(res1._json.status).toBe('saved')

      // Load it back
      const getHandler = r._routes.get['/config'].at(-1)
      const res2 = makeRes()
      getHandler({}, res2)
      expect(res2._json.gitlabBaseUrl).toBe('https://custom.gitlab.com')
      expect(res2._json.projectPath).toBe('my/project')
      expect(res2._json.branch).toBe('develop')
      expect(res2._json.refreshIntervalHours).toBe(6)

      stopScheduler()
    })

    it('rejects http:// in gitlabBaseUrl', async () => {
      const r = makeRouter()
      registerRoutes(r, { storage: makeStorage(), requireAdmin: vi.fn(), registerDiagnostics: vi.fn() })

      const handler = r._routes.post['/config'].at(-1)
      const res = makeRes()
      await handler({
        body: { gitlabBaseUrl: 'http://internal-service.svc.cluster.local' }
      }, res)

      expect(res._status).toBe(400)
      expect(res._json.message).toContain('https://')

      stopScheduler()
    })

    it('rejects invalid refreshIntervalHours', async () => {
      const r = makeRouter()
      registerRoutes(r, { storage: makeStorage(), requireAdmin: vi.fn(), registerDiagnostics: vi.fn() })

      const handler = r._routes.post['/config'].at(-1)

      const res1 = makeRes()
      await handler({ body: { refreshIntervalHours: 0 } }, res1)
      expect(res1._status).toBe(400)

      const res2 = makeRes()
      await handler({ body: { refreshIntervalHours: 999 } }, res2)
      expect(res2._status).toBe(400)

      const res3 = makeRes()
      await handler({ body: { refreshIntervalHours: 'abc' } }, res3)
      expect(res3._status).toBe(400)

      stopScheduler()
    })

    it('rejects non-string fields', async () => {
      const r = makeRouter()
      registerRoutes(r, { storage: makeStorage(), requireAdmin: vi.fn(), registerDiagnostics: vi.fn() })

      const handler = r._routes.post['/config'].at(-1)
      const res = makeRes()
      await handler({ body: { projectPath: 123 } }, res)
      expect(res._status).toBe(400)
      expect(res._json.message).toContain('projectPath')

      stopScheduler()
    })

    it('rejects non-boolean enabled', async () => {
      const r = makeRouter()
      registerRoutes(r, { storage: makeStorage(), requireAdmin: vi.fn(), registerDiagnostics: vi.fn() })

      const handler = r._routes.post['/config'].at(-1)
      const res = makeRes()
      await handler({ body: { enabled: 'yes' } }, res)
      expect(res._status).toBe(400)
      expect(res._json.message).toContain('enabled')

      stopScheduler()
    })
  })

  describe('diagnostics', () => {
    it('registers diagnostics hook', () => {
      expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
    })
  })
})
