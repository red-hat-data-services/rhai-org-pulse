import { ref, shallowRef } from 'vue'
import { apiRequest } from '@shared/client'

/** AI adoption data fetching composable. */
export function useAiAdoption() {
  const data = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchData(releaseGroup, component) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (releaseGroup && releaseGroup !== 'all') params.set('releaseGroup', releaseGroup)
      if (component && component !== 'all') params.set('component', component)
      const qs = params.toString()
      const path = `/modules/releases/ai-adoption${qs ? '?' + qs : ''}`
      data.value = await apiRequest(path)
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, fetchData }
}
