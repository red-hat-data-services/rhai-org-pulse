import { ref } from 'vue'

const API_BASE = '/api/modules/releases/cve-sustaining'

const data = ref(null)
const loading = ref(false)
const error = ref(null)
const refreshing = ref(false)

export function useCveSustaining() {

  async function loadData() {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(API_BASE)

      if (!response.ok) {
        if (response.status === 404) {
          data.value = null
          return
        }
        throw new Error(`Failed to load CVE data: ${response.statusText}`)
      }

      data.value = await response.json()
    } catch (err) {
      error.value = err.message || 'Failed to load CVE sustaining data'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    refreshing.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}/refresh`, { method: 'POST' })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Refresh failed: ${response.statusText}`)
      }

      data.value = await response.json()
    } catch (err) {
      error.value = err.message || 'Failed to refresh CVE data from Jira'
    } finally {
      refreshing.value = false
    }
  }

  return {
    data,
    loading,
    error,
    refreshing,
    loadData,
    refresh
  }
}
