import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─── Mock storage ─────────────────────────────────────────────────────────────

function makeStorage() {
  const store = {}
  return {
    data: store,
    readFromStorage: async (key) => store[key] || null,
    writeToStorage: async (key, val) => { store[key] = val },
    deleteFromStorage: async (key) => { delete store[key] }
  }
}

// ─── Mock express router ──────────────────────────────────────────────────────

function makeRouter() {
  const handlers = {}
  const router = {
    get: (path, ...fns) => { handlers[`GET ${path}`] = fns },
    post: (path, ...fns) => { handlers[`POST ${path}`] = fns },
    delete: (path, ...fns) => { handlers[`DELETE ${path}`] = fns },
    _dispatch: async (method, path, req = {}) => {
      const key = `${method} ${path}`
      const fns = handlers[key]
      if (!fns) throw new Error(`No handler for ${key}`)
      const res = {
        _status: 200,
        _body: null,
        status(code) { this._status = code; return this },
        json(body) { this._body = body; return this },
        end() { return this }
      }
      // Run middleware then handler (skip requireAuth/requireAdmin by calling next)
      let i = 0
      const next = async () => {
        const fn = fns[i++]
        if (fn) await fn(req, res, next)
      }
      await next()
      return res
    }
  }
  return { router, handlers }
}

// ─── Fixture data ────────────────────────────────────────────────────────────

const SAMPLE_RELEASE = {
  version: 'rhoai-3.4',
  gaDate: '2026-04-10',
  codeFreezeDate: '2026-03-20',
  gaSnapshotCommits: { fbc: 'abc123', registry: 'def456' },
  exceptions: {
    fbc: { configExcludes: ['cve'], volatileExcludes: [{ value: 'test.no_erred_tests:fbc', effectiveUntil: '2026-05-15T00:00:00Z', reference: 'https://example.com/JIRA-1', imageUrl: null, comment: null }] },
    registry: { configExcludes: ['cve.cve_blockers'], volatileExcludes: [] }
  }
}

const SAMPLE_PRODUCT_LAYER = {
  version: 'rhaii',
  gaDate: null,
  productLayer: true,
  displayName: 'RHAII',
  exceptions: {
    policy: { configExcludes: ['cve.cve_blockers', 'hermetic_task'], volatileExcludes: [] }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('conforma backend routes', () => {
  let storage
  let router
  let requireAuth
  let requireAdmin

  beforeEach(() => {
    vi.resetModules()
    // DEMO_MODE off
    delete process.env.DEMO_MODE
    storage = makeStorage()
    requireAuth = (_req, _res, next) => next()
    requireAdmin = (_req, _res, next) => next()
    const mock = makeRouter()
    router = mock.router

    // Register routes
    const registerConformaRoutes = require('../../../server/delivery/conforma.js')
    registerConformaRoutes(router, { storage, requireAuth, requireAdmin, requireScope: () => (req, res, next) => next() })
  })

  describe('GET /conforma/status', () => {
    it('returns no_data when nothing stored', async () => {
      const res = await router._dispatch('GET', '/conforma/status')
      expect(res._body).toEqual({ status: 'no_data' })
    })

    it('returns status fields when data exists', async () => {
      storage.writeToStorage('releases/delivery/conforma.json', {
        fetchedAt: '2026-05-10T00:00:00.000Z',
        minDate: '2025-05-22',
        count: 1,
        releases: [SAMPLE_RELEASE]
      })
      const res = await router._dispatch('GET', '/conforma/status')
      expect(res._body.fetchedAt).toBe('2026-05-10T00:00:00.000Z')
      expect(res._body.count).toBe(1)
      expect(res._body.minDate).toBe('2025-05-22')
    })
  })

  describe('GET /conforma/releases', () => {
    it('returns 404 when no data', async () => {
      const res = await router._dispatch('GET', '/conforma/releases')
      expect(res._status).toBe(404)
      expect(res._body.error).toMatch(/no conforma data/i)
    })

    it('returns all releases when data exists', async () => {
      storage.writeToStorage('releases/delivery/conforma.json', {
        fetchedAt: '2026-05-10T00:00:00.000Z',
        minDate: '2025-05-22',
        count: 1,
        releases: [SAMPLE_RELEASE]
      })
      const res = await router._dispatch('GET', '/conforma/releases')
      expect(res._status).toBe(200)
      expect(res._body.releases).toHaveLength(1)
      expect(res._body.releases[0].version).toBe('rhoai-3.4')
    })
  })

  describe('GET /conforma/releases/:version', () => {
    beforeEach(() => {
      storage.writeToStorage('releases/delivery/conforma.json', {
        fetchedAt: '2026-05-10T00:00:00.000Z',
        minDate: '2025-05-22',
        count: 1,
        releases: [SAMPLE_RELEASE]
      })
    })

    it('returns a specific release by version', async () => {
      const res = await router._dispatch('GET', '/conforma/releases/:version', { params: { version: 'rhoai-3.4' } })
      expect(res._status).toBe(200)
      expect(res._body.version).toBe('rhoai-3.4')
      expect(res._body.gaDate).toBe('2026-04-10')
    })

    it('returns 404 for unknown version', async () => {
      const res = await router._dispatch('GET', '/conforma/releases/:version', { params: { version: 'rhoai-99.0' } })
      expect(res._status).toBe(404)
    })
  })

  describe('POST /conforma/bulk', () => {
    it('stores valid releases and returns count', async () => {
      const req = { body: { releases: [SAMPLE_RELEASE], minDate: '2025-05-22' } }
      const res = await router._dispatch('POST', '/conforma/bulk', req)
      expect(res._status).toBe(200)
      expect(res._body.count).toBe(1)
      expect(res._body.savedAt).toBeDefined()

      const stored = await storage.readFromStorage('releases/delivery/conforma.json')
      expect(stored.releases).toHaveLength(1)
      expect(stored.releases[0].version).toBe('rhoai-3.4')
    })

    it('rejects if releases is not an array', async () => {
      const req = { body: { releases: 'bad' } }
      const res = await router._dispatch('POST', '/conforma/bulk', req)
      expect(res._status).toBe(400)
    })

    it('rejects payload exceeding 500 releases', async () => {
      const req = { body: { releases: Array(501).fill(SAMPLE_RELEASE) } }
      const res = await router._dispatch('POST', '/conforma/bulk', req)
      expect(res._status).toBe(400)
    })

    it('returns partial success and reports validation errors', async () => {
      const bad = { version: '', gaDate: '2026-04-10', exceptions: {} }
      const req = { body: { releases: [SAMPLE_RELEASE, bad] } }
      const res = await router._dispatch('POST', '/conforma/bulk', req)
      expect(res._body.count).toBe(1)
      expect(res._body.errors).toHaveLength(1)
    })

    it('returns 400 when all releases are invalid', async () => {
      const req = { body: { releases: [{ version: '', gaDate: '' }] } }
      const res = await router._dispatch('POST', '/conforma/bulk', req)
      expect(res._status).toBe(400)
    })
  })

  describe('POST /conforma/bulk with product layers', () => {
    it('accepts releases with productLayer and no gaDate', async () => {
      const req = { body: { releases: [SAMPLE_PRODUCT_LAYER] } }
      const res = await router._dispatch('POST', '/conforma/bulk', req)
      expect(res._status).toBe(200)
      expect(res._body.count).toBe(1)
    })

    it('rejects releases without gaDate and without productLayer', async () => {
      const req = { body: { releases: [{ version: 'bad', exceptions: {} }] } }
      const res = await router._dispatch('POST', '/conforma/bulk', req)
      expect(res._status).toBe(400)
    })
  })

  describe('merged RHOAI + AIPCC data', () => {
    it('GET /conforma/releases returns releases from both storage keys', async () => {
      storage.writeToStorage('releases/delivery/conforma.json', {
        fetchedAt: '2026-05-10T00:00:00.000Z',
        minDate: '2025-05-22',
        count: 1,
        releases: [SAMPLE_RELEASE]
      })
      storage.writeToStorage('releases/delivery/conforma-aipcc.json', {
        fetchedAt: '2026-07-10T00:00:00.000Z',
        count: 1,
        releases: [SAMPLE_PRODUCT_LAYER]
      })
      const res = await router._dispatch('GET', '/conforma/releases')
      expect(res._status).toBe(200)
      expect(res._body.releases).toHaveLength(2)
      expect(res._body.count).toBe(2)
      expect(res._body.releases.map(r => r.version)).toEqual(['rhoai-3.4', 'rhaii'])
    })

    it('GET /conforma/releases/:version finds AIPCC product layer', async () => {
      storage.writeToStorage('releases/delivery/conforma-aipcc.json', {
        fetchedAt: '2026-07-10T00:00:00.000Z',
        count: 1,
        releases: [SAMPLE_PRODUCT_LAYER]
      })
      const res = await router._dispatch('GET', '/conforma/releases/:version', { params: { version: 'rhaii' } })
      expect(res._status).toBe(200)
      expect(res._body.productLayer).toBe(true)
      expect(res._body.displayName).toBe('RHAII')
    })

    it('GET /conforma/status reports combined count', async () => {
      storage.writeToStorage('releases/delivery/conforma.json', {
        fetchedAt: '2026-05-10T00:00:00.000Z',
        count: 1,
        releases: [SAMPLE_RELEASE]
      })
      storage.writeToStorage('releases/delivery/conforma-aipcc.json', {
        fetchedAt: '2026-07-10T00:00:00.000Z',
        count: 1,
        releases: [SAMPLE_PRODUCT_LAYER]
      })
      const res = await router._dispatch('GET', '/conforma/status')
      expect(res._body.count).toBe(2)
      expect(res._body.fetchedAt).toBe('2026-07-10T00:00:00.000Z')
    })

    it('GET /conforma/releases works with only AIPCC data', async () => {
      storage.writeToStorage('releases/delivery/conforma-aipcc.json', {
        fetchedAt: '2026-07-10T00:00:00.000Z',
        count: 1,
        releases: [SAMPLE_PRODUCT_LAYER]
      })
      const res = await router._dispatch('GET', '/conforma/releases')
      expect(res._status).toBe(200)
      expect(res._body.releases).toHaveLength(1)
    })
  })

  describe('DELETE /conforma', () => {
    it('deletes existing data and returns 204', async () => {
      storage.writeToStorage('releases/delivery/conforma.json', { releases: [SAMPLE_RELEASE] })
      const res = await router._dispatch('DELETE', '/conforma')
      expect(res._status).toBe(204)
      expect(await storage.readFromStorage('releases/delivery/conforma.json')).toBeNull()
    })

    it('returns 204 even when no data exists', async () => {
      const res = await router._dispatch('DELETE', '/conforma')
      expect(res._status).toBe(204)
    })
  })
})

describe('conforma backend routes — demo mode', () => {
  let storage
  let router

  beforeEach(() => {
    process.env.DEMO_MODE = 'true'
    storage = makeStorage()
    const requireAuth = (_req, _res, next) => next()
    const requireAdmin = (_req, _res, next) => next()
    const mock = makeRouter()
    router = mock.router
    const registerConformaRoutes = require('../../../server/delivery/conforma.js')
    registerConformaRoutes(router, { storage, requireAuth, requireAdmin, requireScope: () => (req, res, next) => next() })
  })

  afterEach(() => {
    delete process.env.DEMO_MODE
  })

  it('POST /conforma/bulk returns skipped status without writing data', async () => {
    const req = { body: { releases: [SAMPLE_RELEASE], minDate: '2025-05-22' } }
    const res = await router._dispatch('POST', '/conforma/bulk', req)
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('skipped')
    expect(await storage.readFromStorage('releases/delivery/conforma.json')).toBeNull()
  })

  it('DELETE /conforma returns 400 in demo mode', async () => {
    const res = await router._dispatch('DELETE', '/conforma')
    expect(res._status).toBe(400)
    expect(res._body.error).toMatch(/demo mode/i)
  })
})
