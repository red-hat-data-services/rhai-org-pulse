<template>
  <div class="min-w-0">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Recent Runs</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ RECENT_RUNS_PAGE_SIZE }} runs per page. Click a column heading to sort. All dates are UTC.</p>
      </div>
      <button type="button" :disabled="loading || searchPending" :class="buttonClass" @click="requestRuns(applied, true)">Refresh</button>
    </div>
    <form aria-label="Run filters" class="mb-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" @submit.prevent="applyFilters">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RecentVersionSelect v-model="draft.versions" :options="options.versions" @update:model-value="applyFilters" />
        <label class="text-sm text-gray-700 dark:text-gray-200">Test suite
          <select v-model="draft.suite" aria-label="Test suite" :class="inputClass" @change="applyFilters">
            <option value="">All suites</option>
            <option v-for="suite in options.suites" :key="suite" :value="suite">{{ formatSuiteName(suite) }}</option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-200">Run ID
          <input v-model="draft.runQuery" aria-label="Run ID" type="search" maxlength="256" placeholder="Search any run ID" :class="inputClass" @input="scheduleSearch">
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-200">Date Range
          <select v-model="draft.datePreset" aria-label="Date Range" :class="inputClass" @change="applyDatePreset">
            <option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom dates</option>
          </select>
        </label>
        <template v-if="draft.datePreset === 'custom'">
          <label class="text-sm text-gray-700 dark:text-gray-200">Start Date (UTC)
            <input v-model="draft.dateFrom" aria-label="Start Date (UTC)" type="date" :max="draft.dateTo || undefined" :class="inputClass" @change="applyFilters">
          </label>
          <label class="text-sm text-gray-700 dark:text-gray-200">End Date (UTC)
            <input v-model="draft.dateTo" aria-label="End Date (UTC)" type="date" :min="draft.dateFrom || undefined" :class="inputClass" @change="applyFilters">
          </label>
        </template>
      </div>
      <div class="mt-4 flex flex-wrap gap-3">
        <p class="self-center text-sm text-gray-500 dark:text-gray-400">Filters update automatically.</p>
        <button type="button" :class="buttonClass" @click="clearFilters">Clear filters</button>
      </div>
      <p v-if="invalidDateRange" role="alert" class="mt-3 text-sm text-amber-700 dark:text-amber-300">Start Date must be on or before End Date.</p>
    </form>
    <div v-if="error || restoreError" role="alert" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
      <p class="text-sm text-gray-800 dark:text-gray-200">{{ restoreError || error }}</p>
      <p v-if="hasLoaded" class="mt-1 text-sm text-gray-600 dark:text-gray-300">The previous results are still shown.</p>
      <button v-if="!restoreError" type="button" :disabled="loading || searchPending" class="mt-2 text-sm font-semibold text-primary-700 dark:text-primary-300" @click="requestRuns(lastAttempt, true)">Retry</button>
    </div>
    <p v-if="loading || searchPending" role="status" class="mb-4 text-sm text-gray-500 dark:text-gray-400">{{ hasLoaded ? 'Updating recent runs…' : 'Loading recent runs…' }}</p>
    <div v-if="hasLoaded" :aria-busy="loading" class="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div class="relative overflow-x-auto">
        <table class="w-full min-w-[48rem] table-fixed text-left text-sm">
          <caption class="sr-only">Recent Workflow Validation runs. Select a run to open its details.</caption>
          <thead class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <tr>
              <th v-for="column in columns" :key="column.field" scope="col" :aria-label="column.label" :aria-sort="applied.sortField === column.field ? (applied.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'" class="p-0">
                <button type="button" :aria-label="column.sortLabel"
                  class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500 dark:hover:bg-gray-700/30"
                  @click="setSort(column)">
                  <span>{{ column.label }}</span>
                  <span aria-hidden="true" class="shrink-0 text-sm">{{ applied.sortField === column.field ? (applied.sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in runs" :key="JSON.stringify([run.suite, run.invocationId])" :tabindex="canOpen(run) ? 0 : undefined" :aria-label="canOpen(run) ? `Open run ${run.invocationId}` : undefined"
              class="border-b border-gray-50 dark:border-gray-700" :class="canOpen(run) ? 'cursor-pointer hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500 dark:hover:bg-gray-700/30' : ''"
              @click="openRun(run, $event)" @keydown.enter.prevent="openRun(run, $event)">
              <td class="px-5 py-4">
                <div class="font-medium text-gray-900 dark:text-gray-100">{{ run.suite ? formatSuiteName(run.suite) : 'Test suite unavailable' }}</div>
                <div class="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{{ run.invocationId }}</div>
              </td>
              <td class="break-words px-5 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{{ run.rhoaiVersion ? versionLabel(run.rhoaiVersion) : 'Version unavailable' }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300"><time v-if="validTime(run.timestamp)" :datetime="run.timestamp">{{ recordedTime(run.timestamp) }}</time><span v-else>Unavailable</span></td>
            </tr>
            <tr v-if="!runs.length"><td colspan="3" class="px-5 py-12 text-center text-gray-500 dark:text-gray-400">{{ page.total ? 'This page has changed. Use Previous to return to the first page.' : hasFilters ? 'No runs match these filters.' : 'No runs are available.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <nav aria-label="Recent run pages" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p aria-live="polite" class="text-sm text-gray-600 dark:text-gray-300">Showing {{ page.start }}–{{ page.end }} of {{ page.total }} runs</p>
        <div class="flex gap-3"><button type="button" aria-label="Previous page" :disabled="loading || searchPending || page.previousCursor === null" :class="buttonClass" @click="loadPage(page.previousCursor)">Previous</button><button type="button" aria-label="Next page" :disabled="loading || searchPending || page.nextCursor === null" :class="buttonClass" @click="loadPage(page.nextCursor)">Next</button></div>
      </nav>
    </div>
  </div>
</template>
<script setup>
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RECENT_RUNS_PAGE_SIZE, formatSuiteName, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'
import RecentVersionSelect from '../components/RecentVersionSelect.vue'
import * as versionRules from '../../lib/versions.js'
const { normalizeVersions, versionLabel } = versionRules
const nav = inject('moduleNav', null)
const { getRecentRuns } = useWorkflowValidation()
const columns = [
  { field: 'suite', label: 'Test suite', sortLabel: 'Sort test suite', firstDirection: 'asc' },
  { field: 'version', label: 'Version', sortLabel: 'Sort version', firstDirection: 'desc' },
  { field: 'timestamp', label: 'Executed at (UTC)', sortLabel: 'Sort execution time', firstDirection: 'desc' }
]
const fields = { suite: 'recentSuite', runQuery: 'recentRun', datePreset: 'recentDatePreset', dateFrom: 'recentFrom', dateTo: 'recentTo', sortField: 'recentSortField', sortDir: 'recentSort', cursor: 'recentCursor' }
const defaults = () => ({ versions: [], suite: '', runQuery: '', datePreset: 'all', dateFrom: '', dateTo: '', sortField: 'timestamp', sortDir: 'desc', cursor: '' })
const restoreError = ref('')
/** Return inclusive UTC calendar bounds for a date preset. */
function utcRange(days, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return { dateFrom: new Date(end.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) }
}
/** Restore page-owned filters while keeping legacy cursor spellings intact. */
function fromUrl() {
  const query = defaults(), params = nav?.params?.value || {}
  restoreError.value = ''
  for (const [key, name] of Object.entries(fields)) if (typeof params[name] === 'string') query[key] = params[name]
  if (params.recentVersions) {
    try {
      query.versions = JSON.parse(params.recentVersions)
      if (!Array.isArray(query.versions) || query.versions.length > 50 || query.versions.some(value => typeof value !== 'string' || !value || value.length > 256)) throw new Error()
    } catch { query.versions = []; restoreError.value = 'The saved version selection is invalid. Choose versions again or clear filters.' }
  } else if (typeof params.recentVersion === 'string' && params.recentVersion) query.versions = [params.recentVersion]
  query.sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'
  query.sortField = columns.some(column => column.field === query.sortField) ? query.sortField : 'timestamp'
  if (!['all', '7', '30', '90', 'custom'].includes(query.datePreset)) query.datePreset = 'all'
  if (!params.recentDatePreset && (query.dateFrom || query.dateTo)) query.datePreset = 'custom'
  if (query.datePreset === 'all') { query.dateFrom = ''; query.dateTo = '' }
  if (['7', '30', '90'].includes(query.datePreset) && !query.dateFrom && !query.dateTo) Object.assign(query, utcRange(Number(query.datePreset)))
  return query
}
const applied = ref(fromUrl()), draft = reactive({ ...applied.value, versions: [...applied.value.versions] })
const invalidDateRange = computed(() => draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo)
const runs = ref([]), options = ref({ versions: [], suites: [] }), page = ref({ total: 0, start: 0, end: 0, nextCursor: null, previousCursor: null })
const loading = ref(false), searchPending = ref(false), hasLoaded = ref(false), error = ref(''), lastAttempt = ref({ ...applied.value })
const hasFilters = computed(() => applied.value.versions.length || ['suite', 'runQuery', 'dateFrom', 'dateTo'].some(key => applied.value[key]))
const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900'
const buttonClass = 'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
const formatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' })
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const recordedTime = value => formatter.format(new Date(value))
const canOpen = run => Boolean(run.suite && run.invocationId)
let active = true, sequence = 0, controller, searchTimer
/** Cancel a queued Run ID filter before another action takes over. */
function cancelSearch() { clearTimeout(searchTimer); searchPending.value = false }
/** Open the exact suite and invocation while allowing users to select row text. */
function openRun(run, event) {
  if (!canOpen(run) || (event?.type === 'click' && window.getSelection()?.toString())) return
  const params = { exactRun: '1', version: '', testSuite: run.suite, invocationId: run.invocationId, datePreset: 'all', dateFrom: '', dateTo: '' }
  if (nav?.navigateTo) nav.navigateTo('overview', params)
  else window.location.hash = `/workflow-validation/overview?${new URLSearchParams(params)}`
}
/** Load a validated page, ignore stale responses, and commit matching URL and cursor state. */
async function requestRuns(query, refresh = false) {
  cancelSearch()
  const current = ++sequence
  controller?.abort()
  if (restoreError.value || (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo)) { loading.value = false; error.value = ''; return }
  controller = new AbortController()
  const requested = { ...query, versions: [...query.versions] }
  lastAttempt.value = requested
  loading.value = true; error.value = ''
  try {
    const { datePreset: _preset, ...params } = requested
    const data = await getRecentRuns({ ...params, ...(refresh ? { refresh: true } : {}) }, { signal: controller.signal })
    if (!active || current !== sequence) return
    if (!Array.isArray(data.rows) || data.rows.length > RECENT_RUNS_PAGE_SIZE || !Number.isInteger(data.total) || !Number.isInteger(data.start) || !Number.isInteger(data.end)
      || !Array.isArray(data.options?.versions) || !Array.isArray(data.options?.suites) || !(data.nextCursor === null || typeof data.nextCursor === 'string') || !(data.previousCursor === null || typeof data.previousCursor === 'string')) throw new Error('The run service returned an invalid page. Please retry.')
    runs.value = data.rows; page.value = { total: data.total, start: data.start, end: data.end, nextCursor: data.nextCursor, previousCursor: data.previousCursor }; options.value = data.options
    // Keep the original spelling while a restored cursor still depends on its scope.
    if (!requested.cursor) requested.versions = normalizeVersions(requested.versions)
    applied.value = requested; hasLoaded.value = true
    syncQueryParams(nav, { ...Object.fromEntries(Object.entries(fields).map(([key, name]) => [name, requested[key]])), recentVersions: requested.versions.length ? JSON.stringify(requested.versions) : '', recentVersion: '' })
  } catch (err) { if (active && current === sequence) error.value = err.message || 'Failed to load recent runs.' }
  finally { if (active && current === sequence) loading.value = false }
}
/** Apply canonical filters from page one after a user changes the selection. */
function applyFilters() {
  cancelSearch(); restoreError.value = ''
  requestRuns({ ...draft, versions: normalizeVersions(draft.versions), cursor: '' })
}
/** Set the date bounds for the selected preset before applying filters. */
function applyDatePreset() {
  Object.assign(draft, draft.datePreset === 'all' ? { dateFrom: '', dateTo: '' } : draft.datePreset === 'custom' ? {} : utcRange(Number(draft.datePreset)))
  applyFilters()
}
/** Reverse the active sort or use the new column’s first direction, only for valid dates. */
function setSort(column) {
  if (invalidDateRange.value) return
  // During a request, reverse the latest intent; otherwise follow the displayed rows.
  const current = loading.value ? lastAttempt.value : applied.value
  draft.sortDir = current.sortField === column.field ? (current.sortDir === 'asc' ? 'desc' : 'asc') : column.firstDirection
  draft.sortField = column.field
  applyFilters()
}
/** Cancel outdated work and debounce the next Run ID request. */
function scheduleSearch() { cancelSearch(); sequence += 1; controller?.abort(); loading.value = false; error.value = ''; searchPending.value = true; searchTimer = setTimeout(applyFilters, 300) }
/** Restore the unfiltered newest-first first page. */
function clearFilters() { Object.assign(draft, defaults()); applyFilters() }
/** Load a neighboring page with the exact filter scope that produced its cursor. */
function loadPage(cursor) { requestRuns({ ...applied.value, cursor: cursor || '' }) }
watch(() => nav?.params?.value, () => { const query = fromUrl(); if (JSON.stringify(query) === JSON.stringify(applied.value)) return; Object.assign(draft, query); requestRuns(query) }, { deep: true })
onMounted(() => requestRuns(applied.value))
onBeforeUnmount(() => { active = false; sequence += 1; cancelSearch(); controller?.abort() })
</script>
