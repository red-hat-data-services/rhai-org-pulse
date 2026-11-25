<template>
  <div class="min-w-0">
    <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Recent Runs</h2>
        <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Select a run for its results. Use <strong class="font-medium">Jira issues</strong> to open its linked bugs and RFEs. All dates are UTC.
          A <strong class="font-medium">suite run</strong> executed a defined test suite and shows how many of its expected workflows ran; any other run is <strong class="font-medium">ad hoc</strong>.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" :disabled="loading || searchPending" :class="buttonClass" @click="requestRuns(applied, true)">Refresh</button>
      </div>
    </div>
    <form aria-label="Run filters" class="mb-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" @submit.prevent="applyFilters">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RecentVersionSelect v-model="draft.versions" :options="options.versions" @update:model-value="applyFilters" />
        <RecentFilterSelect v-model="draft.suites" :options="options.suites" label="Test suites" all-label="All suites"
          :format-label="formatSuiteName" @update:model-value="applyFilters" />
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
        <button ref="clearFiltersButton" type="button" :class="buttonClass" @click="clearFilters">Clear filters</button>
        <button type="button" :aria-pressed="draft.bugsOnly" :disabled="loading || searchPending"
          :class="[buttonClass, draft.bugsOnly ? 'bg-primary-50 ring-1 ring-primary-400 dark:bg-primary-900/30' : '']"
          @click="draft.bugsOnly = !draft.bugsOnly; applyFilters()">Contains bugs only</button>
        <button type="button" :aria-pressed="draft.suiteRunsOnly" :disabled="loading || searchPending"
          :class="[buttonClass, draft.suiteRunsOnly ? 'bg-primary-50 ring-1 ring-primary-400 dark:bg-primary-900/30' : '']"
          @click="draft.suiteRunsOnly = !draft.suiteRunsOnly; applyFilters()">Suite runs only</button>
      </div>
      <p v-if="invalidDateRange" role="alert" class="mt-3 text-sm text-amber-700 dark:text-amber-300">Start Date must be on or before End Date.</p>
      <ul v-if="appliedChips.length" ref="chipList" aria-label="Applied filters" class="mb-0 mt-3 flex list-none flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <li v-for="(chip, index) in appliedChips" :key="chip.key" class="min-w-0 max-w-full">
          <button type="button" :aria-label="chip.removeLabel" @click="removeFilter(chip, index, $event.currentTarget)"
            class="flex min-h-8 w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus-visible:outline-primary-300">
            <span class="min-w-0 [overflow-wrap:anywhere]">{{ chip.label }}</span>
            <X :size="13" class="shrink-0" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </form>
    <div v-if="error || restoreError" role="alert" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
      <p class="text-sm text-gray-800 dark:text-gray-200">{{ restoreError || error }}</p>
      <p v-if="hasLoaded" class="mt-1 text-sm text-gray-600 dark:text-gray-300">The previous results are still shown.</p>
      <button v-if="!restoreError" type="button" :disabled="loading || searchPending" class="mt-2 text-sm font-semibold text-primary-700 dark:text-primary-300" @click="retryRuns">{{ restartRequired ? 'Return to first page' : 'Retry' }}</button>
    </div>
    <p v-if="loading || searchPending" role="status" class="mb-4 text-sm text-gray-500 dark:text-gray-400">{{ hasLoaded ? 'Updating recent runs…' : 'Loading recent runs…' }}</p>
    <p v-if="bugFilterIncomplete" role="status" class="mb-4 text-sm text-amber-700 dark:text-amber-300">Some bug counts are unavailable. This filter shows only verified matches.</p>
    <VersionSummaryPanel v-if="hasLoaded" class="mb-5" :summary="summary" :aria-busy="loading || searchPending"
      :show-bug-search="!loading && !searchPending && !error && !restoreError && !invalidDateRange" />
    <div v-if="hasLoaded" :aria-busy="loading" class="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div ref="tableScroll" role="region" aria-label="Recent runs table" tabindex="0" @focusin="revealFocusedRow($event.target)"
        class="table-scroll relative overflow-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500">
        <table class="compact-summary w-full min-w-[66rem] table-fixed text-left text-sm">
          <caption class="sr-only">Recent Workflow Validation runs. Select a run to open its details.</caption>
          <colgroup>
            <col v-for="(width, index) in columnWidths" :key="index" :style="{ width: `${width}%` }">
          </colgroup>
          <thead class="sticky top-0 z-10 bg-white text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th v-for="column in columns" :key="column.field" scope="col" :aria-label="column.label" :aria-sort="applied.sortField === column.field ? (applied.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'" class="p-0">
                <button type="button" :aria-label="column.sortLabel"
                  class="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500 dark:hover:bg-gray-700/30"
                  @click="setSort(column)">
                  <span>{{ column.label }}</span>
                  <span aria-hidden="true" class="shrink-0 text-sm">{{ applied.sortField === column.field ? (applied.sortDir === 'asc' ? '↑' : '↓') : '↕' }}</span>
                </button>
              </th>
              <th scope="col" aria-label="Issues found" class="px-5 py-3">Issues found</th>
              <th v-for="column in countColumns" :key="column.key" scope="col" :aria-label="column.label" class="px-4 py-3 text-right">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in runs" :key="JSON.stringify([run.suite, run.invocationId])" :tabindex="canOpen(run) ? 0 : undefined" :aria-label="canOpen(run) ? `Open run ${run.invocationId}` : undefined"
              class="border-b border-gray-50 dark:border-gray-700" :class="canOpen(run) ? 'cursor-pointer hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-500 dark:hover:bg-gray-700/30' : ''"
              @click="openRun(run, $event)" @keydown.enter.prevent="openRun(run, $event)">
              <td class="px-5 py-4">
                <div class="font-medium text-gray-900 dark:text-gray-100">{{ run.suite ? formatSuiteName(run.suite) : 'Test suite unavailable' }}
                  <span v-if="run.suiteRun === true" data-testid="run-kind" title="This run executed a defined test suite. Its expected workflows were recorded when it started."
                    class="ml-1 inline-block whitespace-nowrap rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">Suite run</span>
                  <span v-else-if="run.suiteRun === false" data-testid="run-kind" title="This run was not started as a test suite, so it has no expected set of workflows."
                    class="ml-1 inline-block whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">Ad hoc</span>
                </div>
                <div class="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{{ run.invocationId }}</div>
              </td>
              <td class="break-words px-5 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{{ run.rhoaiVersion ? versionLabel(run.rhoaiVersion) : 'Version unavailable' }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">
                <time v-if="run.buildDateStatus === 'verified' && validTime(run.buildDate)" :datetime="run.buildDate">
                  <span class="inline-block whitespace-nowrap">{{ recordedTime(run.buildDate).split(', ')[0] }},</span>{{ ' ' }}<span class="inline-block whitespace-nowrap">{{ recordedTime(run.buildDate).split(', ')[1] }}</span>
                </time>
                <span v-else title="No verified RHOAI operator image build time is recorded for this run.">unavailable</span>
              </td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">
                <time v-if="validTime(run.timestamp)" :datetime="run.timestamp">
                  <span class="inline-block whitespace-nowrap">{{ recordedTime(run.timestamp).split(', ')[0] }},</span>{{ ' ' }}<span class="inline-block whitespace-nowrap">{{ recordedTime(run.timestamp).split(', ')[1] }}</span>
                </time>
                <span v-else>Unavailable</span>
              </td>
              <td class="px-5 py-4">
                <a v-if="run.bugTickets?.status === 'ready' && safeExternalUrl(run.bugTickets.url)"
                  :href="safeExternalUrl(run.bugTickets.url)" target="_blank" rel="noopener noreferrer"
                  :aria-label="`Open Jira issues for run ${run.invocationId} (opens in a new tab)`"
                  class="whitespace-nowrap font-medium text-primary-700 underline hover:text-primary-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 dark:text-primary-300"
                  @click.stop @keydown.enter.stop>Jira issues <span aria-hidden="true">↗</span></a>
                <span v-else-if="run.bugTickets?.status === 'empty'" class="text-xs text-gray-500 dark:text-gray-400" title="No eligible Jira issues are recorded for this run.">No issues recorded</span>
                <span v-else class="text-xs text-gray-500 dark:text-gray-400" title="Issue associations or Jira labels could not be verified. Use Refresh to retry.">Issues unavailable</span>
              </td>
              <td v-for="column in countColumns" :key="column.key" class="px-4 py-4 text-right tabular-nums" :title="countTitle(run, column)"
                :class="run[column.key] > 0 && column.tone ? column.tone : 'text-gray-600 dark:text-gray-300'">{{ countText(run, column) }}</td>
            </tr>
            <tr v-if="!runs.length"><td colspan="11" class="px-5 py-12 text-center text-gray-500 dark:text-gray-400">{{ page.total ? 'This page has changed. Use Previous to return to the first page.' : hasFilters ? 'No runs match these filters.' : 'No runs are available.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <nav aria-label="Recent run pages" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p aria-live="polite" class="text-sm text-gray-600 dark:text-gray-300">Showing {{ page.start }}–{{ page.end }} of {{ page.total }} runs</p>
        <div class="flex gap-3"><button type="button" aria-label="Previous page" :disabled="loading || searchPending || page.previousCursor === null" :class="buttonClass" @click="loadPage(page.previousCursor)">Previous</button><button type="button" aria-label="Next page" :disabled="loading || searchPending || page.nextCursor === null" :class="buttonClass" @click="loadPage(page.nextCursor)">Next</button></div>
      </nav>
      <p class="border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">— means a count is unavailable. For a suite run, Workflows shows expected workflows that ran / expected workflows.</p>
    </div>
  </div>
</template>
<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { RECENT_RUNS_PAGE_SIZE, formatSuiteName, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'
import RecentVersionSelect from '../components/RecentVersionSelect.vue'
import RecentFilterSelect from '../components/RecentFilterSelect.vue'
import VersionSummaryPanel from '../components/VersionSummaryPanel.vue'
import * as versionRules from '../../lib/versions.js'
import { safeExternalUrl } from '../utils/external-url'
const { normalizeVersions, versionLabel } = versionRules
const nav = inject('moduleNav', null)
const { getRecentRuns } = useWorkflowValidation()
const columns = [
  { field: 'suite', label: 'Test suite', sortLabel: 'Sort test suite', firstDirection: 'asc' },
  { field: 'version', label: 'Version', sortLabel: 'Sort version', firstDirection: 'desc' },
  { field: 'buildDate', label: 'RHOAI build (UTC)', sortLabel: 'Sort RHOAI build time', firstDirection: 'desc' },
  { field: 'timestamp', label: 'Executed at (UTC)', sortLabel: 'Sort execution time', firstDirection: 'desc' }
]
const countColumns = [
  { key: 'workflows', label: 'Workflows' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'passed', label: 'Passed', tone: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'failed', label: 'Failed', tone: 'text-red-600 dark:text-red-400' },
  { key: 'skipped', label: 'Skipped', tone: 'text-amber-600 dark:text-amber-400' },
  { key: 'bugs', label: 'Bugs' }
]
const columnWidths = [20, 8, 13, 13, 11, 8, 5, 6, 5, 6, 5]
const fields = { runQuery: 'recentRun', datePreset: 'recentDatePreset', dateFrom: 'recentFrom', dateTo: 'recentTo', sortField: 'recentSortField', sortDir: 'recentSort', cursor: 'recentCursor', bugsOnly: 'recentBugsOnly', suiteRunsOnly: 'recentSuiteRunsOnly' }
const legacyFilters = ['recentVersion', 'recentVersions', ...Object.values(fields)]
const unfiltered = () => ({ versions: [], suites: [], runQuery: '', datePreset: 'all', dateFrom: '', dateTo: '', sortField: 'timestamp', sortDir: 'desc', cursor: '', bugsOnly: false, suiteRunsOnly: false })
const defaultSuites = ['aramco', 'release_gate']
const restoreError = ref('')
/** Return inclusive UTC calendar bounds for a date preset. */
function utcRange(days, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return { dateFrom: new Date(end.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) }
}
/** Restore page-owned filters while keeping legacy cursor spellings intact. */
function fromUrl() {
  const query = unfiltered(), params = nav?.params?.value || {}
  restoreError.value = ''
  for (const [key, name] of Object.entries(fields)) if (typeof params[name] === 'string') query[key] = params[name]
  query.bugsOnly = params.recentBugsOnly === 'true'
  query.suiteRunsOnly = params.recentSuiteRunsOnly === 'true'
  if (params.recentVersions) {
    try {
      query.versions = JSON.parse(params.recentVersions)
      if (!Array.isArray(query.versions) || query.versions.length > 50 || query.versions.some(value => typeof value !== 'string' || !value || value.length > 256)) throw new Error()
    } catch { query.versions = []; restoreError.value = 'The saved version selection is invalid. Choose versions again or clear filters.' }
  } else if (typeof params.recentVersion === 'string' && params.recentVersion) query.versions = [params.recentVersion]
  if (params.recentSuites !== undefined) {
    try {
      const suites = JSON.parse(params.recentSuites)
      if (!Array.isArray(suites) || suites.length > 50 || suites.some(value => typeof value !== 'string' || !value.trim() || value.length > 256)) throw new Error()
      query.suites = [...new Set(suites.map(value => value.trim()))].sort()
    } catch { restoreError.value = 'The saved test suite selection is invalid. Choose suites again or clear filters.' }
  } else if (typeof params.recentSuite === 'string') query.suites = params.recentSuite.trim() ? [params.recentSuite.trim()] : []
  else if (!legacyFilters.some(key => Object.hasOwn(params, key))) query.suites = [...defaultSuites]
  query.sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'
  query.sortField = columns.some(column => column.field === query.sortField) ? query.sortField : 'timestamp'
  if (!['all', '7', '30', '90', 'custom'].includes(query.datePreset)) query.datePreset = 'all'
  if (!params.recentDatePreset && (query.dateFrom || query.dateTo)) query.datePreset = 'custom'
  if (query.datePreset === 'all') { query.dateFrom = ''; query.dateTo = '' }
  if (['7', '30', '90'].includes(query.datePreset) && !query.dateFrom && !query.dateTo) Object.assign(query, utcRange(Number(query.datePreset)))
  return query
}
const applied = ref(fromUrl()), draft = reactive({ ...applied.value })
const invalidDateRange = computed(() => draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo)
const runs = ref([]), options = ref({ versions: [], suites: [] }), page = ref({ total: 0, start: 0, end: 0, nextCursor: null, previousCursor: null })
const loading = ref(false), searchPending = ref(false), hasLoaded = ref(false), error = ref(''), restartRequired = ref(false), lastAttempt = ref({ ...applied.value })
const appliedChips = computed(() => {
  const { versions, suites, runQuery, dateFrom, dateTo, bugsOnly, suiteRunsOnly } = applied.value
  const chips = normalizeVersions(versions).map(value => ({ key: `version:${value}`, field: 'versions', value,
    label: `Version: ${versionLabel(value)}`, removeLabel: `Remove version ${versionLabel(value)}` }))
  for (const value of suites) {
    const name = formatSuiteName(value)
    chips.push({ key: `suite:${value}`, field: 'suites', value, label: `Suite: ${name}`, removeLabel: `Remove suite ${name}` })
  }
  const runId = runQuery.trim()
  if (runId) chips.push({ key: 'run', field: 'runQuery', label: `Run ID: ${runId}`, removeLabel: 'Remove run ID filter' })
  if (dateFrom || dateTo) {
    const range = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom ? `from ${dateFrom}` : `through ${dateTo}`
    chips.push({ key: 'date', field: 'dates', label: `Date: ${range} (UTC)`, removeLabel: 'Remove date range filter' })
  }
  if (bugsOnly) chips.push({ key: 'bugs', field: 'bugsOnly', label: 'Contains bugs only', removeLabel: 'Remove contains bugs only filter' })
  if (suiteRunsOnly) chips.push({ key: 'suiteRuns', field: 'suiteRunsOnly', label: 'Suite runs only', removeLabel: 'Remove suite runs only filter' })
  return chips
})
const hasFilters = computed(() => appliedChips.value.length > 0)
const emptySummary = () => ({ suiteRuns: null, workflows: null, tasks: null, passed: null, failed: null, skipped: null, bugs: null })
const summary = ref(emptySummary()), bugFilterIncomplete = ref(false)
const tableScroll = ref(null), chipList = ref(null), clearFiltersButton = ref(null)
const inputClass = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900'
const buttonClass = 'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
const formatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' })
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const recordedTime = value => formatter.format(new Date(value))
const formatCount = value => value == null ? '—' : new Intl.NumberFormat('en-US').format(value)
const showsExpected = (run, column) => column.key === 'workflows' && run.suiteRun === true && Number.isInteger(run.workflowsExpected)
/** Show a suite run's workflows as ran / expected; every other count stays a plain number. */
const countText = (run, column) => showsExpected(run, column)
  ? `${formatCount(run.workflowsRan)} / ${formatCount(run.workflowsExpected)}` : formatCount(run[column.key])
/** Name the expected workflows that did not run, for the Workflows cell of a suite run. */
function countTitle(run, column) {
  if (!showsExpected(run, column)) return undefined
  if (!Array.isArray(run.workflowsMissing)) return 'This run did not record workflow ids, so the workflows that ran cannot be counted.'
  if (!run.workflowsMissing.length) return 'Every expected workflow ran.'
  return `Did not run: ${run.workflowsMissing.map(workflow => workflow.title || workflow.workflowId).join('; ')}`
}
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
/** Keep a focused row or Jira link clear of the sticky header. */
function revealFocusedRow(target) {
  const scroll = tableScroll.value
  if (!scroll?.contains(target) || !target.closest('tbody')) return
  const bounds = target.getBoundingClientRect()
  const headerBottom = scroll.querySelector('thead').getBoundingClientRect().bottom
  const tableBottom = scroll.getBoundingClientRect().bottom
  if (bounds.top < headerBottom) scroll.scrollTop -= headerBottom - bounds.top
  else if (bounds.bottom > tableBottom) scroll.scrollTop += bounds.bottom - tableBottom
}
/** Load a validated page, ignore stale responses, and commit matching URL and cursor state. */
async function requestRuns(query, refresh = false) {
  cancelSearch()
  const current = ++sequence
  controller?.abort()
  if (restoreError.value || (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo)) { loading.value = false; error.value = ''; return }
  controller = new AbortController()
  const requested = { ...query, versions: [...query.versions], suites: [...query.suites] }
  lastAttempt.value = requested
  loading.value = true; error.value = ''; restartRequired.value = false
  try {
    const { datePreset: _preset, bugsOnly, suiteRunsOnly, ...params } = requested
    const data = await getRecentRuns({ ...params, ...(bugsOnly ? { bugsOnly: true } : {}), ...(suiteRunsOnly ? { suiteRunsOnly: true } : {}), ...(refresh ? { refresh: true } : {}) }, { signal: controller.signal })
    if (!active || current !== sequence) return
    if (!Array.isArray(data.rows) || data.rows.length > RECENT_RUNS_PAGE_SIZE || !Number.isInteger(data.total) || !Number.isInteger(data.start) || !Number.isInteger(data.end)
      || !Array.isArray(data.options?.versions) || !Array.isArray(data.options?.suites) || !(data.nextCursor === null || typeof data.nextCursor === 'string') || !(data.previousCursor === null || typeof data.previousCursor === 'string')) throw new Error('The run service returned an invalid page. Please retry.')
    summary.value = { ...emptySummary(), ...data.summary }; bugFilterIncomplete.value = data.bugFilterIncomplete === true
    runs.value = data.rows; page.value = { total: data.total, start: data.start, end: data.end, nextCursor: data.nextCursor, previousCursor: data.previousCursor }; options.value = data.options
    const focused = document.activeElement
    if (tableScroll.value?.contains(focused) && focused.closest('tbody')) {
      nextTick(() => {
        if (!tableScroll.value?.contains(focused)) return
        // Moving a keyed row can drop focus. Restore it only if focus went back to the page.
        if (document.activeElement === document.body) focused.focus({ preventScroll: true })
        if (document.activeElement === focused) revealFocusedRow(focused)
      })
    } else if (tableScroll.value) tableScroll.value.scrollTop = 0
    // Keep the original spelling while a restored cursor still depends on its scope.
    if (!requested.cursor) requested.versions = normalizeVersions(requested.versions)
    applied.value = requested; hasLoaded.value = true
    syncQueryParams(nav, { ...Object.fromEntries(Object.entries(fields).map(([key, name]) => [name, ['bugsOnly', 'suiteRunsOnly'].includes(key) ? (requested[key] ? 'true' : '') : requested[key]])),
      recentVersions: requested.versions.length ? JSON.stringify(requested.versions) : '', recentVersion: '',
      recentSuites: JSON.stringify(requested.suites), recentSuite: '' })
  } catch (err) {
    if (active && current === sequence) {
      error.value = err.message || 'Failed to load recent runs.'
      restartRequired.value = err.data?.code === 'STALE_CURSOR'
    }
  }
  finally { if (active && current === sequence) loading.value = false }
}
/** Retry a failed request, returning changed version results to page one. */
function retryRuns() {
  requestRuns({ ...lastAttempt.value, ...(restartRequired.value ? { cursor: '' } : {}) }, true)
}
/** Apply canonical filters from page one after a user changes the selection. */
function applyFilters() {
  cancelSearch(); restoreError.value = ''
  return requestRuns({ ...draft, versions: normalizeVersions(draft.versions), cursor: '' })
}
/** Remove one filter and keep keyboard focus in the filter controls. */
async function removeFilter(chip, index, button) {
  const wasFocused = document.activeElement === button
  // Failed or invalid edits do not belong to the results these chips describe.
  if (error.value || restoreError.value || invalidDateRange.value) Object.assign(draft, applied.value)
  switch (chip.field) {
    case 'versions': draft.versions = normalizeVersions(draft.versions).filter(value => value !== chip.value); break
    case 'suites': draft.suites = draft.suites.filter(value => value !== chip.value); break
    case 'dates': Object.assign(draft, { datePreset: 'all', dateFrom: '', dateTo: '' }); break
    case 'runQuery': draft.runQuery = ''; break
    case 'bugsOnly': draft.bugsOnly = false; break
    case 'suiteRunsOnly': draft.suiteRunsOnly = false; break
  }
  await applyFilters()
  await nextTick()
  if (!wasFocused || button.isConnected || document.activeElement !== document.body) return
  const remaining = chipList.value?.querySelectorAll('button')
  const next = remaining?.[index] || remaining?.[index - 1] || clearFiltersButton.value
  next?.focus()
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
function clearFilters() { Object.assign(draft, unfiltered()); applyFilters() }
/** Load a neighboring page with the exact filter scope that produced its cursor. */
function loadPage(cursor) { requestRuns({ ...applied.value, cursor: cursor || '' }) }
watch(() => nav?.params?.value, () => { const query = fromUrl(); if (JSON.stringify(query) === JSON.stringify(applied.value)) return; Object.assign(draft, query); requestRuns(query) }, { deep: true })
onMounted(() => requestRuns(applied.value))
onBeforeUnmount(() => { active = false; sequence += 1; cancelSearch(); controller?.abort() })
</script>

<style scoped>
.table-scroll {
  max-height: min(34rem, 65vh);
}
.compact-summary :is(td, th:not(.p-0)) {
  padding-inline: 0.625rem;
}
.compact-summary th button {
  padding-inline: 0.625rem;
  gap: 0.375rem;
}
.compact-summary thead {
  text-transform: none;
  letter-spacing: normal;
}
.compact-summary :is(th, td):nth-child(3),
.compact-summary :is(th, td):nth-child(4) {
  white-space: normal;
}
.compact-summary :is(th, td):nth-child(n + 6) {
  padding-inline: 0.5rem;
  text-align: center;
  white-space: nowrap;
}
</style>
