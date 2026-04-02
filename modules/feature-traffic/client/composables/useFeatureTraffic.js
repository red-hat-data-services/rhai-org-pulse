import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

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
    const url = `/modules/feature-traffic/features${qs ? '?' + qs : ''}`

    try {
      const data = await apiRequest(url.replace(/^\/api/, ''))
      features.value = data.features || []
      featureCount.value = data.featureCount || 0
      fetchedAt.value = data.fetchedAt || null
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
      const data = await apiRequest(`/modules/feature-traffic/features/${key}`)
      feature.value = data
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
      const data = await apiRequest('/modules/feature-traffic/versions')
      versions.value = data.versions || []
    } catch {
      versions.value = []
    }
  }

  return { versions, loadVersions }
}
