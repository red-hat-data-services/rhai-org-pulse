import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds'
export const SEARCH_LIMIT = 200

export function useSearch() {
  const results = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function search(query, filters = {}) {
    if (!query) {
      results.value = null
      return
    }

    loading.value = true
    error.value = null

    const params = new URLSearchParams({ q: query, limit: String(SEARCH_LIMIT) })
    if (filters.types) params.set('types', filters.types)
    if (filters.products) params.set('products', filters.products)
    if (filters.envs) params.set('envs', filters.envs)
    if (filters.archs) params.set('archs', filters.archs)
    if (filters.date) params.set('date', filters.date)
    if (filters.accel) params.set('accel', filters.accel)

    try {
      results.value = await apiRequest(`${BASE}/search?${params}`)
    } catch (err) {
      error.value = err.message
      results.value = null
    } finally {
      loading.value = false
    }
  }

  return { results, loading, error, search }
}

export function useSearchFilters() {
  const artifactTypes = ref([])
  const environments = ref([])
  const architectures = ref([])
  const accelerators = ref([])
  const loaded = ref(false)

  async function loadFilterOptions() {
    if (loaded.value) return
    try {
      const data = await apiRequest(`${BASE}/search/filters`)
      artifactTypes.value = data.artifact_types || []
      environments.value = data.environments || []
      architectures.value = data.architectures || []
      accelerators.value = data.accelerators || []
      loaded.value = true
    } catch {
      // Filter dropdowns simply stay empty/hidden on failure
    }
  }

  return { artifactTypes, environments, architectures, accelerators, loadFilterOptions }
}
