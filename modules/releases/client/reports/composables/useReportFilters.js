import { ref, reactive, computed } from 'vue'

/**
 * Reusable report filter composable.
 *
 * Provides multi-field filtering with AND/OR modes, localStorage persistence,
 * and named preset management. Extracted from CapacityCommitmentReport.
 *
 * @param {Object} options
 * @param {string} options.storageKeyPrefix - Prefix for localStorage keys (e.g. 'capacity-report')
 * @param {Array<{key: string, label: string}>} options.filterFields - Available filter field definitions
 */
export function useReportFilters({ storageKeyPrefix, filterFields }) {
  const FILTERS_STORAGE_KEY = `tt_cache:${storageKeyPrefix}-active-filters`
  const SAVED_FILTERS_STORAGE_KEY = `tt_cache:${storageKeyPrefix}-saved-filters`

  // ── Filter state ──
  const activeFilters = reactive({})
  const filterModes = reactive({}) // per-field: 'or' (default) or 'and'
  const crossFieldMode = ref('and') // across fields: 'and' (default) or 'or'
  const filterModalOpen = ref(false)
  const filterModalField = ref(null)
  const filterModalSearch = ref('')
  const filterModalTab = ref('fields')
  const showSaveForm = ref(false)
  const savedFilters = ref([])
  const savedFilterName = ref('')
  const savedFilterDescription = ref('')
  const editingFilterId = ref(null)
  const appliedPresetId = ref(null)

  // ── Computeds ──

  const hasActiveFilters = computed(() => {
    return Object.values(activeFilters).some(v => v && v.length > 0)
  })

  const activeFieldCount = computed(() => {
    return Object.values(activeFilters).filter(v => v && v.length > 0).length
  })

  const activeFilterDisplay = computed(() => {
    const result = {}
    for (const [field, values] of Object.entries(activeFilters)) {
      if (values && values.length > 0) result[field] = values
    }
    return result
  })

  const appliedPreset = computed(() => {
    if (!appliedPresetId.value) return null
    return savedFilters.value.find(f => f.id === appliedPresetId.value) || null
  })

  const filterNarrativeParts = computed(() => {
    return Object.entries(activeFilterDisplay.value).map(([field, values]) => ({
      field,
      label: filterFieldLabel(field),
      values: formatFilterValues(values)
    }))
  })

  /**
   * Compute modal values for the currently selected field, given available values.
   * @param {Object} availableValues - { [fieldKey]: string[] }
   */
  function getFilterModalValues(availableValues) {
    if (!filterModalField.value) return { selected: [], unselected: [] }
    const all = (availableValues || {})[filterModalField.value] || []
    const q = filterModalSearch.value.toLowerCase().trim()
    const filtered = q ? all.filter(v => v.toLowerCase().includes(q)) : all
    const active = activeFilters[filterModalField.value] || []
    const activeSet = new Set(active)
    const selected = filtered.filter(v => activeSet.has(v))
    const unselected = filtered.filter(v => !activeSet.has(v))
    return { selected, unselected }
  }

  // ── Helpers ──

  function filterFieldLabel(key) {
    const field = filterFields.find(f => f.key === key)
    return field ? field.label : key
  }

  function formatFilterValues(values) {
    if (values.length <= 2) return values.join(', ')
    return values.slice(0, 2).join(', ') + ' +' + (values.length - 2)
  }

  // ── Filter matching ──

  function matchesFieldFilter(item, field, values) {
    const valSet = new Set(values)
    const mode = filterModes[field] || 'or'
    const val = item[field]
    if (mode === 'and') {
      if (Array.isArray(val)) return [...valSet].every(v => val.includes(v))
      return valSet.size === 1 && valSet.has(val || '')
    }
    if (Array.isArray(val)) return val.some(v => valSet.has(v))
    return valSet.has(val || '')
  }

  function filterItems(items) {
    const activeEntries = Object.entries(activeFilters).filter(([, v]) => v && v.length > 0)
    if (activeEntries.length === 0) return items

    if (crossFieldMode.value === 'or') {
      return items.filter(item =>
        activeEntries.some(([field, values]) => matchesFieldFilter(item, field, values))
      )
    }
    return items.filter(item =>
      activeEntries.every(([field, values]) => matchesFieldFilter(item, field, values))
    )
  }

  // ── Filter actions ──

  function toggleFilterValue(field, value) {
    if (!activeFilters[field]) activeFilters[field] = []
    const idx = activeFilters[field].indexOf(value)
    if (idx >= 0) {
      activeFilters[field].splice(idx, 1)
      if (activeFilters[field].length === 0) delete activeFilters[field]
    } else {
      activeFilters[field].push(value)
    }
    appliedPresetId.value = null
    persistActiveFilters()
  }

  function toggleFilterMode(field) {
    filterModes[field] = (filterModes[field] || 'or') === 'or' ? 'and' : 'or'
    persistActiveFilters()
  }

  function clearAllFilters() {
    for (const key of Object.keys(activeFilters)) delete activeFilters[key]
    for (const key of Object.keys(filterModes)) delete filterModes[key]
    crossFieldMode.value = 'and'
    appliedPresetId.value = null
    editingFilterId.value = null
    persistActiveFilters()
  }

  // ── Modal control ──

  function openFilterModal() {
    filterModalField.value = filterFields[0]?.key || null
    filterModalSearch.value = ''
    filterModalTab.value = 'fields'
    filterModalOpen.value = true
  }

  function openFilterModalToPresets() {
    filterModalTab.value = 'presets'
    filterModalOpen.value = true
  }

  function closeFilterModal() {
    filterModalOpen.value = false
    filterModalSearch.value = ''
    showSaveForm.value = false
  }

  function selectFilterField(key) {
    filterModalField.value = key
    filterModalSearch.value = ''
  }

  // ── Persistence ──

  function persistActiveFilters() {
    const data = {}
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v && v.length > 0) data[k] = v
    }
    const modes = {}
    for (const [k, v] of Object.entries(filterModes)) {
      if (v === 'and') modes[k] = v
    }
    const cross = crossFieldMode.value !== 'and' ? crossFieldMode.value : undefined
    if (Object.keys(data).length > 0 || Object.keys(modes).length > 0) {
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ filters: data, modes, crossFieldMode: cross }))
    } else {
      localStorage.removeItem(FILTERS_STORAGE_KEY)
    }
  }

  function loadActiveFilters() {
    try {
      const stored = localStorage.getItem(FILTERS_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      // Support both old format (flat object) and new format ({ filters, modes })
      const filters = parsed.filters || (Array.isArray(parsed) ? {} : (!parsed.modes ? parsed : {}))
      const modes = parsed.modes || {}
      for (const [k, v] of Object.entries(filters)) {
        if (Array.isArray(v) && v.length > 0) activeFilters[k] = v
      }
      for (const [k, v] of Object.entries(modes)) {
        if (v === 'and') filterModes[k] = v
      }
      if (parsed.crossFieldMode) crossFieldMode.value = parsed.crossFieldMode
    } catch { /* ignore */ }
  }

  function persistSavedFilters() {
    localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(savedFilters.value))
  }

  function loadSavedFilters() {
    try {
      const stored = localStorage.getItem(SAVED_FILTERS_STORAGE_KEY)
      if (stored) savedFilters.value = JSON.parse(stored)
    } catch { /* ignore */ }
  }

  // ── Preset management ──

  function restorePresetState(preset) {
    for (const key of Object.keys(activeFilters)) delete activeFilters[key]
    for (const key of Object.keys(filterModes)) delete filterModes[key]
    for (const [k, v] of Object.entries(preset.filters)) {
      if (Array.isArray(v) && v.length > 0) activeFilters[k] = [...v]
    }
    if (preset.modes) {
      for (const [k, v] of Object.entries(preset.modes)) filterModes[k] = v
    }
    crossFieldMode.value = preset.crossFieldMode || 'and'
  }

  function saveCurrentFilters() {
    const name = savedFilterName.value.trim()
    if (!name) return

    const filterData = {}
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v && v.length > 0) filterData[k] = [...v]
    }
    const modesData = {}
    for (const [k, v] of Object.entries(filterModes)) {
      if (v === 'and') modesData[k] = v
    }

    if (editingFilterId.value) {
      const idx = savedFilters.value.findIndex(f => f.id === editingFilterId.value)
      if (idx >= 0) {
        savedFilters.value[idx] = {
          ...savedFilters.value[idx],
          name,
          description: savedFilterDescription.value.trim(),
          filters: filterData,
          modes: modesData,
          crossFieldMode: crossFieldMode.value
        }
      }
      editingFilterId.value = null
    } else {
      savedFilters.value.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        description: savedFilterDescription.value.trim(),
        filters: filterData,
        modes: modesData,
        crossFieldMode: crossFieldMode.value
      })
    }

    persistSavedFilters()
    savedFilterName.value = ''
    savedFilterDescription.value = ''
    showSaveForm.value = false
  }

  function applySavedFilter(preset) {
    restorePresetState(preset)
    appliedPresetId.value = preset.id
    persistActiveFilters()
    editingFilterId.value = null
    closeFilterModal()
  }

  function editSavedFilter(preset) {
    restorePresetState(preset)
    persistActiveFilters()
    editingFilterId.value = preset.id
    savedFilterName.value = preset.name
    savedFilterDescription.value = preset.description || ''
    showSaveForm.value = true
    filterModalTab.value = 'fields'
  }

  function cancelSaveForm() {
    showSaveForm.value = false
    editingFilterId.value = null
    savedFilterName.value = ''
    savedFilterDescription.value = ''
  }

  function cancelEditFilter() {
    editingFilterId.value = null
    savedFilterName.value = ''
    savedFilterDescription.value = ''
  }

  function deleteSavedFilter(id) {
    savedFilters.value = savedFilters.value.filter(f => f.id !== id)
    persistSavedFilters()
    if (editingFilterId.value === id) cancelEditFilter()
  }

  // ── Initialize ──
  loadActiveFilters()
  loadSavedFilters()

  return {
    // State
    activeFilters,
    filterModes,
    crossFieldMode,
    filterModalOpen,
    filterModalField,
    filterModalSearch,
    filterModalTab,
    showSaveForm,
    savedFilters,
    savedFilterName,
    savedFilterDescription,
    editingFilterId,
    appliedPresetId,

    // Computeds
    hasActiveFilters,
    activeFieldCount,
    activeFilterDisplay,
    appliedPreset,
    filterNarrativeParts,

    // Functions
    filterFields,
    filterFieldLabel,
    formatFilterValues,
    getFilterModalValues,
    matchesFieldFilter,
    filterItems,
    toggleFilterValue,
    toggleFilterMode,
    clearAllFilters,
    openFilterModal,
    openFilterModalToPresets,
    closeFilterModal,
    selectFilterField,
    persistActiveFilters,
    setCrossFieldMode(mode) {
      crossFieldMode.value = mode
      persistActiveFilters()
    },
    setFilterModalTab(tab) {
      filterModalTab.value = tab
    },
    setFilterModalSearch(query) {
      filterModalSearch.value = query
    },
    setSavedFilterName(name) {
      savedFilterName.value = name
    },
    setSavedFilterDescription(desc) {
      savedFilterDescription.value = desc
    },
    setShowSaveForm(show) {
      showSaveForm.value = show
    },
    saveCurrentFilters,
    applySavedFilter,
    editSavedFilter,
    cancelSaveForm,
    cancelEditFilter,
    deleteSavedFilter
  }
}
