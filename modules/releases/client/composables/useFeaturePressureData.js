import { ref, shallowRef } from 'vue'
import { apiRequest } from '@shared/client'

const POLL_INTERVAL_MS = 5000
const MAX_POLL_RETRIES = 24 // 24 x 5s = 2 minutes max

/** Feature pressure data fetching, refresh, and polling. */
export function useFeaturePressureData() {
  const data = shallowRef(null)
  const loading = ref(true)
  const error = ref(null)
  const refreshing = ref(false)
  const lookbackMonths = ref(12)

  let pipelinePollTimeout = null
  let refreshPollInterval = null
  let pollRetryCount = 0
  let _alive = true // unmount guard

  async function fetchData() {
    if (!_alive) return
    try {
      const result = await apiRequest('/modules/releases/feature-pressure')
      if (!_alive) return

      if (result._noCache) {
        // Keep loading = true until data arrives so the template shows the spinner
        refreshing.value = true
        pollRetryCount++
        if (pollRetryCount < MAX_POLL_RETRIES) {
          if (pipelinePollTimeout) clearTimeout(pipelinePollTimeout)
          pipelinePollTimeout = setTimeout(fetchData, POLL_INTERVAL_MS)
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

      if (result.metadata?.lookback_months) {
        lookbackMonths.value = result.metadata.lookback_months
      }

      // Poll to detect when background refresh completes
      if (result._refreshing && !refreshPollInterval) {
        refreshPollInterval = setInterval(async () => {
          if (!_alive) { clearInterval(refreshPollInterval); refreshPollInterval = null; return }
          try {
            const status = await apiRequest('/modules/releases/feature-pressure/refresh/status')
            if (!status.running) {
              clearInterval(refreshPollInterval)
              refreshPollInterval = null
              await fetchData()
            }
          } catch (e) {
            console.warn('[useFeaturePressureData] refresh status poll failed:', e.message)
            clearInterval(refreshPollInterval)
            refreshPollInterval = null
            refreshing.value = false
          }
        }, POLL_INTERVAL_MS)
      }
    } catch (e) {
      if (!_alive) return
      error.value = e.message
      loading.value = false
      refreshing.value = false
      pollRetryCount = 0
    }
  }

  async function triggerRefresh(months) {
    if (!_alive || refreshing.value) return
    refreshing.value = true
    const lm = months || lookbackMonths.value || 12
    try {
      await apiRequest('/modules/releases/feature-pressure/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookback_months: lm }),
      })
      if (refreshPollInterval) { clearInterval(refreshPollInterval); refreshPollInterval = null }
      refreshPollInterval = setInterval(async () => {
        if (!_alive) { clearInterval(refreshPollInterval); refreshPollInterval = null; return }
        try {
          const status = await apiRequest('/modules/releases/feature-pressure/refresh/status')
          if (!status.running) {
            clearInterval(refreshPollInterval)
            refreshPollInterval = null
            refreshing.value = false
            await fetchData()
          }
        } catch (e) {
          console.warn('[useFeaturePressureData] refresh status poll failed:', e.message)
          clearInterval(refreshPollInterval)
          refreshPollInterval = null
          refreshing.value = false
        }
      }, POLL_INTERVAL_MS)
    } catch (e) {
      console.warn('[useFeaturePressureData] triggerRefresh failed:', e.message)
      refreshing.value = false
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
    lookbackMonths,
    fetchData,
    triggerRefresh,
    cleanup,
  }
}
