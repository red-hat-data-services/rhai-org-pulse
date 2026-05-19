import { describe, it, expect, vi, beforeEach } from 'vitest'

const registerRoutes = require('../../server/index')

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
    context = { storage, requireAdmin }
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
    })

    it('registers POST config route', () => {
      const paths = Object.keys(router._routes.post)
      expect(paths).toContain('/config')
    })

    it('protects config routes with requireAdmin', () => {
      const getHandlers = router._routes.get['/config']
      expect(getHandlers[0]).toBe(requireAdmin)

      const postHandlers = router._routes.post['/config']
      expect(postHandlers[0]).toBe(requireAdmin)
    })
  })

  describe('GET /config', () => {
    it('returns default config when nothing saved', () => {
      const handler = router._routes.get['/config'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._json).toEqual({ baseUrl: '' })
    })

    it('returns saved config', () => {
      storage.writeToStorage('product-builds/config.json', { baseUrl: 'https://api.example.com' })
      const handler = router._routes.get['/config'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._json.baseUrl).toBe('https://api.example.com')
    })

    it('falls back to env var', () => {
      process.env.PRODUCT_BUILDS_API_URL = 'https://env.example.com'
      const handler = router._routes.get['/config'].at(-1)
      const res = makeRes()
      handler({}, res)
      expect(res._json.baseUrl).toBe('https://env.example.com')
    })
  })

  describe('POST /config', () => {
    it('saves valid URL', () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      handler({ body: { baseUrl: 'https://api.example.com' } }, res)
      expect(res._json.status).toBe('ok')
      expect(res._json.baseUrl).toBe('https://api.example.com')
    })

    it('rejects non-HTTP URL', () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      handler({ body: { baseUrl: 'ftp://bad.example.com' } }, res)
      expect(res._status).toBe(400)
    })

    it('accepts empty URL to clear config', () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      handler({ body: { baseUrl: '' } }, res)
      expect(res._json.status).toBe('ok')
      expect(res._json.baseUrl).toBe('')
    })

    it('rejects non-string baseUrl', () => {
      const handler = router._routes.post['/config'].at(-1)
      const res = makeRes()
      handler({ body: { baseUrl: 123 } }, res)
      expect(res._status).toBe(400)
    })
  })
})
