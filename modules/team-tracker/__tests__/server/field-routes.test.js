import { describe, it, expect } from 'vitest'

/**
 * Tests field-related API route handler logic by calling field-store
 * and team-store functions with mock storage, verifying response shapes.
 */
const fieldStore = require('../../../../shared/server/field-store')
const teamStore = require('../../../../shared/server/team-store')

function makeStorage(initial = {}) {
  const data = { ...initial }
  return {
    readFromStorage(key) { return data[key] ? JSON.parse(JSON.stringify(data[key])) : null },
    writeToStorage(key, val) { data[key] = JSON.parse(JSON.stringify(val)) },
    _data: data
  }
}

const BASE_DEFS = {
  personFields: [
    {
      id: 'field_c1', label: 'Component', type: 'constrained', multiValue: false,
      required: false, visible: true, primaryDisplay: false, allowedValues: ['Platform', 'UI'],
      deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
    },
    {
      id: 'field_req1', label: 'Role', type: 'constrained', multiValue: false,
      required: true, visible: true, primaryDisplay: false, allowedValues: ['BE', 'FE'],
      deleted: false, order: 1, createdAt: '2026-01-01', createdBy: 'admin@test.com'
    }
  ],
  teamFields: [
    {
      id: 'field_tf1', label: 'Status', type: 'constrained', multiValue: false,
      required: false, visible: true, primaryDisplay: false, allowedValues: ['Active', 'Sunset'],
      deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
    }
  ]
}

function makeFullStorage() {
  return makeStorage({
    'team-data/field-definitions.json': JSON.parse(JSON.stringify(BASE_DEFS)),
    'team-data/registry.json': {
      meta: { generatedAt: '2026-01-01', provider: 'test', orgRoots: ['achen'] },
      people: {
        achen: { uid: 'achen', name: 'Alice Chen', status: 'active', _appFields: {} }
      }
    },
    'team-data/teams.json': {
      teams: {
        team_abc: { id: 'team_abc', name: 'Platform', orgKey: 'achen', metadata: {} }
      }
    },
    'audit-log.json': { entries: [] }
  })
}

describe('field routes (handler-level)', () => {
  describe('field definition CRUD', () => {
    it('creates a field with multiValue', () => {
      const storage = makeFullStorage()
      const field = fieldStore.createFieldDefinition(storage, 'person', {
        label: 'Skills', type: 'constrained', multiValue: true, allowedValues: ['Go', 'Rust']
      }, 'admin@test.com')

      expect(field.multiValue).toBe(true)
      expect(field.allowedValues).toEqual(['Go', 'Rust'])
    })

    it('updates a field via PATCH', () => {
      const storage = makeFullStorage()
      const result = fieldStore.updateFieldDefinition(storage, 'person', 'field_c1', {
        label: 'Updated Component', multiValue: true
      }, 'admin@test.com')

      expect(result.label).toBe('Updated Component')
      expect(result.multiValue).toBe(true)
    })

    it('soft-deletes a field', () => {
      const storage = makeFullStorage()
      const result = fieldStore.softDeleteField(storage, 'person', 'field_c1', 'admin@test.com')
      expect(result.deleted).toBe(true)
    })

    it('reads all field definitions', () => {
      const storage = makeFullStorage()
      const defs = fieldStore.readFieldDefinitions(storage)
      expect(defs.personFields).toHaveLength(2)
      expect(defs.teamFields).toHaveLength(1)
    })
  })

  describe('person field value PATCH with validation', () => {
    it('validates and returns result with _warnings for required fields', () => {
      const storage = makeFullStorage()
      const existingValues = {}

      const { validated, warnings, errors } = fieldStore.validateFieldValues(
        storage, 'person', { field_c1: 'Platform' }, existingValues
      )
      expect(errors).toHaveLength(0)

      const result = fieldStore.updatePersonFields(storage, 'achen', validated, 'admin@test.com')
      expect(result.field_c1).toBe('Platform')

      // Check required warning
      expect(warnings.some(w => w.includes('Role is required'))).toBe(true)
    })

    it('returns 400-level errors for unknown fields', () => {
      const storage = makeFullStorage()
      const { errors } = fieldStore.validateFieldValues(
        storage, 'person', { field_unknown: 'x' }, {}
      )
      expect(errors.length).toBeGreaterThan(0)
    })

    it('coerces values for constrained multi-value fields', () => {
      const storage = makeFullStorage()
      // First make field_c1 multiValue
      fieldStore.updateFieldDefinition(storage, 'person', 'field_c1', { multiValue: true }, 'admin@test.com')

      const { validated } = fieldStore.validateFieldValues(
        storage, 'person', { field_c1: 'Platform' }, {}
      )
      expect(validated.field_c1).toEqual(['Platform'])
    })
  })

  describe('team field value PATCH returns flat metadata', () => {
    it('returns team.metadata (not full team object)', () => {
      const storage = makeFullStorage()

      const { validated, warnings } = fieldStore.validateFieldValues(
        storage, 'team', { field_tf1: 'Active' }, {}
      )

      const result = teamStore.updateTeamFields(storage, 'team_abc', validated, 'admin@test.com')
      // Simulate what the route handler does: extract metadata
      const response = { ...(result.metadata || {}) }
      if (warnings.length > 0) response._warnings = warnings

      expect(response.field_tf1).toBe('Active')
      // Should NOT have team-level properties
      expect(response.id).toBeUndefined()
      expect(response.name).toBeUndefined()
      expect(response.orgKey).toBeUndefined()
    })
  })
})
