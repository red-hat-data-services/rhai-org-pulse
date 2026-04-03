import { ref, onMounted } from 'vue'
import { apiRequest, SESSION_CACHE_PREFIX } from '@shared/client/services/api'

const ANALYSIS_CACHE_KEY = `${SESSION_CACHE_PREFIX}release-analysis:analysis-v6`

function readCache() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(ANALYSIS_CACHE_KEY)
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
    sessionStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(data))
  } catch {
    // quota or private mode — ignore
  }
}

function clearCache() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(ANALYSIS_CACHE_KEY)
  } catch {
    // noop
  }
}

/**
 * Shared composable for fetching and caching release-analysis data.
 *
 * @param {Object} [options]
 * @param {Function} [options.onLoaded] - callback invoked after analysis data is set (cache hit or fetch)
 */
export function useReleaseAnalysis({ onLoaded } = {}) {
  const loading = ref(false)
  const error = ref('')
  const analysis = ref(null)

  async function loadAnalysis(forceRefresh = false) {
    loading.value = true
    error.value = ''
    try {
      const url = forceRefresh
        ? '/modules/release-analysis/analysis?refresh=true'
        : '/modules/release-analysis/analysis'
      const data = await apiRequest(url)
      analysis.value = data
      writeCache(data)
      onLoaded?.()
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
    const cached = readCache()
    if (cached) {
      analysis.value = cached
      onLoaded?.()
      return
    }
    loadAnalysis()
  })

  return { loading, error, analysis, loadAnalysis, refreshAnalysis }
}
