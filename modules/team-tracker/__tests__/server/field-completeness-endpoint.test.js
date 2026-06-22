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

function baseStorageData() {
  return {
    'team-data/registry.json': {
      meta: { generatedAt: '2026-01-01', provider: 'test', orgRoots: ['org1'] },
      people: {
        alice: {
          uid: 'alice', name: 'Alice', email: 'alice@example.com',
          title: 'Software Engineer', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', orgType: 'engineering', teamIds: ['team_a'],
          _appFields: { field_f1: 'backend' }
        },
        bob: {
          uid: 'bob', name: 'Bob', email: 'bob@example.com',
          title: 'SRE', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', orgType: 'engineering', teamIds: ['team_a'],
          _appFields: { field_f1: '' }
        },
        inactive: {
          uid: 'inactive', name: 'Gone', email: 'gone@example.com',
          title: 'Former', status: 'inactive', managerUid: null,
          orgRoot: 'org1', teamIds: [],
          _appFields: {}
        },
        pmcarol: {
          uid: 'pmcarol', name: 'Carol', email: 'carol@example.com',
          title: 'Product Manager', status: 'active', managerUid: null,
          orgRoot: 'org1', orgType: 'auxiliary', teamIds: [],
          _appFields: {}
        }
      }
    },
    'team-data/teams.json': {
      teams: {
        team_a: { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: { field_t1: 'sprint-42' }, boards: [{ url: 'https://board.example.com', name: 'Board' }] },
        team_b: { id: 'team_b', name: 'Beta', orgKey: 'org2', metadata: {}, boards: [] }
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

describe('GET /admin/field-completeness', () => {
  it('returns 403 for regular users', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)
    expect(res._status).toBe(403)
  })

  it('returns 403 for managers who are not team-admins', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'mgr1',
      userEmail: 'mgr1@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      isManager: true
    }

    handlers['GET /admin/field-completeness'](req, res)
    expect(res._status).toBe(403)
  })

  it('returns all active people for team-admins', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: false,
      isTeamAdmin: true,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    expect(res._status).toBe(200)
    // Should include alice and bob (active), not inactive
    expect(res._body.people).toHaveLength(2)
    expect(res._body.people.map(p => p.uid).sort()).toEqual(['alice', 'bob'])
  })

  it('returns all teams for admins', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    expect(res._status).toBe(200)
    expect(res._body.teams).toHaveLength(2)
    expect(res._body.teams.map(t => t.name).sort()).toEqual(['Alpha', 'Beta'])
  })

  it('populates customFields from _appFields', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    const alice = res._body.people.find(p => p.uid === 'alice')
    expect(alice.customFields).toEqual({ field_f1: 'backend' })

    const bob = res._body.people.find(p => p.uid === 'bob')
    // Empty string in _appFields becomes null via enrichPerson's `|| null` fallback
    expect(bob.customFields).toEqual({ field_f1: null })
  })

  it('returns field definitions', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    expect(res._body.fieldDefinitions.person).toHaveLength(1)
    expect(res._body.fieldDefinitions.person[0].id).toBe('field_f1')
    expect(res._body.fieldDefinitions.team).toHaveLength(1)
  })

  it('returns org keys from teams', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    expect(res._body.orgKeys).toHaveLength(2)
    expect(res._body.orgKeys.map(o => o.key).sort()).toEqual(['org1', 'org2'])
  })

  it('returns allPeople list for autocomplete', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    // allPeople includes all active people (including auxiliary) for autocomplete
    expect(res._body.allPeople).toHaveLength(3)
    expect(res._body.allPeople.every(p => p.uid && p.name)).toBe(true)
  })

  it('excludes auxiliary people from the people list', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    const uids = res._body.people.map(p => p.uid)
    expect(uids).toContain('alice')
    expect(uids).toContain('bob')
    expect(uids).not.toContain('pmcarol')
  })

  it('returns empty data when registry is missing', () => {
    const data = baseStorageData()
    delete data['team-data/registry.json']
    const { handlers } = setupRoutes(data)
    const res = mockRes()
    const req = {
      userUid: 'alice',
      userEmail: 'alice@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      isManager: false
    }

    handlers['GET /admin/field-completeness'](req, res)

    expect(res._status).toBe(200)
    expect(res._body.people).toEqual([])
    expect(res._body.teams).toEqual([])
  })
})
