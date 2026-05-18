import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useFieldFilters, coerceForDisplay } from '../../client/composables/useFieldFilters'

const singleField = {
  id: 'field_c1', label: 'Component', type: 'constrained', multiValue: false,
  visible: true, deleted: false, allowedValues: ['Platform', 'UI', 'Backend']
}

const multiField = {
  id: 'field_mv1', label: 'Skills', type: 'constrained', multiValue: true,
  visible: true, deleted: false, allowedValues: ['Go', 'Rust', 'Python']
}

const people = [
  { uid: 'a', name: 'Alice', _appFields: { field_c1: 'Platform', field_mv1: ['Go', 'Rust'] } },
  { uid: 'b', name: 'Bob', _appFields: { field_c1: 'UI', field_mv1: ['Python'] } },
  { uid: 'c', name: 'Carol', _appFields: { field_c1: 'Platform', field_mv1: ['Go', 'Python'] } },
  { uid: 'd', name: 'Dave', _appFields: { field_c1: 'Backend' } },
  { uid: 'e', name: 'Eve', _appFields: {} }
]

describe('coerceForDisplay', () => {
  it('coerces string to array for multiValue', () => {
    expect(coerceForDisplay('Go', { multiValue: true })).toEqual(['Go'])
  })

  it('coerces null to empty array for multiValue', () => {
    expect(coerceForDisplay(null, { multiValue: true })).toEqual([])
  })

  it('passes array through for multiValue', () => {
    expect(coerceForDisplay(['Go', 'Rust'], { multiValue: true })).toEqual(['Go', 'Rust'])
  })

  it('coerces array to first element for single-value', () => {
    expect(coerceForDisplay(['Go', 'Rust'], { multiValue: false })).toBe('Go')
  })

  it('passes string through for single-value', () => {
    expect(coerceForDisplay('Go', { multiValue: false })).toBe('Go')
  })
})

describe('useFieldFilters', () => {
  function setup(fieldDefs = [singleField, multiField]) {
    const items = ref(people)
    const defs = ref(fieldDefs)
    return useFieldFilters(items, defs, (item) => item._appFields || {})
  }

  it('returns all items when no filters active', () => {
    const { filtered } = setup()
    expect(filtered.value).toHaveLength(5)
  })

  it('filters by single field', () => {
    const { setFilter, filtered } = setup()
    setFilter('field_c1', ['Platform'])
    expect(filtered.value).toHaveLength(2)
    expect(filtered.value.map(p => p.uid)).toEqual(['a', 'c'])
  })

  it('filters by multiple values within same field (OR)', () => {
    const { setFilter, filtered } = setup()
    setFilter('field_c1', ['Platform', 'UI'])
    expect(filtered.value).toHaveLength(3)
  })

  it('filters by multiple fields (AND)', () => {
    const { setFilter, filtered } = setup()
    setFilter('field_c1', ['Platform'])
    setFilter('field_mv1', ['Go'])
    expect(filtered.value).toHaveLength(2) // Alice and Carol have Platform AND Go
  })

  it('multi-value field filtering: OR within values', () => {
    const { setFilter, filtered } = setup()
    setFilter('field_mv1', ['Rust'])
    expect(filtered.value).toHaveLength(1)
    expect(filtered.value[0].uid).toBe('a')
  })

  it('computes absolute filter counts from unfiltered list', () => {
    const { filterCounts, setFilter } = setup()
    // Even before filtering, counts should reflect the full list
    expect(filterCounts.value.field_c1['Platform']).toBe(2)
    expect(filterCounts.value.field_c1['UI']).toBe(1)
    expect(filterCounts.value.field_c1['Backend']).toBe(1)

    // Counts should NOT change when a filter is active
    setFilter('field_c1', ['Platform'])
    expect(filterCounts.value.field_c1['Platform']).toBe(2)
    expect(filterCounts.value.field_c1['UI']).toBe(1)
  })

  it('clears a single filter', () => {
    const { setFilter, clearFilter, filtered } = setup()
    setFilter('field_c1', ['Platform'])
    expect(filtered.value).toHaveLength(2)
    clearFilter('field_c1')
    expect(filtered.value).toHaveLength(5)
  })

  it('clears all filters', () => {
    const { setFilter, clearAll, filtered } = setup()
    setFilter('field_c1', ['Platform'])
    setFilter('field_mv1', ['Go'])
    expect(filtered.value).toHaveLength(2)
    clearAll()
    expect(filtered.value).toHaveLength(5)
  })

  it('handles mixed string/array values during filtering (coercion)', () => {
    const items = ref([
      { uid: 'x', _appFields: { field_mv1: 'Go' } } // legacy string for multiValue field
    ])
    const defs = ref([multiField])
    const { setFilter, filtered } = useFieldFilters(items, defs, (item) => item._appFields || {})

    setFilter('field_mv1', ['Go'])
    expect(filtered.value).toHaveLength(1)
  })
})
