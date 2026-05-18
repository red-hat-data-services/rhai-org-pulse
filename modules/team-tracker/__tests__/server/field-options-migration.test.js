import { describe, it, expect, vi } from 'vitest'

vi.mock('node-fetch', () => ({ default: vi.fn() }))

const { previewMigration, executeMigration } = require('../../server/migration/field-options-migration')
const fieldStore = require('../../../../shared/server/field-store')

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

function baseStorageData() {
  return {
    'team-data/field-definitions.json': {
      personFields: [
        {
          id: 'field_comp', label: 'Component', type: 'free-text', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: null,
          deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        }
      ],
      teamFields: [
        {
          id: 'field_tf01', label: 'Status', type: 'constrained', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: ['Active'],
          deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        }
      ]
    },
    'team-data/teams.json': {
      teams: {
        team_1: { id: 'team_1', name: 'Platform', orgKey: 'org1', metadata: {}, createdAt: '2026-01-01', createdBy: 'admin@test.com' },
        team_2: { id: 'team_2', name: 'ML Team', orgKey: 'org1', metadata: {}, createdAt: '2026-01-01', createdBy: 'admin@test.com' }
      }
    },
    'team-data/registry.json': {
      meta: { generatedAt: '2026-01-01', provider: 'test', orgRoots: ['org1'] },
      people: {
        person1: {
          uid: 'person1', name: 'Alice', status: 'active',
          teamIds: ['team_1'],
          _appFields: { field_comp: 'Platform Core' }
        },
        person2: {
          uid: 'person2', name: 'Bob', status: 'active',
          teamIds: ['team_1', 'team_2'],
          _appFields: { field_comp: 'ML Models' }
        },
        person3: {
          uid: 'person3', name: 'Carol', status: 'active',
          teamIds: ['team_2'],
          _appFields: { field_comp: 'ML Models' }
        }
      }
    },
    'audit-log.json': { entries: [] }
  }
}

describe('field-options-migration', () => {
  describe('previewMigration', () => {
    it('extracts unique values from person field', () => {
      const storage = makeStorage(baseStorageData())
      const result = previewMigration(storage, 'field_comp')

      expect(result.error).toBeUndefined()
      expect(result.scope).toBe('person')
      expect(result.field.id).toBe('field_comp')
      expect(result.field.label).toBe('Component')
      expect(result.uniqueValues).toEqual(['ML Models', 'Platform Core'])
      expect(result.recordCount).toBe(3)
    })

    it('extracts unique values from team field', () => {
      const data = baseStorageData()
      data['team-data/field-definitions.json'].teamFields.push({
        id: 'field_region', label: 'Region', type: 'free-text', multiValue: false,
        required: false, visible: true, primaryDisplay: false, allowedValues: null,
        deleted: false, order: 1, createdAt: '2026-01-01', createdBy: 'admin@test.com'
      })
      data['team-data/teams.json'].teams.team_1.metadata.field_region = 'APAC'
      data['team-data/teams.json'].teams.team_2.metadata.field_region = 'EMEA'
      const storage = makeStorage(data)

      const result = previewMigration(storage, 'field_region')
      expect(result.scope).toBe('team')
      expect(result.uniqueValues).toEqual(['APAC', 'EMEA'])
      expect(result.recordCount).toBe(2)
    })

    it('returns error for nonexistent field', () => {
      const storage = makeStorage(baseStorageData())
      const result = previewMigration(storage, 'field_nonexistent')
      expect(result.error).toBe('Field not found')
    })

    it('returns error for field already linked to options', () => {
      const data = baseStorageData()
      data['team-data/field-definitions.json'].personFields[0].optionsRef = 'components'
      const storage = makeStorage(data)

      const result = previewMigration(storage, 'field_comp')
      expect(result.error).toBe('Field already linked to a field option set')
    })

    it('handles array values in person fields', () => {
      const data = baseStorageData()
      data['team-data/registry.json'].people.person1._appFields.field_comp = ['Platform Core', 'Infra']
      const storage = makeStorage(data)

      const result = previewMigration(storage, 'field_comp')
      expect(result.uniqueValues).toContain('Platform Core')
      expect(result.uniqueValues).toContain('Infra')
      expect(result.uniqueValues).toContain('ML Models')
    })

    it('skips deleted fields', () => {
      const data = baseStorageData()
      data['team-data/field-definitions.json'].personFields[0].deleted = true
      const storage = makeStorage(data)

      const result = previewMigration(storage, 'field_comp')
      expect(result.error).toBe('Field not found')
    })
  })

  describe('executeMigration', () => {
    it('creates option set with extracted values', () => {
      const storage = makeStorage(baseStorageData())
      const result = executeMigration(storage, {
        sourceFieldId: 'field_comp',
        optionSetName: 'components',
        optionSetLabel: 'Components'
      }, 'admin@test.com')

      expect(result.error).toBeUndefined()
      expect(result.optionSetCreated).toBe('components')
      expect(result.valuesExtracted).toBe(2)

      const options = storage._data['team-data/field-options/components.json']
      expect(options.values).toContain('Platform Core')
      expect(options.values).toContain('ML Models')
    })

    it('updates source field with optionsRef', () => {
      const storage = makeStorage(baseStorageData())
      executeMigration(storage, {
        sourceFieldId: 'field_comp',
        optionSetName: 'components',
        optionSetLabel: 'Components'
      }, 'admin@test.com')

      const defs = fieldStore.readFieldDefinitions(storage)
      const field = defs.personFields.find(f => f.id === 'field_comp')
      expect(field.type).toBe('constrained')
      expect(field.multiValue).toBe(true)
      expect(field.optionsRef).toBe('components')
    })

    it('converts string values to arrays in person records', () => {
      const storage = makeStorage(baseStorageData())
      executeMigration(storage, {
        sourceFieldId: 'field_comp',
        optionSetName: 'components',
        optionSetLabel: 'Components'
      }, 'admin@test.com')

      const registry = storage._data['team-data/registry.json']
      expect(registry.people.person1._appFields.field_comp).toEqual(['Platform Core'])
      expect(registry.people.person2._appFields.field_comp).toEqual(['ML Models'])
    })

    it('creates counterpart team field when requested', () => {
      const storage = makeStorage(baseStorageData())
      const result = executeMigration(storage, {
        sourceFieldId: 'field_comp',
        optionSetName: 'components',
        optionSetLabel: 'Components',
        createCounterpart: true,
        counterpartLabel: 'Team Components'
      }, 'admin@test.com')

      expect(result.counterpartFieldCreated).toBe(true)
      const defs = fieldStore.readFieldDefinitions(storage)
      const teamField = defs.teamFields.find(f => f.optionsRef === 'components')
      expect(teamField).toBeDefined()
      expect(teamField.label).toBe('Team Components')
      expect(teamField.type).toBe('constrained')
      expect(teamField.multiValue).toBe(true)
    })

    it('seeds counterpart team field from person members', () => {
      const storage = makeStorage(baseStorageData())
      const result = executeMigration(storage, {
        sourceFieldId: 'field_comp',
        optionSetName: 'components',
        optionSetLabel: 'Components',
        createCounterpart: true,
        seedFromMembers: true
      }, 'admin@test.com')

      expect(result.teamsSeeded).toBe(2)
      const teams = storage._data['team-data/teams.json']
      const defs = fieldStore.readFieldDefinitions(storage)
      const teamField = defs.teamFields.find(f => f.optionsRef === 'components')

      // team_1 has person1 (Platform Core) and person2 (ML Models)
      expect(teams.teams.team_1.metadata[teamField.id]).toEqual(['ML Models', 'Platform Core'])
      // team_2 has person2 (ML Models) and person3 (ML Models)
      expect(teams.teams.team_2.metadata[teamField.id]).toEqual(['ML Models'])
    })

    it('returns error if option set already exists', () => {
      const data = baseStorageData()
      data['team-data/field-options/components.json'] = {
        name: 'components', label: 'Components', values: ['A']
      }
      const storage = makeStorage(data)

      const result = executeMigration(storage, {
        sourceFieldId: 'field_comp',
        optionSetName: 'components',
        optionSetLabel: 'Components'
      }, 'admin@test.com')

      expect(result.error).toMatch(/already exists/)
    })

    it('returns error if source field not found', () => {
      const storage = makeStorage(baseStorageData())
      const result = executeMigration(storage, {
        sourceFieldId: 'field_nonexistent',
        optionSetName: 'test',
        optionSetLabel: 'Test'
      }, 'admin@test.com')

      expect(result.error).toBe('Field not found')
    })

    it('writes audit log entry', () => {
      const storage = makeStorage(baseStorageData())
      executeMigration(storage, {
        sourceFieldId: 'field_comp',
        optionSetName: 'components',
        optionSetLabel: 'Components'
      }, 'admin@test.com')

      const audit = storage._data['audit-log.json']
      const entry = audit.entries.find(e => e.action === 'migration.field-to-options')
      expect(entry).toBeDefined()
      expect(entry.actor).toBe('admin@test.com')
      expect(entry.entityId).toBe('components')
    })

    it('handles team-scope source field migration', () => {
      const data = baseStorageData()
      data['team-data/field-definitions.json'].teamFields.push({
        id: 'field_region', label: 'Region', type: 'free-text', multiValue: false,
        required: false, visible: true, primaryDisplay: false, allowedValues: null,
        deleted: false, order: 1, createdAt: '2026-01-01', createdBy: 'admin@test.com'
      })
      data['team-data/teams.json'].teams.team_1.metadata.field_region = 'APAC'
      data['team-data/teams.json'].teams.team_2.metadata.field_region = 'EMEA'
      const storage = makeStorage(data)

      const result = executeMigration(storage, {
        sourceFieldId: 'field_region',
        optionSetName: 'regions',
        optionSetLabel: 'Regions'
      }, 'admin@test.com')

      expect(result.valuesExtracted).toBe(2)
      expect(result.sourceFieldUpdated).toBe(true)

      const defs = fieldStore.readFieldDefinitions(storage)
      const field = defs.teamFields.find(f => f.id === 'field_region')
      expect(field.optionsRef).toBe('regions')

      // String values converted to arrays
      const teams = storage._data['team-data/teams.json']
      expect(teams.teams.team_1.metadata.field_region).toEqual(['APAC'])
    })
  })
})
