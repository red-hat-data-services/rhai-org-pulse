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
        readFromStorage: vi.fn(),
        writeToStorage: vi.fn(),
        writeToStorageAtomic: vi.fn()
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
        readFromStorage: vi.fn(),
        writeToStorage: vi.fn(),
        writeToStorageAtomic: vi.fn()
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
      storage: { readFromStorage: vi.fn(), writeToStorage: vi.fn(), writeToStorageAtomic: vi.fn() },
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
      storage: { readFromStorage: vi.fn(), writeToStorage: vi.fn(), writeToStorageAtomic: vi.fn() },
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
      storage: { readFromStorage: vi.fn(), writeToStorage: vi.fn(), writeToStorageAtomic: vi.fn() },
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
      storage: { readFromStorage: vi.fn(), writeToStorage: vi.fn(), writeToStorageAtomic: vi.fn() },
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
})
