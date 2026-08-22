import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

// Singleton state — fetch once, share refs across mounts
const snapshot = ref(null)
const loading = ref(false)
const error = ref(null)
let hasFetched = false

async function loadDecomposer() {
  loading.value = true
  error.value = null
  try {
    snapshot.value = await apiRequest('/modules/ai-impact/decomposer')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

export function useDecomposer() {
  if (!hasFetched) {
    hasFetched = true
    loadDecomposer()
  }
  return {
    snapshot,
    loading,
    error,
    load: loadDecomposer
  }
}

export function _resetForTesting() {
  snapshot.value = null
  loading.value = false
  error.value = null
  hasFetched = true // prevent auto-fetch so tests control loading
}
