import { describe, it, expect } from 'vitest'

const { collectModuleDiagnostics } = require('../module-loader')

function makeModules(slugs) {
  return slugs.map(slug => ({
    slug,
    name: slug,
    requires: [],
    defaultEnabled: true,
    _dir: `/modules/${slug}`,
    server: { entry: './server/index.js' }
  }))
}

describe('collectModuleDiagnostics', () => {
  it('returns "not implemented" for modules without registered hooks', async () => {
    const modules = makeModules(['mod-a'])
    const registry = {}
    const enabledSlugs = new Set(['mod-a'])

    const result = await collectModuleDiagnostics(modules, registry, enabledSlugs)
    expect(result['mod-a']).toEqual({ enabled: true, diagnostics: 'not implemented' })
  })

  it('returns { enabled: false } for disabled modules', async () => {
    const modules = makeModules(['mod-a'])
    const registry = {}
    const enabledSlugs = new Set()

    const result = await collectModuleDiagnostics(modules, registry, enabledSlugs)
    expect(result['mod-a']).toEqual({ enabled: false })
  })

  it('calls registered hook and returns result', async () => {
    const modules = makeModules(['mod-a'])
    const registry = {
      'mod-a': async () => ({ status: 'ok', count: 42 })
    }
    const enabledSlugs = new Set(['mod-a'])

    const result = await collectModuleDiagnostics(modules, registry, enabledSlugs)
    expect(result['mod-a']).toEqual({ status: 'ok', count: 42 })
  })

  it('catches errors in hook and returns error message', async () => {
    const modules = makeModules(['mod-a'])
    const registry = {
      'mod-a': async () => { throw new Error('hook failed') }
    }
    const enabledSlugs = new Set(['mod-a'])

    const result = await collectModuleDiagnostics(modules, registry, enabledSlugs)
    expect(result['mod-a']).toEqual({ error: 'hook failed' })
  })

  it('runs multiple modules in parallel', async () => {
    const modules = makeModules(['mod-a', 'mod-b'])
    const registry = {
      'mod-a': async () => ({ a: true }),
      'mod-b': async () => ({ b: true })
    }
    const enabledSlugs = new Set(['mod-a', 'mod-b'])

    const result = await collectModuleDiagnostics(modules, registry, enabledSlugs)
    expect(result['mod-a']).toEqual({ a: true })
    expect(result['mod-b']).toEqual({ b: true })
  })

  it('times out slow hooks', async () => {
    const modules = makeModules(['mod-a'])
    const registry = {
      'mod-a': () => new Promise(resolve => setTimeout(() => resolve({ done: true }), 15000))
    }
    const enabledSlugs = new Set(['mod-a'])

    const result = await collectModuleDiagnostics(modules, registry, enabledSlugs)
    expect(result['mod-a']).toEqual({ error: 'diagnostics timed out after 10s' })
  }, 15000)
})
