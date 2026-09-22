import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export function useReleaseStatus() {
  const data = ref(null)
  const loading = ref(true)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest('/modules/product-builds/release-status')
    } catch (err) {
      error.value = err.message || 'Failed to load release status'
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}
