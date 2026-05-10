import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

export function useComponentOnboarding() {
  const data = ref(null)
  const loading = ref(true)
  const error = ref(null)
  const detailCache = ref({})

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest('/modules/ai-impact/component-onboarding')
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(key) {
    if (detailCache.value[key]) return
    try {
      detailCache.value[key] = await apiRequest(`/modules/ai-impact/component-onboarding/${key}`)
    } catch (e) {
      console.error(`[component-onboarding] Failed to load detail for ${key}:`, e.message)
    }
  }

  load()

  return { data, loading, error, load, loadDetail, detailCache }
}
