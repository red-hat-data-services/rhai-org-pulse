import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const STORAGE_KEY = 'releases:feature-tracking-cache'
const STALE_MS = 5 * 60 * 1000

const trackingData = ref(null)
const versions = ref([])
const loading = ref(false)
const error = ref(null)

function readCache(version) {
  try {
    var raw = sessionStorage.getItem(STORAGE_KEY + ':' + version)
    if (!raw) return null
    var cached = JSON.parse(raw)
    if (cached && cached.timestamp && Date.now() - cached.timestamp < STALE_MS) {
      return cached.data
    }
  } catch {
    // ignore
  }
  return null
}

function writeCache(version, data) {
  try {
    sessionStorage.setItem(STORAGE_KEY + ':' + version, JSON.stringify({
      timestamp: Date.now(),
      data: data
    }))
  } catch {
    // ignore
  }
}

function clearCache(version) {
  try {
    sessionStorage.removeItem(STORAGE_KEY + ':' + version)
  } catch {
    // ignore
  }
}

export function useFeatureTracking() {
  async function loadVersions() {
    try {
      var data = await apiRequest('/modules/releases/execution/tracking/versions')
      versions.value = data.versions || []
    } catch {
      versions.value = []
    }
  }

  async function loadTrackingData(portfolioVersion, opts) {
    var skipCache = opts && opts.skipCache
    if (!skipCache) {
      var cached = readCache(portfolioVersion)
      if (cached) {
        trackingData.value = cached
        return cached
      }
    }

    loading.value = true
    error.value = null

    try {
      var url = '/modules/releases/execution/tracking/data?version=' + encodeURIComponent(portfolioVersion)
      if (skipCache) {
        url += '&refresh=true'
      }
      var data = await apiRequest(url)
      trackingData.value = data
      writeCache(portfolioVersion, data)
      return data
    } catch (err) {
      error.value = err.message
      trackingData.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  async function refreshTracking(portfolioVersion) {
    clearCache(portfolioVersion)
    return loadTrackingData(portfolioVersion, { skipCache: true })
  }

  return {
    trackingData,
    versions,
    loading,
    error,
    loadVersions,
    loadTrackingData,
    refreshTracking
  }
}
