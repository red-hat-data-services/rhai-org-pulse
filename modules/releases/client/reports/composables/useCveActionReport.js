import { ref } from 'vue'

const COMPONENTS_API = '/api/modules/releases/cve-sustaining/action-report/components'
const ACTION_API = '/api/modules/releases/cve-sustaining/action-report'
const REFRESH_API = '/api/modules/releases/cve-sustaining/refresh'

export function useCveActionReport () {
  const data = ref(null)
  const availableComponents = ref([])
  const selectedComponent = ref('')
  const lastRefreshed = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const refreshing = ref(false)
  let requestToken = 0

  async function loadComponents (preferred = '') {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(COMPONENTS_API)
      if (!response.ok) {
        if (response.status === 404) return
        throw new Error(`Failed to load CVE components: ${response.statusText}`)
      }
      const payload = await response.json()
      availableComponents.value = [...new Set(payload.availableComponents || [])].filter(Boolean).sort((a, b) => a.localeCompare(b))
      lastRefreshed.value = payload.lastRefreshed || null
      if (preferred && availableComponents.value.includes(preferred)) await loadReport(preferred)
    } catch (err) {
      error.value = err.message || 'Failed to load CVE components'
    } finally {
      loading.value = false
    }
  }

  async function loadReport (component) {
    if (!component || !availableComponents.value.includes(component)) {
      selectedComponent.value = ''
      data.value = null
      return
    }
    selectedComponent.value = component
    data.value = null
    loading.value = true
    error.value = null
    const token = ++requestToken
    try {
      const response = await fetch(`${ACTION_API}?component=${encodeURIComponent(component)}`)
      if (!response.ok) throw new Error(`Failed to load CVE action report: ${response.statusText}`)
      const payload = await response.json()
      if (token === requestToken) {
        data.value = payload
        lastRefreshed.value = payload.lastRefreshed || lastRefreshed.value
        if (Array.isArray(payload.availableComponents)) {
          availableComponents.value = payload.availableComponents
        }
      }
    } catch (err) {
      if (token === requestToken) error.value = err.message || 'Failed to load CVE action report'
    } finally {
      if (token === requestToken) loading.value = false
    }
  }

  async function refresh () {
    refreshing.value = true
    error.value = null
    try {
      const response = await fetch(REFRESH_API, { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Failed to refresh CVE data: ${response.statusText}`)
      }
      await response.json()
      await loadComponents(selectedComponent.value)
    } catch (err) {
      error.value = err.message || 'Failed to refresh CVE data from Jira'
    } finally {
      refreshing.value = false
    }
  }

  return { data, availableComponents, selectedComponent, lastRefreshed, loading, error, refreshing, loadComponents, loadReport, refresh }
}
