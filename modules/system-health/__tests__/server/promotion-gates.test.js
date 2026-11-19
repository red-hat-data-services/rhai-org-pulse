import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const registerRoutes = require('../../server/promotion-gates/routes')
const { buildUpstreamUrl } = require('../../server/promotion-gates/proxy')

function makeStorage(data = {}) {
  const store = { ...data }
  return {
    async readFromStorage(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    async writeToStorage(key, value) {
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
    _headers: {},
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res },
    set(key, val) { res._headers[key] = val; return res }
  }
  return res
}

async function invoke(router, method, path, { query = {}, body = null } = {}) {
  const handlers = router._routes[method][path]
  expect(handlers).toBeDefined()
  const req = { query, body, params: {} }
  const res = makeRes()
  for (const handler of handlers) {
    await handler(req, res)
  }
  return res
}

describe('promotion-gates routes', () => {
  let router, requireAdmin, storage

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.PROMOTION_GATES_API_URL
    storage = makeStorage()
    router = makeRouter()
    requireAdmin = vi.fn()
    registerRoutes(router, { storage, requireAdmin })
  })

  describe('route registration', () => {
    it('registers all expected routes', () => {
      expect(Object.keys(router._routes.get)).toEqual(
        expect.arrayContaining(['/config', '/health', '/latest', '/jobs', '/jobs/:number'])
      )
      expect(Object.keys(router._routes.post)).toContain('/config')
    })

    it('guards config routes with requireAdmin', () => {
      expect(router._routes.get['/config']).toContain(requireAdmin)
      expect(router._routes.post['/config']).toContain(requireAdmin)
    })
  })

  describe('config', () => {
    it('returns empty baseUrl when nothing is configured', async () => {
      const res = await invoke(router, 'get', '/config')
      expect(res._json).toEqual({ baseUrl: '' })
    })

    it('falls back to PROMOTION_GATES_API_URL env var', async () => {
      process.env.PROMOTION_GATES_API_URL = 'https://dashboard.example.com'
      const res = await invoke(router, 'get', '/config')
      expect(res._json).toEqual({ baseUrl: 'https://dashboard.example.com' })
    })

    it('prefers the stored config over the env var', async () => {
      process.env.PROMOTION_GATES_API_URL = 'https://env.example.com'
      storage = makeStorage({ 'system-health/promotion-gates/config.json': { baseUrl: 'https://stored.example.com' } })
      router = makeRouter()
      registerRoutes(router, { storage, requireAdmin })
      const res = await invoke(router, 'get', '/config')
      expect(res._json).toEqual({ baseUrl: 'https://stored.example.com' })
    })

    it('saves a valid baseUrl', async () => {
      const res = await invoke(router, 'post', '/config', { body: { baseUrl: 'https://dashboard.example.com' } })
      expect(res._json).toEqual({ status: 'ok', baseUrl: 'https://dashboard.example.com' })
      expect(await storage.readFromStorage('system-health/promotion-gates/config.json'))
        .toEqual({ baseUrl: 'https://dashboard.example.com' })
    })

    it('rejects a non-string baseUrl', async () => {
      const res = await invoke(router, 'post', '/config', { body: { baseUrl: 42 } })
      expect(res._status).toBe(400)
    })

    it('rejects a non-HTTP baseUrl', async () => {
      const res = await invoke(router, 'post', '/config', { body: { baseUrl: 'ftp://example.com' } })
      expect(res._status).toBe(400)
    })
  })

  describe('proxy routes', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
      process.env.PROMOTION_GATES_API_URL = 'https://dashboard.example.com'
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('returns 503 when no baseUrl is configured', async () => {
      delete process.env.PROMOTION_GATES_API_URL
      const res = await invoke(router, 'get', '/latest')
      expect(res._status).toBe(503)
      expect(res._json.error).toContain('not configured')
    })

    it('proxies /latest to the dashboard promotion-gates endpoint', async () => {
      const job = { pr_number: 80, state: 'OPEN' }
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: () => Promise.resolve(job)
      })

      const res = await invoke(router, 'get', '/latest')

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://dashboard.example.com/promotion-gates/latest',
        expect.anything()
      )
      expect(res._status).toBe(200)
      expect(res._json).toEqual(job)
    })

    it('forwards query params and pagination headers on /jobs', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['X-Total-Count', '42'], ['X-Total-Pages', '3']]),
        json: () => Promise.resolve([])
      })

      const res = await invoke(router, 'get', '/jobs', { query: { limit: '20', offset: '40' } })

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://dashboard.example.com/promotion-gates/jobs?limit=20&offset=40',
        expect.anything()
      )
      expect(res._headers['X-Total-Count']).toBe('42')
      expect(res._headers['X-Total-Pages']).toBe('3')
    })

    it('proxies /jobs/:number and passes upstream 404 through', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Map(),
        json: () => Promise.resolve({ message: 'no data yet' })
      })

      const handlers = router._routes.get['/jobs/:number']
      const req = { query: {}, body: null, params: { number: '80' } }
      const res = makeRes()
      for (const handler of handlers) {
        await handler(req, res)
      }

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://dashboard.example.com/promotion-gates/jobs/80',
        expect.anything()
      )
      expect(res._status).toBe(404)
      expect(res._json.message).toBe('no data yet')
    })

    it('rejects a non-numeric job number', async () => {
      const handlers = router._routes.get['/jobs/:number']
      const req = { query: {}, body: null, params: { number: 'abc' } }
      const res = makeRes()
      for (const handler of handlers) {
        await handler(req, res)
      }
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('positive integer')
    })
  })

  describe('health', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('reports not_configured without a baseUrl', async () => {
      const res = await invoke(router, 'get', '/health')
      expect(res._json).toEqual({ status: 'not_configured' })
    })

    it('reports ok when the dashboard answers', async () => {
      process.env.PROMOTION_GATES_API_URL = 'https://dashboard.example.com'
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
      const res = await invoke(router, 'get', '/health')
      expect(res._json.status).toBe('ok')
      expect(res._json.latency).toBeGreaterThanOrEqual(0)
    })

    it('reports unavailable when the dashboard cannot be reached', async () => {
      process.env.PROMOTION_GATES_API_URL = 'https://dashboard.example.com'
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      const res = await invoke(router, 'get', '/health')
      expect(res._json.status).toBe('unavailable')
    })
  })
})

describe('buildUpstreamUrl', () => {
  it('appends the promotion-gates path to the base URL', () => {
    expect(buildUpstreamUrl('https://api.example.com', '/promotion-gates/latest', {}))
      .toBe('https://api.example.com/promotion-gates/latest')
  })

  it('skips empty query values', () => {
    const url = buildUpstreamUrl('https://api.example.com', '/promotion-gates/jobs', { limit: '20', offset: '' })
    expect(url).toContain('limit=20')
    expect(url).not.toContain('offset')
  })
})
