import { ref, computed, watch, nextTick } from 'vue'

var FILTER_STORAGE_KEY = 'releases:feature-tracking-filters'

export function useFeatureTrackingFilters(groups, selectedVersion) {
  var searchQuery = ref('')
  var selectedProducts = ref([])
  var selectedStatuses = ref([])
  var selectedComponents = ref([])
  var selectedOwners = ref([])
  var activeCardFilter = ref(null)

  // --- Derived option lists from FULL unfiltered groups (Risk 3 mitigation) ---

  var availableProducts = computed(function () {
    var seen = {}
    var result = []
    for (var i = 0; i < groups.value.length; i++) {
      var p = groups.value[i].product
      if (p && !seen[p]) {
        seen[p] = true
        result.push(p)
      }
    }
    result.sort()
    return result
  })

  var availableStatuses = computed(function () {
    var seen = {}
    var result = []
    for (var i = 0; i < groups.value.length; i++) {
      var features = groups.value[i].features || []
      for (var j = 0; j < features.length; j++) {
        var s = features[j].colorStatus
        if (s && !seen[s]) {
          seen[s] = true
          result.push(s)
        }
      }
    }
    var order = { Red: 0, Yellow: 1, Green: 2 }
    result.sort(function (a, b) {
      var oa = order[a] != null ? order[a] : 99
      var ob = order[b] != null ? order[b] : 99
      return oa - ob
    })
    return result
  })

  var availableComponents = computed(function () {
    var seen = {}
    var result = []
    var hasEmpty = false
    for (var i = 0; i < groups.value.length; i++) {
      var features = groups.value[i].features || []
      for (var j = 0; j < features.length; j++) {
        var comps = features[j].components || []
        if (comps.length === 0) {
          hasEmpty = true
        }
        for (var k = 0; k < comps.length; k++) {
          if (!seen[comps[k]]) {
            seen[comps[k]] = true
            result.push(comps[k])
          }
        }
      }
    }
    result.sort()
    if (hasEmpty) result.push('No component')
    return result
  })

  var availableOwners = computed(function () {
    var seen = {}
    var result = []
    for (var i = 0; i < groups.value.length; i++) {
      var features = groups.value[i].features || []
      for (var j = 0; j < features.length; j++) {
        var a = features[j].assignee
        var p = features[j].pmOwner
        if (a && !seen[a]) { seen[a] = true; result.push(a) }
        if (p && !seen[p]) { seen[p] = true; result.push(p) }
      }
    }
    result.sort()
    return result
  })

  // --- Total (unfiltered) counts for summary cards (Risk 2 mitigation) ---

  var totalFeatures = computed(function () {
    var keys = {}
    for (var i = 0; i < groups.value.length; i++) {
      var features = groups.value[i].features || []
      for (var j = 0; j < features.length; j++) {
        if (features[j].scopeChange !== 'dropped') {
          keys[features[j].key] = true
        }
      }
    }
    return Object.keys(keys).length
  })

  var totalAddedCount = computed(function () {
    var count = 0
    for (var i = 0; i < groups.value.length; i++) {
      var features = groups.value[i].features || []
      for (var j = 0; j < features.length; j++) {
        if (features[j].scopeChange === 'added') count++
      }
    }
    return count
  })

  var totalDroppedCount = computed(function () {
    var count = 0
    for (var i = 0; i < groups.value.length; i++) {
      var features = groups.value[i].features || []
      for (var j = 0; j < features.length; j++) {
        if (features[j].scopeChange === 'dropped') count++
      }
    }
    return count
  })

  var totalBlockedCount = computed(function () {
    var count = 0
    for (var i = 0; i < groups.value.length; i++) {
      var features = groups.value[i].features || []
      for (var j = 0; j < features.length; j++) {
        if (features[j].isBlocked && features[j].scopeChange !== 'dropped') count++
      }
    }
    return count
  })

  // --- Filter pipeline ---

  function applyToolbarFilters(rawGroups) {
    var result = rawGroups

    if (selectedProducts.value.length > 0) {
      result = result.filter(function (g) {
        return selectedProducts.value.includes(g.product)
      })
    }

    var hasFeatureFilters = searchQuery.value ||
      selectedStatuses.value.length > 0 ||
      selectedComponents.value.length > 0 ||
      selectedOwners.value.length > 0

    if (!hasFeatureFilters) return result

    var q = searchQuery.value ? searchQuery.value.toLowerCase() : ''

    return result.map(function (g) {
      var filtered = (g.features || []).filter(function (f) {
        if (q) {
          var matchKey = f.key && f.key.toLowerCase().includes(q)
          var matchSummary = f.summary && f.summary.toLowerCase().includes(q)
          if (!matchKey && !matchSummary) return false
        }
        if (selectedStatuses.value.length > 0) {
          if (!f.colorStatus || !selectedStatuses.value.includes(f.colorStatus)) return false
        }
        if (selectedComponents.value.length > 0) {
          var comps = f.components || []
          if (comps.length === 0) {
            if (!selectedComponents.value.includes('No component')) return false
          } else {
            var hasMatch = false
            for (var k = 0; k < comps.length; k++) {
              if (selectedComponents.value.includes(comps[k])) { hasMatch = true; break }
            }
            if (!hasMatch) return false
          }
        }
        if (selectedOwners.value.length > 0) {
          var ownerMatch = (f.assignee && selectedOwners.value.includes(f.assignee)) ||
            (f.pmOwner && selectedOwners.value.includes(f.pmOwner))
          if (!ownerMatch) return false
        }
        return true
      })
      return {
        ...g,
        features: filtered,
        featureCount: filtered.filter(function (f) { return f.scopeChange !== 'dropped' }).length
      }
    }).filter(function (g) { return g.features.length > 0 })
  }

  var toolbarFilteredGroups = computed(function () {
    return applyToolbarFilters(groups.value)
  })

  var filteredGroups = computed(function () {
    var base = toolbarFilteredGroups.value
    if (!activeCardFilter.value) return base

    return base.map(function (g) {
      var filtered = (g.features || []).filter(function (f) {
        if (activeCardFilter.value === 'added') return f.scopeChange === 'added'
        if (activeCardFilter.value === 'dropped') return f.scopeChange === 'dropped'
        if (activeCardFilter.value === 'blocked') return f.isBlocked && f.scopeChange !== 'dropped'
        return true
      })
      return {
        ...g,
        features: filtered,
        featureCount: filtered.filter(function (f) { return f.scopeChange !== 'dropped' }).length
      }
    }).filter(function (g) { return g.features.length > 0 })
  })

  // --- Filtered feature count (deduplicated, Risk 4 mitigation) ---

  var filteredFeatureCount = computed(function () {
    var keys = {}
    var fg = filteredGroups.value
    for (var i = 0; i < fg.length; i++) {
      var features = fg[i].features || []
      for (var j = 0; j < features.length; j++) {
        if (features[j].scopeChange !== 'dropped') {
          keys[features[j].key] = true
        }
      }
    }
    return Object.keys(keys).length
  })

  // --- State helpers ---

  var isToolbarFiltered = computed(function () {
    return !!(searchQuery.value ||
      selectedProducts.value.length > 0 ||
      selectedStatuses.value.length > 0 ||
      selectedComponents.value.length > 0 ||
      selectedOwners.value.length > 0)
  })

  var isFiltered = computed(function () {
    return isToolbarFiltered.value || !!activeCardFilter.value
  })

  var activeFilterLabels = computed(function () {
    var labels = []
    if (selectedProducts.value.length > 0) {
      labels.push({ type: 'product', label: 'Product: ' + selectedProducts.value.map(function (p) { return p.toUpperCase() }).join(', ') })
    }
    if (selectedStatuses.value.length > 0) {
      labels.push({ type: 'status', label: 'Status: ' + selectedStatuses.value.join(', ') })
    }
    if (selectedComponents.value.length > 0) {
      labels.push({ type: 'components', label: 'Components: ' + selectedComponents.value.join(', ') })
    }
    if (selectedOwners.value.length > 0) {
      labels.push({ type: 'owners', label: 'Owner: ' + selectedOwners.value.join(', ') })
    }
    if (searchQuery.value) {
      labels.push({ type: 'search', label: 'Search: "' + searchQuery.value + '"' })
    }
    if (activeCardFilter.value) {
      var cardLabels = { added: 'Late Added', dropped: 'Dropped', blocked: 'Blocked' }
      labels.push({ type: 'card', label: cardLabels[activeCardFilter.value] || activeCardFilter.value })
    }
    return labels
  })

  function setCardFilter(type) {
    if (type === null || activeCardFilter.value === type) {
      activeCardFilter.value = null
    } else {
      activeCardFilter.value = type
    }
  }

  function removeFilter(type) {
    if (type === 'product') selectedProducts.value = []
    else if (type === 'status') selectedStatuses.value = []
    else if (type === 'components') selectedComponents.value = []
    else if (type === 'owners') selectedOwners.value = []
    else if (type === 'search') searchQuery.value = ''
    else if (type === 'card') activeCardFilter.value = null
  }

  function clearAllFilters() {
    searchQuery.value = ''
    selectedProducts.value = []
    selectedStatuses.value = []
    selectedComponents.value = []
    selectedOwners.value = []
    activeCardFilter.value = null
  }

  // --- sessionStorage persistence ---

  var _suspendSave = false

  function saveFilters() {
    if (_suspendSave) return
    var version = selectedVersion.value
    if (!version) return
    try {
      sessionStorage.setItem(
        FILTER_STORAGE_KEY + ':' + version,
        JSON.stringify({
          searchQuery: searchQuery.value,
          selectedProducts: selectedProducts.value,
          selectedStatuses: selectedStatuses.value,
          selectedComponents: selectedComponents.value,
          selectedOwners: selectedOwners.value
        })
      )
    } catch { /* quota / private mode */ }
  }

  function restoreFilters() {
    var version = selectedVersion.value
    if (!version) return
    _suspendSave = true
    try {
      var raw = sessionStorage.getItem(FILTER_STORAGE_KEY + ':' + version)
      if (raw) {
        var saved = JSON.parse(raw)
        if (saved.searchQuery && typeof saved.searchQuery === 'string') {
          searchQuery.value = saved.searchQuery.slice(0, 2000)
        }
        var prods = availableProducts.value
        var stats = availableStatuses.value
        var comps = availableComponents.value
        var owners = availableOwners.value
        if (Array.isArray(saved.selectedProducts)) {
          selectedProducts.value = saved.selectedProducts.filter(function (v) { return prods.includes(v) })
        }
        if (Array.isArray(saved.selectedStatuses)) {
          selectedStatuses.value = saved.selectedStatuses.filter(function (v) { return stats.includes(v) })
        }
        if (Array.isArray(saved.selectedComponents)) {
          selectedComponents.value = saved.selectedComponents.filter(function (v) { return comps.includes(v) })
        }
        if (Array.isArray(saved.selectedOwners)) {
          selectedOwners.value = saved.selectedOwners.filter(function (v) { return owners.includes(v) })
        }
      }
    } catch { /* ignore corrupt JSON */ }
    nextTick(function () { _suspendSave = false })
  }

  function resetFilters() {
    _suspendSave = true
    searchQuery.value = ''
    selectedProducts.value = []
    selectedStatuses.value = []
    selectedComponents.value = []
    selectedOwners.value = []
    activeCardFilter.value = null
    nextTick(function () { _suspendSave = false })
  }

  watch(
    [searchQuery, selectedProducts, selectedStatuses, selectedComponents, selectedOwners],
    saveFilters,
    { deep: true }
  )

  return {
    searchQuery,
    selectedProducts,
    selectedStatuses,
    selectedComponents,
    selectedOwners,
    activeCardFilter,

    availableProducts,
    availableStatuses,
    availableComponents,
    availableOwners,

    totalFeatures,
    totalAddedCount,
    totalDroppedCount,
    totalBlockedCount,

    filteredGroups,
    filteredFeatureCount,
    isToolbarFiltered,
    isFiltered,
    activeFilterLabels,

    setCardFilter,
    removeFilter,
    clearAllFilters,
    restoreFilters,
    resetFilters
  }
}
