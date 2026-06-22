import { describe, it, expect, vi, beforeAll } from 'vitest'


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
  const context = {
    storage,
    requireAdmin: (req, res, next) => next(),
    requireTeamAdmin: (req, res, next) => next(),
    requireScope: () => (req, res, next) => next(),
    roleStore: {
      getRoles: vi.fn(() => []),
      isAdmin: vi.fn(() => false),
      isTeamAdmin: vi.fn(() => false)
    },
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
    'team-data/field-definitions.json': {
      personFields: [],
      teamFields: [
        {
          id: 'field_comp', label: 'Component', type: 'constrained', multiValue: true,
          required: false, visible: true, primaryDisplay: false, allowedValues: [],
          deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com',
          optionsRef: 'component'
        },
        {
          id: 'field_status', label: 'Status', type: 'constrained', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: ['Active', 'Sunset'],
          deleted: false, order: 1, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        },
        {
          id: 'field_deleted', label: 'OldField', type: 'free-text', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: [],
          deleted: true, order: 2, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        }
      ]
    },
    'team-data/teams.json': {
      teams: {
        team_a: {
          id: 'team_a', name: 'Pipelines', orgKey: 'org1',
          createdAt: '2026-01-01', createdBy: 'admin@test.com',
          metadata: { field_comp: ['AI Pipelines', 'MLflow'], field_status: 'Active' },
          boards: []
        },
        team_b: {
          id: 'team_b', name: 'Serving', orgKey: 'org1',
          createdAt: '2026-01-01', createdBy: 'admin@test.com',
          metadata: { field_comp: ['Model Serving'], field_status: 'Active' },
          boards: []
        },
        team_c: {
          id: 'team_c', name: 'Legacy', orgKey: 'org2',
          createdAt: '2026-01-01', createdBy: 'admin@test.com',
          metadata: { field_comp: ['AI Pipelines'], field_status: 'Sunset' },
          boards: []
        },
        team_d: {
          id: 'team_d', name: 'Empty', orgKey: 'org1',
          createdAt: '2026-01-01', createdBy: 'admin@test.com',
          metadata: {},
          boards: []
        }
      }
    },
    'team-data/registry.json': {
      meta: { generatedAt: '2026-01-01', provider: 'test', orgRoots: ['org1'] },
      people: {}
    },
    'audit-log.json': { entries: [] }
  }
}

function callHandler(handler, query = {}) {
  const req = { query, auditActor: 'test@test.com' }
  const res = mockRes()
  handler(req, res)
  return res
}

describe('GET /structure/teams/query', () => {
  let handlers

  beforeAll(() => {
    const setup = setupRoutes(baseStorageData())
    handlers = setup.handlers
  })

  function query(params = {}) {
    return callHandler(handlers['GET /structure/teams/query'], params)
  }

  describe('no filters', () => {
    it('returns all teams when no filter is provided', () => {
      const res = query()
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(4)
      expect(res._body.teams).toHaveLength(4)
    })
  })

  describe('filter by field ID', () => {
    it('matches teams with array metadata containing the value', () => {
      const res = query({ filter: 'field_comp:AI Pipelines' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(2)
      const names = res._body.teams.map(t => t.name).sort()
      expect(names).toEqual(['Legacy', 'Pipelines'])
    })

    it('matches teams with scalar metadata', () => {
      const res = query({ filter: 'field_status:Active' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(2)
      const names = res._body.teams.map(t => t.name).sort()
      expect(names).toEqual(['Pipelines', 'Serving'])
    })

    it('returns empty when no teams match', () => {
      const res = query({ filter: 'field_comp:Nonexistent' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(0)
      expect(res._body.teams).toEqual([])
    })
  })

  describe('filter by label', () => {
    it('resolves field by label with label: prefix', () => {
      const res = query({ filter: 'label:Component:Model Serving' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(1)
      expect(res._body.teams[0].name).toBe('Serving')
    })

    it('is case-insensitive on label', () => {
      const res = query({ filter: 'label:component:Model Serving' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(1)
    })

    it('rejects unknown label', () => {
      const res = query({ filter: 'label:Bogus:value' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/No team field found/)
    })

    it('rejects label missing value after colon', () => {
      const res = query({ filter: 'label:Component' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/missing value/)
    })
  })

  describe('case-insensitive value matching', () => {
    it('matches regardless of case', () => {
      const res = query({ filter: 'field_comp:ai pipelines' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(2)
    })

    it('matches scalar values case-insensitively', () => {
      const res = query({ filter: 'field_status:active' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(2)
    })
  })

  describe('multiple filters', () => {
    it('ANDs filters by default (match=all)', () => {
      const res = query({ filter: ['field_comp:AI Pipelines', 'field_status:Active'] })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(1)
      expect(res._body.teams[0].name).toBe('Pipelines')
    })

    it('ORs filters with match=any', () => {
      const res = query({ filter: ['field_comp:Model Serving', 'field_status:Sunset'], match: 'any' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(2)
      const names = res._body.teams.map(t => t.name).sort()
      expect(names).toEqual(['Legacy', 'Serving'])
    })

    it('same-field multi-filter with match=all requires team to have ALL values', () => {
      const res = query({ filter: ['field_comp:AI Pipelines', 'field_comp:MLflow'], match: 'all' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(1)
      expect(res._body.teams[0].name).toBe('Pipelines')
    })

    it('same-field multi-filter with match=any matches teams with either value', () => {
      const res = query({ filter: ['field_comp:AI Pipelines', 'field_comp:Model Serving'], match: 'any' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(3)
    })
  })

  describe('pagination', () => {
    it('respects limit', () => {
      const res = query({ limit: '2' })
      expect(res._status).toBe(200)
      expect(res._body.teams).toHaveLength(2)
      expect(res._body.total).toBe(4)
      expect(res._body.limit).toBe(2)
    })

    it('respects offset', () => {
      const res = query({ limit: '2', offset: '2' })
      expect(res._status).toBe(200)
      expect(res._body.teams).toHaveLength(2)
      expect(res._body.total).toBe(4)
      expect(res._body.offset).toBe(2)
    })

    it('clamps limit to max 1000', () => {
      const res = query({ limit: '9999' })
      expect(res._body.limit).toBe(1000)
    })

    it('defaults limit to 200 and offset to 0', () => {
      const res = query()
      expect(res._body.limit).toBe(200)
      expect(res._body.offset).toBe(0)
    })
  })

  describe('first-colon splitting', () => {
    it('handles values containing colons (split on first colon only)', () => {
      // Set up a team with a URL-like value
      const data = baseStorageData()
      data['team-data/teams.json'].teams.team_a.metadata.field_status = 'https://example.com'
      const { handlers: h } = setupRoutes(data)
      const res = callHandler(h['GET /structure/teams/query'], { filter: 'field_status:https://example.com' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(1)
      expect(res._body.teams[0].name).toBe('Pipelines')
    })

    it('handles label filter values containing colons', () => {
      const data = baseStorageData()
      data['team-data/teams.json'].teams.team_a.metadata.field_status = 'val:with:colons'
      const { handlers: h } = setupRoutes(data)
      const res = callHandler(h['GET /structure/teams/query'], { filter: 'label:Status:val:with:colons' })
      expect(res._status).toBe(200)
      expect(res._body.total).toBe(1)
    })
  })

  describe('error handling', () => {
    it('rejects unknown field ID', () => {
      const res = query({ filter: 'field_unknown:value' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/Unknown team field ID/)
    })

    it('rejects filter without colon separator', () => {
      const res = query({ filter: 'novalue' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/expected fieldId:value/)
    })

    it('rejects invalid match mode', () => {
      const res = query({ filter: 'field_status:Active', match: 'invalid' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/match must be/)
    })

    it('ignores deleted field definitions', () => {
      const res = query({ filter: 'field_deleted:anything' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/Unknown team field ID/)
    })

    it('ignores deleted fields in label lookup', () => {
      const res = query({ filter: 'label:OldField:anything' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/No team field found/)
    })
  })

  describe('teams with no metadata', () => {
    it('skips teams with empty metadata', () => {
      const res = query({ filter: 'field_comp:AI Pipelines' })
      const names = res._body.teams.map(t => t.name)
      expect(names).not.toContain('Empty')
    })
  })

  describe('ambiguous labels', () => {
    it('returns 400 when multiple fields share the same label', () => {
      const data = baseStorageData()
      data['team-data/field-definitions.json'].teamFields.push({
        id: 'field_comp2', label: 'Component', type: 'constrained', multiValue: false,
        required: false, visible: true, primaryDisplay: false, allowedValues: [],
        deleted: false, order: 3, createdAt: '2026-01-01', createdBy: 'admin@test.com'
      })
      const { handlers: h } = setupRoutes(data)
      const res = callHandler(h['GET /structure/teams/query'], { filter: 'label:Component:value' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/Ambiguous label/)
      expect(res._body.error).toMatch(/field_comp/)
      expect(res._body.error).toMatch(/field_comp2/)
    })
  })
})

describe('GET /structure/group-by', () => {
  let handlers

  beforeAll(() => {
    const setup = setupRoutes(baseStorageData())
    handlers = setup.handlers
  })

  function groupBy(params = {}) {
    return callHandler(handlers['GET /structure/group-by'], params)
  }

  describe('by field ID', () => {
    it('returns an inverted index of value → teams', () => {
      const res = groupBy({ field: 'field_comp' })
      expect(res._status).toBe(200)
      expect(res._body.fieldId).toBe('field_comp')
      expect(res._body.label).toBe('Component')
      expect(res._body.type).toBe('constrained')
      expect(res._body.index['AI Pipelines']).toHaveLength(2)
      expect(res._body.index['MLflow']).toHaveLength(1)
      expect(res._body.index['Model Serving']).toHaveLength(1)
    })

    it('includes full metadata on each team', () => {
      const res = groupBy({ field: 'field_comp' })
      const team = res._body.index['AI Pipelines'].find(t => t.name === 'Pipelines')
      expect(team.metadata).toBeDefined()
      expect(team.metadata.field_status).toBe('Active')
      expect(team.metadata.field_comp).toEqual(['AI Pipelines', 'MLflow'])
    })

    it('includes team id, name, orgKey', () => {
      const res = groupBy({ field: 'field_comp' })
      const team = res._body.index['Model Serving'][0]
      expect(team.id).toBe('team_b')
      expect(team.name).toBe('Serving')
      expect(team.orgKey).toBe('org1')
    })

    it('does not include boards', () => {
      const res = groupBy({ field: 'field_comp' })
      const team = res._body.index['Model Serving'][0]
      expect(team.boards).toBeUndefined()
    })

    it('works with scalar fields', () => {
      const res = groupBy({ field: 'field_status' })
      expect(res._body.index['Active']).toHaveLength(2)
      expect(res._body.index['Sunset']).toHaveLength(1)
    })
  })

  describe('by label', () => {
    it('resolves field by label', () => {
      const res = groupBy({ label: 'Component' })
      expect(res._status).toBe(200)
      expect(res._body.fieldId).toBe('field_comp')
      expect(Object.keys(res._body.index).length).toBeGreaterThan(0)
    })

    it('is case-insensitive on label', () => {
      const res = groupBy({ label: 'component' })
      expect(res._status).toBe(200)
      expect(res._body.fieldId).toBe('field_comp')
    })

    it('rejects unknown label', () => {
      const res = groupBy({ label: 'Bogus' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/No team field found/)
    })

    it('rejects ambiguous labels', () => {
      const data = baseStorageData()
      data['team-data/field-definitions.json'].teamFields.push({
        id: 'field_comp2', label: 'Component', type: 'constrained', multiValue: false,
        required: false, visible: true, primaryDisplay: false, allowedValues: [],
        deleted: false, order: 3, createdAt: '2026-01-01', createdBy: 'admin@test.com'
      })
      const { handlers: h } = setupRoutes(data)
      const res = callHandler(h['GET /structure/group-by'], { label: 'Component' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/Ambiguous label/)
    })
  })

  describe('counts', () => {
    it('returns correct valueCount and teamCount', () => {
      const res = groupBy({ field: 'field_comp' })
      // Values: AI Pipelines, MLflow, Model Serving = 3
      expect(res._body.valueCount).toBe(3)
      // Teams with at least one value: team_a, team_b, team_c = 3 (team_d has no components)
      expect(res._body.teamCount).toBe(3)
    })

    it('teamCount counts distinct teams even when they appear under multiple values', () => {
      const res = groupBy({ field: 'field_comp' })
      // team_a has AI Pipelines + MLflow, appears in 2 buckets but teamCount should not double-count
      const totalInBuckets = Object.values(res._body.index).flat().length
      expect(totalInBuckets).toBeGreaterThan(res._body.teamCount)
    })
  })

  describe('empty/null handling', () => {
    it('omits teams with no value for the field', () => {
      const res = groupBy({ field: 'field_comp' })
      // team_d has empty metadata, should not appear anywhere
      const allTeamIds = Object.values(res._body.index).flat().map(t => t.id)
      expect(allTeamIds).not.toContain('team_d')
    })

    it('omits empty string values', () => {
      const data = baseStorageData()
      data['team-data/teams.json'].teams.team_d.metadata.field_status = ''
      const { handlers: h } = setupRoutes(data)
      const res = callHandler(h['GET /structure/group-by'], { field: 'field_status' })
      expect(res._body.index['']).toBeUndefined()
    })

    it('omits null values', () => {
      const data = baseStorageData()
      data['team-data/teams.json'].teams.team_d.metadata.field_status = null
      const { handlers: h } = setupRoutes(data)
      const res = callHandler(h['GET /structure/group-by'], { field: 'field_status' })
      const allTeamIds = Object.values(res._body.index).flat().map(t => t.id)
      expect(allTeamIds).not.toContain('team_d')
    })

    it('skips empty strings within arrays', () => {
      const data = baseStorageData()
      data['team-data/teams.json'].teams.team_d.metadata.field_comp = ['Valid', '']
      const { handlers: h } = setupRoutes(data)
      const res = callHandler(h['GET /structure/group-by'], { field: 'field_comp' })
      expect(res._body.index['']).toBeUndefined()
      expect(res._body.index['Valid']).toHaveLength(1)
    })
  })

  describe('error handling', () => {
    it('rejects when neither field nor label is provided', () => {
      const res = groupBy({})
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/Provide a/)
    })

    it('rejects when both field and label are provided', () => {
      const res = groupBy({ field: 'field_comp', label: 'Component' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/not both/)
    })

    it('rejects unknown field ID', () => {
      const res = groupBy({ field: 'field_nope' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/Unknown team field ID/)
    })

    it('ignores deleted fields', () => {
      const res = groupBy({ field: 'field_deleted' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/Unknown team field ID/)
    })

    it('ignores deleted fields in label lookup', () => {
      const res = groupBy({ label: 'OldField' })
      expect(res._status).toBe(400)
      expect(res._body.error).toMatch(/No team field found/)
    })
  })
})
