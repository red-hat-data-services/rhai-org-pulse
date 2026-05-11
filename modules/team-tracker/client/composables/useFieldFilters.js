import { ref, computed } from 'vue'

/**
 * Coerce a field value for display/filtering based on the field definition.
 * Handles mixed string/array storage after toggling multiValue.
 */
export function coerceForDisplay(value, fieldDef) {
  if (fieldDef && fieldDef.multiValue) {
    if (value == null || value === '') return []
    return Array.isArray(value) ? value : [value]
  }
  if (Array.isArray(value)) return value[0] || null
  return value
}

/**
 * Provides reactive field-based filtering for a list of items.
 *
 * @param {import('vue').Ref<Array>} items - The FULL unfiltered list (people or teams)
 * @param {import('vue').Ref<Array>} fieldDefinitions - Active field definitions
 * @param {Function} getFieldValues - (item) => { fieldId: value } extractor
 * @returns {Object} { activeFilters, setFilter, clearFilter, clearAll, filtered, filterCounts }
 */
export function useFieldFilters(items, fieldDefinitions, getFieldValues) {
  // Maps fieldId -> array of selected values. AND across fields, OR within a field.
  const activeFilters = ref({})

  /**
   * Filterable fields: visible, non-deleted, constrained type.
   */
  const filterableFields = computed(() =>
    (fieldDefinitions.value || []).filter(f => f.visible && !f.deleted && f.type === 'constrained')
  )

  /**
   * Per-value counts computed from the FULL unfiltered list (absolute counts).
   * Returns Record<fieldId, Record<optionValue, number>>
   */
  const filterCounts = computed(() => {
    const counts = {}
    for (const field of filterableFields.value) {
      counts[field.id] = {}
      if (!field.allowedValues) continue
      for (const opt of field.allowedValues) {
        counts[field.id][opt] = 0
      }
    }

    for (const item of (items.value || [])) {
      const vals = getFieldValues(item)
      for (const field of filterableFields.value) {
        const raw = vals[field.id]
        const coerced = coerceForDisplay(raw, field)
        const arr = Array.isArray(coerced) ? coerced : (coerced ? [coerced] : [])
        for (const v of arr) {
          if (counts[field.id] && v != null) {
            counts[field.id][v] = (counts[field.id][v] || 0) + 1
          }
        }
      }
    }

    return counts
  })

  /**
   * Filtered list after applying all active filters.
   * AND across fields, OR within a field.
   */
  const filtered = computed(() => {
    const activeEntries = Object.entries(activeFilters.value).filter(([, vals]) => vals.length > 0)
    if (activeEntries.length === 0) return items.value || []

    return (items.value || []).filter(item => {
      const vals = getFieldValues(item)
      return activeEntries.every(([fieldId, selectedValues]) => {
        const field = filterableFields.value.find(f => f.id === fieldId)
        const raw = vals[fieldId]
        const coerced = coerceForDisplay(raw, field)
        const arr = Array.isArray(coerced) ? coerced : (coerced ? [coerced] : [])
        // OR within a field: any selected value matches
        return arr.some(v => selectedValues.includes(v))
      })
    })
  })

  function setFilter(fieldId, values) {
    activeFilters.value = { ...activeFilters.value, [fieldId]: values }
  }

  function clearFilter(fieldId) {
    const next = { ...activeFilters.value }
    delete next[fieldId]
    activeFilters.value = next
  }

  function clearAll() {
    activeFilters.value = {}
  }

  return {
    activeFilters,
    filterableFields,
    setFilter,
    clearFilter,
    clearAll,
    filtered,
    filterCounts
  }
}
