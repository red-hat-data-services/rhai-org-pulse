import { ref } from 'vue'

const API_BASE = '/api/modules/releases/delivery'

export function useCommitmentTracking() {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const releases = ref([])
  const releasesLoading = ref(false)

  async function loadCommitment(version, phase) {
    if (!version || !phase) {
      error.value = 'Version and phase are required'
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${API_BASE}/commitment/${encodeURIComponent(version)}/${encodeURIComponent(phase)}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`No snapshot found for ${version} ${phase}. Create a snapshot in the Health Dashboard first.`)
        }
        if (response.status === 400) {
          throw new Error('Invalid phase. Must be EA1, EA2, or GA.')
        }
        throw new Error(`Failed to load commitment data: ${response.statusText}`)
      }

      data.value = await response.json()
    } catch (err) {
      error.value = err.message || 'Failed to load commitment tracking data'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadReleases() {
    releasesLoading.value = true
    try {
      // Use commitment tracking versions endpoint (independent of delivery analysis)
      const response = await fetch(`${API_BASE}/commitment/versions`)
      if (!response.ok) {
        throw new Error('Failed to load versions for commitment tracking')
      }
      const data = await response.json()
      releases.value = data.versions || []
    } catch (err) {
      console.error('Failed to load commitment tracking versions:', err)
      releases.value = []
    } finally {
      releasesLoading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    loadCommitment,
    releases,
    releasesLoading,
    loadReleases
  }
}
