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
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: { field_f1: 'backend' }
        },
        bob: {
          uid: 'bob', name: 'Bob', email: 'bob@example.com',
          title: 'SRE', status: 'active', managerUid: 'mgr1',
          orgRoot: 'org1', teamIds: ['team_a'],
          _appFields: {}
        }
      }
    },
    'team-data/teams.json': {
      teams: {
        team_a: { id: 'team_a', name: 'Alpha', orgKey: 'org1', metadata: { field_t1: 'val' }, boards: [{ url: 'https://board.example.com', name: 'Board' }] },
        team_b: { id: 'team_b', name: 'Beta', orgKey: 'org1', metadata: {}, boards: [] }
      }
    },
    'team-data/field-definitions.json': {
      personFields: [
        { id: 'field_f1', label: 'Focus Area', type: 'free-text', multiValue: false, required: false, visible: true, deleted: false, order: 0 }
      ],
      teamFields: [
        { id: 'field_t1', label: 'Sprint', type: 'free-text', multiValue: false, required: false, visible: true, deleted: false, order: 0 }
      ]
    },
    'team-data/field-exceptions.json': {
      version: 1,
      exceptions: [
        { id: 'fex_existing1', entityType: 'person', entityId: 'bob', fieldId: 'field_f1', reason: 'Contractor', createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      ]
    },
    'audit-log.json': { entries: [] }
  }
}

describe('field-exceptions routes', () => {
  describe('GET /field-exceptions', () => {
    it('returns all exceptions for admin', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = { query: {}, isAdmin: true, isTeamAdmin: false, isManager: false }
      const res = mockRes()
      handlers['GET /field-exceptions'](req, res)
      expect(res._body.exceptions).toHaveLength(1)
      expect(res._body.exceptions[0].id).toBe('fex_existing1')
    })

    it('filters by entityType', () => {
      const data = baseStorageData()
      data['team-data/field-exceptions.json'].exceptions.push(
        { id: 'fex_team1', entityType: 'team', entityId: 'team_b', fieldId: '__boards__', reason: 'no boards', createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      )
      const { handlers } = setupRoutes(data)
      const req = { query: { entityType: 'team' }, isAdmin: true, isTeamAdmin: false, isManager: false }
      const res = mockRes()
      handlers['GET /field-exceptions'](req, res)
      expect(res._body.exceptions).toHaveLength(1)
      expect(res._body.exceptions[0].entityType).toBe('team')
    })

    it('returns empty list for user tier', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = { query: {}, isAdmin: false, isTeamAdmin: false, isManager: false }
      const res = mockRes()
      handlers['GET /field-exceptions'](req, res)
      expect(res._body.exceptions).toHaveLength(0)
    })
  })

  describe('POST /field-exceptions', () => {
    it('creates a new person exception', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'person', entityId: 'alice', fieldId: 'field_f1', reason: 'Test reason' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(201)
      expect(res._body.exception.entityId).toBe('alice')
      expect(res._body.exception.reason).toBe('Test reason')
    })

    it('creates a team exception', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'team', entityId: 'team_a', fieldId: 'field_t1', reason: 'Not applicable' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(201)
      expect(res._body.exception.entityType).toBe('team')
    })

    it('creates a __boards__ exception for team', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'team', entityId: 'team_b', fieldId: '__boards__', reason: 'No boards needed' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(201)
      expect(res._body.exception.fieldId).toBe('__boards__')
    })

    it('upserts on duplicate tuple', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'person', entityId: 'bob', fieldId: 'field_f1', reason: 'Updated reason' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(200)
      expect(res._body.exception.id).toBe('fex_existing1')
      expect(res._body.exception.reason).toBe('Updated reason')
    })

    it('rejects invalid entityType', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'invalid', entityId: 'alice', fieldId: 'field_f1', reason: 'test' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('entityType')
    })

    it('rejects missing reason', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'person', entityId: 'alice', fieldId: 'field_f1', reason: '' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('reason')
    })

    it('rejects reason over 500 chars', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'person', entityId: 'alice', fieldId: 'field_f1', reason: 'x'.repeat(501) },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('500')
    })

    it('rejects non-existent person', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'person', entityId: 'nonexistent', fieldId: 'field_f1', reason: 'test' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('not found')
    })

    it('rejects non-existent team', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'team', entityId: 'team_nonexistent', fieldId: 'field_t1', reason: 'test' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('not found')
    })

    it('rejects deleted field', () => {
      const data = baseStorageData()
      data['team-data/field-definitions.json'].personFields[0].deleted = true
      const { handlers } = setupRoutes(data)
      const req = {
        body: { entityType: 'person', entityId: 'alice', fieldId: 'field_f1', reason: 'test' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('deleted')
    })

    it('rejects __boards__ with person entityType', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'person', entityId: 'alice', fieldId: '__boards__', reason: 'test' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('__boards__')
    })

    it('rejects non-existent fieldId', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = {
        body: { entityType: 'person', entityId: 'alice', fieldId: 'field_nonexistent', reason: 'test' },
        userEmail: 'admin@test.com'
      }
      const res = mockRes()
      handlers['POST /field-exceptions'](req, res)
      expect(res._status).toBe(400)
      expect(res._body.error).toContain('not found')
    })
  })

  describe('DELETE /field-exceptions/:id', () => {
    it('removes an existing exception', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = { params: { id: 'fex_existing1' }, userEmail: 'admin@test.com' }
      const res = mockRes()
      handlers['DELETE /field-exceptions/:id'](req, res)
      expect(res._body.removed).toBe(true)
    })

    it('returns 404 for non-existent exception', () => {
      const { handlers } = setupRoutes(baseStorageData())
      const req = { params: { id: 'fex_nonexistent' }, userEmail: 'admin@test.com' }
      const res = mockRes()
      handlers['DELETE /field-exceptions/:id'](req, res)
      expect(res._status).toBe(404)
    })
  })
})
