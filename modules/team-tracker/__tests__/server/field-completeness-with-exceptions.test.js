import { describe, it, expect, vi } from 'vitest'


function makeStorage(initial = {}) {
  const data = { ...initial }
  return {
    readFromStorage(key) { return data[key] ? JSON.parse(JSON.stringify(data[key])) : null },
    writeToStorage: vi.fn((key, val) => { data[key] = JSON.parse(JSON.stringify(val)) }),
    listStorageFiles(dir) {
      return Object.keys(data)
        .filter(k => k.startsWith(dir + '/') && k.endsWith('.json'))
        .map(k => k.split('/').pop())
    },
    deleteStorageDirectory: vi.fn(),
    _data: data
  }
}

// ─── Message Provider Tests ───

function setupAndGetProvider(storageData) {
  let capturedProvider = null

  const mockRouter = {
    get() {},
    post() {},
    put() {},
    patch() {},
    delete() {}
  }

  const storage = makeStorage(storageData)
  const mockRoleStore = {
    getRoles: vi.fn(() => []),
    isAdmin: vi.fn(() => false),
    isTeamAdmin: vi.fn(() => false)
  }

  const context = {
    storage,
    requireAdmin: (req, res, next) => next(),
    requireTeamAdmin: (req, res, next) => next(),
    requireScope: () => (req, res, next) => next(),
    roleStore: mockRoleStore,
    registerScopes: vi.fn(),
    registerMessageProvider(id, fn) {
      capturedProvider = { id, fn }
    }
  }

  const registerRoutes = require('../../server/index.js')
  registerRoutes(mockRouter, context)

  return { provider: capturedProvider, storage }
}

function baseStorageData() {
  return {
    'team-data/registry.json': {
      meta: { generatedAt: '2026-01-01', provider: 'test', orgRoots: ['org1'] },
      people: {
        mgr1: {
          uid: 'mgr1', name: 'Manager One', email: 'mgr1@example.com',
          title: 'Engineering Manager', status: 'active', managerUid: null,
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: { field_f1: 'backend' }
        },
        alice: {
          uid: 'alice', name: 'Alice', email: 'alice@example.com',
          title: 'Software Engineer', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: { field_f1: 'frontend' }
        },
        bob: {
          uid: 'bob', name: 'Bob', email: 'bob@example.com',
          title: 'SRE', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: {} // missing field_f1
        }
      }
    },
    'team-data/teams.json': {
      teams: {
        team_a: { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: { field_t1: 'Sprint 1' }, boards: [{ url: 'https://board.example.com/a' }] },
        team_b: { id: 'team_b', name: 'Beta', orgKey: 'org1', metadata: {}, boards: [] }
      }
    },
    'team-data/field-definitions.json': {
      personFields: [
        { id: 'field_f1', label: 'Focus Area', type: 'free-text', visible: true, deleted: false }
      ],
      teamFields: [
        { id: 'field_t1', label: 'Sprint', type: 'free-text', visible: true, deleted: false }
      ]
    },
    'team-data/config.json': {
      orgRoots: [{ uid: 'org1', displayName: 'Org One' }],
      teamDataSource: 'in-app'
    },
    'audit-log.json': { entries: [] }
  }
}

describe('field-completeness with exceptions — message provider', () => {
  it('counts person as incomplete when no exception exists', async () => {
    const data = baseStorageData()
    // Fill team data so only person incompleteness triggers
    data['team-data/teams.json'].teams.team_b.metadata = { field_t1: 'Sprint 2' }
    data['team-data/teams.json'].teams.team_b.boards = [{ url: 'https://board.example.com/b' }]

    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isManager: true, isAdmin: false, isTeamAdmin: false })
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('1 person')
  })

  it('excludes excepted person field from incompleteness count', async () => {
    const data = baseStorageData()
    // Fill team data
    data['team-data/teams.json'].teams.team_b.metadata = { field_t1: 'Sprint 2' }
    data['team-data/teams.json'].teams.team_b.boards = [{ url: 'https://board.example.com/b' }]
    // Add exception for bob's missing field_f1
    data['team-data/field-exceptions.json'] = {
      version: 1,
      exceptions: [
        { id: 'fex_1', entityType: 'person', entityId: 'bob', fieldId: 'field_f1', reason: 'Contractor', createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      ]
    }

    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isManager: true, isAdmin: false, isTeamAdmin: false })
    // bob's missing field is excepted, so no warnings
    expect(result).toEqual([])
  })

  it('excludes excepted team boards (__boards__ sentinel)', async () => {
    const data = baseStorageData()
    // All person fields filled
    data['team-data/registry.json'].people.bob._appFields = { field_f1: 'devops' }
    // Put bob on team_b so it's in mgr1's purview
    data['team-data/registry.json'].people.bob.teamIds = ['team_a', 'team_b']
    // team_b has no boards and no field_t1 — add exception for boards only
    data['team-data/field-exceptions.json'] = {
      version: 1,
      exceptions: [
        { id: 'fex_2', entityType: 'team', entityId: 'team_b', fieldId: '__boards__', reason: 'No boards needed', createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      ]
    }

    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isManager: true, isAdmin: false, isTeamAdmin: false })
    // team_b still has missing field_t1, so warning remains
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('1 team')
    expect(result[0].text).not.toContain('people')
  })

  it('excludes excepted team field from incompleteness count', async () => {
    const data = baseStorageData()
    // All person fields filled
    data['team-data/registry.json'].people.bob._appFields = { field_f1: 'devops' }
    // Put bob on team_b so it's in mgr1's purview
    data['team-data/registry.json'].people.bob.teamIds = ['team_a', 'team_b']
    // Exception for team_b boards AND field_t1
    data['team-data/field-exceptions.json'] = {
      version: 1,
      exceptions: [
        { id: 'fex_2', entityType: 'team', entityId: 'team_b', fieldId: '__boards__', reason: 'No boards', createdAt: '2026-01-01', createdBy: 'admin@test.com' },
        { id: 'fex_3', entityType: 'team', entityId: 'team_b', fieldId: 'field_t1', reason: 'Not applicable', createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      ]
    }

    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isManager: true, isAdmin: false, isTeamAdmin: false })
    // All empty fields are excepted — no warnings
    expect(result).toEqual([])
  })
})

// ─── Field Completeness Endpoint Tests ───

function setupRoutes(storageData) {
  const handlers = {}
  const mockRouter = {
    get(path, ...args) { handlers[`GET ${path}`] = args[args.length - 1] },
    post(path, ...args) { handlers[`POST ${path}`] = args[args.length - 1] },
    put(path, ...args) { handlers[`PUT ${path}`] = args[args.length - 1] },
    patch(path, ...args) { handlers[`PATCH ${path}`] = args[args.length - 1] },
    delete(path, ...args) { handlers[`DELETE ${path}`] = args[args.length - 1] }
  }

  const storage = makeStorage(storageData)
  const mockRoleStore = {
    getRoles: vi.fn(() => []),
    isAdmin: vi.fn(() => false),
    isTeamAdmin: vi.fn(() => false)
  }

  const context = {
    storage,
    requireAdmin: (req, res, next) => next(),
    requireTeamAdmin: (req, res, next) => next(),
    requireScope: () => (req, res, next) => next(),
    roleStore: mockRoleStore,
    registerScopes: vi.fn()
  }

  const registerRoutes = require('../../server/index.js')
  registerRoutes(mockRouter, context)

  return { handlers, storage }
}

function mockRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) { res._status = code; return res },
    json(body) { res._body = body; return res }
  }
  return res
}

describe('field-completeness endpoint — includes fieldExceptions', () => {
  it('includes fieldExceptions array in response', () => {
    const data = baseStorageData()
    data['team-data/field-exceptions.json'] = {
      version: 1,
      exceptions: [
        { id: 'fex_1', entityType: 'person', entityId: 'bob', fieldId: 'field_f1', reason: 'Contractor', createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      ]
    }
    const { handlers } = setupRoutes(data)
    const req = { isAdmin: true, isTeamAdmin: false, isManager: false, query: {} }
    const res = mockRes()
    handlers['GET /admin/field-completeness'](req, res)
    expect(res._body.fieldExceptions).toBeDefined()
    expect(res._body.fieldExceptions).toHaveLength(1)
    expect(res._body.fieldExceptions[0].id).toBe('fex_1')
  })

  it('returns empty fieldExceptions when no file exists', () => {
    const data = baseStorageData()
    const { handlers } = setupRoutes(data)
    const req = { isAdmin: true, isTeamAdmin: false, isManager: false, query: {} }
    const res = mockRes()
    handlers['GET /admin/field-completeness'](req, res)
    expect(res._body.fieldExceptions).toBeDefined()
    expect(res._body.fieldExceptions).toEqual([])
  })
})

describe('manager dashboard — includes fieldExceptions', () => {
  it('includes fieldExceptions filtered to manager purview', () => {
    const data = baseStorageData()
    data['team-data/field-exceptions.json'] = {
      version: 1,
      exceptions: [
        { id: 'fex_1', entityType: 'person', entityId: 'bob', fieldId: 'field_f1', reason: 'Contractor', createdAt: '2026-01-01', createdBy: 'admin@test.com' },
        { id: 'fex_2', entityType: 'person', entityId: 'unrelated', fieldId: 'field_f1', reason: 'Other', createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      ]
    }
    const { handlers } = setupRoutes(data)
    const req = {
      userUid: 'mgr1',
      userEmail: 'mgr1@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      isManager: true,
      query: {}
    }
    const res = mockRes()
    handlers['GET /manager/dashboard'](req, res)
    // Only bob's exception should be included (alice and bob are mgr1's reports)
    expect(res._body.fieldExceptions).toBeDefined()
    const personExceptions = res._body.fieldExceptions.filter(e => e.entityType === 'person')
    expect(personExceptions.every(e => ['alice', 'bob'].includes(e.entityId))).toBe(true)
    // The 'unrelated' exception should not be included
    expect(res._body.fieldExceptions.find(e => e.entityId === 'unrelated')).toBeUndefined()
  })
})
