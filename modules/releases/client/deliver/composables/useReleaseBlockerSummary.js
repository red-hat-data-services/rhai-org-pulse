import { onMounted, ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export function useReleaseBlockerSummary() {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest('/modules/releases/delivery/blockers/summary')
    } catch (err) {
      data.value = null
      error.value = err.message || 'Failed to load organization-wide blocker totals.'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return { data, loading, error, refresh: load }
}
