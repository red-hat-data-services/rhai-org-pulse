import { ref, onMounted, onUnmounted } from 'vue'
import { apiRequest, SESSION_CACHE_PREFIX } from '@shared/client/services/api'

const POLL_INTERVAL_MS = 3000
const MAX_POLL_MS = 5 * 60 * 1000

const CACHE_KEY = `${SESSION_CACHE_PREFIX}release-analysis:v9`

function readCache() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || !Array.isArray(data.releases)) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data) {
  if (typeof sessionStorage === 'undefined' || !data) return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // quota or private mode — ignore
  }
}

function clearCache() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // noop
  }
}

function stripCacheMeta(data) {
  if (!data) return data
  const { _cacheStale, _refreshing, _noCache, ...rest } = data
  return rest
}

/**
 * Shared composable for fetching and caching release-analysis data.
 * Uses stale-while-revalidate: shows cached/stale data immediately and
 * polls for background refresh completion when the server signals staleness.
 *
 * @param {Object} [options]
 * @param {Function} [options.onLoaded] - callback invoked after analysis data is set (cache hit or fetch)
 */
export function useReleaseAnalysis({ onLoaded } = {}) {
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref('')
  const analysis = ref(null)
  let pollTimer = null
  let pollStart = 0
  let unmounted = false

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  async function pollRefreshStatus() {
    if (unmounted || Date.now() - pollStart > MAX_POLL_MS) {
      stopPolling()
      refreshing.value = false
      return
    }

    try {
      const status = await apiRequest('/modules/releases/delivery/refresh/status')
      if (!status.running) {
        stopPolling()
        refreshing.value = false
        await reloadFreshData()
        return
      }
    } catch {
      // Polling failure is non-critical; keep trying
    }

    if (!unmounted) {
      pollTimer = setTimeout(pollRefreshStatus, POLL_INTERVAL_MS)
    }
  }

  function startPolling() {
    stopPolling()
    refreshing.value = true
    pollStart = Date.now()
    pollTimer = setTimeout(pollRefreshStatus, POLL_INTERVAL_MS)
  }

  async function reloadFreshData() {
    try {
      const data = await apiRequest('/modules/releases/delivery/analysis')
      const clean = stripCacheMeta(data)
      analysis.value = clean
      writeCache(clean)
      onLoaded?.()
    } catch {
      // Silent — stale data is still displayed
    }
  }

  async function loadAnalysis(forceRefresh = false) {
    loading.value = true
    error.value = ''
    try {
      const url = forceRefresh
        ? '/modules/releases/delivery/analysis?refresh=true'
        : '/modules/releases/delivery/analysis'
      const data = await apiRequest(url)
      const clean = stripCacheMeta(data)

      if (data._noCache && data._refreshing) {
        // Cold start — no data yet, server is building it
        startPolling()
      } else {
        if (clean.releases?.length) {
          analysis.value = clean
          writeCache(clean)
          onLoaded?.()
        }

        if (data._refreshing || data._cacheStale) {
          startPolling()
        }
      }
    } catch (err) {
      error.value = err.message || 'Failed to load release analysis'
    } finally {
      loading.value = false
    }
  }

  function refreshAnalysis() {
    clearCache()
    loadAnalysis(true)
  }

  onMounted(() => {
    // Clean up old v6 cache key
    const OLD_KEY = `${SESSION_CACHE_PREFIX}release-analysis:analysis-v6`
    try { sessionStorage.removeItem(OLD_KEY) } catch { /* noop */ }

    // Clean up old per-release v7 cache keys
    const V7_PREFIX = `${SESSION_CACHE_PREFIX}release-analysis:v7:`
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i)
        if (key?.startsWith(V7_PREFIX)) sessionStorage.removeItem(key)
      }
    } catch { /* noop */ }

    const cached = readCache()
    if (cached) {
      analysis.value = cached
      onLoaded?.()
      return
    }
    loadAnalysis()
  })

  onUnmounted(() => {
    unmounted = true
    stopPolling()
  })

  return { loading, refreshing, error, analysis, loadAnalysis, refreshAnalysis }
}
