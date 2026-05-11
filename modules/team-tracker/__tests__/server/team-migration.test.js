import { describe, it, expect } from 'vitest'

const { buildTeamMap, migrateToInApp, previewMigration } = require('../../../../shared/server/team-migration')

function makeStorage(initial = {}) {
  const data = { ...initial }
  const writes = {}
  return {
    readFromStorage(key) { return data[key] ? JSON.parse(JSON.stringify(data[key])) : null },
    writeToStorage(key, val) {
      data[key] = JSON.parse(JSON.stringify(val))
      writes[key] = (writes[key] || 0) + 1
    },
    _data: data,
    _writes: writes
  }
}

function baseRegistry() {
  return {
    meta: { generatedAt: '2026-01-01T00:00:00.000Z', provider: 'test', orgRoots: ['org1'] },
    people: {
      alice: { uid: 'alice', name: 'Alice Chen', status: 'active', orgRoot: 'org1', _teamGrouping: 'Platform', productManager: 'Bob Smith' },
      bob: { uid: 'bob', name: 'Bob Smith', status: 'active', orgRoot: 'org1', _teamGrouping: 'Platform', productManager: 'Bob Smith' },
      carol: { uid: 'carol', name: 'Carol Davis', status: 'active', orgRoot: 'org1', _teamGrouping: 'Serving', productManager: 'Eve White' },
      dave: { uid: 'dave', name: 'Dave Lee', status: 'active', orgRoot: 'org1', _teamGrouping: 'Serving', productManager: 'Eve White' },
      eve: { uid: 'eve', name: 'Eve White', status: 'active', orgRoot: 'org1', _teamGrouping: 'Platform,Serving', productManager: 'Eve White' }
    }
  }
}

describe('buildTeamMap', () => {
  it('groups active people by _teamGrouping', () => {
    const registry = baseRegistry()
    const map = buildTeamMap(registry)
    expect(map.size).toBe(2)
    const platform = map.get('org1::platform')
    expect(platform.name).toBe('Platform')
    expect(platform.uids).toContain('alice')
    expect(platform.uids).toContain('bob')
  })

  it('handles multi-team people (comma-separated)', () => {
    const registry = baseRegistry()
    const map = buildTeamMap(registry)
    const platform = map.get('org1::platform')
    const serving = map.get('org1::serving')
    expect(platform.uids).toContain('eve')
    expect(serving.uids).toContain('eve')
  })

  it('skips inactive people', () => {
    const registry = baseRegistry()
    registry.people.alice.status = 'inactive'
    const map = buildTeamMap(registry)
    const platform = map.get('org1::platform')
    expect(platform.uids).not.toContain('alice')
  })

  it('skips _unassigned', () => {
    const registry = baseRegistry()
    registry.people.alice._teamGrouping = '_unassigned'
    const map = buildTeamMap(registry)
    // alice is not in any team
    for (const entry of map.values()) {
      expect(entry.uids).not.toContain('alice')
    }
  })
})

describe('previewMigration - scope detection', () => {
  function makePreviewStorage(registry) {
    return makeStorage({
      'team-data/registry.json': registry,
      'audit-log.json': { entries: [] }
    })
  }

  it('suggests team scope when 80%+ uniform', async () => {
    // Make all people in all teams have the same PM value
    const registry = {
      meta: { generatedAt: '2026-01-01T00:00:00.000Z', provider: 'test', orgRoots: ['org1'] },
      people: {
        alice: { uid: 'alice', name: 'Alice', status: 'active', orgRoot: 'org1', _teamGrouping: 'Alpha', focus: 'ML' },
        bob: { uid: 'bob', name: 'Bob', status: 'active', orgRoot: 'org1', _teamGrouping: 'Alpha', focus: 'ML' },
        carol: { uid: 'carol', name: 'Carol', status: 'active', orgRoot: 'org1', _teamGrouping: 'Beta', focus: 'Infra' },
        dave: { uid: 'dave', name: 'Dave', status: 'active', orgRoot: 'org1', _teamGrouping: 'Beta', focus: 'Infra' }
      }
    }
    const storage = makePreviewStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'focus', displayLabel: 'Focus Area' }]
      }
    }
    const result = await previewMigration(storage, config)
    const field = result.fields[0]
    // Both Alpha and Beta are uniform -> 100%
    expect(field.suggestedScope).toBe('team')
    expect(field.uniformTeamPct).toBe(100)
  })

  it('suggests person scope when below 80%', async () => {
    const registry = baseRegistry()
    // Make Platform non-uniform by giving alice a different PM
    registry.people.alice.productManager = 'Carol Davis'
    const storage = makePreviewStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'productManager', displayLabel: 'PM' }]
      }
    }
    const result = await previewMigration(storage, config)
    const field = result.fields[0]
    // Platform has Alice=Carol, Bob=Bob, Eve=Eve -> 3 distinct -> not uniform
    // Serving has Carol=Eve, Dave=Eve, Eve=Eve -> 1 distinct -> uniform
    // 1/2 = 50% < 80%
    expect(field.suggestedScope).toBe('person')
    expect(field.uniformTeamPct).toBe(50)
  })

  it('excludes teams with no values from denominator', async () => {
    const registry = baseRegistry()
    // Remove PM from all Platform members
    delete registry.people.alice.productManager
    delete registry.people.bob.productManager
    // Eve is on both teams, but her value only counts for teams she's in
    const storage = makePreviewStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'productManager', displayLabel: 'PM' }]
      }
    }
    const result = await previewMigration(storage, config)
    const field = result.fields[0]
    // Platform: only Eve has value -> 1 distinct -> uniform
    // Serving: Carol=Eve, Dave=Eve, Eve=Eve -> uniform
    // 2/2 = 100%
    expect(field.suggestedScope).toBe('team')
    expect(field.uniformTeamPct).toBe(100)
  })
})

describe('migrateToInApp', () => {
  function makeMigrationStorage(registry, extraData = {}) {
    return makeStorage({
      'team-data/registry.json': registry,
      'team-data/teams.json': { teams: {} },
      'team-data/field-definitions.json': { personFields: [], teamFields: [] },
      'team-data/config.json': { orgRoots: [{ uid: 'org1', displayName: 'Org One' }] },
      'audit-log.json': { entries: [] },
      ...extraData
    })
  }

  it('creates teams and assigns members', async () => {
    const registry = baseRegistry()
    const storage = makeMigrationStorage(registry)
    const config = { teamStructure: { customFields: [] } }
    const result = await migrateToInApp(storage, config, 'admin@test.com', [])

    expect(result.migrated).toBe(true)
    expect(result.teams).toBe(2)
    expect(result.assignments).toBeGreaterThan(0)

    const teams = storage._data['team-data/teams.json'].teams
    expect(Object.keys(teams).length).toBe(2)
  })

  it('skips if already migrated', async () => {
    const registry = baseRegistry()
    const storage = makeMigrationStorage(registry)
    const config = { _migratedToInApp: '2026-01-01', teamStructure: { customFields: [] } }
    const result = await migrateToInApp(storage, config, 'admin@test.com', [])
    expect(result.migrated).toBe(false)
  })

  it('creates team-scoped field definitions in teamFields', async () => {
    const registry = baseRegistry()
    const storage = makeMigrationStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'productManager', displayLabel: 'PM', visible: true }]
      }
    }
    const overrides = [{ key: 'productManager', type: 'person-reference-linked', multiValue: false, scope: 'team' }]
    const result = await migrateToInApp(storage, config, 'admin@test.com', overrides)

    expect(result.fields).toBe(1)

    const fieldDefs = storage._data['team-data/field-definitions.json']
    expect(fieldDefs.teamFields.length).toBe(1)
    expect(fieldDefs.personFields.length).toBe(0)
    expect(fieldDefs.teamFields[0].type).toBe('person-reference-linked')
  })

  it('rolls up uniform team values as single value', async () => {
    // All teams have the same uniform value -> no auto-promotion
    const registry = {
      meta: { generatedAt: '2026-01-01T00:00:00.000Z', provider: 'test', orgRoots: ['org1'] },
      people: {
        alice: { uid: 'alice', name: 'Alice', status: 'active', orgRoot: 'org1', _teamGrouping: 'Alpha', focus: 'ML' },
        bob: { uid: 'bob', name: 'Bob', status: 'active', orgRoot: 'org1', _teamGrouping: 'Alpha', focus: 'ML' },
        carol: { uid: 'carol', name: 'Carol', status: 'active', orgRoot: 'org1', _teamGrouping: 'Beta', focus: 'Infra' }
      }
    }
    const storage = makeMigrationStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'focus', displayLabel: 'Focus' }]
      }
    }
    const overrides = [{ key: 'focus', type: 'free-text', multiValue: false, scope: 'team' }]
    await migrateToInApp(storage, config, 'admin@test.com', overrides)

    const teams = storage._data['team-data/teams.json'].teams
    const fieldDefs = storage._data['team-data/field-definitions.json']
    const fieldId = fieldDefs.teamFields[0].id

    const alpha = Object.values(teams).find(t => t.name === 'Alpha')
    // Uniform value -> stored as single string
    expect(alpha.metadata[fieldId]).toBe('ML')
  })

  it('auto-promotes to multiValue for mixed team values', async () => {
    const registry = baseRegistry()
    // Platform: alice=Bob Smith, bob=Bob Smith, eve=Eve White -> 2 distinct UIDs
    const storage = makeMigrationStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'productManager', displayLabel: 'PM' }]
      }
    }
    const overrides = [{ key: 'productManager', type: 'person-reference-linked', multiValue: false, scope: 'team' }]
    await migrateToInApp(storage, config, 'admin@test.com', overrides)

    const fieldDefs = storage._data['team-data/field-definitions.json']
    // multiValue should be auto-promoted to true
    expect(fieldDefs.teamFields[0].multiValue).toBe(true)

    const teams = storage._data['team-data/teams.json'].teams
    const fieldId = fieldDefs.teamFields[0].id
    const platform = Object.values(teams).find(t => t.name === 'Platform')
    expect(Array.isArray(platform.metadata[fieldId])).toBe(true)
  })

  it('does NOT write to _appFields for team-scoped fields', async () => {
    const registry = baseRegistry()
    const storage = makeMigrationStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'productManager', displayLabel: 'PM' }]
      }
    }
    const overrides = [{ key: 'productManager', type: 'person-reference-linked', multiValue: false, scope: 'team' }]
    await migrateToInApp(storage, config, 'admin@test.com', overrides)

    const reg = storage._data['team-data/registry.json']
    const fieldDefs = storage._data['team-data/field-definitions.json']
    const fieldId = fieldDefs.teamFields[0].id

    // No person should have _appFields set for this team-scoped field
    for (const person of Object.values(reg.people)) {
      if (person._appFields) {
        expect(person._appFields[fieldId]).toBeUndefined()
      }
    }
  })

  it('preserves stale flat values on person records', async () => {
    const registry = baseRegistry()
    const storage = makeMigrationStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'productManager', displayLabel: 'PM' }]
      }
    }
    const overrides = [{ key: 'productManager', type: 'person-reference-linked', multiValue: false, scope: 'team' }]
    await migrateToInApp(storage, config, 'admin@test.com', overrides)

    const reg = storage._data['team-data/registry.json']
    // Original flat value should still be present
    expect(reg.people.alice.productManager).toBe('Bob Smith')
  })

  it('deduplicates teams on retry (reuses existing team)', async () => {
    const registry = baseRegistry()
    // Pre-create a team with the same name
    const storage = makeMigrationStorage(registry, {
      'team-data/teams.json': {
        teams: {
          team_exist1: { id: 'team_exist1', name: 'Platform', orgKey: 'org1', metadata: {}, boards: [] }
        }
      }
    })
    const config = { teamStructure: { customFields: [] } }
    const result = await migrateToInApp(storage, config, 'admin@test.com', [])

    // Should create only 1 new team (Serving), not Platform
    expect(result.teams).toBe(1)

    const teams = storage._data['team-data/teams.json'].teams
    // team_exist1 should still exist
    expect(teams.team_exist1).toBeDefined()
    expect(teams.team_exist1.name).toBe('Platform')
  })

  it('uses batched I/O (single write per data file)', async () => {
    const registry = baseRegistry()
    const storage = makeMigrationStorage(registry)
    const config = {
      teamStructure: {
        customFields: [{ key: 'productManager', displayLabel: 'PM' }]
      }
    }
    const overrides = [{ key: 'productManager', type: 'free-text', multiValue: false, scope: 'person' }]
    await migrateToInApp(storage, config, 'admin@test.com', overrides)

    // Exactly 1 write each for teams.json, registry.json, field-definitions.json
    expect(storage._writes['team-data/teams.json']).toBe(1)
    expect(storage._writes['team-data/registry.json']).toBe(1)
    expect(storage._writes['team-data/field-definitions.json']).toBe(1)
  })

  describe('board migration', () => {
    it('copies boards from teams-metadata.json', async () => {
      const registry = baseRegistry()
      const storage = makeMigrationStorage(registry, {
        'team-data/config.json': { orgRoots: [{ uid: 'org1', displayName: 'Org One' }] },
        'org-roster/teams-metadata.json': {
          teams: [
            { org: 'Org One', name: 'Platform', boardUrls: ['https://jira.example.com/board/1', 'https://jira.example.com/board/2'] },
            { org: 'Org One', name: 'Serving', boardUrls: ['https://jira.example.com/board/3'] }
          ],
          boardNames: {
            'https://jira.example.com/board/1': 'Platform Board',
            'https://jira.example.com/board/3': 'Serving Board'
          }
        }
      })
      const config = { teamStructure: { customFields: [] } }
      const result = await migrateToInApp(storage, config, 'admin@test.com', [])

      expect(result.boardsMigrated).toBe(3)

      const teams = storage._data['team-data/teams.json'].teams
      const platform = Object.values(teams).find(t => t.name === 'Platform')
      expect(platform.boards).toHaveLength(2)
      expect(platform.boards[0].url).toBe('https://jira.example.com/board/1')
      expect(platform.boards[0].name).toBe('Platform Board')
      expect(platform.boards[1].name).toBe('') // no boardName entry
    })

    it('uses case-insensitive matching for org and team names', async () => {
      const registry = baseRegistry()
      const storage = makeMigrationStorage(registry, {
        'team-data/config.json': { orgRoots: [{ uid: 'org1', displayName: 'Org One' }] },
        'org-roster/teams-metadata.json': {
          teams: [
            { org: 'ORG ONE', name: 'PLATFORM', boardUrls: ['https://jira.example.com/board/1'] }
          ],
          boardNames: {}
        }
      })
      const config = { teamStructure: { customFields: [] } }
      const result = await migrateToInApp(storage, config, 'admin@test.com', [])
      expect(result.boardsMigrated).toBe(1)
    })

    it('handles missing metadata gracefully', async () => {
      const registry = baseRegistry()
      const storage = makeMigrationStorage(registry)
      // No teams-metadata.json
      const config = { teamStructure: { customFields: [] } }
      const result = await migrateToInApp(storage, config, 'admin@test.com', [])
      expect(result.boardsMigrated).toBe(0)
    })

    it('handles teams with no boards in metadata', async () => {
      const registry = baseRegistry()
      const storage = makeMigrationStorage(registry, {
        'team-data/config.json': { orgRoots: [{ uid: 'org1', displayName: 'Org One' }] },
        'org-roster/teams-metadata.json': {
          teams: [
            { org: 'Org One', name: 'Platform', boardUrls: [] }
          ],
          boardNames: {}
        }
      })
      const config = { teamStructure: { customFields: [] } }
      const result = await migrateToInApp(storage, config, 'admin@test.com', [])
      expect(result.boardsMigrated).toBe(0)
    })

    it('skips boards with invalid URL schemes (javascript:, data:, etc.)', async () => {
      const registry = baseRegistry()
      const storage = makeMigrationStorage(registry, {
        'team-data/config.json': { orgRoots: [{ uid: 'org1', displayName: 'Org One' }] },
        'org-roster/teams-metadata.json': {
          teams: [
            {
              org: 'Org One',
              name: 'Platform',
              boardUrls: [
                'https://jira.example.com/board/1',
                'javascript:alert(1)',
                'data:text/html,<h1>XSS</h1>',
                'https://jira.example.com/board/2'
              ]
            }
          ],
          boardNames: {}
        }
      })
      const config = { teamStructure: { customFields: [] } }
      const result = await migrateToInApp(storage, config, 'admin@test.com', [])

      // Only the two https:// boards should be migrated
      expect(result.boardsMigrated).toBe(2)
      const teams = storage._data['team-data/teams.json'].teams
      const platform = Object.values(teams).find(t => t.name === 'Platform')
      expect(platform.boards).toHaveLength(2)
      expect(platform.boards[0].url).toBe('https://jira.example.com/board/1')
      expect(platform.boards[1].url).toBe('https://jira.example.com/board/2')
    })
  })
})
