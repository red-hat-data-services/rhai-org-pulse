import { describe, it, expect, beforeEach, vi } from 'vitest'

function makeStorage() {
  const store = {}
  return {
    data: store,
    readFromStorage: async (key) => store[key] || null,
    writeToStorage: async (key, val) => { store[key] = val }
  }
}

function makeRouter() {
  const handlers = {}
  const router = {
    get: (path, ...fns) => { handlers[`GET ${path}`] = fns },
    post: (path, ...fns) => { handlers[`POST ${path}`] = fns },
    _dispatch: async (method, path, req = {}) => {
      const key = `${method} ${path}`
      const fns = handlers[key]
      if (!fns) throw new Error(`No handler for ${key}`)
      const res = {
        _status: 200,
        _body: null,
        status(code) { this._status = code; return this },
        json(body) { this._body = body; return this }
      }
      let i = 0
      const next = async () => {
        const fn = fns[i++]
        if (!fn) return
        // Skip auth/scope middleware — call next; json middleware assigns body
        if (fn.length >= 3 && fn !== fns[fns.length - 1]) {
          return await fn(req, res, next)
        }
        await fn(req, res, next)
      }
      await next()
      return res
    }
  }
  return { router, handlers }
}

const SAMPLE = {
  fetchedAt: '2026-09-30T18:00:00.000Z',
  activeStreams: ['rhoai-3.5'],
  environments: {
    prod: {
      fetchedAt: '2026-09-30T18:00:00.000Z',
      source: 'catalog.redhat.com',
      versions: [{ id: 'rhoai-3.5', tag: 'v3.5', summary: { imageCount: 1 }, components: [] }]
    },
    stage: {
      fetchedAt: '2026-09-30T17:00:00.000Z',
      source: 'pyxis.stage.engineering.redhat.com',
      versions: []
    }
  }
}

describe('chi-hierarchy routes', () => {
  let storage
  let router

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('DEMO_MODE', 'false')
    storage = makeStorage()
    const made = makeRouter()
    router = made.router
    const { registerChiHierarchyRoutes } = await import('../../../server/chi-hierarchy/routes.js')
    const passthrough = (_req, _res, next) => next()
    registerChiHierarchyRoutes(router, {
      storage,
      requireAuth: passthrough,
      requireScope: () => passthrough
    })
  })

  it('validatePayload rejects missing environments', async () => {
    const { validatePayload } = await import('../../../server/chi-hierarchy/routes.js')
    expect(validatePayload({})).toMatch(/environments/)
    expect(validatePayload({ environments: {} })).toMatch(/prod and\/or stage/)
    expect(validatePayload(SAMPLE)).toBeNull()
  })

  it('GET /data returns 404 when empty', async () => {
    const res = await router._dispatch('GET', '/data', { user: { email: 't@redhat.com' } })
    expect(res._status).toBe(404)
  })

  it('POST /bulk stores payload and GET /data returns it', async () => {
    const post = await router._dispatch('POST', '/bulk', {
      user: { email: 'pipeline@redhat.com' },
      body: SAMPLE
    })
    expect(post._status).toBe(200)
    expect(post._body.status).toBe('ok')
    expect(post._body.environments).toEqual(['prod', 'stage'])

    const get = await router._dispatch('GET', '/data', {})
    expect(get._status).toBe(200)
    expect(get._body.environments.prod.source).toBe('catalog.redhat.com')
    expect(get._body.activeStreams).toContain('rhoai-3.5')
  })

  it('GET /status reports env version counts', async () => {
    await storage.writeToStorage('releases/chi-hierarchy/latest.json', SAMPLE)
    const res = await router._dispatch('GET', '/status', {})
    expect(res._status).toBe(200)
    expect(res._body.status).toBe('ok')
    expect(res._body.environments.prod.versionCount).toBe(1)
    expect(res._body.environments.stage.versionCount).toBe(0)
  })

  it('POST /bulk rejects malformed payload', async () => {
    const res = await router._dispatch('POST', '/bulk', {
      body: { environments: { prod: { versions: 'nope' } } }
    })
    expect(res._status).toBe(400)
  })
})

describe('chi-hierarchy demo mode', () => {
  it('POST /bulk skips writes in DEMO_MODE', async () => {
    vi.resetModules()
    vi.stubEnv('DEMO_MODE', 'true')
    const storage = makeStorage()
    const { router } = makeRouter()
    const { registerChiHierarchyRoutes } = await import('../../../server/chi-hierarchy/routes.js')
    const passthrough = (_req, _res, next) => next()
    registerChiHierarchyRoutes(router, {
      storage,
      requireAuth: passthrough,
      requireScope: () => passthrough
    })
    const res = await router._dispatch('POST', '/bulk', { body: SAMPLE })
    expect(res._body.status).toBe('skipped')
    expect(storage.data['releases/chi-hierarchy/latest.json']).toBeUndefined()
  })
})
