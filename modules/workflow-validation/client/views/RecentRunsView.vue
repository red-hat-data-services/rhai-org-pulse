<template>
  <div class="min-w-0">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Recent Runs</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">20 runs per page, ordered by recorded test time. All dates are UTC.</p>
      </div>
      <button type="button" :disabled="loading || searchPending" :class="buttonClass" @click="requestRuns(applied)">Refresh</button>
    </div>

    <form aria-label="Run filters" class="mb-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" @submit.prevent="applyFilters">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="text-sm text-gray-700 dark:text-gray-200">RHOAI version
          <select v-model="draft.version" aria-label="RHOAI version" :class="inputClass" @change="applyFilters">
            <option value="">All versions</option>
            <option v-for="version in options.versions" :key="version" :value="version">{{ version }}</option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-200">Test suite
          <select v-model="draft.suite" aria-label="Test suite" :class="inputClass" @change="applyFilters">
            <option value="">All suites</option>
            <option v-for="suite in options.suites" :key="suite" :value="suite">{{ formatSuiteName(suite) }}</option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-200">Run ID
          <input v-model="draft.runQuery" aria-label="Run ID" type="search" maxlength="256" placeholder="Search any run ID" :class="inputClass" @input="scheduleSearch">
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-200">Recorded from (UTC)
          <input v-model="draft.dateFrom" aria-label="Recorded from (UTC)" type="date" :max="draft.dateTo || undefined" :class="inputClass" @change="applyFilters">
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-200">Recorded to (UTC)
          <input v-model="draft.dateTo" aria-label="Recorded to (UTC)" type="date" :min="draft.dateFrom || undefined" :class="inputClass" @change="applyFilters">
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-200">Sort runs
          <select v-model="draft.sortDir" aria-label="Sort runs" :class="inputClass" @change="applyFilters">
            <option value="desc">Newest recorded test first</option>
            <option value="asc">Oldest recorded test first</option>
          </select>
        </label>
      </div>
      <div class="mt-4 flex flex-wrap gap-3">
        <p class="self-center text-sm text-gray-500 dark:text-gray-400">Filters update automatically.</p>
        <button type="button" :class="buttonClass" @click="clearFilters">Clear filters</button>
      </div>
      <p v-if="invalidDateRange" role="alert" class="mt-3 text-sm text-amber-700 dark:text-amber-300">Recorded from must be on or before Recorded to.</p>
    </form>

    <div v-if="error" role="alert" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
      <p class="text-sm text-gray-800 dark:text-gray-200">{{ error }}</p>
      <p v-if="hasLoaded" class="mt-1 text-sm text-gray-600 dark:text-gray-300">The previous results are still shown.</p>
      <button type="button" :disabled="loading || searchPending" class="mt-2 text-sm font-semibold text-primary-700 dark:text-primary-300" @click="requestRuns(lastAttempt)">Retry</button>
    </div>
    <p v-if="loading" role="status" class="mb-4 text-sm text-gray-500 dark:text-gray-400">{{ hasLoaded ? 'Updating recent runs…' : 'Loading recent runs…' }}</p>

    <div v-if="hasLoaded" :aria-busy="loading" class="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
      <p class="border-b border-gray-100 px-5 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">{{ criteria }}</p>
      <div class="relative overflow-x-auto">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">Recent Workflow Validation runs</caption>
          <thead class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" class="px-5 py-3">Test suite</th>
              <th scope="col" class="px-5 py-3">Version</th>
              <th scope="col" class="px-5 py-3">Recorded test time (UTC)</th>
              <th scope="col" class="px-5 py-3"><span class="sr-only">Run details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in runs" :key="JSON.stringify([run.suite, run.invocationId])" class="border-b border-gray-50 dark:border-gray-700">
              <td class="px-5 py-4">
                <div class="font-medium text-gray-900 dark:text-gray-100">{{ run.suite ? formatSuiteName(run.suite) : 'Test suite unavailable' }}</div>
                <div class="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{{ run.invocationId }}</div>
              </td>
              <td class="px-5 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{{ run.rhoaiVersion || 'Version unavailable' }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">
                <time v-if="validTime(run.timestamp)" :datetime="run.timestamp">{{ recordedTime(run.timestamp) }}</time>
                <span v-else>Unavailable</span>
              </td>
              <td class="px-5 py-4 text-right">
                <a v-if="run.suite && run.invocationId" :href="runLink(run)" :aria-label="`View run ${run.invocationId}`" class="whitespace-nowrap font-medium text-primary-700 underline hover:text-primary-900 dark:text-primary-300">View run</a>
                <span v-else class="text-xs text-gray-500 dark:text-gray-400">Run details unavailable</span>
              </td>
            </tr>
            <tr v-if="!runs.length">
              <td colspan="4" class="px-5 py-12 text-center text-gray-500 dark:text-gray-400">{{ page.total ? 'This page has changed. Use Previous to return to the first page.' : hasFilters ? 'No runs match these filters.' : 'No runs are available.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav aria-label="Recent run pages" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p aria-live="polite" class="text-sm text-gray-600 dark:text-gray-300">Showing {{ page.start }}–{{ page.end }} of {{ page.total }} runs</p>
        <div class="flex gap-3">
          <button type="button" aria-label="Previous page" :disabled="loading || searchPending || page.previousCursor === null" :class="buttonClass" @click="loadPage(page.previousCursor)">Previous</button>
          <button type="button" aria-label="Next page" :disabled="loading || searchPending || page.nextCursor === null" :class="buttonClass" @click="loadPage(page.nextCursor)">Next</button>
        </div>
      </nav>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { formatSuiteName, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav', null)
const { getRecentRuns } = useWorkflowValidation()
const fields = { version: 'recentVersion', suite: 'recentSuite', runQuery: 'recentRun', dateFrom: 'recentFrom', dateTo: 'recentTo', sortDir: 'recentSort', cursor: 'recentCursor' }
const defaults = () => ({ version: '', suite: '', runQuery: '', dateFrom: '', dateTo: '', sortDir: 'desc', cursor: '' })
function fromUrl() {
  const query = defaults()
  for (const [key, name] of Object.entries(fields)) {
    const value = nav?.params?.value?.[name]
    if (typeof value === 'string') query[key] = value
  }
  query.sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'
  return query
}
const applied = ref(fromUrl())
const draft = reactive({ ...applied.value })
const invalidDateRange = computed(() => draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo)
const searchPending = ref(false)
const runs = ref([])
const page = ref({ total: 0, start: 0, end: 0, nextCursor: null, previousCursor: null })
const options = ref({ versions: [], suites: [] })
const loading = ref(false)
const hasLoaded = ref(false)
const error = ref('')
const lastAttempt = ref({ ...applied.value })
const hasFilters = computed(() => ['version', 'suite', 'runQuery', 'dateFrom', 'dateTo'].some(key => applied.value[key]))
const criteria = computed(() => [
  applied.value.version || 'All versions', applied.value.suite ? formatSuiteName(applied.value.suite) : 'All suites',
  applied.value.runQuery ? `Run ID contains “${applied.value.runQuery}”` : 'All run IDs',
  applied.value.dateFrom || applied.value.dateTo ? `${applied.value.dateFrom || 'Any start'} to ${applied.value.dateTo || 'Any end'} (UTC)` : 'All dates',
  applied.value.sortDir === 'asc' ? 'Oldest recorded test first' : 'Newest recorded test first'
].join(' · '))
const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900'
const buttonClass = 'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
const formatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' })
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const recordedTime = value => formatter.format(new Date(value))
let active = true
let sequence = 0
let controller
let searchTimer

function cancelSearch() { clearTimeout(searchTimer); searchPending.value = false }

function runLink(run) {
  const params = new URLSearchParams({ exactRun: '1', version: run.rhoaiVersion || '', testSuite: run.suite, invocationId: run.invocationId, datePreset: 'all', dateFrom: '', dateTo: '' })
  return `#/workflow-validation/overview?${params}`
}

async function requestRuns(query) {
  cancelSearch()
  const current = ++sequence
  controller?.abort()
  controller = new AbortController()
  const requested = { ...query }
  lastAttempt.value = requested
  loading.value = true
  error.value = ''
  try {
    const data = await getRecentRuns(requested, { signal: controller.signal })
    if (!active || current !== sequence) return
    if (!Array.isArray(data.rows) || data.rows.length > 20 || !Number.isInteger(data.total)
      || !Number.isInteger(data.start) || !Number.isInteger(data.end)
      || !Array.isArray(data.options?.versions) || !Array.isArray(data.options?.suites)
      || !(data.nextCursor === null || typeof data.nextCursor === 'string')
      || !(data.previousCursor === null || typeof data.previousCursor === 'string')) throw new Error('The run service returned an invalid page. Please retry.')
    runs.value = data.rows
    page.value = { total: data.total, start: data.start, end: data.end, nextCursor: data.nextCursor, previousCursor: data.previousCursor }
    options.value = data.options
    applied.value = requested
    hasLoaded.value = true
    syncQueryParams(nav, Object.fromEntries(Object.entries(fields).map(([key, name]) => [name, requested[key]])))
  } catch (err) {
    if (!active || current !== sequence) return
    error.value = err.message || 'Failed to load recent runs.'
  } finally {
    if (active && current === sequence) loading.value = false
  }
}
function applyFilters() {
  cancelSearch()
  if (!invalidDateRange.value) requestRuns({ ...draft, cursor: '' })
}
function scheduleSearch() {
  cancelSearch()
  searchPending.value = true
  searchTimer = setTimeout(applyFilters, 300)
}
function clearFilters() { Object.assign(draft, defaults()); applyFilters() }
function loadPage(cursor) { requestRuns({ ...applied.value, cursor: cursor || '' }) }
watch(() => nav?.params?.value, () => {
  const query = fromUrl()
  if (JSON.stringify(query) === JSON.stringify(applied.value)) return
  Object.assign(draft, query)
  requestRuns(query)
}, { deep: true })
onMounted(() => requestRuns(applied.value))
onBeforeUnmount(() => { active = false; sequence += 1; cancelSearch(); controller?.abort() })
</script>
