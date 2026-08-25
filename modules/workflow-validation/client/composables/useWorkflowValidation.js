import { reactive } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/workflow-validation'

/**
 * Shared, module-wide filter state. Every view reads/writes the same object so
 * a version/verdict/search chosen on one page carries to the others — mirroring
 * the global filter bar in the reference OSD dashboard.
 */
export const filters = reactive({
  version: '',
  verdict: '',
  provider: '',
  workflow: '',
  category: '',
  action: '',
  q: '',
  dateFrom: '',
  dateTo: ''
})

export function resetFilters() {
  filters.version = ''
  filters.verdict = ''
  filters.provider = ''
  filters.workflow = ''
  filters.category = ''
  filters.action = ''
  filters.q = ''
  filters.dateFrom = ''
  filters.dateTo = ''
}

/** Build a query string from the shared filters plus any extra params. */
export function buildQuery(extra = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...filters, ...extra })) {
    if (v !== '' && v !== null && v !== undefined) params.set(k, v)
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

// ─── Formatting helpers ───

export function formatUsd(n) {
  if (n == null) return '—'
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'k'
  return '$' + Number(n).toFixed(2)
}

export function formatDuration(seconds) {
  if (seconds == null) return '—'
  const s = Math.round(seconds)
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60)
  if (m < 60) return m + 'm ' + (s % 60) + 's'
  const h = Math.floor(m / 60)
  return h + 'h ' + (m % 60) + 'm'
}

export function formatPercent(rate) {
  if (rate == null) return '—'
  return Math.round(rate * 100) + '%'
}

export function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── API ───

export function useWorkflowValidation() {
  const getStatus = () => apiRequest(`${BASE}/status`)
  const getFilters = () => apiRequest(`${BASE}/filters`)
  const getOverview = () => apiRequest(`${BASE}/overview${buildQuery()}`)
  const getCharts = () => apiRequest(`${BASE}/charts${buildQuery()}`)
  const getRuns = (page = 0, size = 25) => apiRequest(`${BASE}/runs${buildQuery({ page, size })}`)
  const getRun = (runKey) => apiRequest(`${BASE}/runs/${encodeURIComponent(runKey)}`)
  const getBugs = (page = 0, size = 50) => apiRequest(`${BASE}/bugs${buildQuery({ page, size })}`)
  const getWorkflows = () => apiRequest(`${BASE}/workflows${buildQuery()}`)
  const getWorkflowHistory = (workflow) => apiRequest(`${BASE}/workflow-history?workflow=${encodeURIComponent(workflow)}`)
  const getCiRuns = () => apiRequest(`${BASE}/ci-runs`)
  const getCompare = (a, b) => apiRequest(`${BASE}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`)

  return {
    getStatus, getFilters, getOverview, getCharts, getRuns, getRun, getBugs,
    getWorkflows, getWorkflowHistory, getCiRuns, getCompare
  }
}
