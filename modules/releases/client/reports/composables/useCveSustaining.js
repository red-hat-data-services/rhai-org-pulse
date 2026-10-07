import { ref } from 'vue'

const API_BASE = '/api/modules/releases/cve-sustaining'
const REFRESH_POLL_INTERVAL_MS = 3000
const REFRESH_POLL_TIMEOUT_MS = 5 * 60 * 1000
const INDETERMINATE_REFRESH_STATUSES = new Set([502, 504])

export function useCveSustaining() {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const refreshError = ref(null)
  const refreshing = ref(false)
  let refreshToken = 0
  let pollTimer = null
  let pollResolver = null
  let alive = true

  async function fetchCachedPayload() {
    const response = await fetch(API_BASE)
    if (!response.ok) {
      const err = new Error(`Failed to load CVE data: ${response.statusText}`)
      err.status = response.status
      throw err
    }
    return response.json()
  }

  function waitForNextPoll() {
    return new Promise(resolve => {
      pollResolver = resolve
      pollTimer = setTimeout(() => {
        pollTimer = null
        pollResolver = null
        resolve(true)
      }, REFRESH_POLL_INTERVAL_MS)
    })
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
    if (pollResolver) pollResolver(false)
    pollResolver = null
  }

  function applyRefreshedPayload(payload, token) {
    if (!alive || token !== refreshToken) return false
    data.value = payload
    error.value = null
    return true
  }

  async function pollForRefreshedCache(baseline, token) {
    const deadline = Date.now() + REFRESH_POLL_TIMEOUT_MS
    while (alive && token === refreshToken && Date.now() < deadline) {
      if (!await waitForNextPoll()) return false
      try {
        const payload = await fetchCachedPayload()
        const timestamp = payload.lastRefreshed || null
        if (timestamp && timestamp !== baseline) {
          return applyRefreshedPayload(payload, token)
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) throw err
        // The refresh may still be running or the replacement cache may not exist yet.
      }
    }
    return false
  }

  async function finishIndeterminateRefresh(baseline, token) {
    const updated = await pollForRefreshedCache(baseline, token)
    if (!updated && alive && token === refreshToken) {
      refreshError.value = 'The Jira refresh is taking longer than expected. Current data is still shown; try again shortly.'
    }
  }

  async function loadData() {
    loading.value = true
    error.value = null

    try {
      data.value = await fetchCachedPayload()
    } catch (err) {
      if (err.status === 404) {
        data.value = null
        return
      }
      error.value = err.message || 'Failed to load CVE sustaining data'
      data.value = null
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    if (refreshing.value) return
    const token = ++refreshToken
    const baseline = data.value?.lastRefreshed || null
    refreshing.value = true
    refreshError.value = null

    try {
      let response
      try {
        response = await fetch(`${API_BASE}/refresh`, { method: 'POST' })
      } catch {
        await finishIndeterminateRefresh(baseline, token)
        return
      }

      if (!response.ok) {
        if (INDETERMINATE_REFRESH_STATUSES.has(response.status)) {
          await finishIndeterminateRefresh(baseline, token)
          return
        }
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Refresh failed: ${response.statusText}`)
      }

      const payload = await response.json()
      applyRefreshedPayload(payload, token)
    } catch (err) {
      if (alive && token === refreshToken) {
        refreshError.value = err.message || 'Failed to refresh CVE data from Jira'
      }
    } finally {
      if (alive && token === refreshToken) refreshing.value = false
    }
  }

  function cleanup() {
    alive = false
    refreshToken++
    stopPolling()
  }

  return {
    data,
    loading,
    error,
    refreshError,
    refreshing,
    loadData,
    refresh,
    cleanup
  }
}
