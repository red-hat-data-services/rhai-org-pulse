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
      get: vi.fn((path, handler) => registered.push({ method: 'get', path })),
      post: vi.fn(),
    }
    const context = { registerDiagnostics: vi.fn() }

    registerRoutes(router, context)

    const paths = registered.map(r => r.path)
    expect(paths).toContain('/config')
    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/contributors')
    expect(paths).toContain('/leadership')
    expect(paths).toContain('/projects')
    expect(paths).toHaveLength(5)
  })

  it('registers diagnostics hook when available', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = { registerDiagnostics: vi.fn() }

    registerRoutes(router, context)
    expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
  })

  it('does not fail when registerDiagnostics is absent', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    const context = {}

    expect(() => registerRoutes(router, context)).not.toThrow()
  })

  it('does not register any POST routes', () => {
    const router = { get: vi.fn(), post: vi.fn() }
    registerRoutes(router, { registerDiagnostics: vi.fn() })
    expect(router.post).not.toHaveBeenCalled()
  })
})
