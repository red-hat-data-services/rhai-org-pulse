import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds'

export function useProduct() {
  const product = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function loadProduct(key) {
    loading.value = true
    error.value = null
    try {
      product.value = await apiRequest(`${BASE}/products/${encodeURIComponent(key)}`)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { product, loading, error, loadProduct }
}

export function useDrops() {
  const drops = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function loadDrops(productKey, filters = {}) {
    loading.value = true
    error.value = null

    const params = new URLSearchParams()
    params.set('product_key', productKey)
    if (filters.series) params.set('series', filters.series)
    if (filters.artifact_type) params.set('artifact_type', filters.artifact_type)
    if (filters.supported_only) params.set('supported_only', 'true')
    if (filters.limit) params.set('limit', filters.limit)
    if (filters.offset) params.set('offset', filters.offset)

    try {
      const data = await apiRequest(`${BASE}/drops?${params}`)
      drops.value = Array.isArray(data) ? data : []
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { drops, loading, error, loadDrops }
}

export function useDropDetail() {
  const drop = ref(null)
  const changelog = ref(null)
  const metrics = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function loadDrop(key) {
    loading.value = true
    error.value = null
    try {
      drop.value = await apiRequest(`${BASE}/drops/${encodeURIComponent(key)}`)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function loadChangelog(key) {
    try {
      changelog.value = await apiRequest(`${BASE}/drops/${encodeURIComponent(key)}/changelog`)
    } catch {
      changelog.value = null
    }
  }

  async function loadMetrics(key) {
    try {
      metrics.value = await apiRequest(`${BASE}/drops/${encodeURIComponent(key)}/metrics`)
    } catch {
      metrics.value = null
    }
  }

  return { drop, changelog, metrics, loading, error, loadDrop, loadChangelog, loadMetrics }
}

export function useSeries() {
  const series = ref([])

  async function loadSeries(productKey) {
    try {
      const data = await apiRequest(`${BASE}/series?product_key=${encodeURIComponent(productKey)}`)
      series.value = Array.isArray(data) ? data : []
    } catch {
      series.value = []
    }
  }

  return { series, loadSeries }
}
