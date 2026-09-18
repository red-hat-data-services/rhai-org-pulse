import { reactive } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/workflow-validation'
const EMPTY_FILTER_OPTIONS = { versions: [], providers: [], models: [], workflows: [], testSuites: [] }
let filterOptionsPromise
let explicitVersionSelection = false
let explicitDateSelection = false

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
  jiraScope: '',
  testSuite: '',
  invocationId: '',
  datePreset: '90',
  dateFrom: '',
  dateTo: ''
})

export function resetFilters() {
  explicitVersionSelection = false
  explicitDateSelection = false
  const dates = defaultDateRange()
  filters.version = ''
  filters.verdict = ''
  filters.workflow = ''
  filters.category = ''
  filters.action = ''
  filters.q = ''
  filters.jiraScope = ''
  filters.testSuite = ''
  filters.invocationId = ''
  filters.datePreset = '90'
  filters.dateFrom = dates.dateFrom
  filters.dateTo = dates.dateTo
}

export function hydrateFilters(params = {}, keys = []) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(params, key)) filters[key] = params[key]
  }
  if (keys.includes('version') && Object.prototype.hasOwnProperty.call(params, 'version')) explicitVersionSelection = true
  if (keys.some((key) => ['datePreset', 'dateFrom', 'dateTo'].includes(key)) && (
    Object.prototype.hasOwnProperty.call(params, 'dateFrom') || Object.prototype.hasOwnProperty.call(params, 'dateTo')
  )) explicitDateSelection = true
}

export function syncQueryParams(nav, values) {
  nav?.updateParams?.(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value ?? ''])), { push: false })
}

export function filterQueryValues(keys = []) {
  return Object.fromEntries(keys.map((key) => [key, filters[key]]))
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
        if (!explicitVersionSelection && !filters.version) filters.version = highestNumberedVersion(options.versions) || ''
        if (!explicitDateSelection && !filters.dateFrom && !filters.dateTo) Object.assign(filters, defaultDateRange())
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
  if (!value) return 'Unknown test run'
  return String(value).replaceAll(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatBuildId(value) {
  if (!value || String(value).toLowerCase() === 'unknown') return 'Unknown'
  return String(value).replace(/^sha256:/i, '').slice(0, 8)
}

const VERSION_COLORS = ['#3b82f6', '#f97316', '#a855f7', '#14b8a6', '#ec4899', '#eab308', '#06b6d4', '#ef4444', '#6366f1', '#84cc16', '#f43f5e', '#0ea5e9']

export function versionColor(version, domain = [], alpha = 1) {
  const versions = domain.length ? domain : [version || 'Unknown']
  const index = Math.max(0, versions.indexOf(version || 'Unknown'))
  const color = VERSION_COLORS[index % VERSION_COLORS.length]
  if (alpha >= 1) return color
  return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`
}

export function compareTableValues(left, right, direction = 'asc') {
  const a = left == null ? '' : left
  const b = right == null ? '' : right
  const result = typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
  return direction === 'desc' ? -result : result
}

export function displayedTestOutcome(test = {}) {
  const verdict = String(test.verdict || '').toUpperCase()
  if (test.passed === true || verdict === 'PASS') return 'PASS'
  if (!['FAIL', 'ERROR'].includes(verdict) && test.passed !== false) return verdict || 'UNKNOWN'
  const hasProductBug = (test.productBugs || []).some((finding) => finding.category === 'PRODUCT_BUG')
  return hasProductBug ? 'FAIL' : 'SKIP'
}

export function displayedOutcomeCounts(tests = []) {
  return tests.reduce((counts, test) => {
    const outcome = displayedTestOutcome(test).toLowerCase()
    if (Object.hasOwn(counts, outcome)) counts[outcome] += 1
    return counts
  }, { pass: 0, fail: 0, skip: 0 })
}

export function runOutcomeCounts(run = {}) {
  if (Array.isArray(run.tests)) return displayedOutcomeCounts(run.tests)
  const pass = Number(run.passed) || 0
  const unsuccessful = (Number(run.failed) || 0) + (Number(run.errors) || 0)
  const productBugTests = new Set((run.productBugs || [])
    .filter((finding) => finding.category === 'PRODUCT_BUG')
    .map((finding) => finding.workflow || finding.root_cause_id || finding.id)
    .filter(Boolean)).size
  const fail = Math.min(unsuccessful, productBugTests)
  return { pass, fail, skip: Math.max(0, unsuccessful - fail) }
}

// ─── API ───

export function useWorkflowValidation() {
  const getStatus = () => apiRequest(`${BASE}/status`)
  const getFilters = () => initializeVersionFilter()
  const getOverview = (extra = {}) => filteredRequest('overview', ['version', 'dateFrom', 'dateTo', 'testSuite', 'invocationId'], extra)
  const getCharts = (extra = {}) => filteredRequest('charts', ['version', 'dateFrom', 'dateTo', 'testSuite', 'invocationId'], extra)
  const getRuns = (cursor = '', size = 25, sorting = {}) => filteredRequest('runs', ['version', 'verdict', 'workflow', 'q', 'testSuite', 'invocationId', 'dateFrom', 'dateTo'], { cursor, size, ...sorting })
  const getRun = (executionId) => apiRequest(`${BASE}/runs/${encodeURIComponent(executionId)}`)
  const getBugs = (cursor = '', size = 50) => filteredRequest('bugs', ['version', 'testSuite', 'invocationId', 'workflow', 'category', 'action', 'q', 'dateFrom', 'dateTo'], { cursor, size })
  const getWorkflows = (extra = {}) => filteredRequest('workflows', ['version', 'q', 'dateFrom', 'dateTo'], extra)
  const getWorkflowHistory = (workflow) => filteredRequest('workflow-history', ['version', 'dateFrom', 'dateTo'], { workflow })
  const getCiRuns = () => apiRequest(`${BASE}/ci-runs`)
  const getCompare = (a, b) => apiRequest(`${BASE}/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`)
  const getCompareRuns = (testSuite = '') => apiRequest(`${BASE}/compare-runs${buildQuery({ testSuite }, {})}`)
  const getRunCompare = (baselineInvocation, targetInvocation, testSuite) => apiRequest(`${BASE}/run-compare${buildQuery({ baselineInvocation, targetInvocation, testSuite }, {})}`)
  const getTestSuites = (params = {}) => apiRequest(`${BASE}/test-suites${buildQuery(params, {})}`)
  const getTestSuite = (suite, invocationId) => apiRequest(`${BASE}/test-suites/${encodeURIComponent(suite)}/${encodeURIComponent(invocationId)}`)

  return {
    getStatus, getFilters, getOverview, getCharts, getRuns, getRun, getBugs,
    getWorkflows, getWorkflowHistory, getCiRuns, getCompare,
    getCompareRuns, getRunCompare, getTestSuites, getTestSuite
  }
}
