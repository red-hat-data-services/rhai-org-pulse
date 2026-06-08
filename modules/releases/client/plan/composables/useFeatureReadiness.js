import { ref } from 'vue'
import { cachedRequest } from '@shared/client/services/api'

const API_PATH = '/modules/releases/planning/feature-readiness'
const CACHE_TTL = 300_000 // 5 minutes — data changes only when strat pipeline runs (~2h)

// Module-level refs -- singleton pattern so all components share state
const pendingReview = ref([])
const ready = ref([])
const filterMeta = ref({})
const meta = ref(null)
const loading = ref(false)
const error = ref(null)

var lastFetchAt = 0

export function useFeatureReadiness() {
  async function loadFeatureReadiness() {
    var now = Date.now()
    if (now - lastFetchAt < CACHE_TTL && meta.value !== null) {
      return
    }

    loading.value = true
    error.value = null

    try {
      await cachedRequest('feature-readiness', API_PATH, function(data) {
        pendingReview.value = data.pendingReview || []
        ready.value = data.ready || []
        filterMeta.value = data.filterMeta || {}
        meta.value = data.meta || null
      })
      lastFetchAt = Date.now()
    } catch (err) {
      error.value = err.message || 'Failed to load feature readiness data'
    } finally {
      loading.value = false
    }
  }

  return {
    pendingReview,
    ready,
    filterMeta,
    meta,
    loading,
    error,
    loadFeatureReadiness
  }
}
