import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

/**
 * Composable for loading and caching feature review data.
 * - features: Map<string, SlimFeature> (keyed by RHAISTRAT key)
 * - loadFeatures(): fetches GET /features (slim projection)
 * - loadFeatureDetail(key): fetches GET /features/:key (full + history)
 */
export function useFeatures() {
  const features = ref({})
  const featureMeta = ref({ lastSyncedAt: null, totalFeatures: 0 })
  const featureLoading = ref(false)
  const featureError = ref(null)

  // Cache for full detail fetches (keyed by RHAISTRAT key)
  const detailCache = ref({})

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
