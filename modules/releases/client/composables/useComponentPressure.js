import { computed } from 'vue'

/**
 * Computed filtering and sorting for component pressure data.
 * @param {import('vue').Ref} data - The full API response ref
 * @param {import('vue').Ref<string>} searchQuery - Component search filter
 * @param {import('vue').Ref<string>} sortField - Field to sort by
 * @param {import('vue').Ref<boolean>} sortAsc - Sort direction
 */
export function useComponentPressure(data, searchQuery, sortField, sortAsc) {
  const filteredComponents = computed(() => {
    if (!data.value?.component_pressure) return []
    let list = data.value.component_pressure

    // Filter by search query
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(c => c.component.toLowerCase().includes(q))
    }

    // Sort
    const field = sortField.value || 'net'
    const asc = sortAsc.value
    list = [...list].sort((a, b) => {
      let va = a[field]
      let vb = b[field]

      // Handle string sorting for component name
      if (field === 'component') {
        return asc
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va))
      }

      // Handle Infinity (native or string from JSON round-trip)
      if (va === Infinity || va === 'Infinity') va = Number.MAX_SAFE_INTEGER
      if (vb === Infinity || vb === 'Infinity') vb = Number.MAX_SAFE_INTEGER

      return asc ? va - vb : vb - va
    })

    return list
  })

  return { filteredComponents }
}
