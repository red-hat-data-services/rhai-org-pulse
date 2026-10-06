import { ref } from 'vue'

const API_BASE = '/api/modules/releases/chi-hierarchy'

const data = ref(null)
const loading = ref(false)
const error = ref(null)

export function useChiHierarchy() {
  async function loadData() {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}/data`)

      if (!response.ok) {
        if (response.status === 404) {
          data.value = null
          return
        }
        throw new Error(`Failed to load CHI hierarchy: ${response.statusText}`)
      }

      data.value = await response.json()
    } catch (err) {
      error.value = err.message || 'Failed to load Container Health Index data'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    loadData
  }
}
