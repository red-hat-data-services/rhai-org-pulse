import { ref } from 'vue'
import { cachedRequest } from '@shared/client/services/api'

const API_PATH = '/modules/releases/planning/feature-readiness'
const CACHE_TTL = 300_000 // 5 minutes — data changes only when strat pipeline runs (~2h)

// Module-level refs -- singleton pattern so all components share state
const pendingReview = ref([])
const approved = ref([])
const filterMeta = ref({})
const meta = ref(null)
const loading = ref(false)
const error = ref(null)

// Simple query string builder — no URLSearchParams
function buildQueryString(params) {
  const parts = []
  for (const key of Object.keys(params)) {
    const val = params[key]
    if (val != null && val !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(val))
    }
  }
  return parts.length ? '?' + parts.join('&') : ''
}

// Track last fetch time per version key for TTL-based cache skip
const lastFetchAt = {}

export function useFeatureReadiness() {
  async function loadFeatureReadiness(version) {
    const now = Date.now()
    const versionKey = version || '__none__'
    if (now - (lastFetchAt[versionKey] || 0) < CACHE_TTL && meta.value !== null) {
      return
    }

    loading.value = true
    error.value = null

    const qs = buildQueryString(version ? { version } : {})
    const path = API_PATH + qs
    const cacheKey = 'feature-readiness' + (version ? ':' + version : '')

    try {
      await cachedRequest(cacheKey, path, function(data) {
        pendingReview.value = data.pendingReview || []
        approved.value = data.approved || []
        filterMeta.value = data.filterMeta || {}
        meta.value = data.meta || null
      })
      lastFetchAt[versionKey] = Date.now()
    } catch (err) {
      error.value = err.message || 'Failed to load feature readiness data'
    } finally {
      loading.value = false
    }
  }

  return {
    pendingReview,
    approved,
    filterMeta,
    meta,
    loading,
    error,
    loadFeatureReadiness
  }
}
