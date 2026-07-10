import { describe, it, expect, vi } from 'vitest'

const registerRoutes = (await import('../../server/index.js')).default || (await import('../../server/index.js'))

describe('pm-pipeline server module', () => {
  it('exports a function', () => {
    expect(typeof registerRoutes).toBe('function')
  })

  it('registers expected GET routes', () => {
    const registered = []
    const router = {
      get: vi.fn((...args) => registered.push({ method: 'get', path: args[0] })),
      delete: vi.fn()
    }
    const passthrough = () => (req, res, next) => next()
    const context = {
      registerScopes: vi.fn(),
      registerDiagnostics: vi.fn(),
      requireAdmin: vi.fn(),
      requireScope: vi.fn(() => passthrough),
      secrets: { JIRA_EMAIL: 'test@redhat.com', JIRA_TOKEN: 'token' }
    }

    registerRoutes(router, context)

    const paths = registered.map(r => r.path)
    expect(paths).toContain('/pipeline')
    expect(paths).toContain('/resources')
    expect(paths).toContain('/pm-roster')
    expect(context.registerScopes).toHaveBeenCalled()
  })

  it('registers diagnostics hook when available', () => {
    const router = { get: vi.fn(), delete: vi.fn() }
    const context = {
      registerScopes: vi.fn(),
      registerDiagnostics: vi.fn(),
      requireAdmin: vi.fn(),
      requireScope: vi.fn(() => (req, res, next) => next()),
      secrets: { JIRA_EMAIL: 'test@redhat.com', JIRA_TOKEN: 'token' }
    }

    registerRoutes(router, context)
    expect(context.registerDiagnostics).toHaveBeenCalledWith(expect.any(Function))
  })
})
