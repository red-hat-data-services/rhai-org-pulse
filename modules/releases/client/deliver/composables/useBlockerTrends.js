import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export function useBlockerTrends() {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchTrends() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest('/modules/releases/delivery/blockers/trends')
    } catch (err) {
      error.value = err.message || 'Failed to load blocker trends.'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  onMounted(fetchTrends)

  return {
    data,
    loading,
    error,
    refresh: fetchTrends
  }
}
