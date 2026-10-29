// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import registerUsageTracking from '../../server/index.js'

function createMockRouter() {
  const routes = { get: {}, post: {} }
  return {
    get: function (path, ...handlers) { routes.get[path] = handlers },
    post: function (path, ...handlers) { routes.post[path] = handlers },
    _routes: routes
  }
}

function createTestContext() {
  const written = []
  return {
    storage: {
      readFromStorage: vi.fn(async function (key) {
        if (key === 'team-data/registry.json') {
          return { people: { jdoe: { status: 'active', email: 'jdoe@redhat.com', title: 'Software Engineer' } } }
        }
        if (key === 'usage/persona-map.json') {
          return { 'Software Engineer': 'developer' }
        }
        return null
      }),
      readRawFromStorage: vi.fn(async function () { return null }),
      writeToStorage: vi.fn(async function () {}),
      writeRawToStorage: vi.fn(async function () {}),
      appendToStorage: vi.fn(async function (key, content) {
        written.push({ key, content })
      }),
      listStorageFiles: vi.fn(async function () { return [] }),
      listAllStorageFiles: vi.fn(async function () {
        return ['events-2026-10-12.jsonl', 'persona-map.json']
      }),
      getFileMtime: vi.fn(async function () { return Date.now() })
    },
    requireAuth: function (_req, _res, next) { next() },
    requireAdmin: function (_req, _res, next) { next() },
    resolveSecret: vi.fn(function () { return undefined }),
    registerRefresh: vi.fn(),
    _written: written
  }
}

function mockReq(body = {}, query = {}) {
  return {
    body: body,
    query: query,
    userEmail: 'jdoe@redhat.com',
    userUid: 'jdoe'
  }
}

function mockRes() {
  const res = {
    _status: 200,
    _body: null,
    _type: null,
    status: function (code) { res._status = code; return res },
    json: function (data) { res._body = data; return res },
    type: function (t) { res._type = t; return res },
    send: function (data) { res._body = data; return res }
  }
  return res
}

describe('usage-tracking routes', () => {
  let ctx, router

  beforeEach(() => {
    ctx = createTestContext()
    router = createMockRouter()
    registerUsageTracking(router, ctx)
  })

  it('registers a refresh handler', () => {
    expect(ctx.registerRefresh).toHaveBeenCalledWith('report', expect.objectContaining({
      cadence: '24h'
    }))
  })

  describe('POST /events', () => {
    async function postEvents(body) {
      const handlers = router._routes.post['/events']
      const req = mockReq(body)
      const res = mockRes()
      for (const handler of handlers) {
        let called = false
        await handler(req, res, function () { called = true })
        if (!called && res._body !== null) break
      }
      return res
    }

    it('accepts valid events and writes JSONL', async () => {
      const res = await postEvents({
        events: [{ module: 'ai-impact', view: 'autofix', action: 'view' }]
      })
      expect(res._status).toBe(200)
      expect(res._body.status).toBe('ok')
      expect(res._body.count).toBe(1)
      expect(ctx._written).toHaveLength(1)
      expect(ctx._written[0].key).toMatch(/^usage\/events-\d{4}-\d{2}-\d{2}\.jsonl$/)

      const event = JSON.parse(ctx._written[0].content.trim())
      expect(event.module).toBe('ai-impact')
      expect(event.action).toBe('view')
      expect(event.userId).toMatch(/^hmac:/)
      expect(event.persona).toBe('developer')
      expect(event.ts).toBeTruthy()
    })

    it('silently drops invalid actions', async () => {
      const res = await postEvents({
        events: [
          { module: 'ai-impact', view: 'autofix', action: 'view' },
          { module: 'ai-impact', view: 'autofix', action: 'INVALID' }
        ]
      })
      expect(res._body.count).toBe(1)
    })

    it('truncates targets to 100 chars', async () => {
      const res = await postEvents({
        events: [{ module: 'test', view: 'v', action: 'filter', target: 'x'.repeat(200) }]
      })
      expect(res._body.count).toBe(1)
      const event = JSON.parse(ctx._written[0].content.trim())
      expect(event.target).toHaveLength(100)
    })

    it('rejects missing events array', async () => {
      const res = await postEvents({})
      expect(res._status).toBe(400)
    })

    it('rejects oversized batch', async () => {
      const events = Array.from({ length: 501 }, function () {
        return { module: 'test', view: 'v', action: 'view' }
      })
      const res = await postEvents({ events })
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('Too many events')
    })

    it('skips null entries in events array', async () => {
      const res = await postEvents({
        events: [null, { module: 'test', view: 'v', action: 'view' }, undefined]
      })
      expect(res._status).toBe(200)
      expect(res._body.count).toBe(1)
    })

    it('uses HMAC not plain hash', async () => {
      await postEvents({
        events: [{ module: 'test', view: 'v', action: 'view' }]
      })
      const event = JSON.parse(ctx._written[0].content.trim())
      expect(event.userId).toMatch(/^hmac:/)
      expect(event.userId).not.toContain('jdoe')
    })
  })

  describe('GET /report', () => {
    async function getReport() {
      const handlers = router._routes.get['/report']
      const req = mockReq()
      const res = mockRes()
      for (const handler of handlers) {
        let called = false
        await handler(req, res, function () { called = true })
        if (!called && res._body !== null) break
      }
      return res
    }

    it('returns placeholder when no report', async () => {
      const res = await getReport()
      expect(res._body).toContain('No report generated yet')
    })

    it('returns existing report', async () => {
      ctx.storage.readRawFromStorage.mockResolvedValue('Test Report')
      const res = await getReport()
      expect(res._body).toBe('Test Report')
    })
  })

  describe('GET /days', () => {
    it('returns event file dates', async () => {
      const handlers = router._routes.get['/days']
      const req = mockReq()
      const res = mockRes()
      for (const handler of handlers) {
        let called = false
        await handler(req, res, function () { called = true })
        if (!called && res._body !== null) break
      }
      expect(res._body.days).toEqual(['2026-10-12'])
    })
  })
})
