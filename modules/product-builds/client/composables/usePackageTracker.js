import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds/package-tracker'

export function usePackageTracker() {
  const data = ref(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest(BASE)
    } catch (e) {
      error.value = e.message || 'Failed to load package tracker'
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    refreshing.value = true
    error.value = null
    try {
      data.value = await apiRequest(`${BASE}/refresh`, { method: 'POST' })
    } catch (e) {
      error.value = e.message || 'Failed to refresh package tracker'
    } finally {
      refreshing.value = false
    }
  }

  const packages = computed(() => data.value ? data.value.packages : [])

  const summary = computed(() => {
    if (!data.value) return null
    return {
      total: data.value.total,
      overdue: data.value.overdue,
      at_risk: data.value.at_risk,
      on_track: data.value.on_track,
      no_date: data.value.no_date,
      generated_at: data.value.generated_at,
    }
  })

  return {
    data,
    loading,
    refreshing,
    error,
    load,
    refresh,
    packages,
    summary,
  }
}
