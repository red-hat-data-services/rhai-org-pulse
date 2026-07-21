import { describe, it, expect, vi } from 'vitest'

const registerHygieneRoutes = require('../../../server/hygiene/routes')

function makeStorage(data = {}) {
  var store = { ...data }
  return {
    async readFromStorage(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    async writeToStorage(key, value) {
      store[key] = value
    },
    async listStorageFiles(prefix) {
      return Object.keys(store)
        .filter(k => k.startsWith(prefix + '/'))
        .map(k => k.slice(prefix.length + 1))
    }
  }
}

function makeRouter() {
  var routes = { get: {}, post: {} }
  return {
    get: vi.fn(function (path, ...handlers) {
      routes.get[path] = handlers
    }),
    post: vi.fn(function (path, ...handlers) {
      routes.post[path] = handlers
    }),
    _routes: routes
  }
}

function makeRes() {
  var res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res }
  }
  return res
}

function hygieneFeatureData(version) {
  return {
    version: version,
    fetchedAt: '2026-07-01T00:00:00Z',
    features: {
      'TEST-1': {
        key: 'TEST-1',
        summary: 'Test feature',
        issueType: 'Feature',
        status: 'In Progress',
        team: 'Team A',
        assignee: 'dev@example.com'
      }
    }
  }
}

describe('GET /program-report', () => {
  let router, context

  async function setup(storageData) {
    router = makeRouter()
    context = {
      storage: makeStorage(storageData),
      requireAuth: (req, res, next) => next(),
      requirePlanningManager: (req, res, next) => next(),
      requireScope: () => (req, res, next) => next(),
      registerDiagnostics: vi.fn(),
      isRefreshRunning: () => false
    }
    await registerHygieneRoutes(router, context)
  }

  async function callProgramReport() {
    var handler = router._routes.get['/program-report'].at(-1)
    var res = makeRes()
    await handler({}, res)
    return res
  }

  it('uses displayName from registry when matched by id', async () => {
    await setup({
      'releases/registry.json': {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-2.14', displayName: 'RHOAI 2.14', state: 'active' }
        ]
      },
      'releases/hygiene/features-rhoai-2.14.json': hygieneFeatureData('rhoai-2.14')
    })

    var res = await callProgramReport()
    expect(res._json.versions).toHaveLength(1)
    expect(res._json.versions[0].displayName).toBe('RHOAI 2.14')
  })

  it('uses displayName from registry when matched by fixVersions', async () => {
    await setup({
      'releases/registry.json': {
        schemaVersion: 1,
        releases: [
          {
            id: 'rhoai-2.14',
            displayName: 'RHOAI 2.14',
            fixVersions: ['RHOAI-2.14', 'rhoai-2.14'],
            state: 'active'
          }
        ]
      },
      'releases/hygiene/features-RHOAI-2.14.json': hygieneFeatureData('RHOAI-2.14')
    })

    var res = await callProgramReport()
    expect(res._json.versions).toHaveLength(1)
    expect(res._json.versions[0].displayName).toBe('RHOAI 2.14')
  })

  it('uses displayName from registry when matched by displayName', async () => {
    await setup({
      'releases/registry.json': {
        schemaVersion: 1,
        releases: [
          { id: 'rhoai-2.14', displayName: 'RHOAI 2.14', state: 'active' }
        ]
      },
      'releases/hygiene/features-RHOAI 2.14.json': hygieneFeatureData('RHOAI 2.14')
    })

    var res = await callProgramReport()
    expect(res._json.versions).toHaveLength(1)
    expect(res._json.versions[0].displayName).toBe('RHOAI 2.14')
  })

  it('formats versionId as fallback when no registry match', async () => {
    await setup({
      'releases/registry.json': { schemaVersion: 1, releases: [] },
      'releases/hygiene/features-rhoai-3.5.EA1.json': hygieneFeatureData(null)
    })

    var res = await callProgramReport()
    expect(res._json.versions).toHaveLength(1)
    expect(res._json.versions[0].displayName).toBe('RHOAI 3.5.EA1')
  })

  it('formats uppercase product prefix correctly', async () => {
    await setup({
      'releases/registry.json': { schemaVersion: 1, releases: [] },
      'releases/hygiene/features-RHAII-3.5.json': hygieneFeatureData(null)
    })

    var res = await callProgramReport()
    expect(res._json.versions[0].displayName).toBe('RHAII 3.5')
  })

  it('uses data.version as fallback before formatVersionId', async () => {
    await setup({
      'releases/registry.json': { schemaVersion: 1, releases: [] },
      'releases/hygiene/features-custom-id.json': hygieneFeatureData('Custom Display Name')
    })

    var res = await callProgramReport()
    expect(res._json.versions[0].displayName).toBe('Custom Display Name')
  })

  it('returns gaDate and isReleased from registry match via fixVersions', async () => {
    await setup({
      'releases/registry.json': {
        schemaVersion: 1,
        releases: [
          {
            id: 'rhoai-2.13',
            displayName: 'RHOAI 2.13',
            fixVersions: ['RHOAI-2.13'],
            milestones: { ga: '2020-01-01' },
            state: 'archived'
          }
        ]
      },
      'releases/hygiene/features-RHOAI-2.13.json': hygieneFeatureData('RHOAI-2.13')
    })

    var res = await callProgramReport()
    expect(res._json.versions[0].gaDate).toBe('2020-01-01')
    expect(res._json.versions[0].isReleased).toBe(true)
  })

  it('skips files with no features', async () => {
    await setup({
      'releases/registry.json': { schemaVersion: 1, releases: [] },
      'releases/hygiene/features-empty.json': { version: 'empty', fetchedAt: '2026-01-01', features: {} }
    })

    var res = await callProgramReport()
    expect(res._json.versions).toHaveLength(0)
  })
})
