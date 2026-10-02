import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds'

export function useQuayImages() {
  const repos = ref([])
  const refreshedAt = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function load(filters = {}) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (filters.stream) params.set('stream', filters.stream)
      if (filters.component) params.set('component', filters.component)
      const qs = params.toString()
      const data = await apiRequest(`${BASE}/quay-images${qs ? '?' + qs : ''}`)
      repos.value = data.repos || []
      refreshedAt.value = data.refreshed_at || null
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { repos, refreshedAt, loading, error, load }
}
