import { ref } from 'vue'
import { apiRequest, getModules } from '@shared/client/services/api'

const modulesData = ref(null)
const loading = ref(false)
const error = ref(null)
const enabledBuiltInSlugs = ref(null)

export function useModules() {
  async function loadModules() {
    if (modulesData.value) return
    loading.value = true
    error.value = null
    try {
      modulesData.value = await getModules()
    } catch (err) {
      error.value = err.message
      console.error('Failed to load modules:', err)
    } finally {
      loading.value = false
    }
  }

  async function loadEnabledBuiltInSlugs(allDiscoveredSlugs) {
    try {
      const data = await apiRequest('/built-in-modules/state')
      enabledBuiltInSlugs.value = data.enabledSlugs
    } catch (err) {
      console.warn('Failed to load built-in module state, defaulting to all enabled:', err.message)
      enabledBuiltInSlugs.value = allDiscoveredSlugs || []
    }
  }

  async function reloadModules() {
    modulesData.value = null
    return loadModules()
  }

  return {
    modulesData,
    loading,
    error,
    enabledBuiltInSlugs,
    loadModules,
    loadEnabledBuiltInSlugs,
    reloadModules
  }
}
