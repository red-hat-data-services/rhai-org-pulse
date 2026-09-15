<template>
  <div>
    <button class="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" @click="nav.navigateTo('test-suites', { suite })">
      <ChevronLeftIcon :size="16" /> Test Suites
    </button>
    <div v-if="loading" class="py-10 text-center text-gray-400">Loading test suite…</div>
    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">{{ error }}</div>
    <template v-else-if="data">
      <div class="mb-5">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ formatSuiteName(data.suite) }}</h2>
        <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Test suite execution from {{ formatDate(data.timestamp) }}</p>
      </div>
      <div class="mb-6 flex flex-wrap justify-center gap-4 [&>*]:min-w-40">
        <MetricCard :value="data.summary.tests" label="Tests" />
        <MetricCard :value="formatPercent(data.summary.passRate)" label="Pass Rate" :tone="passTone(data.summary.passRate)" />
        <MetricCard :value="data.summary.passed" label="Passed" tone="green" />
        <MetricCard :value="data.summary.failed" label="Failed" tone="red" />
        <MetricCard v-if="data.summary.errors" :value="data.summary.errors" label="Errors" tone="amber" />
      </div>
      <div class="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-gray-100 bg-white p-5 text-sm shadow-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-700/60 dark:bg-gray-800">
        <div><span class="text-gray-500">RHOAI version:</span> {{ data.rhoaiVersion || '—' }}</div>
        <div><span class="text-gray-500">RHODS Build ID:</span> <span class="font-mono" :title="data.rhodsOperatorDigest || undefined">{{ formatBuildId(data.rhodsOperatorDigest) }}</span></div>
        <div><span class="text-gray-500">Cluster:</span> {{ data.clusterName || '—' }}</div>
        <div><span class="text-gray-500">Executed:</span> {{ formatDate(data.timestamp) }}</div>
      </div>
      <div v-if="data.productBugs.length" class="mb-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <div class="border-b border-gray-100 px-6 py-4 dark:border-gray-700/60"><h3 class="font-semibold">Product Bugs Observed</h3></div>
        <BugRow v-for="bug in data.productBugs" :key="bug.id" :bug="bug" />
      </div>
      <div class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <div class="border-b border-gray-100 px-6 py-4 dark:border-gray-700/60"><h3 class="font-semibold">Tests in this Suite Execution</h3></div>
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead><tr class="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
            <th class="px-5 py-3 font-semibold"><button @click="setSort('workflow_label')">Test {{ sortMark('workflow_label') }}</button></th>
            <th class="px-4 py-3 font-semibold"><button @click="setSort('verdict')">Result {{ sortMark('verdict') }}</button></th>
            <th class="px-4 py-3 font-semibold"><button @click="setSort('tasks_passed')">Tasks {{ sortMark('tasks_passed') }}</button></th>
            <th class="min-w-72 px-4 py-3 font-semibold">Product bug</th>
            <th class="px-4 py-3 font-semibold"><button @click="setSort('timestamp')">Executed {{ sortMark('timestamp') }}</button></th>
          </tr></thead>
          <tbody><tr v-for="test in sortedTests" :key="test.execution_id || test.id" class="cursor-pointer border-b border-gray-50 hover:bg-gray-50 dark:border-gray-700/40 dark:hover:bg-gray-700/30" @click="openTest(test)">
            <td class="px-5 py-3 font-medium">{{ test.workflow_label || test.workflow }}</td>
            <td class="px-4 py-3"><StatusBadge :value="test.verdict" /></td>
            <td class="px-4 py-3 font-mono text-xs">{{ formatRatio(test.tasks_passed, test.tasks_total) }}</td>
            <td class="px-4 py-3"><ProductBugStatus :findings="test.productBugs" :verdict="test.verdict" /></td>
            <td class="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{{ formatDate(test.timestamp) }}</td>
          </tr></tbody>
        </table></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { ChevronLeft as ChevronLeftIcon } from 'lucide-vue-next'
import BugRow from '../components/BugRow.vue'
import MetricCard from '../components/MetricCard.vue'
import ProductBugStatus from '../components/ProductBugStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { compareTableValues, formatBuildId, formatDate, formatPercent, formatRatio, formatSuiteName, useWorkflowValidation } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getTestSuite } = useWorkflowValidation()
const suite = ref('')
const data = ref(null)
const loading = ref(false)
const error = ref('')
const sortBy = ref('timestamp')
const sortDir = ref('desc')
const sortedTests = computed(() => [...(data.value?.tests || [])].sort((a, b) => compareTableValues(a[sortBy.value] || a.workflow, b[sortBy.value] || b.workflow, sortDir.value)))
function passTone(rate) { if (rate == null) return 'neutral'; return rate >= 0.9 ? 'green' : rate >= 0.7 ? 'amber' : 'red' }
function setSort(column) { sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'; sortBy.value = column }
function sortMark(column) { return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : '' }
function openTest(test) { nav.navigateTo('run-detail', { runKey: test.execution_id || test.id }) }
async function load() {
  suite.value = nav.params?.value?.suite || ''
  const invocationId = nav.params?.value?.invocationId
  if (!suite.value || !invocationId) { error.value = 'No test suite execution specified'; return }
  loading.value = true
  error.value = ''
  try { data.value = await getTestSuite(suite.value, invocationId) }
  catch (err) { error.value = err.data?.error || err.message || 'Failed to load test suite execution' }
  finally { loading.value = false }
}
watch(() => [nav.params?.value?.suite, nav.params?.value?.invocationId], load)
onMounted(load)
</script>
