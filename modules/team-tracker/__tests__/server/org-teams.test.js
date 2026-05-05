import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests the buildEnrichedTeams board priority cascade logic by registering
 * the org-teams routes on a mock router and invoking the GET /org-teams handler.
 */

// Mock node-fetch (required by transitive imports)
vi.mock('node-fetch', () => ({ default: vi.fn() }))

const rosterSyncConfig = require('../../../../shared/server/roster-sync/config')

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
    _data: data
  }
}

/**
 * Build a minimal registry with people in given teams.
 */
function buildRegistryAndConfig(orgRootUid, orgDisplayName, teams) {
  const people = {}
  let idx = 0
  for (const teamName of teams) {
    const uid = `person_${idx++}`
    people[uid] = {
      uid,
      name: `Person ${idx}`,
      status: 'active',
      orgRoot: orgRootUid,
      _teamGrouping: teamName,
      title: 'Engineer'
    }
  }

  return {
    'team-data/registry.json': {
      meta: { generatedAt: '2026-01-01', provider: 'test', orgRoots: [orgRootUid] },
      people
    },
    'team-data/config.json': {
      orgRoots: [{ uid: orgRootUid, displayName: orgDisplayName }]
    },
    'team-data/field-definitions.json': {
      personFields: [],
      teamFields: []
    }
  }
}

/**
 * Register the org-teams routes and capture the GET /org-teams handler.
 */
function setupRoutes(storage) {
  const handlers = {}
  const mockRouter = {
    get(path, ...args) { handlers[`GET ${path}`] = args[args.length - 1] },
    post(path, ...args) { handlers[`POST ${path}`] = args[args.length - 1] },
    patch(path, ...args) { handlers[`PATCH ${path}`] = args[args.length - 1] },
    delete(path, ...args) { handlers[`DELETE ${path}`] = args[args.length - 1] }
  }

  const context = {
    storage,
    requireAdmin: (req, res, next) => next()
  }

  // Clear config cache before registering
  rosterSyncConfig.clearDisplayNamesCache()

  const registerOrgTeamsRoutes = require('../../server/routes/org-teams')
  registerOrgTeamsRoutes(mockRouter, context)

  return handlers
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

beforeEach(() => {
  rosterSyncConfig.clearDisplayNamesCache()
})

describe('buildEnrichedTeams board cascade', () => {
  it('prefers structure boards over metadata boards', () => {
    const storageData = {
      ...buildRegistryAndConfig('org1', 'Org One', ['Platform']),
      'org-roster/teams-metadata.json': {
        teams: [
          { org: 'Org One', name: 'Platform', boardUrls: ['https://meta-board.example.com'] }
        ],
        boardNames: { 'https://meta-board.example.com': 'Meta Board' }
      },
      'org-roster/components.json': { components: {} },
      'team-data/teams.json': {
        teams: {
          team_abc: {
            id: 'team_abc',
            name: 'Platform',
            orgKey: 'org1',
            metadata: {},
            boards: [
              { url: 'https://structure-board.example.com', name: 'Structure Board' }
            ]
          }
        }
      },
      'audit-log.json': { entries: [] }
    }

    const storage = makeStorage(storageData)
    const handlers = setupRoutes(storage)
    const res = mockRes()

    handlers['GET /org-teams']({ query: {} }, res)

    expect(res._status).toBe(200)
    const team = res._body.teams.find(t => t.name === 'Platform')
    expect(team).toBeDefined()
    // Should use structure boards, NOT metadata boards
    expect(team.boards).toHaveLength(1)
    expect(team.boards[0].url).toBe('https://structure-board.example.com')
    expect(team.boards[0].name).toBe('Structure Board')
    expect(team.structureId).toBe('team_abc')
  })

  it('falls back to metadata boards when no structure team exists', () => {
    const storageData = {
      ...buildRegistryAndConfig('org1', 'Org One', ['Platform']),
      'org-roster/teams-metadata.json': {
        teams: [
          { org: 'Org One', name: 'Platform', boardUrls: ['https://meta-board.example.com'] }
        ],
        boardNames: { 'https://meta-board.example.com': 'Meta Board' }
      },
      'org-roster/components.json': { components: {} },
      'team-data/teams.json': { teams: {} },
      'audit-log.json': { entries: [] }
    }

    const storage = makeStorage(storageData)
    const handlers = setupRoutes(storage)
    const res = mockRes()

    handlers['GET /org-teams']({ query: {} }, res)

    expect(res._status).toBe(200)
    const team = res._body.teams.find(t => t.name === 'Platform')
    expect(team).toBeDefined()
    // Should use metadata boards as fallback
    expect(team.boards).toHaveLength(1)
    expect(team.boards[0].url).toBe('https://meta-board.example.com')
    expect(team.boards[0].name).toBe('Meta Board')
    expect(team.structureId).toBeUndefined()
  })

  it('sources components from team metadata when component field exists', () => {
    const storageData = {
      ...buildRegistryAndConfig('org1', 'Org One', ['Platform']),
      'org-roster/teams-metadata.json': {
        teams: [{ org: 'Org One', name: 'Platform', boardUrls: [] }],
        boardNames: {}
      },
      'org-roster/components.json': { components: {} },
      'team-data/teams.json': {
        teams: {
          team_abc: {
            id: 'team_abc',
            name: 'Platform',
            orgKey: 'org1',
            metadata: { field_comp01: ['Platform Core', 'Dashboard'] }
          }
        }
      },
      'audit-log.json': { entries: [] }
    }

    // Override field definitions to include the component field
    storageData['team-data/field-definitions.json'] = {
      personFields: [],
      teamFields: [{
        id: 'field_comp01', label: 'Components', type: 'constrained',
        multiValue: true, optionsRef: 'components', allowedValues: null,
        deleted: false, order: 0
      }]
    }

    const storage = makeStorage(storageData)
    const handlers = setupRoutes(storage)
    const res = mockRes()

    handlers['GET /org-teams']({ query: {} }, res)

    expect(res._status).toBe(200)
    const team = res._body.teams.find(t => t.name === 'Platform')
    expect(team).toBeDefined()
    expect(team.components).toEqual(['Platform Core', 'Dashboard'])
  })

  it('falls back to legacy componentMap when no component field exists', () => {
    const storageData = {
      ...buildRegistryAndConfig('org1', 'Org One', ['Platform']),
      'org-roster/teams-metadata.json': {
        teams: [{ org: 'Org One', name: 'Platform', boardUrls: [] }],
        boardNames: {}
      },
      'org-roster/components.json': { components: { 'Legacy Comp': ['Platform'] } },
      'team-data/teams.json': { teams: {} },
      'audit-log.json': { entries: [] }
    }

    const storage = makeStorage(storageData)
    const handlers = setupRoutes(storage)
    const res = mockRes()

    handlers['GET /org-teams']({ query: {} }, res)

    expect(res._status).toBe(200)
    const team = res._body.teams.find(t => t.name === 'Platform')
    expect(team).toBeDefined()
    expect(team.components).toEqual(['Legacy Comp'])
  })

  it('handles missing boards array on structure team gracefully', () => {
    const storageData = {
      ...buildRegistryAndConfig('org1', 'Org One', ['Platform']),
      'org-roster/teams-metadata.json': {
        teams: [
          { org: 'Org One', name: 'Platform', boardUrls: ['https://meta-board.example.com'] }
        ],
        boardNames: { 'https://meta-board.example.com': 'Meta Board' }
      },
      'org-roster/components.json': { components: {} },
      'team-data/teams.json': {
        teams: {
          team_abc: {
            id: 'team_abc',
            name: 'Platform',
            orgKey: 'org1',
            metadata: {}
            // NOTE: no boards property (legacy team record without boards)
          }
        }
      },
      'audit-log.json': { entries: [] }
    }

    const storage = makeStorage(storageData)
    const handlers = setupRoutes(storage)
    const res = mockRes()

    handlers['GET /org-teams']({ query: {} }, res)

    expect(res._status).toBe(200)
    const team = res._body.teams.find(t => t.name === 'Platform')
    expect(team).toBeDefined()
    expect(team.structureId).toBe('team_abc')
    // When structure team has no boards array, should keep metadata boards
    expect(team.boards).toHaveLength(1)
    expect(team.boards[0].url).toBe('https://meta-board.example.com')
  })
})
