import { ref } from 'vue'
import { getModules } from '../services/api'

const modulesData = ref(null)
const loading = ref(false)
const error = ref(null)

export function useModules() {
  async function loadModules() {
    if (modulesData.value) return
    loading.value = true
    error.value = null
    try {
      await getModules((data) => {
        modulesData.value = data
        loading.value = false
      })
    } catch (err) {
      error.value = err.message
      console.error('Failed to load modules:', err)
    } finally {
      loading.value = false
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
    loadModules,
    reloadModules
  }
}
