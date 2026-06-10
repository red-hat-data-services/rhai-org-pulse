import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useComponentPressure } from '../../../client/composables/useComponentPressure'

function makeData(components) {
  return ref({
    component_pressure: components || [
      { component: 'Alpha', created: 10, resolved: 5, net: 5, open: 8, pressure_ratio: 2.0 },
      { component: 'Beta', created: 20, resolved: 15, net: 5, open: 12, pressure_ratio: 1.33 },
      { component: 'Gamma', created: 3, resolved: 3, net: 0, open: 1, pressure_ratio: 1.0 }
    ]
  })
}

describe('useComponentPressure', function () {
  it('returns all components when no filter', function () {
    var data = makeData()
    var search = ref('')
    var sortField = ref('net')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value).toHaveLength(3)
  })

  it('returns empty array when data is null', function () {
    var data = ref(null)
    var search = ref('')
    var sortField = ref('net')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value).toHaveLength(0)
  })

  it('returns empty array when component_pressure is missing', function () {
    var data = ref({})
    var search = ref('')
    var sortField = ref('net')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value).toHaveLength(0)
  })

  it('filters by component name (case insensitive)', function () {
    var data = makeData()
    var search = ref('alp')
    var sortField = ref('net')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value).toHaveLength(1)
    expect(result.filteredComponents.value[0].component).toBe('Alpha')
  })

  it('sorts by net descending by default', function () {
    var data = makeData([
      { component: 'A', net: 1 },
      { component: 'B', net: 10 },
      { component: 'C', net: 5 }
    ])
    var search = ref('')
    var sortField = ref('net')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value[0].component).toBe('B')
    expect(result.filteredComponents.value[1].component).toBe('C')
    expect(result.filteredComponents.value[2].component).toBe('A')
  })

  it('sorts ascending when sortAsc is true', function () {
    var data = makeData([
      { component: 'A', net: 1 },
      { component: 'B', net: 10 },
      { component: 'C', net: 5 }
    ])
    var search = ref('')
    var sortField = ref('net')
    var sortAsc = ref(true)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value[0].component).toBe('A')
    expect(result.filteredComponents.value[2].component).toBe('B')
  })

  it('sorts by component name alphabetically', function () {
    var data = makeData([
      { component: 'Zebra', net: 1 },
      { component: 'Apple', net: 1 },
      { component: 'Mango', net: 1 }
    ])
    var search = ref('')
    var sortField = ref('component')
    var sortAsc = ref(true)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value[0].component).toBe('Apple')
    expect(result.filteredComponents.value[2].component).toBe('Zebra')
  })

  it('handles Infinity in pressure_ratio during sort', function () {
    var data = makeData([
      { component: 'A', pressure_ratio: Infinity },
      { component: 'B', pressure_ratio: 2.0 },
      { component: 'C', pressure_ratio: 5.0 }
    ])
    var search = ref('')
    var sortField = ref('pressure_ratio')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value[0].component).toBe('A')
  })

  it('handles empty component_pressure array', function () {
    var data = makeData([])
    var search = ref('')
    var sortField = ref('net')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value).toHaveLength(0)
  })

  it('sorts string "Infinity" values correctly (from JSON round-trip)', function () {
    var data = makeData([
      { component: 'Finite', pressure_ratio: 2.5 },
      { component: 'Infinite', pressure_ratio: 'Infinity' },
      { component: 'Zero', pressure_ratio: 0 }
    ])
    var search = ref('')
    var sortField = ref('pressure_ratio')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    // "Infinity" string should sort as largest value
    expect(result.filteredComponents.value[0].component).toBe('Infinite')
    expect(result.filteredComponents.value[1].component).toBe('Finite')
    expect(result.filteredComponents.value[2].component).toBe('Zero')
  })

  it('is reactive to search changes', function () {
    var data = makeData()
    var search = ref('')
    var sortField = ref('net')
    var sortAsc = ref(false)
    var result = useComponentPressure(data, search, sortField, sortAsc)
    expect(result.filteredComponents.value).toHaveLength(3)
    search.value = 'beta'
    expect(result.filteredComponents.value).toHaveLength(1)
    expect(result.filteredComponents.value[0].component).toBe('Beta')
  })
})
