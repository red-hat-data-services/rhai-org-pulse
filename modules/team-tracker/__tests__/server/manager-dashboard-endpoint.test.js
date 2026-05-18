import { describe, it, expect, vi } from 'vitest'

// Mock node-fetch (required by transitive imports)
vi.mock('node-fetch', () => ({ default: vi.fn() }))

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
  const middlewareMap = {}
  const mockRouter = {
    get(path, ...args) {
      const handler = args[args.length - 1]
      const middleware = args.length > 2 ? args.slice(0, -1) : []
      handlers[`GET ${path}`] = handler
      middlewareMap[`GET ${path}`] = middleware
    },
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
    roleStore: mockRoleStore
  }

  const registerRoutes = require('../../server/index.js')
  registerRoutes(mockRouter, context)

  return { handlers, storage, middlewareMap }
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
        mgr1: {
          uid: 'mgr1', name: 'Manager One', email: 'mgr1@example.com',
          title: 'Engineering Manager', status: 'active', managerUid: null,
          orgRoot: 'org1', teamIds: [],
          _appFields: {}
        },
        alice: {
          uid: 'alice', name: 'Alice', email: 'alice@example.com',
          title: 'Software Engineer', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: { field_f1: 'backend' }
        },
        bob: {
          uid: 'bob', name: 'Bob', email: 'bob@example.com',
          title: 'SRE', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: { field_f1: 'frontend' }
        },
        charlie: {
          uid: 'charlie', name: 'Charlie', email: 'charlie@example.com',
          title: 'QE', status: 'active', managerUid: 'other',
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: {}
        },
        nonmgr: {
          uid: 'nonmgr', name: 'Non Manager', email: 'nonmgr@example.com',
          title: 'Developer', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: ['team_b'],
          _appFields: {}
        }
      }
    },
    'team-data/teams.json': {
      teams: {
        team_a: { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: { sprint: '42' }, boards: [{ url: 'https://board.example.com', name: 'Board' }] },
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

describe('GET /manager/dashboard', () => {
  it('returns correct purview for a manager', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'mgr1',
      userEmail: 'mgr1@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      permissionTier: 'manager'
    }

    handlers['GET /manager/dashboard'](req, res)

    expect(res._status).toBe(200)
    expect(res._body.manager).toEqual({
      uid: 'mgr1',
      name: 'Manager One',
      email: 'mgr1@example.com'
    })
    expect(res._body.directReports).toHaveLength(3) // alice, bob, nonmgr
    expect(res._body.teams).toHaveLength(2) // team_a, team_b
    expect(res._body.fieldDefinitions.person).toHaveLength(1)
    expect(res._body.fieldDefinitions.team).toHaveLength(1)
    expect(res._body.reason).toBeUndefined()
  })

  it('returns 200 with reason "no-registry-identity" when req.userUid is null', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: null,
      userEmail: 'nobody@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      permissionTier: 'user'
    }

    handlers['GET /manager/dashboard'](req, res)

    expect(res._status).toBe(200)
    expect(res._body.reason).toBe('no-registry-identity')
    expect(res._body.manager).toBeNull()
    expect(res._body.directReports).toEqual([])
    expect(res._body.teams).toEqual([])
  })

  it('returns 200 with reason "no-direct-reports" for admin with no reports', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'charlie',
      userEmail: 'charlie@example.com',
      isAdmin: true,
      isTeamAdmin: false,
      permissionTier: 'admin'
    }

    handlers['GET /manager/dashboard'](req, res)

    expect(res._status).toBe(200)
    expect(res._body.reason).toBe('no-direct-reports')
    expect(res._body.directReports).toEqual([])
    expect(res._body.teams).toEqual([])
  })

  it('returns 403 for user tier (not a manager)', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'charlie',
      userEmail: 'charlie@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      permissionTier: 'user'
    }

    handlers['GET /manager/dashboard'](req, res)

    expect(res._status).toBe(403)
    expect(res._body.error).toBe('You are not a manager')
  })

  it('populates customFields from _appFields using field definitions', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'mgr1',
      userEmail: 'mgr1@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      permissionTier: 'manager'
    }

    handlers['GET /manager/dashboard'](req, res)

    const alice = res._body.directReports.find(r => r.uid === 'alice')
    expect(alice.customFields).toEqual({ field_f1: 'backend' })

    const bob = res._body.directReports.find(r => r.uid === 'bob')
    expect(bob.customFields).toEqual({ field_f1: 'frontend' })
  })

  it('directReportUids contains only direct reports, not all team members', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'mgr1',
      userEmail: 'mgr1@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      permissionTier: 'manager'
    }

    handlers['GET /manager/dashboard'](req, res)

    const teamA = res._body.teams.find(t => t.id === 'team_a')
    expect(teamA.directReportUids).toEqual(expect.arrayContaining(['alice', 'bob']))
    expect(teamA.directReportUids).not.toContain('charlie')
  })

  it('totalMemberCount reflects all team members, not just direct reports', () => {
    const { handlers } = setupRoutes(baseStorageData())
    const res = mockRes()
    const req = {
      userUid: 'mgr1',
      userEmail: 'mgr1@example.com',
      isAdmin: false,
      isTeamAdmin: false,
      permissionTier: 'manager'
    }

    handlers['GET /manager/dashboard'](req, res)

    const teamA = res._body.teams.find(t => t.id === 'team_a')
    // alice, bob (direct reports) + charlie (not a report) = 3
    expect(teamA.totalMemberCount).toBe(3)
  })
})
