import { ref } from 'vue'

/**
 * Composable for RFE creation and similarity search
 */
export function useRfeCreator() {
  const loading = ref(false)
  const error = ref(null)

  /**
   * Search for similar RFEs using AI-powered semantic similarity
   */
  async function searchSimilar(rfeData) {
    loading.value = true
    error.value = null

    try {
      const res = await fetch('/api/modules/customer-insights/rfe/search-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rfeData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const results = await res.json()
      return results.similar || []
    } catch (err) {
      error.value = err.message
      console.error('Error searching similar RFEs:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new RFE
   */
  async function createRfe(rfeData) {
    loading.value = true
    error.value = null

    try {
      const res = await fetch('/api/modules/customer-insights/rfe/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rfeData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const result = await res.json()
      return result
    } catch (err) {
      error.value = err.message
      console.error('Error creating RFE:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch list of existing RFEs
   */
  async function listRfes(filters = {}) {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (filters.component) params.append('component', filters.component)
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)

      const res = await fetch(`/api/modules/customer-insights/rfe/list?${params}`)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const results = await res.json()
      return results
    } catch (err) {
      error.value = err.message
      console.error('Error fetching RFEs:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    searchSimilar,
    createRfe,
    listRfes,
  }
}
