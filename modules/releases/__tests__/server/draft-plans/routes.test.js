import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { _setFetch, DATA_PREFIX } = require('../../../server/draft-plans/fetch')

const mockFetch = vi.fn()

const PLAN_DATA = {
  generatedAt: '2026-07-08T11:00:00Z',
  product: 'RHOAI',
  summary: { totalFeatures: 100 },
  capacity: { conservative_max: 31 },
  releases: [
    { version: '3.5', events: { EA1: { features: [{ key: 'F-1' }] }, GA: { features: [] } } },
    { version: '3.6', events: { EA1: { features: [] } } }
  ]
}

const HEALTH_DATA = {
  generatedAt: '2026-07-08',
  historicalCapacity: { typical: 12 },
  velocitySource: 'live',
  releases: [
    { version: '3.5', totalFeatures: 156, committed: 118, planned: 38, healthStatus: 'critical', featureHealth: { ready: 127 }, overcommitRatio: 9.2 },
    { version: '3.6', totalFeatures: 80, committed: 60, planned: 20, healthStatus: 'healthy', featureHealth: { ready: 75 }, overcommitRatio: 1.1 }
  ]
}

function makeStorage(data = {}) {
  const store = { ...data }
  return {
    async readFromStorage(key) { return store[key] ? JSON.parse(JSON.stringify(store[key])) : null },
    async writeToStorage(key, value) { store[key] = value },
    async listStorageFiles(dir) {
      const prefix = dir.endsWith('/') ? dir : dir + '/'
      const names = []
      for (const key of Object.keys(store)) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        if (rest && rest.indexOf('/') === -1 && rest.endsWith('.json')) names.push(rest)
      }
      return names
    },
    _store: store
  }
}

function makeRouter() {
  const routes = { get: {}, post: {}, put: {} }
  return {
    get: vi.fn(function(path, ...handlers) { routes.get[path] = handlers }),
    post: vi.fn(function(path, ...handlers) { routes.post[path] = handlers }),
    put: vi.fn(function(path, ...handlers) { routes.put[path] = handlers }),
    _routes: routes
  }
}

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    _headers: {},
    headersSent: false,
    writableEnded: false,
    status(code) { res._status = code; return res },
    set(key, value) { res._headers[key] = value; return res },
    setHeader(key, value) { res._headers[key] = value; return res },
    getHeader(key) { return res._headers[key] },
    json(data) { res._json = data; res.headersSent = true; return res },
    send(data) {
      res._json = typeof data === 'string' ? { error: data } : data
      res.headersSent = true
      res.writableEnded = true
      return res
    }
  }
  return res
}

function passthrough(req, res, next) { if (next) next(); }

async function setupRouter(storageData = {}, secretsOverride = null) {
  const storage = makeStorage(storageData)
  const router = makeRouter()
  const refreshHandlers = {}
  const diagnosticsFn = vi.fn()

  const registerDraftPlanRoutes = require('../../../server/draft-plans/routes')
  await registerDraftPlanRoutes(router, {
    storage,
    requireAuth: passthrough,
    requireScope: () => passthrough,
    secrets: secretsOverride !== null ? secretsOverride : { GITLAB_TOKEN: 'test-token' },
    registerRefresh: (name, opts) => { refreshHandlers[name] = opts },
    isRefreshRunning: () => false,
    registerDiagnostics: diagnosticsFn
  })

  return { storage, router, refreshHandlers, diagnosticsFn }
}

async function callRoute(router, method, path, req = {}) {
  const routes = router._routes[method]
  const handlers = routes[path]
  if (!handlers) throw new Error(`No route registered for ${method.toUpperCase()} ${path}`)

  const res = makeRes()
  const fullReq = { query: {}, params: {}, body: {}, ...req }
  let idx = 0

  async function run() {
    while (idx < handlers.length) {
      const handler = handlers[idx++]
      let advanced = false
      const maybePromise = handler(fullReq, res, function next(err) {
        if (err) throw err
        advanced = true
      })
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise
      }
      // Terminal handler (no next call) ends the chain
      if (!advanced) break
    }
  }

  await run()
  return res
}

describe('draft-plans routes', () => {
  const prevDemo = process.env.DEMO_MODE

  beforeEach(() => {
    vi.clearAllMocks()
    _setFetch(mockFetch)
    vi.resetModules()
    // Existing editor route tests exercise demo impersonation path
    process.env.DEMO_MODE = 'true'
  })

  afterEach(() => {
    if (prevDemo === undefined) delete process.env.DEMO_MODE
    else process.env.DEMO_MODE = prevDemo
  })

  describe('GET /releases', () => {
    it('returns empty products when no data stored', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/releases')

      expect(res._json.products).toEqual([])
      expect(res._json.fetchedAt).toBeNull()
    })

    it('returns release list with health summary when data is stored', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/RHOAI/release-plan.json`]: PLAN_DATA,
        [`${DATA_PREFIX}/RHOAI/release-health.json`]: HEALTH_DATA,
        [`${DATA_PREFIX}/last-fetch.json`]: { timestamp: '2026-07-08T12:00:00Z' }
      })

      const res = await callRoute(router, 'get', '/releases')

      expect(res._json.fetchedAt).toBe('2026-07-08T12:00:00Z')
      expect(res._json.products).toHaveLength(1)
      expect(res._json.products[0].product).toBe('RHOAI')
      expect(res._json.products[0].releases).toHaveLength(2)

      const v35 = res._json.products[0].releases[0]
      expect(v35.version).toBe('3.5')
      expect(v35.totalFeatures).toBe(156)
      expect(v35.healthStatus).toBe('critical')
      expect(v35.overcommitRatio).toBe(9.2)
    })

    it('filters by product query param', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/RHOAI/release-plan.json`]: PLAN_DATA
      })

      const res = await callRoute(router, 'get', '/releases', { query: { product: 'RHAIIS' } })
      expect(res._json.products).toEqual([])
    })
  })

  describe('GET /:version', () => {
    it('returns full version plan data', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/RHOAI/release-plan.json`]: PLAN_DATA
      })

      const res = await callRoute(router, 'get', '/:version', { params: { version: '3.5' } })

      expect(res._status).toBe(200)
      expect(res._json.version).toBe('3.5')
      expect(res._json.products.RHOAI).toBeDefined()
      expect(res._json.products.RHOAI.release.version).toBe('3.5')
      expect(res._json.products.RHOAI.release.events).toBeDefined()
      expect(res._json.products.RHOAI.summary).toEqual({ totalFeatures: 100 })
      expect(res._json.products.RHOAI.capacity).toEqual({ conservative_max: 31 })
    })

    it('returns 404 for unknown version', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/RHOAI/release-plan.json`]: PLAN_DATA
      })

      const res = await callRoute(router, 'get', '/:version', { params: { version: '9.9' } })
      expect(res._status).toBe(404)
    })

    it('returns 400 for invalid version format', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/:version', { params: { version: '../etc/passwd' } })
      expect(res._status).toBe(400)
    })

    it('accepts version names with spaces', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/:version', { params: { version: 'RHOAI 3.5' } })
      expect(res._status).not.toBe(400)
    })

    it('returns 404 when no data stored', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/:version', { params: { version: '3.5' } })
      expect(res._status).toBe(404)
    })
  })

  describe('GET /:version/health', () => {
    it('returns health data for a version', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/RHOAI/release-health.json`]: HEALTH_DATA
      })

      const res = await callRoute(router, 'get', '/:version/health', { params: { version: '3.5' } })

      expect(res._status).toBe(200)
      expect(res._json.version).toBe('3.5')
      expect(res._json.products.RHOAI.release.healthStatus).toBe('critical')
      expect(res._json.products.RHOAI.release.totalFeatures).toBe(156)
      expect(res._json.products.RHOAI.historicalCapacity).toEqual({ typical: 12 })
      expect(res._json.products.RHOAI.velocitySource).toBe('live')
    })

    it('returns 404 for unknown version', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/RHOAI/release-health.json`]: HEALTH_DATA
      })

      const res = await callRoute(router, 'get', '/:version/health', { params: { version: '9.9' } })
      expect(res._status).toBe(404)
    })

    it('returns 400 for invalid version format', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/:version/health', { params: { version: 'a'.repeat(51) } })
      expect(res._status).toBe(400)
    })

    it('accepts version names with spaces', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/:version/health', { params: { version: 'RHOAI 3.5' } })
      expect(res._status).not.toBe(400)
    })
  })

  describe('GET /config', () => {
    it('returns default config with token status', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/config')

      expect(res._json.enabled).toBe(false)
      expect(res._json.projectId).toBe('81798612')
      expect(res._json.tokenConfigured).toBe(true)
      expect(res._json.tokenSource).toBe('GITLAB_TOKEN')
    })

    it('reports DRAFT_PLANS_GITLAB_TOKEN as preferred source', async () => {
      const { router } = await setupRouter({}, { DRAFT_PLANS_GITLAB_TOKEN: 'dp-token', GITLAB_TOKEN: 'gl-token' })
      const res = await callRoute(router, 'get', '/config')

      expect(res._json.tokenConfigured).toBe(true)
      expect(res._json.tokenSource).toBe('DRAFT_PLANS_GITLAB_TOKEN')
    })

    it('reports no token when secrets are empty', async () => {
      const { router } = await setupRouter({}, {})
      const res = await callRoute(router, 'get', '/config')

      expect(res._json.tokenConfigured).toBe(false)
      expect(res._json.tokenSource).toBeNull()
    })
  })

  describe('POST /config', () => {
    it('saves valid config without enabling', async () => {
      const { router, storage } = await setupRouter()
      const res = await callRoute(router, 'post', '/config', {
        body: { projectId: '12345', refreshIntervalHours: 12 }
      })

      expect(res._json.status).toBe('saved')
      const saved = storage._store[`${DATA_PREFIX}/config.json`]
      expect(saved.projectId).toBe('12345')
      expect(saved.refreshIntervalHours).toBe(12)
    })

    it('auto-fetches when enabling for the first time', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(PLAN_DATA))
      })

      const { router } = await setupRouter()
      const res = await callRoute(router, 'post', '/config', {
        body: { enabled: true, projectId: '12345' }
      })

      expect(res._json.status).toBe('saved_and_fetched')
      expect(res._json.fetchResult).toBeDefined()
    })

    it('rejects invalid projectId', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'post', '/config', {
        body: { projectId: 'not-a-number' }
      })

      expect(res._status).toBe(400)
      expect(res._json.message).toContain('projectId must be a numeric string')
    })

    it('rejects non-https gitlabBaseUrl', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'post', '/config', {
        body: { gitlabBaseUrl: 'http://gitlab.internal' }
      })

      expect(res._status).toBe(400)
      expect(res._json.message).toContain('must start with https://')
    })

    it('rejects refreshIntervalHours out of range', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'post', '/config', {
        body: { refreshIntervalHours: 0 }
      })

      expect(res._status).toBe(400)
    })
  })

  describe('POST /refresh', () => {
    it('returns 500 when no token configured', async () => {
      const { router } = await setupRouter(
        { [`${DATA_PREFIX}/config.json`]: { ...PLAN_DATA, enabled: true } },
        {}
      )

      const res = await callRoute(router, 'post', '/refresh')
      expect(res._status).toBe(500)
      expect(res._json.message).toContain('No GitLab token')
    })

    it('returns 400 when fetch is disabled', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'post', '/refresh')

      expect(res._status).toBe(400)
      expect(res._json.message).toContain('disabled')
    })

    it('performs fetch when enabled and token present', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(PLAN_DATA))
      })

      const { router } = await setupRouter({
        [`${DATA_PREFIX}/config.json`]: { enabled: true, projectId: '81798612', branch: 'main', gitlabBaseUrl: 'https://gitlab.com' }
      })

      const res = await callRoute(router, 'post', '/refresh', { userEmail: 'test@example.com' })
      expect(res._json.status).toBe('success')
      expect(res._json.fileCount).toBeGreaterThan(0)
    })
  })

  describe('GET /refresh/status', () => {
    it('returns status with no prior fetch', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/refresh/status')

      expect(res._json.running).toBe(false)
      expect(res._json.lastFetch).toBeNull()
    })

    it('returns last fetch info when available', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/last-fetch.json`]: { status: 'success', timestamp: '2026-07-08T12:00:00Z', fileCount: 2 }
      })

      const res = await callRoute(router, 'get', '/refresh/status')
      expect(res._json.lastFetch.status).toBe('success')
      expect(res._json.lastFetch.fileCount).toBe(2)
    })
  })

  describe('registerRefresh', () => {
    it('registers a draft-plans refresh handler', async () => {
      const { refreshHandlers } = await setupRouter()

      expect(refreshHandlers['draft-plans']).toBeDefined()
      expect(refreshHandlers['draft-plans'].order).toBe(80)
      expect(refreshHandlers['draft-plans'].timeout).toBe(300000)
      expect(refreshHandlers['draft-plans'].handler).toBeTypeOf('function')
    })

    it('refresh handler skips when disabled', async () => {
      const { refreshHandlers } = await setupRouter()
      const result = await refreshHandlers['draft-plans'].handler()

      expect(result.status).toBe('skipped')
    })

    it('refresh handler skips when no token', async () => {
      const { refreshHandlers } = await setupRouter(
        { [`${DATA_PREFIX}/config.json`]: { enabled: true, projectId: '81798612' } },
        {}
      )

      const result = await refreshHandlers['draft-plans'].handler()
      expect(result.status).toBe('error')
      expect(result.message).toContain('No GitLab token')
    })
  })

  describe('registerDiagnostics', () => {
    it('registers a diagnostics function', async () => {
      const { diagnosticsFn } = await setupRouter()
      expect(diagnosticsFn).toHaveBeenCalledOnce()
      expect(diagnosticsFn.mock.calls[0][0]).toBeTypeOf('function')
    })

    it('diagnostics returns status info', async () => {
      const { diagnosticsFn } = await setupRouter({
        [`${DATA_PREFIX}/last-fetch.json`]: { status: 'success', timestamp: '2026-07-08T12:00:00Z', fileCount: 2 }
      })

      const diagFn = diagnosticsFn.mock.calls[0][0]
      const result = await diagFn()

      expect(result.lastFetchStatus).toBe('success')
      expect(result.lastFetchTimestamp).toBe('2026-07-08T12:00:00Z')
      expect(result.fileCount).toBe(2)
      expect(result.tokenSource).toBe('GITLAB_TOKEN')
    })
  })

  describe('GET /cycles', () => {
    it('returns demo 3.6 cycle and both products', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/cycles', { query: { product: 'RHOAI' } })

      expect(res._status).toBe(200)
      expect(res._json.product).toBe('RHOAI')
      expect(res._json.products).toEqual(['RHOAI', 'RHAII'])
      expect(res._json.defaultVersion).toBe('3.6')
      expect(res._json.cycles.some(c => c.version === '3.6' && c.demoMode)).toBe(true)
    })

    it('prefers stored pipeline draft over demo for same version', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/drafts/RHOAI/3.6.json`]: {
          version: '3.6',
          generatedAt: '2026-07-15T00:00:00Z',
          candidates: [
            { key: 'RHAISTRAT-1', summary: 'Stored', basePlacement: 'EA1', component: 'KubeRay' }
          ],
          ceilingsByComponent: {}
        }
      })

      const res = await callRoute(router, 'get', '/cycles', { query: { product: 'RHOAI' } })
      const cycle = res._json.cycles.find(c => c.version === '3.6')
      expect(cycle.source).toBe('pipeline')
      expect(cycle.demoMode).toBe(false)
      expect(cycle.candidateCount).toBe(1)
    })
  })

  describe('GET /editor/:version', () => {
    it('returns demo fixture for 3.6 when no stored draft', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/editor/:version', {
        params: { version: '3.6' },
        query: { product: 'RHOAI' }
      })

      expect(res._status).toBe(200)
      expect(res._json.draft.demoMode).toBe(true)
      expect(res._json.draft.candidates.length).toBeGreaterThan(0)
      expect(res._json.edits).toEqual({})
      expect(res._json.meta.planVersion).toBe('3.6')
      expect(res._json.session).toBeTruthy()
      expect(res._json.session.canImpersonate).toBe(true)
    })

    it('rejects unknown product', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'get', '/editor/:version', {
        params: { version: '3.6' },
        query: { product: '../etc/passwd' }
      })
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('Unknown product')
    })

    it('prefers stored draft over demo', async () => {
      const { router } = await setupRouter({
        [`${DATA_PREFIX}/drafts/RHOAI/3.6.json`]: {
          version: '3.6',
          generatedAt: '2026-07-15T00:00:00Z',
          candidates: [
            {
              key: 'RHAISTRAT-1',
              summary: 'Stored',
              basePlacement: 'EA1',
              component: 'KubeRay',
              assignee: 'A'
            }
          ],
          ceilingsByComponent: { KubeRay: { EA1: 2, EA2: 0, GA: 1 } }
        }
      })

      const res = await callRoute(router, 'get', '/editor/:version', {
        params: { version: '3.6' },
        query: { product: 'RHOAI' }
      })

      expect(res._json.draft.demoMode).toBe(false)
      expect(res._json.draft.candidates).toHaveLength(1)
      expect(res._json.draft.candidates[0].key).toBe('RHAISTRAT-1')
      expect(res._json.ceilingsByComponent.KubeRay.EA1).toBe(2)
    })
  })

  describe('PUT /editor/:version', () => {
    it('persists edits meta and audit', async () => {
      const { router, storage } = await setupRouter()
      const res = await callRoute(router, 'put', '/editor/:version', {
        params: { version: '3.6' },
        query: { product: 'RHOAI' },
        body: {
          edits: { 'RHAISTRAT-1': { decision: 'move', placement: 'EA2' } },
          meta: { planVersion: '3.6', currentUser: 'Admin', frozenEvents: {} },
          audit: [{ action: 'decision', detail: 'test' }]
        },
        userEmail: 'admin@test.com',
        isAdmin: true
      })

      expect(res._status).toBe(200)
      expect(res._json.status).toBe('saved')
      const stored = storage._store[`${DATA_PREFIX}/editor/RHOAI/3.6.json`]
      expect(stored.edits['RHAISTRAT-1'].placement).toBe('EA2')
      expect(stored.audit).toHaveLength(1)
      expect(stored.meta.isPlanAdmin).toBe(true)
    })

    it('rejects unknown product', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'put', '/editor/:version', {
        params: { version: '3.6' },
        query: { product: 'NOPE' },
        body: { edits: {}, meta: {}, audit: [] }
      })
      expect(res._status).toBe(400)
      expect(res._json.error).toContain('Unknown product')
    })

    it('rejects missing edits', async () => {
      const { router } = await setupRouter()
      const res = await callRoute(router, 'put', '/editor/:version', {
        params: { version: '3.6' },
        body: { meta: {} }
      })
      expect(res._status).toBe(400)
    })

    it('rejects foreign-row edits and Admin impersonation outside DEMO_MODE', async () => {
      process.env.DEMO_MODE = 'false'
      process.env.VITE_DEMO_MODE = 'false'
      const { router, storage } = await setupRouter({
        [`${DATA_PREFIX}/drafts/RHOAI/3.6.json`]: {
          version: '3.6',
          candidates: [
            { key: 'F-1', summary: 'Alice feature', basePlacement: 'EA1', assignee: 'Alice', component: 'KubeRay' },
            { key: 'F-2', summary: 'Owner feature', basePlacement: 'EA1', assignee: 'abellusci', component: 'KubeRay' }
          ],
          ceilingsByComponent: { KubeRay: { EA1: 5, EA2: 5, GA: 5 } }
        }
      })

      const foreign = await callRoute(router, 'put', '/editor/:version', {
        params: { version: '3.6' },
        query: { product: 'RHOAI' },
        userEmail: 'abellusci@redhat.com',
        userUid: 'abellusci',
        isAdmin: false,
        body: {
          edits: { 'F-1': { decision: 'descope', placement: null } },
          meta: { currentUser: 'Admin', frozenEvents: {} },
          audit: []
        }
      })
      expect(foreign._status).toBe(403)

      const own = await callRoute(router, 'put', '/editor/:version', {
        params: { version: '3.6' },
        query: { product: 'RHOAI' },
        userEmail: 'abellusci@redhat.com',
        userUid: 'abellusci',
        isAdmin: false,
        body: {
          edits: { 'F-2': { decision: 'move', placement: 'EA2' } },
          meta: { currentUser: 'Admin', frozenEvents: {} },
          audit: []
        }
      })
      expect(own._status).toBe(200)
      expect(own._json.meta.currentUser).toBe('abellusci')
      expect(own._json.meta.isPlanAdmin).toBe(false)
      const stored = storage._store[`${DATA_PREFIX}/editor/RHOAI/3.6.json`]
      expect(stored.meta.currentUser).toBe('abellusci')
      expect(stored.edits['F-2'].placement).toBe('EA2')
    })

    it('rate-limits excessive editor saves', async () => {
      const { router } = await setupRouter()
      const req = {
        params: { version: '3.6' },
        query: { product: 'RHOAI' },
        userEmail: 'rate-limit@test.com',
        isAdmin: true,
        body: {
          edits: {},
          meta: { planVersion: '3.6', currentUser: 'Admin', frozenEvents: {} },
          audit: []
        }
      }
      let last = null
      for (let i = 0; i < 61; i++) {
        last = await callRoute(router, 'put', '/editor/:version', req)
      }
      expect(last._status).toBe(429)
      expect(last._json.error).toMatch(/Rate limit exceeded/)
    })
  })
})
