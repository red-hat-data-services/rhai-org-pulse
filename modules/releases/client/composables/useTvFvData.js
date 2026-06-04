import { ref } from 'vue'
import { apiRequest } from '@shared/client'

const MAX_POLL_RETRIES = 24 // 24 x 5s = 2 minutes max

/** TV/FV delta data fetching, refresh, and polling. */
export function useTvFvData() {
  const data = ref(null)
  const loading = ref(true)
  const error = ref(null)
  const refreshing = ref(false)
  const selectedRelease = ref('')

  // Owned refs for registry and version data
  const registryReleases = ref([])
  const jiraVersions = ref([])

  let pipelinePollTimeout = null
  let refreshPollInterval = null
  let pollRetryCount = 0
  let _alive = true // unmount guard

  async function fetchRegistry() {
    try {
      const result = await apiRequest('/modules/releases/registry')
      registryReleases.value = (result.releases || []).filter(r => r.state === 'active')
      return registryReleases.value
    } catch (e) {
      console.warn('[useTvFvData] fetchRegistry failed:', e.message)
      return []
    }
  }

  async function fetchVersions() {
    try {
      const result = await apiRequest('/modules/releases/tv-fv-delta/versions')
      jiraVersions.value = result.versions || []
    } catch (e) {
      console.warn('[useTvFvData] fetchVersions failed:', e.message)
    }
  }

  async function fetchData() {
    if (!_alive) return
    try {
      const result = await apiRequest('/modules/releases/tv-fv-delta')
      if (!_alive) return
      if (result._noCache) {
        loading.value = false
        refreshing.value = true
        pollRetryCount++
        if (pollRetryCount < MAX_POLL_RETRIES) {
          if (pipelinePollTimeout) clearTimeout(pipelinePollTimeout)
          pipelinePollTimeout = setTimeout(fetchData, 5000)
        } else {
          error.value = 'Data pipeline is taking too long. Try refreshing manually.'
          refreshing.value = false
          loading.value = false
        }
        return
      }
      pollRetryCount = 0
      error.value = null
      data.value = result
      refreshing.value = !!result._refreshing
      loading.value = false

      // Poll to detect when background refresh completes
      if (result._refreshing && !refreshPollInterval) {
        refreshPollInterval = setInterval(async () => {
          if (!_alive) { clearInterval(refreshPollInterval); refreshPollInterval = null; return }
          try {
            const status = await apiRequest('/modules/releases/tv-fv-delta/refresh/status')
            if (!status.running) {
              clearInterval(refreshPollInterval)
              refreshPollInterval = null
              await fetchData()
            }
          } catch (e) {
            console.warn('[useTvFvData] refresh status poll failed:', e.message)
            clearInterval(refreshPollInterval)
            refreshPollInterval = null
            refreshing.value = false
          }
        }, 5000)
      }
      if (result.metadata?.releases?.length && !selectedRelease.value) {
        selectedRelease.value = result.metadata.releases[0]
      }
    } catch (e) {
      if (!_alive) return
      error.value = e.message
      loading.value = false
      refreshing.value = false
      pollRetryCount = 0
    }
  }

  async function triggerRefresh(releases) {
    if (refreshing.value) return
    refreshing.value = true
    try {
      const versions = releases?.value ?? releases ?? []
      const body = versions.length
        ? { releases: versions }
        : {}
      await apiRequest('/modules/releases/tv-fv-delta/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (refreshPollInterval) { clearInterval(refreshPollInterval); refreshPollInterval = null }
      refreshPollInterval = setInterval(async () => {
        if (!_alive) { clearInterval(refreshPollInterval); refreshPollInterval = null; return }
        try {
          const status = await apiRequest('/modules/releases/tv-fv-delta/refresh/status')
          if (!status.running) {
            clearInterval(refreshPollInterval)
            refreshPollInterval = null
            refreshing.value = false
            selectedRelease.value = ''
            await fetchData()
          }
        } catch (e) {
          console.warn('[useTvFvData] refresh status poll failed:', e.message)
          clearInterval(refreshPollInterval)
          refreshPollInterval = null
          refreshing.value = false
        }
      }, 3000)
    } catch (e) {
      console.warn('[useTvFvData] triggerRefresh failed:', e.message)
      refreshing.value = false
      // Only show error if no data to display (avoid hiding valid data on 403)
      if (!data.value) error.value = e.message
    }
  }

  function cleanup() {
    _alive = false
    if (pipelinePollTimeout) clearTimeout(pipelinePollTimeout)
    if (refreshPollInterval) clearInterval(refreshPollInterval)
  }

  return {
    data,
    loading,
    error,
    refreshing,
    selectedRelease,
    registryReleases,
    jiraVersions,
    fetchRegistry,
    fetchVersions,
    fetchData,
    triggerRefresh,
    cleanup,
  }
}
