import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds/milestones'

export function useMilestones() {
  const data = ref(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref(null)

  async function loadMilestones() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest(BASE)
    } catch (e) {
      error.value = e.message || 'Failed to load milestones'
    } finally {
      loading.value = false
    }
  }

  async function refreshMilestones() {
    refreshing.value = true
    error.value = null
    try {
      data.value = await apiRequest(`${BASE}/refresh`, { method: 'POST' })
    } catch (e) {
      error.value = e.message || 'Failed to refresh milestones'
    } finally {
      refreshing.value = false
    }
  }

  const releases = computed(() => data.value ? data.value.releases : [])

  const accelerators = computed(() => data.value ? data.value.accelerators : [])

  const source = computed(() => data.value ? data.value.source : null)

  const allPackageNames = computed(() => {
    if (!data.value) return []
    const names = new Set()
    for (const acc of data.value.accelerators) {
      for (const sv of acc.sub_variants) {
        for (const pkg of sv.packages) names.add(pkg.name)
      }
    }
    return [...names].sort()
  })

  const allSubVariants = computed(() => {
    if (!data.value) return []
    const result = []
    for (const acc of data.value.accelerators) {
      for (const sv of acc.sub_variants) {
        result.push({ accelerator: acc.sheet, ...sv })
      }
    }
    return result
  })

  return {
    data,
    loading,
    error,
    loadMilestones,
    refreshMilestones,
    refreshing,
    releases,
    accelerators,
    source,
    allPackageNames,
    allSubVariants,
  }
}
