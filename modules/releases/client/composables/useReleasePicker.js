import { ref, computed } from 'vue'

/** Release picker state and logic. */
export function useReleasePicker(data, registryReleases, jiraVersions) {
  const chosenReleases = ref([])
  const pickerOpen = ref(false)
  const pickerRef = ref(null)
  const chosenVersionNames = ref(new Set())
  const versionSearch = ref('')

  /** Pick the next N releases whose code freeze is in the future (or most recent if all past) */
  function autoSelectReleases(releases, count = 3) {
    const now = Date.now()
    const withDates = releases
      .filter(r => r.state === 'active' && r.fixVersions?.length)
      .map(r => ({
        ...r,
        freezeTs: r.milestones?.codeFreeze ? new Date(r.milestones.codeFreeze).getTime() : null,
        gaTs: r.milestones?.ga ? new Date(r.milestones.ga).getTime() : null,
      }))

    const upcoming = withDates
      .filter(r => r.freezeTs && r.freezeTs > now)
      .sort((a, b) => a.freezeTs - b.freezeTs)

    if (upcoming.length >= count) return upcoming.slice(0, count)

    const past = withDates
      .filter(r => !r.freezeTs || r.freezeTs <= now)
      .sort((a, b) => (b.freezeTs || 0) - (a.freezeTs || 0))

    return [...upcoming, ...past].slice(0, count)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  /** Whether a version is present in the currently loaded data */
  function isInCurrentData(name) {
    return data.value?.metadata?.releases?.includes(name) ?? false
  }

  /** All available versions for the dropdown — registry releases + Jira versions, deduplicated */
  const availableVersions = computed(() => {
    const seen = new Set()
    const result = []

    for (const rel of registryReleases.value) {
      for (const fv of (rel.fixVersions || [])) {
        if (!seen.has(fv)) {
          seen.add(fv)
          result.push({
            name: fv,
            displayName: rel.displayName,
            codeFreeze: rel.milestones?.codeFreeze || null,
            source: 'registry',
          })
        }
      }
    }

    for (const v of jiraVersions.value) {
      if (!seen.has(v.name)) {
        seen.add(v.name)
        result.push({
          name: v.name,
          displayName: v.name,
          codeFreeze: null,
          releaseDate: v.releaseDate,
          released: v.released,
          source: 'jira',
        })
      }
    }

    return result
  })

  /** Filtered versions for the dropdown search */
  const filteredVersions = computed(() => {
    const q = versionSearch.value.toLowerCase().trim()
    if (!q) return availableVersions.value
    return availableVersions.value.filter(v => v.name.toLowerCase().includes(q) || v.displayName.toLowerCase().includes(q))
  })

  /** The version name strings that are currently selected */
  const allSelectedVersions = computed(() => [...chosenVersionNames.value])

  function toggleVersion(name) {
    const s = new Set(chosenVersionNames.value)
    if (s.has(name)) {
      s.delete(name)
    } else {
      s.add(name)
    }
    chosenVersionNames.value = s
  }

  function removeVersion(name) {
    const s = new Set(chosenVersionNames.value)
    s.delete(name)
    chosenVersionNames.value = s
    // Keep a release object only if it has other fixVersions still selected
    chosenReleases.value = chosenReleases.value.filter(r => {
      const fvs = r.fixVersions || []
      const wasRelevant = fvs.includes(name)
      const hasOtherSelected = fvs.some(fv => fv !== name && s.has(fv))
      return !wasRelevant || hasOtherSelected
    })
  }

  /** Enrich chosen version names with display info */
  const chosenVersionsDisplay = computed(() => {
    return allSelectedVersions.value.map(name => {
      const info = availableVersions.value.find(v => v.name === name)
      return info || { name, displayName: name, source: 'manual' }
    })
  })

  function handleClickOutside(e) {
    if (pickerRef.value && !pickerRef.value.contains(e.target)) {
      pickerOpen.value = false
    }
  }

  return {
    chosenReleases,
    pickerOpen,
    pickerRef,
    chosenVersionNames,
    versionSearch,
    availableVersions,
    filteredVersions,
    allSelectedVersions,
    chosenVersionsDisplay,
    autoSelectReleases,
    formatDate,
    isInCurrentData,
    toggleVersion,
    removeVersion,
    handleClickOutside,
  }
}
