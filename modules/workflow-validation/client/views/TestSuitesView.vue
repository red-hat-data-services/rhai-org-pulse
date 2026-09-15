<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Test Suites</h2>
      <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Results from groups of tests executed together against RHOAI.</p>
    </div>

    <div class="mb-6 rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Filters</span>
        <select v-model="selectedSuite" aria-label="Test suite" :class="inputClass" @change="load">
          <option v-for="suite in suites" :key="suite.value" :value="suite.value">{{ formatSuiteName(suite.value) }}</option>
        </select>
        <select v-model="datePreset" aria-label="Date range" :class="inputClass" @change="applyDatePreset">
          <option value="latest">Latest</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
          <option value="custom">Custom dates</option>
        </select>
        <template v-if="datePreset === 'custom'">
          <input v-model="dateFrom" type="date" aria-label="Start date" :max="dateTo || undefined" :class="inputClass" @change="load" />
          <span class="text-xs text-gray-400">to</span>
          <input v-model="dateTo" type="date" aria-label="End date" :min="dateFrom || undefined" :class="inputClass" @change="load" />
        </template>
      </div>
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{{ error }}</div>
    <div v-else class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
            <th class="px-5 py-3 font-semibold"><button @click="setSort('suite')">Test suite {{ sortMark('suite') }}</button></th>
            <th class="px-4 py-3 font-semibold"><button @click="setSort('timestamp')">Executed {{ sortMark('timestamp') }}</button></th>
            <th class="px-4 py-3 text-right font-semibold"><button @click="setSort('tests')">Tests {{ sortMark('tests') }}</button></th>
            <th class="px-4 py-3 font-semibold"><button @click="setSort('passRate')">Pass rate {{ sortMark('passRate') }}</button></th>
            <th class="px-4 py-3 font-semibold"><button @click="setSort('rhoaiVersion')">RHOAI version {{ sortMark('rhoaiVersion') }}</button></th>
            <th class="px-4 py-3 font-semibold">RHODS Build ID</th>
            <th class="min-w-72 px-4 py-3 font-semibold">Product bugs</th>
          </tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="7" class="px-5 py-10 text-center text-gray-400">Loading test suites…</td></tr>
            <tr v-for="row in sortedRows" v-else :key="`${row.suite}:${row.invocationId}`" tabindex="0" class="cursor-pointer border-b border-gray-50 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-gray-700/30" @click="openSuite(row)" @keydown.enter="openSuite(row)">
              <td class="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{{ formatSuiteName(row.suite) }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{{ formatDate(row.timestamp) }}</td>
              <td class="px-4 py-3 text-right font-mono">{{ row.tests }}</td>
              <td class="px-4 py-3"><span class="font-mono">{{ formatPercent(row.passRate) }}</span><span class="ml-2 text-xs text-gray-500">{{ outcomeSummary(row) }}</span></td>
              <td class="px-4 py-3 font-mono text-xs">{{ row.rhoaiVersion || '—' }}</td>
              <td class="px-4 py-3 font-mono text-xs" :title="row.rhodsOperatorDigest || undefined">{{ formatBuildId(row.rhodsOperatorDigest) }}</td>
              <td class="px-4 py-3"><ProductBugStatus :findings="row.productBugs" neutral-message="No product bugs observed in this suite execution." neutral-tooltip="No product bug was recorded for this test suite execution." /></td>
            </tr>
            <tr v-if="!loading && !rows.length"><td colspan="7" class="px-5 py-10 text-center text-gray-400">No test suite executions match these filters</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import ProductBugStatus from '../components/ProductBugStatus.vue'
import { compareTableValues, defaultDateRange, formatBuildId, formatDate, formatPercent, formatSuiteName, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const initialParams = nav?.params?.value || {}
const { getFilters, getTestSuites } = useWorkflowValidation()
const inputClass = 'text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40'
const suites = ref([])
const selectedSuite = ref(initialParams.suite || '')
const datePreset = ref(initialParams.datePreset || 'latest')
const dateFrom = ref(initialParams.dateFrom || '')
const dateTo = ref(initialParams.dateTo || '')
const rows = ref([])
const loading = ref(false)
const error = ref('')
const sortBy = ref('timestamp')
const sortDir = ref('desc')
const sortedRows = computed(() => [...rows.value].sort((a, b) => compareTableValues(a[sortBy.value], b[sortBy.value], sortDir.value)))

function outcomeSummary(row) {
  const parts = [`${row.passed} passed`, `${row.failed} failed`]
  if (row.errors) parts.push(`${row.errors} ${row.errors === 1 ? 'error' : 'errors'}`)
  return parts.join(' · ')
}
function setSort(column) {
  sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'
  sortBy.value = column
}
function sortMark(column) { return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : '' }
function openSuite(row) { nav.navigateTo('test-suite-detail', { suite: row.suite, invocationId: row.invocationId }) }
function applyDatePreset() {
  if (datePreset.value === 'latest' || datePreset.value === 'all') {
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
  if (!selectedSuite.value) return
  syncQueryParams(nav, {
    suite: selectedSuite.value,
    datePreset: datePreset.value,
    dateFrom: dateFrom.value,
    dateTo: dateTo.value
  })
  loading.value = true
  error.value = ''
  try {
    const data = await getTestSuites({ suite: selectedSuite.value, latest: datePreset.value === 'latest', dateFrom: dateFrom.value, dateTo: dateTo.value })
    rows.value = data.rows || []
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load test suites'
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  try {
    const options = await getFilters()
    suites.value = options.testSuites || []
    selectedSuite.value = selectedSuite.value || suites.value[0]?.value || ''
    await load()
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load test suite filters'
  }
})
</script>
