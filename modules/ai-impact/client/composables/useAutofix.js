import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

export function useAutofix(timeWindow) {
  const autofixData = ref(null)
  const loading = ref(true)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const tw = timeWindow.value || 'month'
      autofixData.value = await apiRequest(`/modules/ai-impact/autofix-data?timeWindow=${tw}`)
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  watch(timeWindow, () => load())
  load()

  return { autofixData, loading, error, load }
}
