import { ref } from 'vue'
import { apiRequest, cachedRequest } from '@shared/client/services/api'

const MODULE_API = '/api/modules/feature-traffic'

export function useFeatureTraffic() {
  const features = ref([])
  const featureCount = ref(0)
  const fetchedAt = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function loadFeatures(filters = {}) {
    loading.value = true
    error.value = null

    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.version) params.set('version', filters.version)
    if (filters.health) params.set('health', filters.health)
    if (filters.sortBy) params.set('sortBy', filters.sortBy)
    if (filters.sortDir) params.set('sortDir', filters.sortDir)

    const qs = params.toString()
    const url = `${MODULE_API}/features${qs ? '?' + qs : ''}`

    try {
      await cachedRequest(url, function(data) {
        features.value = data.features || []
        featureCount.value = data.featureCount || 0
        fetchedAt.value = data.fetchedAt || null
      })
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { features, featureCount, fetchedAt, loading, error, loadFeatures }
}

export function useFeatureDetail() {
  const feature = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function loadFeature(key) {
    loading.value = true
    error.value = null

    try {
      await cachedRequest(`${MODULE_API}/features/${key}`, function(data) {
        feature.value = data
      })
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { feature, loading, error, loadFeature }
}

export function useVersions() {
  const versions = ref([])

  async function loadVersions() {
    try {
      const data = await apiRequest(`${MODULE_API}/versions`)
      versions.value = data.versions || []
    } catch {
      versions.value = []
    }
  }

  return { versions, loadVersions }
}
