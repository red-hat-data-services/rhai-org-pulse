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
        },
        charlie: {
          uid: 'charlie', name: 'Charlie', email: 'charlie@example.com',
          title: 'QE', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: ['team_b'],
          _appFields: {} // missing field_f1
        },
        inactive: {
          uid: 'inactive', name: 'Inactive', email: 'inactive@example.com',
          title: 'Dev', status: 'inactive', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: [],
          _appFields: {}
        },
        nonmgr: {
          uid: 'nonmgr', name: 'Non Manager', email: 'nonmgr@example.com',
          title: 'Developer', status: 'active', managerUid: 'alice',
          orgRoot: 'org1', teamIds: [],
          _appFields: {}
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

describe('field-completeness message provider', () => {
  it('registers a provider with the expected ID', () => {
    const { provider } = setupAndGetProvider(baseStorageData())
    expect(provider).not.toBeNull()
    expect(provider.id).toBe('team-tracker:field-completeness')
    expect(typeof provider.fn).toBe('function')
  })

  it('returns empty array when user.uid is null', async () => {
    const { provider } = setupAndGetProvider(baseStorageData())
    const result = await provider.fn({ uid: null, isAdmin: true, isTeamAdmin: false, isManager: false })
    expect(result).toEqual([])
  })

  it('returns empty array when user is not admin/team-admin/manager (early bailout)', async () => {
    const { provider } = setupAndGetProvider(baseStorageData())
    const result = await provider.fn({ uid: 'nonmgr', isAdmin: false, isTeamAdmin: false, isManager: false })
    expect(result).toEqual([])
  })

  it('returns empty array for non-managers with no direct reports', async () => {
    const { provider } = setupAndGetProvider(baseStorageData())
    // alice has no direct reports in the base data (nonmgr reports to alice, let's use someone without reports)
    const result = await provider.fn({ uid: 'charlie', isAdmin: false, isTeamAdmin: true, isManager: false })
    expect(result).toEqual([])
  })

  it('returns empty array when all visible fields are populated', async () => {
    const data = baseStorageData()
    // Fill all fields for mgr1's direct reports
    data['team-data/registry.json'].people.alice._appFields = { field_f1: 'frontend' }
    data['team-data/registry.json'].people.bob._appFields = { field_f1: 'backend' }
    data['team-data/registry.json'].people.charlie._appFields = { field_f1: 'qa' }
    // Fill team fields and boards
    data['team-data/teams.json'].teams.team_a.metadata = { field_t1: 'Sprint 1' }
    data['team-data/teams.json'].teams.team_b.metadata = { field_t1: 'Sprint 2' }
    data['team-data/teams.json'].teams.team_b.boards = [{ url: 'https://board.example.com/b' }]
    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result).toEqual([])
  })

  it('returns warning message with correct person count', async () => {
    const data = baseStorageData()
    // team fields and boards all filled
    data['team-data/teams.json'].teams.team_a.metadata = { field_t1: 'Sprint 1' }
    data['team-data/teams.json'].teams.team_b.metadata = { field_t1: 'Sprint 2' }
    data['team-data/teams.json'].teams.team_b.boards = [{ url: 'https://board.example.com/b' }]
    // bob and charlie have empty field_f1
    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('2 people')
    expect(result[0].text).not.toContain('team')
  })

  it('returns warning message with correct team count', async () => {
    const data = baseStorageData()
    // All person fields filled
    data['team-data/registry.json'].people.alice._appFields = { field_f1: 'a' }
    data['team-data/registry.json'].people.bob._appFields = { field_f1: 'b' }
    data['team-data/registry.json'].people.charlie._appFields = { field_f1: 'c' }
    // team_b has empty metadata
    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('1 team')
    expect(result[0].text).not.toContain('people')
  })

  it('returns combined message when both people and teams are incomplete', async () => {
    const { provider } = setupAndGetProvider(baseStorageData())
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('people')
    expect(result[0].text).toContain('team')
    expect(result[0].text).toContain('and')
  })

  it('uses correct singular/plural: "1 person has"', async () => {
    const data = baseStorageData()
    // Only bob has empty field, alice and charlie filled
    data['team-data/registry.json'].people.alice._appFields = { field_f1: 'a' }
    data['team-data/registry.json'].people.charlie._appFields = { field_f1: 'c' }
    // Fill all team fields and boards
    data['team-data/teams.json'].teams.team_a.metadata = { field_t1: 's1' }
    data['team-data/teams.json'].teams.team_b.metadata = { field_t1: 's2' }
    data['team-data/teams.json'].teams.team_b.boards = [{ url: 'https://board.example.com/b' }]
    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('1 person has incomplete fields.')
  })

  it('uses correct combined verb: "1 person and 1 team have"', async () => {
    const data = baseStorageData()
    // Only bob has empty person field
    data['team-data/registry.json'].people.alice._appFields = { field_f1: 'a' }
    data['team-data/registry.json'].people.charlie._appFields = { field_f1: 'c' }
    // team_a filled, team_b empty
    data['team-data/teams.json'].teams.team_a.metadata = { field_t1: 's1' }
    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('1 person and 1 team have incomplete fields.')
  })

  it('skips deleted and non-visible fields', async () => {
    const data = baseStorageData()
    data['team-data/field-definitions.json'].personFields = [
      { id: 'field_f1', label: 'Focus', type: 'free-text', visible: true, deleted: true },
      { id: 'field_f2', label: 'Hidden', type: 'free-text', visible: false, deleted: false }
    ]
    data['team-data/field-definitions.json'].teamFields = [
      { id: 'field_t1', label: 'Sprint', type: 'free-text', visible: true, deleted: true }
    ]
    // Fill boards so only custom field visibility matters
    data['team-data/teams.json'].teams.team_b.boards = [{ url: 'https://board.example.com/b' }]
    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    // No visible non-deleted fields and boards are filled, so nothing to check
    expect(result).toEqual([])
  })

  it('counts teams with empty boards as incomplete', async () => {
    const data = baseStorageData()
    // Fill all person and team custom fields
    data['team-data/registry.json'].people.alice._appFields = { field_f1: 'a' }
    data['team-data/registry.json'].people.bob._appFields = { field_f1: 'b' }
    data['team-data/registry.json'].people.charlie._appFields = { field_f1: 'c' }
    data['team-data/teams.json'].teams.team_a.metadata = { field_t1: 's1' }
    data['team-data/teams.json'].teams.team_b.metadata = { field_t1: 's2' }
    // team_a has boards (from base), team_b has empty boards
    const { provider } = setupAndGetProvider(data)
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('1 team has incomplete fields.')
  })

  it('message includes link to manager dashboard', async () => {
    const { provider } = setupAndGetProvider(baseStorageData())
    const result = await provider.fn({ uid: 'mgr1', isAdmin: false, isTeamAdmin: false, isManager: true })
    expect(result[0].link).toEqual({
      label: 'Review',
      href: '#/team-tracker/manager-dashboard'
    })
  })
})
