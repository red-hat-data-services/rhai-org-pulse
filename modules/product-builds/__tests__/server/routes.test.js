import { describe, it, expect, vi, beforeEach } from 'vitest'

const registerRoutes = require('../../server/index')

function makeStorage(data = {}) {
  const store = { ...data }
  return {
    async readFromStorage(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    async writeToStorage(key, value) {
      store[key] = value
    },
    async listStorageFiles(prefix) {
      return Object.keys(store)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length))
    }
  }
}

function makeRouter() {
  const routes = { get: {}, post: {} }
  return {
    get: vi.fn(function(path, ...handlers) {
      routes.get[path] = handlers
    }),
    post: vi.fn(function(path, ...handlers) {
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

describe('product-builds routes', () => {
  let router, requireAdmin, context, storage

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.PRODUCT_BUILDS_API_URL

    storage = makeStorage()
    router = makeRouter()
    requireAdmin = vi.fn()
    context = {
      storage,
      requireAdmin,
      secrets: {},
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
    }
    registerRoutes(router, context)
  })

  describe('route registration', () => {
    it('registers all expected GET routes', () => {
      const paths = Object.keys(router._routes.get)
      expect(paths).toContain('/config')
      expect(paths).toContain('/products/:key')
      expect(paths).toContain('/drops')
      expect(paths).toContain('/drops/:key')
      expect(paths).toContain('/drops/:key/changelog')
      expect(paths).toContain('/drops/:key/metrics')
      expect(paths).toContain('/series')
      expect(paths).toContain('/artifacts')
      expect(paths).toContain('/artifacts/:key')
      expect(paths).toContain('/artifacts/:key/wheels')
      expect(paths).toContain('/artifacts/:key/containers')
      expect(paths).toContain('/package-reports')
      expect(paths).toContain('/package-reports/latest')
      expect(paths).toContain('/package-reports/onboarded')
      expect(paths).toContain('/package-reports/:date')
    })

    it('registers POST routes', () => {
      const paths = Object.keys(router._routes.post)
      expect(paths).toContain('/config')
      expect(paths).toContain('/package-reports/generate')
    })

    it('protects config routes with requireAdmin', () => {
      const getHandlers = router._routes.get['/config']
      expect(getHandlers[0]).toBe(requireAdmin)

      const postHandlers = router._routes.post['/config']
      expect(postHandlers[0]).toBe(requireAdmin)
    })
  })

  describe('GET /config', () => {
    it('returns default config when nothing saved', async () => {
      const handler = router._routes.get['/config'].at(-1)
      const res = makeRes()
      await handler({}, res)
      expect(res._json).toEqual({ baseUrl: '' })
    })

    it('returns saved config', async () => {
      await storage.writeToStorage('product-builds/config.json', { baseUrl: 'https://api.example.com' })
      const handler = router._routes.get['/config'].at(-1)
      const res = makeRes()
      await handler({}, res)
      expect(res._json.baseUrl).toBe('https://api.example.com')
    })

    it('falls back to env var', async () => {
      process.env.PRODUCT_BUILDS_API_URL = 'https://env.example.com'
      const handler = router._routes.get['/config'].at(-1)
      const res = makeRes()
      await handler({}, res)
      expect(res._json.baseUrl).toBe('https://env.example.com')
    })
  })

  describe('POST /config', () => {
    it('saves valid URL', async () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      await handler({ body: { baseUrl: 'https://api.example.com' } }, res)
      expect(res._json.status).toBe('ok')
      expect(res._json.baseUrl).toBe('https://api.example.com')
    })

    it('rejects non-HTTP URL', async () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      await handler({ body: { baseUrl: 'ftp://bad.example.com' } }, res)
      expect(res._status).toBe(400)
    })

    it('accepts empty URL to clear config', async () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      await handler({ body: { baseUrl: '' } }, res)
      expect(res._json.status).toBe('ok')
      expect(res._json.baseUrl).toBe('')
    })

    it('rejects non-string baseUrl', async () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      await handler({ body: { baseUrl: 123 } }, res)
      expect(res._status).toBe(400)
    })
  })

  describe('GET /package-reports', () => {
    it('returns empty array when no index exists', async () => {
      const handler = router._routes.get['/package-reports'].at(-1)
      const res = makeRes()
      await handler({}, res)
      expect(res._json).toEqual([])
    })

    it('returns index from storage', async () => {
      const index = [{ report_date: '2026-06-07', summary: { open_epics: 10 } }]
      await storage.writeToStorage('product-builds/package-reports/index.json', index)
      const handler = router._routes.get['/package-reports'].at(-1)
      const res = makeRes()
      await handler({}, res)
      expect(res._json).toEqual(index)
    })
  })

  describe('GET /package-reports/latest', () => {
    it('returns 404 when no reports exist', async () => {
      const handler = router._routes.get['/package-reports/latest'].at(-1)
      const res = makeRes()
      await handler({}, res)
      expect(res._status).toBe(404)
    })

    it('returns latest report from storage', async () => {
      const index = [{ report_date: '2026-06-07' }]
      const report = { report_date: '2026-06-07', summary: {}, categories: {} }
      await storage.writeToStorage('product-builds/package-reports/index.json', index)
      await storage.writeToStorage('product-builds/package-reports/2026-06-07.json', report)
      const handler = router._routes.get['/package-reports/latest'].at(-1)
      const res = makeRes()
      await handler({}, res)
      expect(res._json.report_date).toBe('2026-06-07')
    })
  })

  describe('GET /package-reports/:date', () => {
    it('returns 404 for missing report', async () => {
      const handler = router._routes.get['/package-reports/:date'].at(-1)
      const res = makeRes()
      await handler({ params: { date: '2026-01-01' } }, res)
      expect(res._status).toBe(404)
    })

    it('returns report for valid date', async () => {
      const report = { report_date: '2026-06-07', summary: {}, categories: {} }
      await storage.writeToStorage('product-builds/package-reports/2026-06-07.json', report)
      const handler = router._routes.get['/package-reports/:date'].at(-1)
      const res = makeRes()
      await handler({ params: { date: '2026-06-07' } }, res)
      expect(res._json.report_date).toBe('2026-06-07')
    })
  })

  describe('POST /package-reports/generate', () => {
    it('requires admin', () => {
      const handlers = router._routes.post['/package-reports/generate']
      expect(handlers[0]).toBe(requireAdmin)
    })
  })

  describe('registrations', () => {
    it('registers refresh handler', () => {
      expect(context.registerRefresh).toHaveBeenCalledWith('package-analysis', expect.objectContaining({
        order: 200,
        timeout: 600000,
      }))
    })

    it('registers diagnostics', () => {
      expect(context.registerDiagnostics).toHaveBeenCalled()
    })
  })
})
