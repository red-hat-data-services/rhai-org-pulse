import { describe, it, expect, vi } from 'vitest'

const registerRoutes = (await import('../../server/index.js')).default

describe('ai-catalyst server module', () => {
  it('exports a function', () => {
    expect(typeof registerRoutes).toBe('function')
  })

  it('registers expected GET routes', () => {
    const registered = []
    const router = {
      get: vi.fn((...args) => registered.push({ method: 'get', path: args[0] })),
      post: vi.fn((...args) => registered.push({ method: 'post', path: args[0] }))
    }
    const context = {
      storage: {
        readFromStorage: vi.fn(async () => null),
        writeToStorage: vi.fn(async () => {})
      },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    const getPaths = registered.filter(r => r.method === 'get').map(r => r.path)
    expect(getPaths).toContain('/board-config')
    expect(getPaths).toContain('/config')
    expect(getPaths).toContain('/boards')
    expect(getPaths).toContain('/boards/:month')
    expect(getPaths).toContain('/candidates/:id')
    expect(getPaths).toContain('/stats')
    expect(getPaths).toContain('/showcase/config')
    expect(getPaths).toContain('/showcase/entries')
    expect(getPaths).toContain('/showcase/entries/:slug')
  })

  it('registers POST routes including showcase', () => {
    const registered = []
    const router = {
      get: vi.fn(),
      post: vi.fn((...args) => registered.push({ method: 'post', path: args[0] }))
    }
    const context = {
      storage: {
        readFromStorage: vi.fn(async () => null),
        writeToStorage: vi.fn(async () => {})
      },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    const postPaths = registered.filter(r => r.method === 'post').map(r => r.path)
    expect(postPaths).toContain('/board-config')
    expect(postPaths).toContain('/sync')
    expect(postPaths).toContain('/showcase/config')
    expect(postPaths).toContain('/showcase/refresh')
  })

  it('registers scopes', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerScopes).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'ai-catalyst:read' }),
        expect.objectContaining({ key: 'ai-catalyst:showcase' })
      ])
    )
  })

  it('registers refresh handlers', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerRefresh).toHaveBeenCalledWith(
      'ai-catalyst:sync-boards',
      expect.objectContaining({ cadence: '1h' })
    )
    expect(context.registerRefresh).toHaveBeenCalledWith(
      'ai-catalyst:showcase-sync',
      expect.objectContaining({ cadence: '1h' })
    )
  })

  it('registers diagnostics hook', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerDiagnostics).toHaveBeenCalled()
  })

  it('registers export hook', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {
      storage: { readFromStorage: vi.fn(async () => null), writeToStorage: vi.fn(async () => {}) },
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    expect(context.registerExport).toHaveBeenCalled()
  })

  it('scopes board pillars to the complete month while keeping showcase pillars complete', async () => {
    const handlers = {}
    const candidates = [
      { uniqueId: 'inference-item', category: 'model-inference', impactScore: 9 },
      { uniqueId: 'data-item', category: 'data-science-engineering', impactScore: 8 }
    ]
    const showcaseData = {
      fetchedAt: '2026-09-16T10:00:00Z',
      pillars: [
        { pillarKey: 'model-inference', title: 'Model Inference', sortOrder: 1 },
        { pillarKey: 'data-science-engineering', title: 'Data Science', sortOrder: 2 },
        { pillarKey: 'model-customization', title: 'Model Customization', sortOrder: 3 }
      ],
      entries: [{ slug: 'inference-showcase', strategyPillarKey: 'model-inference', status: 'active' }]
    }
    const index = { boards: [{ month: '2026-09', candidateCount: candidates.length }] }
    const storage = {
      readFromStorage: vi.fn(async key => {
        if (key === 'ai-catalyst/index.json') return index
        if (key === 'ai-catalyst/boards/2026-09.json') return candidates
        if (key === 'ai-catalyst/showcase/showcase-data.json') return showcaseData
        return null
      }),
      writeToStorage: vi.fn(async () => {})
    }
    const router = {
      get: vi.fn((path, ...args) => { handlers[path] = args.at(-1) }),
      post: vi.fn()
    }
    const context = {
      storage,
      requireAuth: vi.fn((req, res, next) => next()),
      requireAdmin: vi.fn((req, res, next) => next()),
      requireScope: vi.fn(() => vi.fn((req, res, next) => next())),
      resolveSecret: vi.fn(),
      secrets: {},
      registerScopes: vi.fn(),
      registerRefresh: vi.fn(),
      registerDiagnostics: vi.fn(),
      registerExport: vi.fn()
    }

    registerRoutes(router, context)

    const boardResponse = { json: vi.fn(), status: vi.fn() }
    await handlers['/boards/:month'](
      { params: { month: '2026-09' }, query: { category: 'model-inference' } },
      boardResponse
    )

    expect(boardResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      filtered: 1,
      pillars: expect.arrayContaining([
        expect.objectContaining({ pillarKey: 'model-inference' }),
        expect.objectContaining({ pillarKey: 'data-science-engineering' })
      ])
    }))
    expect(boardResponse.json.mock.calls[0][0].pillars).toHaveLength(2)

    const detailResponse = { json: vi.fn(), status: vi.fn() }
    await handlers['/candidates/:id']({ params: { id: 'data-item' } }, detailResponse)
    expect(detailResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      boardMonth: '2026-09',
      pillar: expect.objectContaining({ pillarKey: 'data-science-engineering' })
    }))

    const showcaseResponse = { json: vi.fn(), status: vi.fn() }
    await handlers['/showcase/entries']({}, showcaseResponse)

    expect(showcaseResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      pillars: expect.arrayContaining([
        expect.objectContaining({ pillarKey: 'model-inference' }),
        expect.objectContaining({ pillarKey: 'data-science-engineering' }),
        expect.objectContaining({ pillarKey: 'model-customization' })
      ])
    }))
    expect(showcaseResponse.json.mock.calls[0][0].pillars).toHaveLength(3)
  })
})
