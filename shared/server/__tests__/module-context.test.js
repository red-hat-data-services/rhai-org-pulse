import { describe, it, expect, vi } from 'vitest'

const { buildModuleContext, createTestContext } = require('../module-context')

function makeCoreServices(overrides = {}) {
  const noop = function () {}
  const noopMw = function (_req, _res, next) { next() }
  return {
    storage: { readFromStorage: noop, writeToStorage: noop },
    requireAuth: noopMw,
    requireAdmin: noopMw,
    requireTeamAdmin: noopMw,
    requireReleaseManager: noopMw,
    requireScope: function () { return noopMw },
    roleStore: { getRole: noop },
    ...overrides
  }
}

describe('buildModuleContext', () => {
  it('returns a frozen object', () => {
    const ctx = buildModuleContext(makeCoreServices(), 'test-mod')
    expect(Object.isFrozen(ctx)).toBe(true)
  })

  it('includes all expected properties', () => {
    const ctx = buildModuleContext(makeCoreServices(), 'test-mod')
    expect(ctx).toHaveProperty('storage')
    expect(ctx).toHaveProperty('requireAuth')
    expect(ctx).toHaveProperty('requireAdmin')
    expect(ctx).toHaveProperty('requireTeamAdmin')
    expect(ctx).toHaveProperty('requireReleaseManager')
    expect(ctx).toHaveProperty('requireScope')
    expect(ctx).toHaveProperty('roleStore')
    expect(ctx).toHaveProperty('registerDiagnostics')
    expect(ctx).toHaveProperty('registerMessageProvider')
    expect(ctx).toHaveProperty('registerRefresh')
    expect(ctx).toHaveProperty('registerExport')
  })

  it('noop registries do not throw when called', () => {
    const ctx = buildModuleContext(makeCoreServices(), 'test-mod')
    expect(() => ctx.registerDiagnostics(function () {})).not.toThrow()
    expect(() => ctx.registerMessageProvider('x', function () {})).not.toThrow()
    expect(() => ctx.registerRefresh('x', { handler: function () {} })).not.toThrow()
    expect(() => ctx.registerExport(function () {})).not.toThrow()
  })

  it('diagnostics accumulates into array per slug', () => {
    const diagnostics = {}
    const ctx = buildModuleContext(makeCoreServices(), 'my-mod', { diagnostics })
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    ctx.registerDiagnostics(fn1)
    ctx.registerDiagnostics(fn2)
    expect(diagnostics['my-mod']).toEqual([fn1, fn2])
  })

  it('diagnostics from different modules are separate', () => {
    const diagnostics = {}
    const ctx1 = buildModuleContext(makeCoreServices(), 'mod-a', { diagnostics })
    const ctx2 = buildModuleContext(makeCoreServices(), 'mod-b', { diagnostics })
    ctx1.registerDiagnostics(function () {})
    ctx2.registerDiagnostics(function () {})
    expect(diagnostics['mod-a']).toHaveLength(1)
    expect(diagnostics['mod-b']).toHaveLength(1)
  })

  it('delegates registerMessageProvider to message registry', () => {
    const messages = { registerProvider: vi.fn() }
    const ctx = buildModuleContext(makeCoreServices(), 'test-mod', { messages })
    const fn = function () {}
    ctx.registerMessageProvider('alert', fn)
    expect(messages.registerProvider).toHaveBeenCalledWith('alert', fn)
  })

  it('delegates registerRefresh to refresh registry with scoped id', () => {
    const refresh = { register: vi.fn() }
    const ctx = buildModuleContext(makeCoreServices(), 'my-mod', { refresh })
    const config = { handler: function () {}, order: 50 }
    ctx.registerRefresh('metrics', config)
    expect(refresh.register).toHaveBeenCalledWith('my-mod:metrics', config)
  })

  it('delegates registerExport to export registry', () => {
    const exports = { register: vi.fn() }
    const ctx = buildModuleContext(makeCoreServices(), 'my-mod', { exports })
    const fn = function () {}
    ctx.registerExport(fn)
    expect(exports.register).toHaveBeenCalledWith('my-mod', fn)
  })
})

describe('createTestContext', () => {
  it('returns an object with all context properties', () => {
    const ctx = createTestContext()
    expect(ctx).toHaveProperty('storage')
    expect(ctx).toHaveProperty('requireAuth')
    expect(ctx).toHaveProperty('requireAdmin')
    expect(ctx).toHaveProperty('requireTeamAdmin')
    expect(ctx).toHaveProperty('requireReleaseManager')
    expect(ctx).toHaveProperty('requireScope')
    expect(ctx).toHaveProperty('roleStore')
    expect(ctx).toHaveProperty('registerDiagnostics')
    expect(ctx).toHaveProperty('registerMessageProvider')
    expect(ctx).toHaveProperty('registerRefresh')
    expect(ctx).toHaveProperty('registerExport')
  })

  it('allows overriding properties', () => {
    const customStorage = { readFromStorage: vi.fn(), writeToStorage: vi.fn() }
    const ctx = createTestContext({ storage: customStorage })
    expect(ctx.storage).toBe(customStorage)
  })

  it('storage defaults return null / noop', () => {
    const ctx = createTestContext()
    expect(ctx.storage.readFromStorage('any')).toBeNull()
    expect(() => ctx.storage.writeToStorage('any', {})).not.toThrow()
  })

  it('registration functions are callable noops', () => {
    const ctx = createTestContext()
    expect(() => ctx.registerDiagnostics(function () {})).not.toThrow()
    expect(() => ctx.registerMessageProvider('x', function () {})).not.toThrow()
    expect(() => ctx.registerRefresh('x', {})).not.toThrow()
    expect(() => ctx.registerExport(function () {})).not.toThrow()
  })
})
