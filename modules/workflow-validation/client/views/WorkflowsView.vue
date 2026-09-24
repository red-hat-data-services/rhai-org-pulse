<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Trends</h2>
      <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Track a test run's health, product bugs, and release-to-release progress.</p>
    </div>
    <div class="mb-6 rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
      <div class="flex flex-wrap items-center gap-3">
        <label class="flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400"
          >Test Suite<select v-model="selectedRun" aria-label="Test Suite" :class="inputClass" @change="load">
            <option v-for="run in runOptions" :key="run.value" :value="run.value">
              {{ formatSuiteName(run.value) }}
            </option>
          </select></label
        >
        <label class="flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400"
          >RHOAI Version<select v-model="selectedVersion" aria-label="RHOAI Version" :class="inputClass" @change="load">
            <option value="">All versions</option>
            <option v-for="version in versionOptions" :key="version.value" :value="version.value">
              {{ version.value }}
            </option>
          </select></label
        >
        <label class="flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400"
          >Date Range<select v-model="datePreset" aria-label="Date Range" :class="inputClass" @change="applyDatePreset">
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom dates</option>
          </select></label
        >
        <template v-if="datePreset === 'custom'"
          ><label class="flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Start Date<input v-model="dateFrom" type="date" aria-label="Start Date" :max="dateTo || undefined" :class="inputClass" @change="load" /></label><span class="self-end pb-2 text-xs text-gray-400">to</span><label class="flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">End Date<input v-model="dateTo" type="date" aria-label="End Date" :min="dateFrom || undefined" :class="inputClass" @change="load" /></label
        ></template>
      </div>
    </div>
    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      {{ error }}
    </div>
    <template v-else>
      <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div class="xl:col-span-2">
          <TestRunOutcomeChart :runs="chronologicalRuns" @select="openRun" />
        </div>
        <TestRunBugChart :runs="chronologicalRuns" @select="openRun" /><TestRunBugVersionChart :runs="chronologicalRuns" />
      </div>
      <div v-if="versionRows.length > 1" class="mb-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <div class="border-b border-gray-100 px-6 py-4 dark:border-gray-700/60">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">Results by RHOAI Version</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Rollup of the selected test run for each release in the active date range.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                <th class="px-5 py-3 font-semibold">Version</th>
                <th class="px-4 py-3 text-right font-semibold">Runs</th>
                <th class="px-4 py-3 text-right font-semibold">Tests</th>
                <th class="px-4 py-3 font-semibold">Pass rate</th>
                <th class="px-4 py-3 text-right font-semibold">Bugs opened</th>
                <th class="px-4 py-3 text-right font-semibold">Known bugs</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in versionRows" :key="row.version" class="border-b border-gray-50 dark:border-gray-700/40">
                <td class="px-5 py-3 font-mono text-xs">{{ row.version }}</td>
                <td class="px-4 py-3 text-right font-mono">{{ row.runs }}</td>
                <td class="px-4 py-3 text-right font-mono">{{ row.tests }}</td>
                <td class="px-4 py-3 font-mono">
                  {{ formatPercent(row.passRate) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                  {{ row.newBugs }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
                  {{ row.knownBugs }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <div class="border-b border-gray-100 px-6 py-4 dark:border-gray-700/60">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100">Run History</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Select a row to inspect every test and product bug from that exact run.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
                <th class="px-5 py-3 font-semibold">
                  <button @click="setSort('timestamp')">Executed {{ sortMark('timestamp') }}</button>
                </th>
                <th class="px-4 py-3 font-semibold">
                  <button @click="setSort('rhoaiVersion')">Version {{ sortMark('rhoaiVersion') }}</button>
                </th>
                <th class="px-4 py-3 font-semibold">RHODS Build</th>
                <th class="px-4 py-3 text-right font-semibold">
                  <button @click="setSort('tests')">Tests passed / failed / skipped {{ sortMark('tests') }}</button>
                </th>
                <th class="px-4 py-3 font-semibold">
                  <button @click="setSort('passRate')">Pass rate {{ sortMark('passRate') }}</button>
                </th>
                <th class="px-4 py-3 text-right font-semibold">Bugs opened</th>
                <th class="px-4 py-3 text-right font-semibold">Known bugs</th>
                <th class="px-4 py-3 text-right font-semibold">
                  <button @click="setSort('duration')">Total test time {{ sortMark('duration') }}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="8" class="px-5 py-10 text-center text-gray-400">Loading test trends…</td>
              </tr>
              <tr v-for="run in sortedRuns" v-else :key="run.invocationId" tabindex="0" class="cursor-pointer border-b border-gray-50 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-gray-700/30" @click="openRun(run)" @keydown.enter="openRun(run)">
                <td class="whitespace-nowrap px-5 py-3 text-xs text-gray-500 dark:text-gray-400">
                  {{ formatDate(run.timestamp) }}
                </td>
                <td class="px-4 py-3 font-mono text-xs">
                  {{ run.rhoaiVersion || '—' }}
                </td>
                <td class="px-4 py-3 font-mono text-xs" :title="run.rhodsOperatorDigest || undefined">
                  {{ formatBuildId(run.rhodsOperatorDigest) }}
                </td>
                <td class="px-4 py-3 text-right font-mono">
                  <span class="text-green-600 dark:text-green-400">{{ runOutcomeCounts(run).pass }}</span>
                  /
                  <span class="text-red-600 dark:text-red-400">{{ runOutcomeCounts(run).fail }}</span>
                  /
                  <span class="text-orange-600 dark:text-orange-400">{{ runOutcomeCounts(run).skip }}</span>
                </td>
                <td class="px-4 py-3 font-mono">
                  {{ formatPercent(run.passRate) }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-red-600 dark:text-red-400">
                  {{ bugCounts(run).new }}
                </td>
                <td class="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400">
                  {{ bugCounts(run).known }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
                  {{ formatDuration(run.duration) }}
                </td>
              </tr>
              <tr v-if="!loading && !sortedRuns.length">
                <td colspan="8" class="px-5 py-10 text-center text-gray-400">No runs match these filters</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import TestRunBugChart from '../components/TestRunBugChart.vue'
import TestRunBugVersionChart from '../components/TestRunBugVersionChart.vue'
import TestRunOutcomeChart from '../components/TestRunOutcomeChart.vue'
import { isVisibleProductBug } from '../utils/product-bugs'
import { compareTableValues, defaultDateRange, formatBuildId, formatDate, formatDuration, formatPercent, formatSuiteName, runOutcomeCounts, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'
const nav = inject('moduleNav')
const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
const { getFilters, getTestSuites } = useWorkflowValidation()
const inputClass = 'text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40'
const runOptions = ref([])
const versionOptions = ref([])
const selectedRun = ref(urlParams.get('testRun') || urlParams.get('suite') || '')
const selectedVersion = ref(urlParams.get('version') || '')
const datePreset = ref(urlParams.get('datePreset') || '90')
const dateFrom = ref(urlParams.get('dateFrom') || '')
const dateTo = ref(urlParams.get('dateTo') || '')
const runs = ref([])
const loading = ref(false)
const error = ref('')
const sortBy = ref('timestamp')
const sortDir = ref('desc')
function bugCounts(run) {
  const bugs = (run.productBugs || []).filter(isVisibleProductBug)
  return {
    new: bugs.filter((bug) => bug.opened === true).length,
    known: bugs.filter((bug) => bug.opened !== true).length,
  }
}
const chronologicalRuns = computed(() => [...runs.value].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || ''))))
const sortedRuns = computed(() => [...runs.value].sort((a, b) => compareTableValues(a[sortBy.value], b[sortBy.value], sortDir.value)))
const versionRows = computed(() => {
  const grouped = new Map()
  for (const run of runs.value) {
    const version = run.rhoaiVersion || 'Unknown'
    const row = grouped.get(version) || {
      version,
      runs: 0,
      tests: 0,
      passed: 0,
      newBugs: 0,
      knownBugs: 0,
    }
    const bugs = bugCounts(run)
    row.runs += 1
    row.tests += run.tests
    row.passed += run.passed
    row.newBugs += bugs.new
    row.knownBugs += bugs.known
    grouped.set(version, row)
  }
  return [...grouped.values()]
    .map((row) => ({
      ...row,
      passRate: row.tests ? row.passed / row.tests : null,
    }))
    .sort((a, b) => compareTableValues(a.version, b.version, 'desc'))
})
function openRun(run) {
  nav.navigateTo('overview', {
    version: run.rhoaiVersion || '',
    testSuite: run.suite,
    invocationId: run.invocationId,
    datePreset: '90',
    dateFrom: '',
    dateTo: '',
  })
}
function setSort(column) {
  sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'
  sortBy.value = column
}
function sortMark(column) {
  return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : ''
}
function applyDatePreset() {
  if (datePreset.value === 'all') {
    dateFrom.value = ''
    dateTo.value = ''
  } else if (datePreset.value !== 'custom') {
    const range = defaultDateRange(Number(datePreset.value))
    dateFrom.value = range.dateFrom
    dateTo.value = range.dateTo
  }
  load()
}
async function load() {
  if (!selectedRun.value) return
  loading.value = true
  error.value = ''
  syncQueryParams(nav, {
    testRun: selectedRun.value,
    version: selectedVersion.value,
    datePreset: datePreset.value,
    dateFrom: dateFrom.value,
    dateTo: dateTo.value,
  })
  try {
    const data = await getTestSuites({
      suite: selectedRun.value,
      version: selectedVersion.value,
      dateFrom: dateFrom.value,
      dateTo: dateTo.value,
    })
    runs.value = data.rows || []
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load test trends'
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  try {
    const options = await getFilters()
    runOptions.value = options.testSuites || []
    versionOptions.value = options.versions || []
    if (!dateFrom.value && !dateTo.value && !['all', 'custom'].includes(datePreset.value)) {
      const range = defaultDateRange(Number(datePreset.value))
      dateFrom.value = range.dateFrom
      dateTo.value = range.dateTo
    }
    if (!selectedRun.value) {
      const latest = await getTestSuites({
        version: selectedVersion.value,
        dateFrom: dateFrom.value,
        dateTo: dateTo.value,
      })
      selectedRun.value = latest.rows?.[0]?.suite || runOptions.value[0]?.value || ''
    }
    await load()
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load trend filters'
  }
})
</script>
