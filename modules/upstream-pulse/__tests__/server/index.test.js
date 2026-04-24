import { describe, it, expect, vi } from 'vitest'

// CJS mocking of node-fetch is unreliable in vitest node env,
// so we test the structural aspects of the module (same pattern as git-sync tests).
const registerRoutes = (await import('../../server/index.js')).default

describe('upstream-pulse server module', () => {
  it('exports a function', () => {
    expect(typeof registerRoutes).toBe('function')
  })

  it('registers expected GET routes', () => {
    const registered = []
    const router = {
      get: vi.fn((...args) => registered.push({ method: 'get', path: args[0] })),
      post: vi.fn(),
    }
    const context = { registerDiagnostics: vi.fn(), requireAdmin: vi.fn(), storage: { readFromStorage: vi.fn() } }

    registerRoutes(router, context)

    const paths = registered.map(r => r.path)
    expect(paths).toContain('/config')
    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/contributors')
    expect(paths).toContain('/leadership')
    expect(paths).toContain('/projects')
    expect(paths).toContain('/orgs')
    expect(paths).toContain('/project-jobs')
    expect(paths).toContain('/repo-info')
    expect(paths).toHaveLength(8)
  })

  it('registers admin POST routes for projects and roster-push', () => {
    const postCalls = []
    const router = {
      get: vi.fn(),
      post: vi.fn((...args) => postCalls.push({ path: args[0] })),
    }
    const requireAdmin = vi.fn()
    registerRoutes(router, { registerDiagnostics: vi.fn(), requireAdmin, storage: { readFromStorage: vi.fn() } })

    expect(postCalls).toHaveLength(2)
    expect(postCalls.map(c => c.path)).toContain('/projects')
    expect(postCalls.map(c => c.path)).toContain('/roster-push')
    expect(router.post).toHaveBeenCalledWith('/projects', requireAdmin, expect.any(Function))
    expect(router.post).toHaveBeenCalledWith('/roster-push', requireAdmin, expect.any(Function))
  })

  it('gates repo-info behind requireAdmin', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const requireAdmin = vi.fn()
    registerRoutes(router, { registerDiagnostics: vi.fn(), requireAdmin, storage: { readFromStorage: vi.fn() } })

    expect(router.get).toHaveBeenCalledWith('/repo-info', requireAdmin, expect.any(Function))
  })

  it('registers diagnostics hook when available', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = { registerDiagnostics: vi.fn(), requireAdmin: vi.fn(), storage: { readFromStorage: vi.fn() } }

    registerRoutes(router, context)
    expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
  })

  it('does not fail when registerDiagnostics is absent', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = { requireAdmin: vi.fn(), storage: { readFromStorage: vi.fn() } }

    expect(() => registerRoutes(router, context)).not.toThrow()
  })
})
