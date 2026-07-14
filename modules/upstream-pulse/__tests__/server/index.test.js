import { describe, it, expect, vi } from 'vitest'

// We test the structural aspects of the module (same pattern as git-sync tests).
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
      patch: vi.fn(),
    }
    const context = { registerDiagnostics: vi.fn(), registerScopes: vi.fn(), registerRole: vi.fn(), requireAdmin: vi.fn(), requireRole: vi.fn(() => vi.fn()), requireScope: () => (req, res, next) => next(), storage: { readFromStorage: vi.fn().mockResolvedValue(null) } }

    registerRoutes(router, context)

    const paths = registered.map(r => r.path)
    expect(paths).toContain('/config')
    expect(paths).toContain('/dashboard')
    expect(paths).toContain('/contributors')
    expect(paths).toContain('/leadership')
    expect(paths).toContain('/projects')
    expect(paths).toContain('/orgs')
    expect(paths).toContain('/github-access')
    expect(paths).toContain('/project-jobs')
    expect(paths).toContain('/strategy/permissions')
    expect(paths).toContain('/org-info')
    expect(paths).toContain('/repo-info')
    expect(paths).toHaveLength(11)
  })

  it('registers admin POST routes for projects and roster-push', () => {
    const postCalls = []
    const router = {
      get: vi.fn(),
      post: vi.fn((...args) => postCalls.push({ path: args[0] })),
      patch: vi.fn(),
    }
    const requireAdmin = vi.fn()
    registerRoutes(router, { registerDiagnostics: vi.fn(), registerScopes: vi.fn(), registerRole: vi.fn(), requireAdmin, requireRole: vi.fn(() => vi.fn()), requireScope: () => (req, res, next) => next(), storage: { readFromStorage: vi.fn().mockResolvedValue(null) } })

    expect(postCalls).toHaveLength(3)
    expect(postCalls.map(c => c.path)).toContain('/orgs')
    expect(postCalls.map(c => c.path)).toContain('/projects')
    expect(postCalls.map(c => c.path)).toContain('/roster-push')
    expect(router.post).toHaveBeenCalledWith('/projects', requireAdmin, expect.any(Function), expect.any(Function))
    expect(router.post).toHaveBeenCalledWith('/roster-push', requireAdmin, expect.any(Function), expect.any(Function))
  })

  it('gates repo-info behind requireAdmin', () => {
    const router = { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
    const requireAdmin = vi.fn()
    registerRoutes(router, { registerDiagnostics: vi.fn(), registerScopes: vi.fn(), registerRole: vi.fn(), requireAdmin, requireRole: vi.fn(() => vi.fn()), requireScope: () => (req, res, next) => next(), storage: { readFromStorage: vi.fn().mockResolvedValue(null) } })

    expect(router.get).toHaveBeenCalledWith('/repo-info', requireAdmin, expect.any(Function), expect.any(Function))
  })

  it('registers diagnostics hook when available', () => {
    const router = { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
    const context = { registerDiagnostics: vi.fn(), registerScopes: vi.fn(), registerRole: vi.fn(), requireAdmin: vi.fn(), requireRole: vi.fn(() => vi.fn()), requireScope: () => (req, res, next) => next(), storage: { readFromStorage: vi.fn().mockResolvedValue(null) } }

    registerRoutes(router, context)
    expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
  })

  it('does not fail when registerDiagnostics is absent', () => {
    const router = { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
    const context = { registerScopes: vi.fn(), registerRole: vi.fn(), requireAdmin: vi.fn(), requireRole: vi.fn(() => vi.fn()), requireScope: () => (req, res, next) => next(), storage: { readFromStorage: vi.fn().mockResolvedValue(null) } }

    expect(() => registerRoutes(router, context)).not.toThrow()
  })

  it('registers PATCH route for org update', () => {
    const patchCalls = []
    const router = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn((...args) => patchCalls.push({ path: args[0] })),
    }
    const requireUpstreamAdmin = vi.fn()
    const requireRole = vi.fn(() => requireUpstreamAdmin)
    registerRoutes(router, { registerDiagnostics: vi.fn(), registerScopes: vi.fn(), registerRole: vi.fn(), requireAdmin: vi.fn(), requireRole, requireScope: () => (req, res, next) => next(), storage: { readFromStorage: vi.fn().mockResolvedValue(null) } })

    expect(patchCalls).toHaveLength(1)
    expect(patchCalls[0].path).toBe('/orgs/:githubOrg')
    expect(router.patch).toHaveBeenCalledWith('/orgs/:githubOrg', requireUpstreamAdmin, expect.any(Function), expect.any(Function))
  })

  it('registers upstream-pulse-admin role', () => {
    const router = { get: vi.fn(), post: vi.fn(), patch: vi.fn() }
    const registerRole = vi.fn()
    registerRoutes(router, { registerDiagnostics: vi.fn(), registerScopes: vi.fn(), registerRole, requireAdmin: vi.fn(), requireRole: vi.fn(() => vi.fn()), requireScope: () => (req, res, next) => next(), storage: { readFromStorage: vi.fn().mockResolvedValue(null) } })

    expect(registerRole).toHaveBeenCalledWith('upstream-pulse-admin', expect.objectContaining({
      label: 'Upstream Pulse Admin',
      description: expect.any(String),
    }))
  })
})
