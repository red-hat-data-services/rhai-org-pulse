import { ref, computed } from 'vue'

export function useFilters(features, rfes, bigRocks) {
  const selectedPillar = ref('')
  const selectedRock = ref('')
  const selectedStatus = ref('')
  const selectedPriority = ref('')
  const selectedTeam = ref('')
  const searchQuery = ref('')

  function matchesFilters(item) {
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      const matchesSearch =
        (item.issueKey && item.issueKey.toLowerCase().includes(q)) ||
        (item.summary && item.summary.toLowerCase().includes(q)) ||
        (item.components && item.components.toLowerCase().includes(q)) ||
        (item.pm && item.pm.toLowerCase().includes(q)) ||
        (item.deliveryOwner && item.deliveryOwner.toLowerCase().includes(q))
      if (!matchesSearch) return false
    }

    if (selectedStatus.value && item.status !== selectedStatus.value) return false
    if (selectedPriority.value && item.priority !== selectedPriority.value) return false
    if (selectedTeam.value && item.components !== selectedTeam.value) return false

    if (selectedRock.value) {
      const rocks = (item.bigRock || '').split(', ')
      if (!rocks.includes(selectedRock.value)) return false
    }

    if (selectedPillar.value && bigRocks.value) {
      const pillarRocks = bigRocks.value
        .filter(r => r.pillar === selectedPillar.value)
        .map(r => r.name)
      if (item.bigRock) {
        const itemRocks = item.bigRock.split(', ')
        if (!itemRocks.some(r => pillarRocks.includes(r))) return false
      } else {
        return false
      }
    }

    return true
  }

  const filteredFeatures = computed(() => {
    if (!features.value) return []
    return features.value.filter(matchesFilters)
  })

  const filteredRfes = computed(() => {
    if (!rfes.value) return []
    return rfes.value.filter(matchesFilters)
  })

  const hasActiveFilters = computed(() => {
    return !!(selectedPillar.value || selectedRock.value || selectedStatus.value ||
      selectedPriority.value || selectedTeam.value || searchQuery.value)
  })

  function clearFilters() {
    selectedPillar.value = ''
    selectedRock.value = ''
    selectedStatus.value = ''
    selectedPriority.value = ''
    selectedTeam.value = ''
    searchQuery.value = ''
  }

  return {
    selectedPillar,
    selectedRock,
    selectedStatus,
    selectedPriority,
    selectedTeam,
    searchQuery,
    filteredFeatures,
    filteredRfes,
    hasActiveFilters,
    clearFilters
  }
}
