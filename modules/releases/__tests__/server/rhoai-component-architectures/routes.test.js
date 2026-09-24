import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const registerRhoaiComponentArchitecturesRoutes = require('../../../server/rhoai-component-architectures/routes')
const { pickRecommendedBranch } = registerRhoaiComponentArchitecturesRoutes

function makeRegistry(releases) {
  return { releases }
}

function makeRelease(id, gaDate) {
  return { id, milestones: { ga: gaDate } }
}

describe('pickRecommendedBranch', () => {
  let realDateNow

  beforeEach(() => {
    realDateNow = Date.now
  })

  afterEach(() => {
    Date.now = realDateNow
  })

  it('picks the branch whose GA release date is closest to today', () => {
    Date.now = () => new Date('2026-08-20').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ga', '2026-11-19')
    ])
    const branches = ['rhoai-3.6', 'rhoai-3.5']

    expect(pickRecommendedBranch(registry, branches)).toBe('rhoai-3.5')
  })

  it('picks closer future GA when past GA is farther away', () => {
    Date.now = () => new Date('2026-10-15').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ga', '2026-11-19')
    ])
    const branches = ['rhoai-3.6', 'rhoai-3.5']

    expect(pickRecommendedBranch(registry, branches)).toBe('rhoai-3.6')
  })

  it('picks GA release date over EA release date for the same branch', () => {
    Date.now = () => new Date('2026-08-15').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ea1', '2026-06-17'),
      makeRelease('rhai-3.5-ea2', '2026-07-15'),
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ea1', '2026-09-17')
    ])
    const branches = ['rhoai-3.6', 'rhoai-3.5']

    expect(pickRecommendedBranch(registry, branches)).toBe('rhoai-3.5')
  })

  it('returns null when registry is null', () => {
    expect(pickRecommendedBranch(null, ['rhoai-3.5'])).toBe(null)
  })

  it('returns null when no releases have GA dates', () => {
    const registry = makeRegistry([
      { id: 'rhai-3.5-ga', milestones: {} }
    ])
    expect(pickRecommendedBranch(registry, ['rhoai-3.5'])).toBe(null)
  })

  it('returns null when availableBranches is empty', () => {
    const registry = makeRegistry([makeRelease('rhai-3.5-ga', '2026-08-19')])
    expect(pickRecommendedBranch(registry, [])).toBe(null)
  })

  it('skips releases without a milestones object', () => {
    Date.now = () => new Date('2026-08-20').getTime()
    const registry = makeRegistry([
      { id: 'rhai-3.5-ga' },
      makeRelease('rhai-3.6-ga', '2026-08-19')
    ])
    expect(pickRecommendedBranch(registry, ['rhoai-3.5', 'rhoai-3.6'])).toBe('rhoai-3.6')
  })

  it('skips releases whose branch is not in availableBranches', () => {
    Date.now = () => new Date('2026-08-20').getTime()

    const registry = makeRegistry([
      makeRelease('rhai-3.5-ga', '2026-08-19'),
      makeRelease('rhai-3.6-ga', '2026-11-19')
    ])

    expect(pickRecommendedBranch(registry, ['rhoai-3.6'])).toBe('rhoai-3.6')
  })
})

describe('registerRhoaiComponentArchitecturesRoutes', () => {
  const STORAGE_KEY = 'releases/rhoai-component-architectures/latest.json'
  const REGISTRY_KEY = 'releases/registry.json'

  const REGISTRY = makeRegistry([
    makeRelease('rhai-2.25-ga', '2026-07-01'),
    makeRelease('rhai-3.5-ga', '2026-09-01'),
    makeRelease('rhai-3.5-ea2', '2026-08-10')
  ])

  function makeStorage(data = {}) {
    const store = { ...data }
    return {
      readFromStorage: vi.fn(async (key) => (store[key] ? JSON.parse(JSON.stringify(store[key])) : null)),
      writeToStorage: vi.fn(async (key, value) => { store[key] = value })
    }
  }

  function makeRouter() {
    const routes = { get: {}, post: {} }
    return {
      get: vi.fn(function (path, ...handlers) { routes.get[path] = handlers }),
      post: vi.fn(function (path, ...handlers) { routes.post[path] = handlers }),
      _routes: routes
    }
  }

  function makeRes() {
    const res = {
      _status: 200,
      _json: null,
      status(code) { res._status = code; return res },
      json(body) { res._json = body; return res }
    }
    return res
  }

  function register({ storageData = {}, registry = REGISTRY } = {}) {
    const router = makeRouter()
    const registerRefresh = vi.fn()
    const context = {
      storage: makeStorage({ [REGISTRY_KEY]: registry, ...storageData }),
      requireAuth: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => (req, res, next) => next()),
      registerRefresh
    }
    registerRhoaiComponentArchitecturesRoutes(router, context)
    return {
      router,
      context,
      getHandler: () => router._routes.get['/'].pop(),
      postHandler: () => router._routes.post['/refresh'].pop()
    }
  }

  it('registers the GET route, the refresh route, and the refresh cadence', () => {
    const { router, context } = register()

    expect(router.get).toHaveBeenCalledWith('/', expect.any(Function), expect.any(Function), expect.any(Function))
    expect(router.post).toHaveBeenCalledWith('/refresh', expect.any(Function), expect.any(Function), expect.any(Function))
    expect(context.requireAuth).not.toHaveBeenCalled()
    expect(context.requireScope).toHaveBeenCalledWith('releases:read')
    expect(context.requireScope).toHaveBeenCalledWith('releases:write')
    expect(context.registerRefresh).toHaveBeenCalledWith(
      'rhoai-component-architectures',
      expect.objectContaining({ order: 85, cadence: '24h', handler: expect.any(Function) })
    )
  })

  it('returns a placeholder shell when no cached data exists', async () => {
    const { getHandler } = register()
    const res = makeRes()
    await getHandler()({ query: {} }, res)

    expect(res._status).toBe(200)
    expect(res._json.fetchedAt).toBe(null)
    expect(res._json.source).toEqual({ owner: 'red-hat-data-services', repo: 'konflux-central' })
    expect(res._json.maturity).toEqual({ available: false, fetchedAt: null, warning: null, allProductComponents: [] })
    expect(Object.keys(res._json.branches).sort()).toEqual(['rhoai-2.25', 'rhoai-3.3', 'rhoai-3.5', 'rhoai-3.5-ea.2'])
    for (const branch of Object.keys(res._json.branches)) {
      expect(res._json.branches[branch]).toEqual({ reportAvailable: false, components: [], summary: null })
    }
    expect(res._json.recommendedBranch).toBe(
      pickRecommendedBranch(REGISTRY, ['rhoai-2.25', 'rhoai-3.5', 'rhoai-3.5-ea.2'])
    )
  })

  it('serves cached data aligned to registry branches', async () => {
    const cached = {
      fetchedAt: '2026-09-02T00:00:00.000Z',
      source: { owner: 'red-hat-data-services', repo: 'konflux-central' },
      branches: {
        'rhoai-2.25': {
          reportAvailable: true,
          components: [{ name: 'odh-x-rhel9' }],
          summary: { totalComponents: 1 }
        },
        'rhoai-0.9': { reportAvailable: true, components: [], summary: null }
      },
      maturity: { available: true, fetchedAt: '2026-09-02T00:00:00.000Z', warning: null, allProductComponents: [{ name: 'PC' }] }
    }
    const { getHandler } = register({ storageData: { [STORAGE_KEY]: cached } })
    const res = makeRes()
    await getHandler()({ query: {} }, res)

    expect(res._status).toBe(200)
    expect(res._json.fetchedAt).toBe('2026-09-02T00:00:00.000Z')
    expect(res._json.maturity.available).toBe(true)
    expect(res._json.branches['rhoai-2.25'].components).toEqual([{ name: 'odh-x-rhel9' }])
    expect(res._json.branches['rhoai-3.5']).toEqual({ reportAvailable: false, components: [], summary: null })
    expect(res._json.branches['rhoai-3.5-ea.2']).toEqual({ reportAvailable: false, components: [], summary: null })
    expect(res._json.branches['rhoai-0.9']).toBeUndefined()
  })

  it('defaults maturity to unavailable when missing from the cache', async () => {
    const cached = {
      fetchedAt: '2026-09-02T00:00:00.000Z',
      source: null,
      branches: { 'rhoai-2.25': { reportAvailable: true, components: [], summary: null } }
    }
    const { getHandler } = register({ storageData: { [STORAGE_KEY]: cached } })
    const res = makeRes()
    await getHandler()({ query: {} }, res)

    expect(res._status).toBe(200)
    expect(res._json.maturity).toEqual({ available: false, fetchedAt: null, warning: null, allProductComponents: [] })
  })

  it('filters to a single branch via the branch query parameter', async () => {
    const cached = {
      fetchedAt: '2026-09-02T00:00:00.000Z',
      source: null,
      branches: {
        'rhoai-2.25': { reportAvailable: true, components: [{ name: 'a' }], summary: null },
        'rhoai-3.5': { reportAvailable: false, components: [], summary: null }
      }
    }
    const { getHandler } = register({ storageData: { [STORAGE_KEY]: cached } })
    const res = makeRes()
    await getHandler()({ query: { branch: 'rhoai-2.25' } }, res)

    expect(res._status).toBe(200)
    expect(Object.keys(res._json.branches)).toEqual(['rhoai-2.25'])
    expect(res._json.branches['rhoai-2.25'].components).toEqual([{ name: 'a' }])
  })

  it('returns 404 for an unknown branch query parameter', async () => {
    const { getHandler } = register({
      storageData: {
        [STORAGE_KEY]: {
          fetchedAt: '2026-09-02T00:00:00.000Z',
          source: null,
          branches: {},
          maturity: null
        }
      }
    })
    const res = makeRes()
    await getHandler()({ query: { branch: 'rhoai-9.9' } }, res)

    expect(res._status).toBe(404)
    expect(res._json).toEqual({ error: 'Branch rhoai-9.9 not found' })
  })

  it('returns 500 when the storage read fails', async () => {
    const router = makeRouter()
    const context = {
      storage: {
        readFromStorage: vi.fn(async () => { throw new Error('disk on fire') }),
        writeToStorage: vi.fn()
      },
      requireAuth: vi.fn(),
      requireScope: vi.fn(),
      registerRefresh: vi.fn()
    }
    registerRhoaiComponentArchitecturesRoutes(router, context)
    const res = makeRes()
    await router._routes.get['/'].pop()({ query: {} }, res)

    expect(res._status).toBe(500)
    expect(res._json).toEqual({ error: 'disk on fire' })
  })
})
