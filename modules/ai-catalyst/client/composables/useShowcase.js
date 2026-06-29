import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const MODULE_API = '/modules/ai-catalyst/showcase'

const entries = ref([])
const pillars = ref([])
const meta = ref({ fetchedAt: null, totalEntries: 0 })
const loading = ref(false)
const error = ref(null)
const detailCache = ref({})
let hasFetched = false

async function loadEntries() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest(`${MODULE_API}/entries`)
    entries.value = data.entries || []
    pillars.value = data.pillars || []
    meta.value = { fetchedAt: data.fetchedAt, totalEntries: data.totalEntries }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadEntryDetail(slug) {
  if (detailCache.value[slug]) {
    return detailCache.value[slug]
  }
  try {
    const data = await apiRequest(`${MODULE_API}/entries/${encodeURIComponent(slug)}`)
    detailCache.value[slug] = data
    return data
  } catch (e) {
    error.value = e.message
    return null
  }
}

export function useShowcase() {
  if (!hasFetched) {
    hasFetched = true
    loadEntries()
  }
  return {
    entries,
    pillars,
    meta,
    loading,
    error,
    loadEntries,
    loadEntryDetail,
    detailCache,
  }
}

export function _resetForTesting() {
  entries.value = []
  pillars.value = []
  meta.value = { fetchedAt: null, totalEntries: 0 }
  loading.value = false
  error.value = null
  detailCache.value = {}
  hasFetched = false
}
