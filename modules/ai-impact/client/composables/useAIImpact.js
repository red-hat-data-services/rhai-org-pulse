import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

// Singleton state — fetch once, share refs
const rfeData = ref(null)
const loading = ref(true)
const error = ref(null)
const refreshStatus = ref(null)
let hasFetched = false

const timeWindow = ref('month')

async function load() {
  loading.value = true
  error.value = null
  try {
    const tw = timeWindow.value || 'month'
    rfeData.value = await apiRequest(`/modules/ai-impact/rfe-data?timeWindow=${tw}`)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function refresh() {
  return apiRequest('/modules/ai-impact/refresh', { method: 'POST' })
}

async function checkRefreshStatus() {
  refreshStatus.value = await apiRequest('/modules/ai-impact/refresh/status')
}

// Re-fetch when time window changes
watch(timeWindow, () => load())

export function useAIImpact(tw) {
  if (tw) {
    timeWindow.value = tw.value || tw
  }
  if (!hasFetched) {
    hasFetched = true
    load()
  }
  return { rfeData, loading, error, refresh, refreshStatus, checkRefreshStatus, load, timeWindow }
}

export function _resetForTesting() {
  rfeData.value = null
  loading.value = true
  error.value = null
  refreshStatus.value = null
  hasFetched = true // prevent auto-fetch so tests control when loading happens
}
