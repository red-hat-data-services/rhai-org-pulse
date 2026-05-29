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
      const response = await fetch(`${API_BASE}/analysis`)
      if (!response.ok) {
        throw new Error('Failed to load releases')
      }
      const analysisData = await response.json()

      // Extract unique release versions from delivery analysis
      // Extract version numbers from various formats:
      // - "3.5" (simple)
      // - "rhoai-3.5" (product prefix)
      // - "rhoai-3.5.EA1" (product + phase)
      // - "RHAII-3.5 EA1" (product + space + phase)
      const uniqueVersions = new Set()
      const allReleases = analysisData.releases || []

      for (const release of allReleases) {
        const fullVersion = release.releaseNumber
        if (!fullVersion) continue

        // Extract X.Y version number from various formats
        const match = fullVersion.match(/(\d+\.\d+)/)
        if (match) {
          const version = match[1]
          const [major, minor] = version.split('.').map(Number)
          // Only include 3.4 and above
          if (major === 3 && minor >= 4) {
            uniqueVersions.add(version)
          }
        }
      }

      // Convert to array and sort
      releases.value = Array.from(uniqueVersions)
        .sort((a, b) => {
          const [aMajor, aMinor] = a.split('.').map(Number)
          const [bMajor, bMinor] = b.split('.').map(Number)
          return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor
        })
        .map(version => ({ version }))
    } catch (err) {
      console.error('Failed to load releases:', err)
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
