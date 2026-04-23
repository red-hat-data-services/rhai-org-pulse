import { describe, it, expect } from 'vitest'

const { collect } = require('../must-gather')

function makeStorage(data = {}) {
  return {
    readFromStorage(key) {
      return data[key] !== undefined ? JSON.parse(JSON.stringify(data[key])) : null
    },
    writeToStorage() {},
    listStorageFiles() { return [] },
    DATA_DIR: '/app/data'
  }
}

function makeModules() {
  return [
    {
      slug: 'team-tracker',
      name: 'People & Teams',
      description: 'Delivery metrics',
      icon: 'BarChart3',
      order: 1,
      requires: [],
      defaultEnabled: true,
      _dir: '/modules/team-tracker',
      client: { entry: './client/index.js' },
      server: { entry: './server/index.js' }
    }
  ]
}

describe('must-gather collect', () => {
  it('returns a bundle with all top-level keys', async () => {
    const bundle = await collect({
      storageModule: makeStorage(),
      builtInModules: makeModules(),
      enabledSlugs: new Set(['team-tracker']),
      collectModuleDiagnostics: async () => ({ 'team-tracker': { test: true } }),
      diagnosticsRegistry: {},
      gitSync: null,
      redact: 'minimal'
    })

    expect(bundle.buildInfo).toBeDefined()
    expect(bundle.collectedAt).toBeTruthy()
    expect(bundle.redactionLevel).toBe('minimal')
    expect(bundle.system).toBeDefined()
    expect(bundle.system.platform).toBeTruthy()
    expect(bundle.system.env).toBeDefined()
    expect(bundle.builtInModules).toBeDefined()
    expect(bundle.builtInModules.discovered).toEqual(['team-tracker'])
    expect(bundle.storage).toBeDefined()
    expect(bundle.allowlist).toBeDefined()
    expect(bundle.modules).toEqual({ 'team-tracker': { test: true } })
    expect(bundle.requestStats).toBeDefined()
    expect(bundle.recentErrors).toBeDefined()
  })

  it('system.env reports token presence not values', async () => {
    const origToken = process.env.JIRA_TOKEN
    process.env.JIRA_TOKEN = 'secret-value'

    const bundle = await collect({
      storageModule: makeStorage(),
      builtInModules: [],
      enabledSlugs: new Set(),
      collectModuleDiagnostics: async () => ({}),
      diagnosticsRegistry: {},
      redact: 'minimal'
    })

    expect(bundle.system.env.JIRA_TOKEN_SET).toBe(true)
    // Token value should NOT appear anywhere in the bundle
    const json = JSON.stringify(bundle)
    expect(json).not.toContain('secret-value')

    if (origToken === undefined) delete process.env.JIRA_TOKEN
    else process.env.JIRA_TOKEN = origToken
  })

  it('aggressive mode anonymizes names from roster', async () => {
    const registry = {
      meta: {
        generatedAt: '2026-01-15T00:00:00.000Z',
        provider: 'test',
        orgRoots: ['orgA'],
        vp: { name: 'Jane VP', uid: 'janevp' }
      },
      people: {
        bobl: {
          uid: 'bobl', name: 'Bob Leader', email: 'bob@example.com',
          orgRoot: 'orgA', status: 'active', github: { username: 'bobgh', source: 'ldap' }, gitlab: null,
          firstSeenAt: '2026-01-01T00:00:00.000Z', lastSeenAt: '2026-01-15T00:00:00.000Z', inactiveSince: null
        },
        aliced: {
          uid: 'aliced', name: 'Alice Dev', email: 'alice@example.com',
          orgRoot: 'orgA', status: 'active', github: null, gitlab: null,
          firstSeenAt: '2026-01-01T00:00:00.000Z', lastSeenAt: '2026-01-15T00:00:00.000Z', inactiveSince: null
        }
      }
    }
    const config = { orgRoots: [{ uid: 'orgA', name: 'Bob Leader', displayName: 'Bob Leader' }] }

    const storage = makeStorage({
      'team-data/registry.json': registry,
      'team-data/config.json': config
    })

    // Simulate module diagnostics with a person name
    const bundle = await collect({
      storageModule: storage,
      builtInModules: [],
      enabledSlugs: new Set(),
      collectModuleDiagnostics: async () => ({
        test: { unresolvedNames: ['Bob Leader'] }
      }),
      diagnosticsRegistry: {},
      redact: 'aggressive'
    })

    const json = JSON.stringify(bundle)
    // Real names should not appear
    expect(json).not.toContain('Jane VP')
    expect(json).not.toContain('Bob Leader')
    expect(json).not.toContain('Alice Dev')
    expect(json).not.toContain('jane@example.com')
  })

  it('aggressive mode truncates Google Sheet ID', async () => {
    const storage = makeStorage({
      'team-data/registry.json': { meta: { generatedAt: '2026-01-15T00:00:00.000Z', provider: 'test', orgRoots: [], vp: null }, people: {} },
      'team-data/config.json': { orgRoots: [] }
    })

    const bundle = await collect({
      storageModule: storage,
      builtInModules: [],
      enabledSlugs: new Set(),
      collectModuleDiagnostics: async () => ({
        test: { config: { googleSheetId: '1abc-long-sheet-id-here' } }
      }),
      diagnosticsRegistry: {},
      redact: 'aggressive'
    })

    const json = JSON.stringify(bundle)
    expect(json).not.toContain('1abc-long-sheet-id-here')
    expect(json).toContain('placeholder-sheet-id')
  })

  it('minimal mode keeps names but strips secrets', async () => {
    const storage = makeStorage({})

    const bundle = await collect({
      storageModule: storage,
      builtInModules: [],
      enabledSlugs: new Set(),
      collectModuleDiagnostics: async () => ({
        test: { unresolvedNames: ['Real Person'], googleSheetId: '1abc-long-id' }
      }),
      diagnosticsRegistry: {},
      redact: 'minimal'
    })

    const json = JSON.stringify(bundle)
    expect(json).toContain('Real Person')
    expect(json).toContain('1abc...(redacted)')
    expect(json).not.toContain('1abc-long-id')
  })

  it('handles missing roster in aggressive mode gracefully', async () => {
    const storage = makeStorage({})

    const bundle = await collect({
      storageModule: storage,
      builtInModules: [],
      enabledSlugs: new Set(),
      collectModuleDiagnostics: async () => ({}),
      diagnosticsRegistry: {},
      redact: 'aggressive'
    })

    expect(bundle.redactionLevel).toBe('aggressive')
    expect(bundle.system).toBeDefined()
  })

  it('builtInModules reports enabled state correctly', async () => {
    const modules = makeModules()
    const bundle = await collect({
      storageModule: makeStorage(),
      builtInModules: modules,
      enabledSlugs: new Set(['team-tracker']),
      collectModuleDiagnostics: async () => ({}),
      diagnosticsRegistry: {},
      redact: 'minimal'
    })

    expect(bundle.builtInModules.enabledState['team-tracker']).toBe(true)
    expect(bundle.builtInModules.moduleManifests['team-tracker'].name).toBe('People & Teams')
  })
})
