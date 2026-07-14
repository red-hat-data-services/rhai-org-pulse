import { ref } from 'vue'

const API_BASE = '/api/modules/releases/release-readiness'

const data = ref(null)
const loading = ref(false)
const error = ref(null)
const versions = ref([])
const defaultVersion = ref(null)
const versionsLoading = ref(false)
const refreshing = ref(false)

export function useReleaseReadiness() {

  async function loadMetrics(version) {
    if (!version) {
      error.value = 'Version is required'
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}?version=${encodeURIComponent(version)}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No release readiness metrics found for "${version}". Run the extraction script or trigger a refresh.`)
        }
        throw new Error(`Failed to load delivery metrics: ${response.statusText}`)
      }

      data.value = await response.json()
    } catch (err) {
      error.value = err.message || 'Failed to load release readiness metrics'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadVersions() {
    versionsLoading.value = true
    try {
      const response = await fetch(`${API_BASE}/versions`)
      if (!response.ok) {
        throw new Error('Failed to load available versions')
      }
      const result = await response.json()
      versions.value = result.versions || []
      defaultVersion.value = result.default_version || null
    } catch (err) {
      console.error('Failed to load release readiness versions:', err)
      versions.value = []
      defaultVersion.value = null
    } finally {
      versionsLoading.value = false
    }
  }

  async function refreshFromJira(version) {
    if (!version) return

    refreshing.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}/refresh?version=${encodeURIComponent(version)}`, { method: 'POST' })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Refresh failed: ${response.statusText}`)
      }

      data.value = await response.json()
    } catch (err) {
      error.value = err.message || 'Failed to refresh from Jira'
    } finally {
      refreshing.value = false
    }
  }

  return {
    data,
    loading,
    error,
    versions,
    defaultVersion,
    versionsLoading,
    refreshing,
    loadMetrics,
    loadVersions,
    refreshFromJira
  }
}
