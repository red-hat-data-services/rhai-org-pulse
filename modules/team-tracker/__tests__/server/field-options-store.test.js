import { describe, it, expect, vi } from 'vitest'

const fieldOptionsStore = require('../../server/field-options-store')

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

describe('field-options-store', () => {
  describe('listFieldOptions', () => {
    it('returns summary of all option sets', () => {
      const storage = makeStorage({
        'team-data/field-options/components.json': {
          name: 'components', label: 'Components', values: ['A', 'B', 'C']
        },
        'team-data/field-options/tags.json': {
          name: 'tags', label: 'Tags', values: ['X']
        }
      })
      const result = fieldOptionsStore.listFieldOptions(storage)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ name: 'components', label: 'Components', count: 3 })
      expect(result[1]).toEqual({ name: 'tags', label: 'Tags', count: 1 })
    })

    it('returns empty array when no option sets exist', () => {
      const storage = makeStorage({})
      const result = fieldOptionsStore.listFieldOptions(storage)
      expect(result).toEqual([])
    })
  })

  describe('getValues', () => {
    it('returns values array for existing option set', () => {
      const storage = makeStorage({
        'team-data/field-options/components.json': {
          name: 'components', label: 'Components', values: ['A', 'B']
        }
      })
      expect(fieldOptionsStore.getValues(storage, 'components')).toEqual(['A', 'B'])
    })

    it('returns null for non-existent option set', () => {
      const storage = makeStorage({})
      expect(fieldOptionsStore.getValues(storage, 'nonexistent')).toBeNull()
    })
  })

  describe('addValues', () => {
    it('adds new values and deduplicates', () => {
      const storage = makeStorage({
        'team-data/field-options/components.json': {
          name: 'components', label: 'Components', values: ['A', 'B']
        },
        'audit-log.json': { entries: [] }
      })
      const result = fieldOptionsStore.addValues(storage, 'components', ['B', 'C', 'D'], 'user@test.com')
      expect(result.added).toEqual(['C', 'D'])
      expect(result.total).toBe(4)

      const saved = storage._data['team-data/field-options/components.json']
      expect(saved.values).toEqual(['A', 'B', 'C', 'D']) // sorted
    })

    it('creates option set if it does not exist', () => {
      const storage = makeStorage({ 'audit-log.json': { entries: [] } })
      const result = fieldOptionsStore.addValues(storage, 'newthing', ['X', 'Y'], 'user@test.com')
      expect(result.added).toEqual(['X', 'Y'])
      expect(result.total).toBe(2)

      const saved = storage._data['team-data/field-options/newthing.json']
      expect(saved.name).toBe('newthing')
      expect(saved.label).toBe('Newthing')
    })

    it('trims whitespace and ignores empty strings', () => {
      const storage = makeStorage({ 'audit-log.json': { entries: [] } })
      const result = fieldOptionsStore.addValues(storage, 'test', ['  A  ', '', '  '], 'user@test.com')
      expect(result.added).toEqual(['A'])
    })
  })

  describe('replaceValues', () => {
    it('replaces all values, dedupes and sorts', () => {
      const storage = makeStorage({ 'audit-log.json': { entries: [] } })
      const result = fieldOptionsStore.replaceValues(storage, 'components', ['C', 'A', 'B', 'A'], 'Components', 'user@test.com')
      expect(result.values).toEqual(['A', 'B', 'C'])
      expect(result.name).toBe('components')
      expect(result.label).toBe('Components')
    })
  })

  describe('removeValues', () => {
    it('removes specified values', () => {
      const storage = makeStorage({
        'team-data/field-options/components.json': {
          name: 'components', label: 'Components', values: ['A', 'B', 'C']
        },
        'audit-log.json': { entries: [] }
      })
      const result = fieldOptionsStore.removeValues(storage, 'components', ['B'], 'user@test.com')
      expect(result.removed).toBe(1)
      expect(result.total).toBe(2)
    })

    it('returns null for non-existent option set', () => {
      const storage = makeStorage({})
      const result = fieldOptionsStore.removeValues(storage, 'nonexistent', ['A'], 'user@test.com')
      expect(result).toBeNull()
    })
  })

  describe('path sanitization', () => {
    it('strips unsafe characters from option set name', () => {
      const storage = makeStorage({ 'audit-log.json': { entries: [] } })
      fieldOptionsStore.replaceValues(storage, '../../../etc/passwd', ['X'], null, 'user@test.com')
      // Should write to sanitized path, not allow traversal
      expect(storage._data['team-data/field-options/etcpasswd.json']).toBeDefined()
      expect(storage._data['../../../etc/passwd.json']).toBeUndefined()
    })

    it('throws on empty-after-sanitization name', () => {
      const storage = makeStorage({})
      expect(() => {
        fieldOptionsStore.getValues(storage, '../../..')
      }).toThrow('empty after sanitization')
    })
  })

  describe('multi-option-set isolation', () => {
    it('operations on one set do not affect another', () => {
      const storage = makeStorage({
        'team-data/field-options/components.json': {
          name: 'components', label: 'Components', values: ['A']
        },
        'team-data/field-options/tags.json': {
          name: 'tags', label: 'Tags', values: ['X']
        },
        'audit-log.json': { entries: [] }
      })

      fieldOptionsStore.addValues(storage, 'components', ['B'], 'user@test.com')
      expect(fieldOptionsStore.getValues(storage, 'tags')).toEqual(['X'])
      expect(fieldOptionsStore.getValues(storage, 'components')).toEqual(['A', 'B'])
    })
  })
})
