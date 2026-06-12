import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'releases:hygiene:filter_sets'
const MAX_SAVED_SETS = 10
const NO_TEAM = 'No team'
const NO_COMPONENT = 'No component'

function loadSavedSets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSavedSets(sets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets))
  } catch { /* localStorage unavailable */ }
}

export function useHygieneFilters(features) {
  const selectedTeams = ref([])
  const selectedComponents = ref([])
  const savedSets = ref(loadSavedSets())

  const availableTeams = computed(() => {
    const set = new Set()
    for (const f of features.value) {
      set.add(f.team || NO_TEAM)
    }
    const sorted = [...set].filter(t => t !== NO_TEAM).sort()
    if (set.has(NO_TEAM)) sorted.push(NO_TEAM)
    return sorted
  })

  const availableComponents = computed(() => {
    const set = new Set()
    for (const f of features.value) {
      const comps = f.components
      if (!comps || comps.length === 0) {
        set.add(NO_COMPONENT)
      } else {
        for (const c of comps) set.add(c)
      }
    }
    const sorted = [...set].filter(c => c !== NO_COMPONENT).sort()
    if (set.has(NO_COMPONENT)) sorted.push(NO_COMPONENT)
    return sorted
  })

  const filteredFeatures = computed(() => {
    let result = features.value
    if (selectedTeams.value.length > 0) {
      result = result.filter(f => {
        const team = f.team || NO_TEAM
        return selectedTeams.value.includes(team)
      })
    }
    if (selectedComponents.value.length > 0) {
      result = result.filter(f => {
        const comps = f.components
        if (!comps || comps.length === 0) {
          return selectedComponents.value.includes(NO_COMPONENT)
        }
        return comps.some(c => selectedComponents.value.includes(c))
      })
    }
    return result
  })

  const isFiltered = computed(() => {
    return selectedTeams.value.length > 0 || selectedComponents.value.length > 0
  })

  function toggleTeam(team) {
    const idx = selectedTeams.value.indexOf(team)
    if (idx >= 0) {
      selectedTeams.value.splice(idx, 1)
    } else {
      selectedTeams.value.push(team)
    }
  }

  function toggleComponent(comp) {
    const idx = selectedComponents.value.indexOf(comp)
    if (idx >= 0) {
      selectedComponents.value.splice(idx, 1)
    } else {
      selectedComponents.value.push(comp)
    }
  }

  function clearFilters() {
    selectedTeams.value = []
    selectedComponents.value = []
  }

  function saveCurrentSet(name) {
    if (!name || !name.trim()) return false
    const trimmed = name.trim()
    if (savedSets.value.some(s => s.name === trimmed)) return false
    if (savedSets.value.length >= MAX_SAVED_SETS) return false
    savedSets.value.push({
      name: trimmed,
      teams: [...selectedTeams.value],
      components: [...selectedComponents.value]
    })
    persistSavedSets(savedSets.value)
    return true
  }

  function loadSet(set) {
    // Intersect with available values for stale detection
    selectedTeams.value = set.teams.filter(t => availableTeams.value.includes(t))
    selectedComponents.value = set.components.filter(c => availableComponents.value.includes(c))
  }

  function deleteSet(name) {
    savedSets.value = savedSets.value.filter(s => s.name !== name)
    persistSavedSets(savedSets.value)
  }

  const matchCounts = computed(() => {
    const map = {}
    for (const set of savedSets.value) {
      const validTeams = set.teams.filter(t => availableTeams.value.includes(t))
      const validComps = set.components.filter(c => availableComponents.value.includes(c))

      let result = features.value
      if (validTeams.length > 0) {
        result = result.filter(f => {
          const team = f.team || NO_TEAM
          return validTeams.includes(team)
        })
      }
      if (validComps.length > 0) {
        result = result.filter(f => {
          const comps = f.components
          if (!comps || comps.length === 0) {
            return validComps.includes(NO_COMPONENT)
          }
          return comps.some(c => validComps.includes(c))
        })
      }
      map[set.name] = result.length
    }
    return map
  })

  function setMatchCount(set) {
    return matchCounts.value[set.name] ?? 0
  }

  // Reload saved sets when localStorage may have changed externally
  watch(features, () => {
    savedSets.value = loadSavedSets()
  })

  return {
    selectedTeams,
    selectedComponents,
    availableTeams,
    availableComponents,
    filteredFeatures,
    isFiltered,
    savedSets,
    toggleTeam,
    toggleComponent,
    clearFilters,
    saveCurrentSet,
    loadSet,
    deleteSet,
    setMatchCount
  }
}
