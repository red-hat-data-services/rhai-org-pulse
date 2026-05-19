import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds'

export function useArtifacts() {
  const artifacts = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadArtifacts(filters = {}) {
    loading.value = true
    error.value = null

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, value)
      }
    }

    try {
      const data = await apiRequest(`${BASE}/artifacts?${params}`)
      artifacts.value = Array.isArray(data) ? data : []
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { artifacts, loading, error, loadArtifacts }
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
