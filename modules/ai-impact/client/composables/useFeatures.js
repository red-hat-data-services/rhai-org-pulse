import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const features = ref({})
const featureMeta = ref({ lastSyncedAt: null, totalFeatures: 0 })
const metrics = ref(null)
const trendData = ref([])
const breakdown = ref([])
const reviewStatus = ref(null)
const featureLoading = ref(false)
const featureError = ref(null)
const detailCache = ref({})

const timeWindow = ref('month')
let hasFetched = false

async function loadFeatures() {
  featureLoading.value = true
  featureError.value = null
  try {
    const tw = timeWindow.value || 'month'
    const data = await apiRequest(`/modules/ai-impact/features?timeWindow=${tw}`)
    features.value = data.features || {}
    detailCache.value = {}
    featureMeta.value = {
      lastSyncedAt: data.lastSyncedAt,
      totalFeatures: data.totalFeatures
    }
    metrics.value = data.metrics || null
    trendData.value = data.trendData || []
    breakdown.value = data.breakdown || []
    reviewStatus.value = data.reviewStatus || null
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

watch(timeWindow, () => loadFeatures())

export function useFeatures(tw) {
  if (tw) {
    timeWindow.value = tw.value || tw
  }
  if (!hasFetched) {
    hasFetched = true
    loadFeatures()
  }
  return {
    features,
    featureMeta,
    metrics,
    trendData,
    breakdown,
    reviewStatus,
    featureLoading,
    featureError,
    loadFeatures,
    loadFeatureDetail,
    detailCache,
    timeWindow
  }
}

export function _resetForTesting() {
  features.value = {}
  featureMeta.value = { lastSyncedAt: null, totalFeatures: 0 }
  metrics.value = null
  trendData.value = []
  breakdown.value = []
  reviewStatus.value = null
  featureLoading.value = false
  featureError.value = null
  detailCache.value = {}
  hasFetched = true
}
