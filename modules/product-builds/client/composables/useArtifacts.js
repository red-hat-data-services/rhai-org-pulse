import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds'

export function useArtifacts() {
  const artifacts = ref([])
  const loading = ref(false)
  const error = ref(null)
  const hasMore = ref(false)

  async function loadArtifacts(filters = {}, { append = false } = {}) {
    loading.value = true
    error.value = null

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value)
      }
    }

    const limit = parseInt(filters.limit, 10) || 50

    try {
      const data = await apiRequest(`${BASE}/artifacts?${params}`)
      const items = Array.isArray(data) ? data : []
      if (append) {
        artifacts.value = [...artifacts.value, ...items]
      } else {
        artifacts.value = items
      }
      hasMore.value = items.length >= limit
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  function reset() {
    artifacts.value = []
    hasMore.value = false
    error.value = null
  }

  return { artifacts, hasMore, loading, error, loadArtifacts, reset }
}

export function useArtifactDetail() {
  const artifact = ref(null)
  const wheels = ref([])
  const containers = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadArtifact(key) {
    loading.value = true
    error.value = null
    try {
      artifact.value = await apiRequest(`${BASE}/artifacts/${encodeURIComponent(key)}`)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function loadWheels(key) {
    try {
      const data = await apiRequest(`${BASE}/artifacts/${encodeURIComponent(key)}/wheels`)
      wheels.value = Array.isArray(data) ? data : []
    } catch {
      wheels.value = []
    }
  }

  async function loadContainers(key) {
    try {
      const data = await apiRequest(`${BASE}/artifacts/${encodeURIComponent(key)}/containers`)
      containers.value = Array.isArray(data) ? data : []
    } catch {
      containers.value = []
    }
  }

  return { artifact, wheels, containers, loading, error, loadArtifact, loadWheels, loadContainers }
}
