import { describe, it, expect } from 'vitest'

const fieldStore = require('../../../../shared/server/field-store')

function makeStorage(initial = {}) {
  const data = { ...initial }
  return {
    readFromStorage(key) { return data[key] ? JSON.parse(JSON.stringify(data[key])) : null },
    writeToStorage(key, val) { data[key] = JSON.parse(JSON.stringify(val)) },
    _data: data
  }
}

function makeStorageWithFieldDefs(fieldDefs) {
  return makeStorage({
    'team-data/field-definitions.json': fieldDefs,
    'team-data/registry.json': {
      meta: { generatedAt: '2026-01-01T00:00:00.000Z', provider: 'test', orgRoots: ['achen'] },
      people: {
        achen: { uid: 'achen', name: 'Alice Chen', status: 'active', _appFields: {} }
      }
    },
    'audit-log.json': { entries: [] }
  })
}

describe('field-store', () => {
  describe('createFieldDefinition', () => {
    it('creates a free-text field', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const field = fieldStore.createFieldDefinition(storage, 'person', {
        label: 'Focus Area', type: 'free-text'
      }, 'admin@test.com')

      expect(field.id).toMatch(/^field_/)
      expect(field.label).toBe('Focus Area')
      expect(field.type).toBe('free-text')
      expect(field.multiValue).toBe(false)
      expect(field.required).toBe(false)
      expect(field.deleted).toBe(false)
    })

    it('creates a constrained field with multiValue', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const field = fieldStore.createFieldDefinition(storage, 'person', {
        label: 'Skills', type: 'constrained', multiValue: true, allowedValues: ['Go', 'Rust']
      }, 'admin@test.com')

      expect(field.type).toBe('constrained')
      expect(field.multiValue).toBe(true)
      expect(field.allowedValues).toEqual(['Go', 'Rust'])
    })

    it('ignores multiValue for non-constrained types', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const field = fieldStore.createFieldDefinition(storage, 'person', {
        label: 'Notes', type: 'free-text', multiValue: true
      }, 'admin@test.com')

      expect(field.multiValue).toBe(false)
    })

    it('rejects invalid allowedValues (not array)', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      expect(() => {
        fieldStore.createFieldDefinition(storage, 'person', {
          label: 'Bad', type: 'constrained', allowedValues: 'not-an-array'
        }, 'admin@test.com')
      }).toThrow('allowedValues must be an array')
    })

    it('rejects allowedValues with non-string entries', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      expect(() => {
        fieldStore.createFieldDefinition(storage, 'person', {
          label: 'Bad', type: 'constrained', allowedValues: [123]
        }, 'admin@test.com')
      }).toThrow('must be a string')
    })

    it('creates a team field', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const field = fieldStore.createFieldDefinition(storage, 'team', {
        label: 'Status', type: 'constrained', allowedValues: ['Active', 'Forming']
      }, 'admin@test.com')

      expect(field.label).toBe('Status')
      const defs = fieldStore.readFieldDefinitions(storage)
      expect(defs.teamFields).toHaveLength(1)
    })
  })

  describe('updateFieldDefinition', () => {
    it('updates label and multiValue', () => {
      const storage = makeStorageWithFieldDefs({
        personFields: [{
          id: 'field_abc', label: 'Old', type: 'constrained', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: ['A'],
          deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        }],
        teamFields: []
      })

      const result = fieldStore.updateFieldDefinition(storage, 'person', 'field_abc', {
        label: 'New', multiValue: true
      }, 'admin@test.com')

      expect(result.label).toBe('New')
      expect(result.multiValue).toBe(true)
    })

    it('returns null for unknown field', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const result = fieldStore.updateFieldDefinition(storage, 'person', 'field_nope', { label: 'X' }, 'admin@test.com')
      expect(result).toBeNull()
    })

    it('rejects invalid type on update', () => {
      const storage = makeStorageWithFieldDefs({
        personFields: [{
          id: 'field_abc', label: 'Test', type: 'free-text', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: null,
          deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        }],
        teamFields: []
      })
      expect(() => {
        fieldStore.updateFieldDefinition(storage, 'person', 'field_abc', { type: 'invalid-type' }, 'admin@test.com')
      }).toThrow('Invalid type')
    })

    it('rejects invalid allowedValues on update', () => {
      const storage = makeStorageWithFieldDefs({
        personFields: [{
          id: 'field_abc', label: 'Test', type: 'constrained', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: ['A'],
          deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        }],
        teamFields: []
      })
      expect(() => {
        fieldStore.updateFieldDefinition(storage, 'person', 'field_abc', { allowedValues: 'not-array' }, 'admin@test.com')
      }).toThrow('allowedValues must be an array')
    })
  })

  describe('softDeleteField', () => {
    it('marks as deleted without removing', () => {
      const storage = makeStorageWithFieldDefs({
        personFields: [{
          id: 'field_del', label: 'Del', type: 'free-text', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: null,
          deleted: false, order: 0, createdAt: '2026-01-01', createdBy: 'admin@test.com'
        }],
        teamFields: []
      })

      const result = fieldStore.softDeleteField(storage, 'person', 'field_del', 'admin@test.com')
      expect(result.deleted).toBe(true)

      const defs = fieldStore.readFieldDefinitions(storage)
      expect(defs.personFields).toHaveLength(1)
      expect(defs.personFields[0].deleted).toBe(true)
    })
  })

  describe('reorderFields', () => {
    it('reorders correctly', () => {
      const storage = makeStorageWithFieldDefs({
        personFields: [
          { id: 'f1', label: 'First', order: 0, deleted: false },
          { id: 'f2', label: 'Second', order: 1, deleted: false },
          { id: 'f3', label: 'Third', order: 2, deleted: false }
        ],
        teamFields: []
      })

      fieldStore.reorderFields(storage, 'person', ['f3', 'f1', 'f2'], 'admin@test.com')
      const defs = fieldStore.readFieldDefinitions(storage)
      expect(defs.personFields.map(f => f.id)).toEqual(['f3', 'f1', 'f2'])
    })
  })

  describe('updatePersonFields', () => {
    it('sets values and returns _appFields', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const result = fieldStore.updatePersonFields(storage, 'achen', { field_x: 'hello' }, 'admin@test.com')
      expect(result).toEqual({ field_x: 'hello' })
    })

    it('handles multi-value arrays', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const result = fieldStore.updatePersonFields(storage, 'achen', { field_x: ['A', 'B'] }, 'admin@test.com')
      expect(result).toEqual({ field_x: ['A', 'B'] })
    })

    it('returns null for unknown person', () => {
      const storage = makeStorageWithFieldDefs({ personFields: [], teamFields: [] })
      const result = fieldStore.updatePersonFields(storage, 'nobody', { field_x: 'y' }, 'admin@test.com')
      expect(result).toBeNull()
    })
  })

  describe('coerceFieldValue', () => {
    it('coerces string to array for multiValue', () => {
      expect(fieldStore.coerceFieldValue('hello', { multiValue: true })).toEqual(['hello'])
    })

    it('coerces null to empty array for multiValue', () => {
      expect(fieldStore.coerceFieldValue(null, { multiValue: true })).toEqual([])
    })

    it('coerces empty string to empty array for multiValue', () => {
      expect(fieldStore.coerceFieldValue('', { multiValue: true })).toEqual([])
    })

    it('passes through array for multiValue', () => {
      expect(fieldStore.coerceFieldValue(['a', 'b'], { multiValue: true })).toEqual(['a', 'b'])
    })

    it('coerces array to first element for single-value', () => {
      expect(fieldStore.coerceFieldValue(['a', 'b'], { multiValue: false })).toBe('a')
    })

    it('coerces empty array to null for single-value', () => {
      expect(fieldStore.coerceFieldValue([], { multiValue: false })).toBeNull()
    })

    it('passes through string for single-value', () => {
      expect(fieldStore.coerceFieldValue('hello', { multiValue: false })).toBe('hello')
    })

    it('passes through null for single-value', () => {
      expect(fieldStore.coerceFieldValue(null, { multiValue: false })).toBeNull()
    })
  })

  describe('validateFieldValues', () => {
    const baseDefs = {
      personFields: [
        {
          id: 'field_c1', label: 'Component', type: 'constrained', multiValue: false,
          required: false, visible: true, primaryDisplay: false, allowedValues: ['Platform', 'UI'],
          deleted: false, order: 0
        },
        {
          id: 'field_mv1', label: 'Skills', type: 'constrained', multiValue: true,
          required: false, visible: true, primaryDisplay: false, allowedValues: ['Go', 'Rust', 'Python'],
          deleted: false, order: 1
        },
        {
          id: 'field_req1', label: 'Role', type: 'constrained', multiValue: false,
          required: true, visible: true, primaryDisplay: false, allowedValues: ['BE', 'FE'],
          deleted: false, order: 2
        }
      ],
      teamFields: []
    }

    it('validates constrained values (lenient mode)', () => {
      const storage = makeStorageWithFieldDefs(baseDefs)
      const { validated, errors } = fieldStore.validateFieldValues(storage, 'person', {
        field_c1: 'Platform'
      })
      expect(errors).toHaveLength(0)
      expect(validated.field_c1).toBe('Platform')
    })

    it('warns on stale constrained values', () => {
      const storage = makeStorageWithFieldDefs(baseDefs)
      const { validated, warnings, errors } = fieldStore.validateFieldValues(storage, 'person', {
        field_c1: 'OldValue'
      })
      expect(errors).toHaveLength(0)
      expect(warnings.some(w => w.includes('OldValue'))).toBe(true)
      expect(validated.field_c1).toBe('OldValue')
    })

    it('errors on unknown field', () => {
      const storage = makeStorageWithFieldDefs(baseDefs)
      const { errors } = fieldStore.validateFieldValues(storage, 'person', {
        field_unknown: 'x'
      })
      expect(errors.some(e => e.includes('Unknown field'))).toBe(true)
    })

    it('coerces string to array for multiValue field', () => {
      const storage = makeStorageWithFieldDefs(baseDefs)
      const { validated } = fieldStore.validateFieldValues(storage, 'person', {
        field_mv1: 'Go'
      })
      expect(validated.field_mv1).toEqual(['Go'])
    })

    it('coerces array to first element for single-value field', () => {
      const storage = makeStorageWithFieldDefs(baseDefs)
      const { validated } = fieldStore.validateFieldValues(storage, 'person', {
        field_c1: ['Platform', 'UI']
      })
      expect(validated.field_c1).toBe('Platform')
    })

    it('reports required field warnings', () => {
      const storage = makeStorageWithFieldDefs(baseDefs)
      const { warnings } = fieldStore.validateFieldValues(storage, 'person', {
        field_c1: 'Platform'
      }, {})
      expect(warnings.some(w => w.includes('Role is required'))).toBe(true)
    })

    it('does not warn for required field when existing value present', () => {
      const storage = makeStorageWithFieldDefs(baseDefs)
      const { warnings } = fieldStore.validateFieldValues(storage, 'person', {
        field_c1: 'Platform'
      }, { field_req1: 'BE' })
      expect(warnings.some(w => w.includes('Role'))).toBe(false)
    })
  })

  describe('fixture validation', () => {
    it('fixtures/team-data/field-definitions.json matches expected schema', () => {
      const fixture = require('../../../../fixtures/team-data/field-definitions.json')
      expect(fixture).toHaveProperty('personFields')
      expect(fixture).toHaveProperty('teamFields')
      expect(Array.isArray(fixture.personFields)).toBe(true)
      expect(Array.isArray(fixture.teamFields)).toBe(true)

      const validTypes = ['free-text', 'constrained', 'person-reference-linked']

      for (const field of [...fixture.personFields, ...fixture.teamFields]) {
        expect(field).toHaveProperty('id')
        expect(field).toHaveProperty('label')
        expect(field).toHaveProperty('type')
        expect(validTypes).toContain(field.type)
        expect(typeof field.deleted).toBe('boolean')
        expect(typeof field.visible).toBe('boolean')

        if (field.type === 'constrained' && field.multiValue) {
          expect(Array.isArray(field.allowedValues)).toBe(true)
          expect(field.allowedValues.length).toBeGreaterThan(0)
        }
      }

      // Verify at least one multiValue field exists
      const hasMultiValue = fixture.personFields.some(f => f.multiValue === true)
      expect(hasMultiValue).toBe(true)

      // Verify at least one required field exists
      const hasRequired = fixture.personFields.some(f => f.required === true)
      expect(hasRequired).toBe(true)
    })
  })
})
