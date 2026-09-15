<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Compare RHOAI Versions</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Compare the recorded execution cohorts for two RHOAI versions. These are version-level observations, not individual builds.</p>
    </div>

    <div v-if="error" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Unable to load comparison</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ error }}</p>
      <button class="mt-4 px-4 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50" :disabled="loading" @click="load">{{ loading ? 'Retrying…' : 'Retry' }}</button>
    </div>

    <template v-else>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Baseline RHOAI version</label>
            <select v-model="baseline" aria-label="Baseline RHOAI version" :class="inputClass" @change="compare">
              <option v-for="version in versions" :key="version.version" :value="version.version">{{ versionLabel(version) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Target RHOAI version</label>
            <select v-model="target" aria-label="Target RHOAI version" :class="inputClass" @change="compare">
              <option v-for="version in versions" :key="version.version" :value="version.version">{{ versionLabel(version) }}</option>
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

      <div v-if="loading" class="text-center py-10 text-gray-400 dark:text-gray-500">Comparing versions…</div>
      <p v-else-if="versions.length < 2" class="text-center py-10 text-sm text-gray-400 dark:text-gray-500">At least two RHOAI versions are required for comparison.</p>

      <template v-else-if="result">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <MetricCard :value="scopedSummary.higher" label="Higher Observed Pass Rate" tone="green" />
          <MetricCard :value="scopedSummary.lower" label="Lower Observed Pass Rate" tone="red" />
          <MetricCard :value="scopedSummary.same" label="Same Observed Pass Rate" tone="amber" />
          <MetricCard :value="scopedSummary.baselineCoverage" label="Tests Run in Baseline" />
          <MetricCard :value="scopedSummary.targetCoverage" label="Tests Run in Target" />
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                  <th class="px-5 py-3 font-semibold"><button @click="setSort('workflowLabel')">Test {{ sortMark('workflowLabel') }}</button></th>
                  <th class="px-4 py-3 font-semibold"><button @click="setSort('baselineRate')">{{ result.baseline.version }} {{ sortMark('baselineRate') }}</button></th>
                  <th class="px-4 py-3 font-semibold"><button @click="setSort('targetRate')">{{ result.target.version }} {{ sortMark('targetRate') }}</button></th>
                  <th class="px-4 py-3 font-semibold"><button @click="setSort('passRateChange')">Change {{ sortMark('passRateChange') }}</button></th>
                  <th class="px-4 py-3 font-semibold"><button @click="setSort('targetTimestamp')">Last observed {{ sortMark('targetTimestamp') }}</button></th>
                  <th class="px-4 py-3 font-semibold min-w-72">Target product bug</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in sortedRows" :key="row.workflow" class="border-b border-gray-50 dark:border-gray-700/40 border-l-4" :class="rowAccent(row.change)">
                  <td class="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">
                    <button class="text-left hover:text-blue-600 dark:hover:text-blue-400" @click="openTrend(row)">{{ row.workflowLabel || row.workflow }}</button>
                  </td>
                  <td class="px-4 py-3">
                    <button v-if="row.baseline" class="text-left hover:text-blue-600 dark:hover:text-blue-400" @click="openExecutions(row, result.baseline.version)">
                      <span class="block font-semibold">{{ formatPercent(row.baseline.passRate) }}</span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400">{{ cohortLabel(row.baseline) }}</span>
                    </button>
                    <span v-else class="text-xs text-gray-400">Not run</span>
                  </td>
                  <td class="px-4 py-3">
                    <button v-if="row.target" class="text-left hover:text-blue-600 dark:hover:text-blue-400" @click="openExecutions(row, result.target.version)">
                      <span class="block font-semibold">{{ formatPercent(row.target.passRate) }}</span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400">{{ cohortLabel(row.target) }}</span>
                    </button>
                    <span v-else class="text-xs text-gray-400">Not run</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-block px-2 py-0.5 rounded-full text-[0.7rem] font-semibold" :class="changeBadge(row.change)">{{ changeLabel(row.change) }}</span>
                    <span v-if="row.passRateChange != null" class="block mt-1 text-xs text-gray-500 dark:text-gray-400">{{ formatPointChange(row.passRateChange) }}</span>
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
import { compareTableValues, compareVersionNumbers, filters, formatDate, formatPercent, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const initialParams = nav?.params?.value || {}
const { getCompareVersions, getVersionCompare } = useWorkflowValidation()
const inputClass = 'w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/40'
const versions = ref([])
const baseline = ref(initialParams.baseline || '')
const target = ref(initialParams.target || '')
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
  if (sortBy.value === 'baselineRate') return row.baseline?.passRate
  if (sortBy.value === 'targetRate') return row.target?.passRate
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

function versionLabel(version) { return `${version.version} · ${version.tests} tests · ${version.executions} executions` }
function cohortLabel(cohort) {
  const unknown = cohort.unknown ? ` · ${cohort.unknown} unknown` : ''
  return `${cohort.passed} passed · ${cohort.executions} executions${unknown}`
}
function syncComparisonQuery() {
  syncQueryParams(nav, { baseline: baseline.value, target: target.value, test: selectedTest.value })
}
function formatPointChange(change) { return `${change > 0 ? '+' : ''}${Math.round(change * 100)} percentage points` }
function openExecutions(row, version) {
  filters.workflow = row.workflow
  filters.version = version
  filters.verdict = ''
  filters.q = ''
  nav.navigateTo('runs', { workflow: row.workflow, version, verdict: '', q: '' })
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
function changeLabel(change) {
  return { higher: 'Higher observed rate', lower: 'Lower observed rate', 'same-passing': 'Same observed rate', same: 'Same observed rate', 'insufficient-data': 'Insufficient executions', 'not-in-baseline': 'Not run in baseline', 'not-in-target': 'Not run in target' }[change] || change
}
function rowAccent(change) {
  return { higher: 'border-green-500', lower: 'border-red-500', same: 'border-amber-400', 'same-passing': 'border-green-200 dark:border-green-900/50', 'insufficient-data': 'border-gray-300 dark:border-gray-600', 'not-in-baseline': 'border-blue-400', 'not-in-target': 'border-gray-300 dark:border-gray-600' }[change]
}
function changeBadge(change) {
  return { higher: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', lower: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', same: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', 'same-passing': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', 'insufficient-data': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400', 'not-in-baseline': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', 'not-in-target': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' }[change]
}

async function compare() {
  if (!baseline.value || !target.value) return
  loading.value = true
  error.value = ''
  try {
    result.value = await getVersionCompare(baseline.value, target.value)
    const requestedTest = nav.params?.value?.workflow
    if (!selectedTest.value && requestedTest && result.value.rows.some(row => row.workflow === requestedTest)) selectedTest.value = requestedTest
    if (selectedTest.value && !result.value.rows.some(row => row.workflow === selectedTest.value)) selectedTest.value = ''
    syncComparisonQuery()
  } catch (err) {
    result.value = null
    error.value = err.data?.error || err.message || 'Failed to compare RHOAI versions'
  } finally {
    loading.value = false
  }
}

async function load() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const data = await getCompareVersions()
    versions.value = [...(data.versions || [])].sort((a, b) => compareVersionNumbers(b.version, a.version))
    if (versions.value.length >= 2) {
      const available = new Set(versions.value.map((version) => version.version))
      if (!available.has(target.value)) target.value = versions.value[0].version
      if (!available.has(baseline.value) || baseline.value === target.value) {
        baseline.value = versions.value.find((version) => version.version !== target.value)?.version || ''
      }
      await compare()
    }
  } catch (err) {
    versions.value = []
    error.value = err.data?.error || err.message || 'Failed to load RHOAI versions'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
