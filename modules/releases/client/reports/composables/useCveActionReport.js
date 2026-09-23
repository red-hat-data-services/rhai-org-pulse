import { ref } from 'vue'

const COMPONENTS_API = '/api/modules/releases/cve-sustaining/action-report/components'
const ACTION_API = '/api/modules/releases/cve-sustaining/action-report'
const REFRESH_API = '/api/modules/releases/cve-sustaining/refresh'
const REFRESH_POLL_INTERVAL_MS = 3000
const REFRESH_POLL_TIMEOUT_MS = 5 * 60 * 1000
const INDETERMINATE_REFRESH_STATUSES = new Set([502, 504])

function normalizeComponents (components) {
  return [...new Set(components || [])].filter(Boolean).sort((a, b) => a.localeCompare(b))
}

export function useCveActionReport () {
  const data = ref(null)
  const availableComponents = ref([])
  const selectedComponent = ref('')
  const lastRefreshed = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const refreshError = ref(null)
  const refreshing = ref(false)
  let requestToken = 0
  let refreshToken = 0
  let pollTimer = null
  let pollResolver = null
  let alive = true

  async function fetchComponentsPayload () {
    const response = await fetch(COMPONENTS_API)
    if (!response.ok) {
      const err = new Error(`Failed to load CVE components: ${response.statusText}`)
      err.status = response.status
      throw err
    }
    return response.json()
  }

  async function fetchReportPayload (component) {
    const response = await fetch(`${ACTION_API}?component=${encodeURIComponent(component)}`)
    if (!response.ok) throw new Error(`Failed to load CVE action report: ${response.statusText}`)
    return response.json()
  }

  function waitForNextPoll () {
    return new Promise(resolve => {
      pollResolver = resolve
      pollTimer = setTimeout(() => {
        pollTimer = null
        pollResolver = null
        resolve(true)
      }, REFRESH_POLL_INTERVAL_MS)
    })
  }

  function stopPolling () {
    if (pollTimer) clearTimeout(pollTimer)
    pollTimer = null
    if (pollResolver) pollResolver(false)
    pollResolver = null
  }

  async function applyRefreshedCache (componentsPayload, preferred, token) {
    const components = normalizeComponents(componentsPayload.availableComponents)
    const nextSelected = preferred && components.includes(preferred) ? preferred : ''
    const nextData = nextSelected ? await fetchReportPayload(nextSelected) : null
    if (!alive || token !== refreshToken) return false

    availableComponents.value = components
    selectedComponent.value = nextSelected
    data.value = nextData
    lastRefreshed.value = nextData?.lastRefreshed || componentsPayload.lastRefreshed || null
    error.value = null
    return true
  }

  async function pollForRefreshedCache (baseline, preferred, token) {
    const deadline = Date.now() + REFRESH_POLL_TIMEOUT_MS
    while (alive && token === refreshToken && Date.now() < deadline) {
      if (!await waitForNextPoll()) return false
      try {
        const payload = await fetchComponentsPayload()
        const timestamp = payload.lastRefreshed || null
        if (timestamp && timestamp !== baseline) {
          return applyRefreshedCache(payload, preferred, token)
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) throw err
        // The refresh may still own the backend or the cache may not exist yet.
      }
    }
    return false
  }

  async function loadComponents (preferred = '') {
    loading.value = true
    error.value = null
    try {
      const payload = await fetchComponentsPayload()
      availableComponents.value = normalizeComponents(payload.availableComponents)
      lastRefreshed.value = payload.lastRefreshed || null
      if (preferred && availableComponents.value.includes(preferred)) {
        await loadReport(preferred)
      } else if (preferred) {
        selectedComponent.value = ''
        data.value = null
      }
    } catch (err) {
      if (err.status === 404) return
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
      const payload = await fetchReportPayload(component)
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
    if (refreshing.value) return
    const token = ++refreshToken
    const baseline = lastRefreshed.value
    const preferred = selectedComponent.value
    refreshing.value = true
    refreshError.value = null
    try {
      let response
      try {
        response = await fetch(REFRESH_API, { method: 'POST' })
      } catch {
        const updated = await pollForRefreshedCache(baseline, preferred, token)
        if (!updated && alive && token === refreshToken) {
          refreshError.value = 'The Jira refresh is taking longer than expected. Current data is still shown; try again shortly.'
        }
        return
      }

      if (!response.ok) {
        if (INDETERMINATE_REFRESH_STATUSES.has(response.status)) {
          const updated = await pollForRefreshedCache(baseline, preferred, token)
          if (!updated && alive && token === refreshToken) {
            refreshError.value = 'The Jira refresh is taking longer than expected. Current data is still shown; try again shortly.'
          }
          return
        }
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Failed to refresh CVE data: ${response.statusText}`)
      }

      const componentsPayload = await fetchComponentsPayload()
      await applyRefreshedCache(componentsPayload, preferred, token)
    } catch (err) {
      if (alive && token === refreshToken) {
        refreshError.value = err.message || 'Failed to refresh CVE data from Jira'
      }
    } finally {
      if (alive && token === refreshToken) refreshing.value = false
    }
  }

  function cleanup () {
    alive = false
    refreshToken++
    stopPolling()
  }

  return { data, availableComponents, selectedComponent, lastRefreshed, loading, error, refreshError, refreshing, loadComponents, loadReport, refresh, cleanup }
}
