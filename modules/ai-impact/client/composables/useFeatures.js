import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

// Singleton state — fetch once, share refs
const features = ref({})
const featureMeta = ref({ lastSyncedAt: null, totalFeatures: 0 })
const featureLoading = ref(false)
const featureError = ref(null)
const detailCache = ref({})
let hasFetched = false

async function loadFeatures() {
  featureLoading.value = true
  featureError.value = null
  try {
    const data = await apiRequest('/modules/ai-impact/features')
    features.value = data.features || {}
    detailCache.value = {}
    featureMeta.value = {
      lastSyncedAt: data.lastSyncedAt,
      totalFeatures: data.totalFeatures
    }
  } catch (e) {
    featureError.value = e.message
  } finally {
    featureLoading.value = false
  }
}

async function loadFeatureDetail(key) {
  if (detailCache.value[key]) {
    return detailCache.value[key]
  }
  try {
    const data = await apiRequest(`/modules/ai-impact/features/${encodeURIComponent(key)}`)
    detailCache.value[key] = data
    return data
  } catch (e) {
    if (e.message && e.message.includes('404')) {
      return null
    }
    throw e
  }
}

export function useFeatures() {
  if (!hasFetched) {
    hasFetched = true
    loadFeatures()
  }
  return {
    features,
    featureMeta,
    featureLoading,
    featureError,
    loadFeatures,
    loadFeatureDetail,
    detailCache
  }
}

export function _resetForTesting() {
  features.value = {}
  featureMeta.value = { lastSyncedAt: null, totalFeatures: 0 }
  featureLoading.value = false
  featureError.value = null
  detailCache.value = {}
  hasFetched = true // prevent auto-fetch so tests control when loading happens
}
