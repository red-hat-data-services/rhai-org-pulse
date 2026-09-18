<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Compare Test Runs</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Compare test results from two runs of the same test suite.</p>
    </div>

    <div v-if="error" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Unable to load comparison</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ error }}</p>
      <button class="mt-4 px-4 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50" :disabled="loading" @click="load">{{ loading ? 'Retrying…' : 'Retry' }}</button>
    </div>

    <template v-else>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Test Suite</label>
            <select v-model="selectedRun" aria-label="Test Suite" :class="inputClass" @change="loadVersions">
              <option v-for="run in testRuns" :key="run.value" :value="run.value">{{ formatSuiteName(run.value) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Baseline Test Run</label>
            <select v-model="baseline" aria-label="Baseline Test Run" :class="inputClass" @change="compare">
              <option v-for="run in runs" :key="run.invocationId" :value="run.invocationId">{{ runLabel(run) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Target Test Run</label>
            <select v-model="target" aria-label="Target Test Run" :class="inputClass" @change="compare">
              <option v-for="run in runs" :key="run.invocationId" :value="run.invocationId">{{ runLabel(run) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Test</label>
            <select v-model="selectedTest" aria-label="Test" :class="inputClass" :disabled="!result" @change="syncComparisonQuery">
              <option value="">All tests</option>
              <option v-for="test in availableTests" :key="test.workflow" :value="test.workflow">{{ test.label }}</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-10 text-gray-400 dark:text-gray-500">Comparing test runs…</div>
      <p v-else-if="runs.length < 2" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">At least two recorded instances of this test run are required for comparison.</p>

      <template v-else-if="result">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <MetricCard :value="scopedSummary.higher" label="Tests Fixed" tone="green" />
          <MetricCard :value="scopedSummary.lower" label="Tests Regressed" tone="red" />
          <MetricCard :value="scopedSummary.same" label="Unchanged Tests" />
          <MetricCard :value="scopedSummary.baselineCoverage" label="Tests Run in Baseline" />
          <MetricCard :value="scopedSummary.targetCoverage" label="Tests Run in Target" />
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                  <th class="px-5 py-3 font-semibold"><button @click="setSort('workflowLabel')">Test {{ sortMark('workflowLabel') }}</button></th>
                  <th class="px-4 py-3 font-semibold"><button @click="setSort('baselineVerdict')">{{ shortRunLabel(baseline) }} {{ sortMark('baselineVerdict') }}</button></th>
                  <th class="px-4 py-3 font-semibold"><button @click="setSort('targetVerdict')">{{ shortRunLabel(target) }} {{ sortMark('targetVerdict') }}</button></th>
                  <th class="px-4 py-3 font-semibold"><button @click="setSort('targetTimestamp')">Last observed {{ sortMark('targetTimestamp') }}</button></th>
                  <th class="px-4 py-3 font-semibold min-w-72">Target product bug</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in sortedRows" :key="row.workflow" class="border-b border-gray-50 dark:border-gray-700/40">
                  <td class="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">
                    <button class="text-left hover:text-blue-600 dark:hover:text-blue-400" @click="openTrend(row)">{{ row.workflowLabel || row.workflow }}</button>
                  </td>
                  <td class="px-4 py-3">
                    <button v-if="row.baseline" class="text-left hover:text-blue-600 dark:hover:text-blue-400" @click="openExecutions(row, baseline)">
                      <StatusBadge :value="displayedTestOutcome({ ...row.baseline.latest, productBugs: row.baseline.productBugs })" />
                      <span v-if="row.baseline.latest?.telemetry_origin" class="mt-1 block text-xs text-gray-400 dark:text-gray-500">Origin: {{ row.baseline.latest.telemetry_origin }}</span>
                    </button>
                    <span v-else class="text-xs text-gray-400">Not run</span>
                  </td>
                  <td class="px-4 py-3">
                    <button v-if="row.target" class="text-left hover:text-blue-600 dark:hover:text-blue-400" @click="openExecutions(row, target)">
                      <StatusBadge :value="displayedTestOutcome({ ...row.target.latest, productBugs: row.target.productBugs })" />
                      <span v-if="row.target.latest?.telemetry_origin" class="mt-1 block text-xs text-gray-400 dark:text-gray-500">Origin: {{ row.target.latest.telemetry_origin }}</span>
                    </button>
                    <span v-else class="text-xs text-gray-400">Not run</span>
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(row.target?.latest?.timestamp || row.baseline?.latest?.timestamp) }}</td>
                  <td class="px-4 py-3"><ProductBugStatus v-if="row.target" :findings="row.target.productBugs" /><span v-else class="text-xs text-gray-400">No target executions</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import MetricCard from '../components/MetricCard.vue'
import ProductBugStatus from '../components/ProductBugStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { compareTableValues, displayedTestOutcome, filters, formatDate, formatSuiteName, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const initialParams = nav?.params?.value || {}
const { getFilters, getCompareRuns, getRunCompare } = useWorkflowValidation()
const inputClass = 'w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/40'
const runs = ref([])
const testRuns = ref([])
const selectedRun = ref(initialParams.testRun || '')
const baseline = ref(initialParams.baselineInvocation || '')
const target = ref(initialParams.targetInvocation || '')
const selectedTest = ref(initialParams.test || initialParams.workflow || '')
const result = ref(null)
const loading = ref(false)
const error = ref('')
const sortBy = ref('targetTimestamp')
const sortDir = ref('desc')
const availableTests = computed(() => result.value ? result.value.rows
  .map(row => ({ workflow: row.workflow, label: row.workflowLabel || row.workflow }))
  .sort((a, b) => a.label.localeCompare(b.label)) : [])
const scopedRows = computed(() => result.value?.rows.filter(row => !selectedTest.value || row.workflow === selectedTest.value) || [])
function sortValue(row) {
  if (sortBy.value === 'baselineVerdict') return row.baseline ? displayedTestOutcome({ ...row.baseline.latest, productBugs: row.baseline.productBugs }) : null
  if (sortBy.value === 'targetVerdict') return row.target ? displayedTestOutcome({ ...row.target.latest, productBugs: row.target.productBugs }) : null
  if (sortBy.value === 'targetTimestamp') return row.target?.latest?.timestamp || row.baseline?.latest?.timestamp
  return row[sortBy.value]
}
const sortedRows = computed(() => [...scopedRows.value].sort((a, b) => compareTableValues(sortValue(a), sortValue(b), sortDir.value)))
const scopedSummary = computed(() => scopedRows.value.reduce((summary, row) => {
  if (row.change === 'higher') summary.higher += 1
  if (row.change === 'lower') summary.lower += 1
  if (row.change === 'same' || row.change === 'same-passing') summary.same += 1
  if (row.baseline) summary.baselineCoverage += 1
  if (row.target) summary.targetCoverage += 1
  return summary
}, { higher: 0, lower: 0, same: 0, baselineCoverage: 0, targetCoverage: 0 }))

function runLabel(run) { return `${formatDate(run.latestTimestamp)}${run.version ? ` · RHOAI ${run.version}` : ''} · ${run.tests} tests` }
function shortRunLabel(invocationId) {
  const run = runs.value.find(item => item.invocationId === invocationId)
  return run ? formatDate(run.latestTimestamp) : 'Run'
}
function syncComparisonQuery() {
  syncQueryParams(nav, { testRun: selectedRun.value, baselineInvocation: baseline.value, targetInvocation: target.value, test: selectedTest.value })
}
function openExecutions(row, invocationId) {
  filters.workflow = row.workflow
  filters.version = runs.value.find(run => run.invocationId === invocationId)?.version || ''
  filters.testSuite = selectedRun.value
  filters.invocationId = invocationId
  filters.verdict = ''
  filters.q = ''
  nav.navigateTo('runs', { workflow: row.workflow, version: filters.version, testSuite: selectedRun.value, invocationId, verdict: '', q: '' })
}
function openTrend(row) {
  filters.q = ''
  nav.navigateTo('workflow-history', { workflow: row.workflow })
}
function setSort(column) {
  sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'
  sortBy.value = column
}
function sortMark(column) { return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : '' }

async function compare() {
  if (!baseline.value || !target.value) return
  loading.value = true
  error.value = ''
  try {
    result.value = await getRunCompare(baseline.value, target.value, selectedRun.value)
    const requestedTest = nav.params?.value?.workflow
    if (!selectedTest.value && requestedTest && result.value.rows.some(row => row.workflow === requestedTest)) selectedTest.value = requestedTest
    if (selectedTest.value && !result.value.rows.some(row => row.workflow === selectedTest.value)) selectedTest.value = ''
    syncComparisonQuery()
  } catch (err) {
    result.value = null
    error.value = err.data?.error || err.message || 'Failed to compare test runs'
  } finally {
    loading.value = false
  }
}

async function loadVersions() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const data = await getCompareRuns(selectedRun.value)
    runs.value = [...(data.runs || [])].sort((a, b) => String(b.latestTimestamp || '').localeCompare(String(a.latestTimestamp || '')))
    if (runs.value.length >= 2) {
      const available = new Set(runs.value.map((run) => run.invocationId))
      if (!available.has(target.value)) target.value = runs.value[0].invocationId
      if (!available.has(baseline.value) || baseline.value === target.value) {
        baseline.value = runs.value.find((run) => run.invocationId !== target.value)?.invocationId || ''
      }
      await compare()
    }
  } catch (err) {
    runs.value = []
    error.value = err.data?.error || err.message || 'Failed to load test runs'
  } finally {
    loading.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const options = await getFilters()
    testRuns.value = [...(options.testSuites || [])].sort((a, b) => (b.count || 0) - (a.count || 0))
    selectedRun.value = selectedRun.value || testRuns.value[0]?.value || ''
    await loadVersions()
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load comparison filters'
    loading.value = false
  }
}

onMounted(load)
</script>
