import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds'
const ITEMS_PER_PAGE = 20

export function useWheelBrowse() {
  const artifacts = ref([])
  const loading = ref(false)
  const error = ref(null)
  const offset = ref(0)
  const hasNext = ref(false)
  const sortColumn = ref('created_at')
  const sortDirection = ref('desc')
  const searchValue = ref('')

  const pageNumber = computed(() => Math.floor(offset.value / ITEMS_PER_PAGE) + 1)
  const hasPrevious = computed(() => offset.value > 0)

  const buildSequences = ref({})
  const buildSequencesLoading = ref(false)

  async function load() {
    loading.value = true
    error.value = null
    buildSequences.value = {}
    try {
      const params = new URLSearchParams({
        type: 'wheels-collections',
        limit: String(ITEMS_PER_PAGE + 1),
        offset: String(offset.value),
        sort_by: sortColumn.value,
        sort_order: sortDirection.value,
        count_limit: '1000'
      })
      if (searchValue.value) {
        params.set('version_pattern', searchValue.value)
      }
      const data = await apiRequest(`${BASE}/artifacts?${params}`)
      const items = Array.isArray(data) ? data : []
      hasNext.value = items.length > ITEMS_PER_PAGE
      artifacts.value = items.slice(0, ITEMS_PER_PAGE)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
    loadBuildSequences()
  }

  async function loadBuildSequences() {
    const keys = artifacts.value.map(a => a.key).filter(Boolean)
    if (!keys.length) return
    buildSequencesLoading.value = true
    try {
      const data = await apiRequest(`${BASE}/artifacts/build-sequences?keys=${keys.map(encodeURIComponent).join(',')}`)
      buildSequences.value = data || {}
    } catch {
      buildSequences.value = {}
    } finally {
      buildSequencesLoading.value = false
    }
  }

  function nextPage() {
    if (!hasNext.value) return
    offset.value += ITEMS_PER_PAGE
    load()
  }

  function previousPage() {
    if (offset.value === 0) return
    offset.value = Math.max(0, offset.value - ITEMS_PER_PAGE)
    load()
  }

  function toggleSort(column) {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn.value = column
      sortDirection.value = 'asc'
    }
    offset.value = 0
    load()
  }

  function search(value) {
    searchValue.value = value
    offset.value = 0
    load()
  }

  return {
    artifacts, loading, error,
    pageNumber, hasPrevious, hasNext,
    sortColumn, sortDirection, searchValue,
    buildSequences, buildSequencesLoading,
    load, nextPage, previousPage, toggleSort, search
  }
}

export function useWheelPackageSearch() {
  const results = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const offset = ref(0)
  const hasMore = ref(false)

  const pageNumber = computed(() => Math.floor(offset.value / ITEMS_PER_PAGE) + 1)
  const hasPrevious = computed(() => offset.value > 0)

  async function search(packageName, filters = {}, newOffset = 0) {
    if (!packageName?.trim()) return
    loading.value = true
    error.value = null
    if (newOffset === 0) results.value = null

    try {
      const params = new URLSearchParams()
      if (filters.product_key && filters.product_key !== 'all') {
        params.set('product_key', filters.product_key)
        if (filters.series && filters.series !== 'all') {
          params.set('series', filters.series)
        }
      }
      if (filters.variant && filters.variant !== 'all') {
        params.set('variant_filter', filters.variant)
      }
      params.set('limit', String(ITEMS_PER_PAGE))
      params.set('offset', String(newOffset))

      const queryString = params.toString()
      const url = `${BASE}/artifacts/wheels/build-history/${encodeURIComponent(packageName)}${queryString ? '?' + queryString : ''}`
      const data = await apiRequest(url)
      const items = Array.isArray(data) ? data : []

      hasMore.value = items.length === ITEMS_PER_PAGE
      offset.value = newOffset
      results.value = items
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  function nextPage(packageName, filters) {
    search(packageName, filters, offset.value + ITEMS_PER_PAGE)
  }

  function previousPage(packageName, filters) {
    search(packageName, filters, Math.max(0, offset.value - ITEMS_PER_PAGE))
  }

  function reset() {
    results.value = null
    offset.value = 0
    hasMore.value = false
    error.value = null
  }

  return {
    results, loading, error,
    pageNumber, hasPrevious, hasMore,
    search, nextPage, previousPage, reset
  }
}

export function useWheelFilters() {
  const products = ref([])
  const variants = ref([])
  const series = ref([])
  const loaded = ref(false)

  async function loadFilters() {
    if (loaded.value) return
    try {
      const filterResult = await apiRequest(`${BASE}/artifacts/wheels-collections/filters`).catch(() => ({ product_keys: [], variants: [] }))
      variants.value = filterResult.variants || []

      const productKeys = filterResult.product_keys || []
      if (productKeys.length > 0) {
        const allProducts = []
        for (const key of productKeys) {
          try {
            const p = await apiRequest(`${BASE}/products/${encodeURIComponent(key)}`)
            allProducts.push(p)
          } catch { /* skip unavailable products */ }
        }
        products.value = allProducts
      }
      loaded.value = true
    } catch { /* silently fail */ }
  }

  async function loadSeries(productKey) {
    if (!productKey || productKey === 'all') {
      series.value = []
      return
    }
    try {
      const data = await apiRequest(`${BASE}/series?product_key=${encodeURIComponent(productKey)}&supported_only=false&limit=100&offset=0`)
      series.value = Array.isArray(data) ? data : []
    } catch {
      series.value = []
    }
  }

  return { products, variants, series, loadFilters, loadSeries }
}
