import { ref, computed } from 'vue'
import { getApiBase, SESSION_CACHE_PREFIX } from '@shared/client/services/api'

const CACHE_KEY = `${SESSION_CACHE_PREFIX}risk-dashboard-config:v1`
const CACHE_TTL_MS = 5 * 60 * 1000

function readCache() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || Date.now() - parsed._cachedAt > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(data) {
  if (typeof sessionStorage === 'undefined' || !data) return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, _cachedAt: Date.now() }))
  } catch {
    // quota or private mode
  }
}

function clearCache() {
  if (typeof sessionStorage === 'undefined') return
  try { sessionStorage.removeItem(CACHE_KEY) } catch { /* noop */ }
}

const config = ref(null)
const loading = ref(false)

async function loadConfig(force) {
  if (!force) {
    const cached = readCache()
    if (cached) {
      config.value = cached
      return
    }
  }

  loading.value = true
  try {
    const response = await fetch(getApiBase() + '/modules/releases/delivery/risk-dashboard-config')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const data = await response.json()
    config.value = data
    writeCache(data)
  } catch {
    config.value = { portfolioReleases: [] }
  } finally {
    loading.value = false
  }
}

async function saveConfig(data) {
  const response = await fetch(getApiBase() + '/modules/releases/delivery/risk-dashboard-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) {
    const errData = await response.json().catch(function () { return {} })
    throw new Error(errData.error || 'HTTP ' + response.status)
  }
  config.value = data
  writeCache(data)
}

const portfolioReleases = computed(function () {
  return (config.value && config.value.portfolioReleases) || []
})

export function useRiskDashboardConfig() {
  return {
    config,
    loading,
    loadConfig,
    saveConfig,
    clearCache,
    portfolioReleases
  }
}
