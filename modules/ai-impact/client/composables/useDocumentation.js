import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

export function useDocumentation() {
  const docData = ref(null)
  const loading = ref(true)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      docData.value = await apiRequest('/modules/ai-impact/doc-data')
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  load()

  return { docData, loading, error, load }
}
