import { reactive } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/workflow-validation'
const EMPTY_FILTER_OPTIONS = { versions: [], providers: [], models: [], workflows: [], testSuites: [] }
let filterOptionsPromise

/**
 * Shared, module-wide filter state. Every view reads/writes the same object so
 * a version/verdict/search chosen on one page carries to the others — mirroring
 * the global filter bar in the reference OSD dashboard.
 */
export const filters = reactive({
  version: '',
  verdict: '',
  workflow: '',
  category: '',
  action: '',
  q: '',
  dateFrom: '',
  dateTo: ''
})

export function resetFilters() {
  const dates = defaultDateRange()
  filters.version = ''
  filters.verdict = ''
  filters.workflow = ''
  filters.category = ''
  filters.action = ''
  filters.q = ''
  filters.dateFrom = dates.dateFrom
  filters.dateTo = dates.dateTo
}

/** Build a query string from the shared filters plus any extra params. */
export function buildQuery(extra = {}, base = filters) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...base, ...extra })) {
    if (v !== '' && v !== null && v !== undefined) params.set(k, v)
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** Compare arbitrary labels by their numeric runs, from left to right. */
export function compareVersionNumbers(a, b) {
  const numbers = (value) => (String(value).match(/\d+/g) || []).map((part) => BigInt(part))
  const left = numbers(a)
  const right = numbers(b)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    if (index >= left.length) return -1
    if (index >= right.length) return 1
    if (left[index] < right[index]) return -1
    if (left[index] > right[index]) return 1
  }
  return String(a).localeCompare(String(b))
}

export function highestNumberedVersion(versions = []) {
  const values = versions.map((version) => version?.value ?? version).filter(Boolean)
  const numbered = values.filter((value) => /\d/.test(String(value)))
  return numbered.reduce((highest, value) =>
    highest == null || compareVersionNumbers(value, highest) > 0 ? value : highest, null)
}

function inputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function defaultDateRange(days = 90, now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return { dateFrom: inputDate(start), dateTo: inputDate(end) }
}

async function initializeVersionFilter() {
  if (!filterOptionsPromise) {
    filterOptionsPromise = apiRequest(`${BASE}/filters`)
      .then((options) => {
        if (!filters.version) filters.version = highestNumberedVersion(options.versions) || ''
        if (!filters.dateFrom && !filters.dateTo) Object.assign(filters, defaultDateRange())
        return options
      })
      .catch(() => EMPTY_FILTER_OPTIONS)
  }
  return filterOptionsPromise
}

async function filteredRequest(path, keys, extra = {}) {
  await initializeVersionFilter()
  const scoped = Object.fromEntries(keys.map((key) => [key, filters[key]]))
  return apiRequest(`${BASE}/${path}${buildQuery(extra, scoped)}`)
}

// ─── Formatting helpers ───

export function formatUsd(n) {
  if (n == null) return '—'
  const value = Number(n)
  if (!Number.isFinite(value)) return '—'
  if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'k'
  return '$' + value.toFixed(2)
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

export function formatRatio(value, total) {
  if (value == null || total == null) return '—'
  return `${value}/${total}`
}

export function formatSuiteName(value) {
  if (!value) return 'Unknown test suite'
  return String(value).replaceAll(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatBuildId(value) {
  if (!value || String(value).toLowerCase() === 'unknown') return 'Unknown'
  return String(value).replace(/^sha256:/i, '').slice(0, 8)
}

export function compareTableValues(left, right, direction = 'asc') {
  const a = left == null ? '' : left
  const b = right == null ? '' : right
  const result = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  return direction === 'desc' ? -result : result
}

// ─── API ───

export function useWorkflowValidation() {
  const getStatus = () => apiRequest(`${BASE}/status`)
  const getFilters = () => initializeVersionFilter()
  const getOverview = (extra = {}) => filteredRequest('overview', ['version', 'dateFrom', 'dateTo'], extra)
  const getCharts = (extra = {}) => filteredRequest('charts', ['version', 'dateFrom', 'dateTo'], extra)
  const getRuns = (cursor = '', size = 25, sorting = {}) => filteredRequest('runs', ['version', 'verdict', 'workflow', 'q', 'dateFrom', 'dateTo'], { cursor, size, ...sorting })
  const getRun = (executionId) => apiRequest(`${BASE}/runs/${encodeURIComponent(executionId)}`)
  const getBugs = (cursor = '', size = 50) => filteredRequest('bugs', ['version', 'workflow', 'category', 'action', 'q', 'dateFrom', 'dateTo'], { cursor, size })
  const getWorkflows = (extra = {}) => filteredRequest('workflows', ['version', 'q', 'dateFrom', 'dateTo'], extra)
  const getWorkflowHistory = (workflow) => filteredRequest('workflow-history', ['version', 'dateFrom', 'dateTo'], { workflow })
  const getCiRuns = () => apiRequest(`${BASE}/ci-runs`)
  const getCompare = (a, b) => apiRequest(`${BASE}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`)
  const getCompareVersions = () => apiRequest(`${BASE}/compare-versions`)
  const getVersionCompare = (baseline, target) => apiRequest(`${BASE}/version-compare?baseline=${encodeURIComponent(baseline)}&target=${encodeURIComponent(target)}`)
  const getTestSuites = (params = {}) => apiRequest(`${BASE}/test-suites${buildQuery(params, {})}`)
  const getTestSuite = (suite, invocationId) => apiRequest(`${BASE}/test-suites/${encodeURIComponent(suite)}/${encodeURIComponent(invocationId)}`)

  return {
    getStatus, getFilters, getOverview, getCharts, getRuns, getRun, getBugs,
    getWorkflows, getWorkflowHistory, getCiRuns, getCompare,
    getCompareVersions, getVersionCompare, getTestSuites, getTestSuite
  }
}
