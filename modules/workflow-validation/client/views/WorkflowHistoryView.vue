<template>
  <div>
    <button class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
      @click="backToTrends">
      <ChevronLeftIcon :size="16" /> Test Trends
    </button>

    <div v-if="loading" class="text-center py-10 text-gray-400 dark:text-gray-500">Loading history…</div>
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <template v-else>
      <div class="mb-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ workflowLabel || workflow }}</h2>
          <button class="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400" @click="openCompare">Compare this test across runs →</button>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Execution history and defect trends for this test</p>
      </div>

      <!-- Summary -->
      <div class="flex flex-wrap justify-center gap-4 mb-6 [&>*]:min-w-40">
        <MetricCard :value="summary.runs" label="Total Executions" />
        <MetricCard :value="historyOutcomes.pass" label="Passed" tone="green" />
        <MetricCard :value="historyOutcomes.fail" label="Failed" tone="red" />
        <MetricCard :value="historyOutcomes.skip" label="Skipped" tone="amber" />
        <MetricCard :value="formatPercent(summary.passRate)" label="Pass Rate" :tone="passTone(summary.passRate)" />
        <MetricCard :value="latestBadge" label="Latest Result" :tone="latestBadge === 'PASS' ? 'green' : latestBadge === 'FAIL' ? 'red' : latestBadge === 'SKIP' ? 'amber' : 'neutral'" />
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Task Pass / Fail per Execution</h3>
            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-green-500"></span>Passed</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-red-500"></span>Failed</span>
            </div>
          </div>
          <div v-if="runs.length" class="relative" style="height: 240px"><Bar :data="outcomeData" :options="outcomeOptions" /></div>
          <div v-else class="py-12 text-center text-sm text-gray-400">No executions</div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Duration Trend</h3>
          <div v-if="runs.length" class="relative" style="height: 240px"><Line :data="durationData" :options="durationOptions" /></div>
          <div v-else class="py-12 text-center text-sm text-gray-400">No executions</div>
        </div>
      </div>

      <!-- Execution history table -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Execution History</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                <th class="px-6 py-3 font-semibold"><button @click="setSort('verdict')">Verdict {{ sortMark('verdict') }}</button></th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('rhoai_version')">Version {{ sortMark('rhoai_version') }}</button></th>
                <th class="px-4 py-3 font-semibold text-right"><button @click="setSort('tasks_passed')">Tasks {{ sortMark('tasks_passed') }}</button></th>
                <th class="px-4 py-3 font-semibold text-right"><button @click="setSort('duration_s')">Duration {{ sortMark('duration_s') }}</button></th>
                <th class="px-4 py-3 font-semibold">Root Cause</th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('timestamp')">When {{ sortMark('timestamp') }}</button></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in sortedRuns"
                :key="r.id"
                class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer align-top"
                @click="nav.navigateTo('run-detail', { runKey: r.execution_id || r.id })"
              >
                <td class="px-6 py-3"><StatusBadge :value="displayedTestOutcome(r)" /></td>
                <td class="px-4 py-3">
                  <div class="font-mono text-xs text-gray-600 dark:text-gray-300">{{ r.rhoai_version }}</div>
                  <div v-if="r.telemetry_origin" class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Origin: {{ r.telemetry_origin }}</div>
                </td>
                <td class="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{{ formatRatio(r.tasks_passed, r.tasks_total) }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{{ formatDuration(r.duration_s) }}</td>
                <td class="px-4 py-3 max-w-[340px]">
                  <div v-if="bugsForRun(r.run_id).length" class="space-y-1">
                    <div v-for="b in bugsForRun(r.run_id)" :key="b.id" class="flex items-start gap-1.5">
                      <StatusBadge :value="b.category" />
                      <span class="text-xs text-gray-600 dark:text-gray-400 leading-snug">{{ b.error_summary }}</span>
                    </div>
                  </div>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(r.timestamp) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue'
import { ChevronLeft as ChevronLeftIcon } from 'lucide-vue-next'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler
} from 'chart.js'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { compareTableValues, displayedOutcomeCounts, displayedTestOutcome, filterQueryValues, hydrateFilters, syncQueryParams, useWorkflowValidation, formatDuration, formatPercent, formatDate, formatRatio } from '../composables/useWorkflowValidation'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

const nav = inject('moduleNav')
const FILTER_KEYS = ['version', 'datePreset', 'dateFrom', 'dateTo']
hydrateFilters(nav?.params?.value, FILTER_KEYS)
const { getWorkflowHistory } = useWorkflowValidation()

const workflow = ref('')
const workflowLabel = ref('')
const runs = ref([])
const bugs = ref([])
const summary = ref({ runs: 0, passed: 0, failed: 0, errors: 0, passRate: null, latestVerdict: null })
const loading = ref(false)
const error = ref('')
const sortBy = ref('timestamp')
const sortDir = ref('desc')

const runsWithBugs = computed(() => runs.value.map((run) => ({
  ...run,
  productBugs: bugs.value.filter((bug) => bug.run_id === run.run_id && bug.category === 'PRODUCT_BUG')
})))
const sortedRuns = computed(() => [...runsWithBugs.value].sort((a, b) =>
  compareTableValues(a[sortBy.value], b[sortBy.value], sortDir.value)))
const historyOutcomes = computed(() => displayedOutcomeCounts(runsWithBugs.value))
const latestBadge = computed(() => runsWithBugs.value.length ? displayedTestOutcome(runsWithBugs.value[runsWithBugs.value.length - 1]) : '—')

function passTone(rate) { if (rate == null) return 'neutral'; return rate >= 0.9 ? 'green' : rate >= 0.7 ? 'amber' : 'red' }

const bugsByRun = computed(() => {
  const map = {}
  for (const b of bugs.value) {
    if (!b.run_id) continue
    ;(map[b.run_id] = map[b.run_id] || []).push(b)
  }
  return map
})
function bugsForRun(runId) { return bugsByRun.value[runId] || [] }
function backToTrends() { nav.navigateTo('workflows', filterQueryValues(FILTER_KEYS)) }
function openCompare() { nav.navigateTo('compare', { test: workflow.value }) }
function setSort(column) {
  sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'
  sortBy.value = column
}
function sortMark(column) { return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : '' }

const labels = computed(() => runs.value.map((r) => {
  const d = new Date(r.timestamp)
  const date = Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${r.rhoai_version || 'Unknown version'} · ${date}`
}))

const outcomeData = computed(() => ({
  labels: labels.value,
  datasets: [
    { label: 'Passed', data: runs.value.map((r) => r.tasks_passed ?? null), backgroundColor: '#22c55e', stack: 't', borderRadius: 3 },
    { label: 'Failed', data: runs.value.map((r) => r.tasks_failed ?? null), backgroundColor: '#ef4444', stack: 't', borderRadius: 3 }
  ]
}))
const outcomeOptions = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', padding: 10, cornerRadius: 8 } },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, color: '#9ca3af', maxRotation: 60, minRotation: 30 } },
    y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, color: '#9ca3af', precision: 0 } }
  }
}

const durationData = computed(() => ({
  labels: labels.value,
  datasets: [{
    label: 'Duration (min)',
    data: runs.value.map((r) => r.duration_s == null ? null : Math.round(r.duration_s / 60)),
    borderColor: '#0ea5e9',
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3, fill: true,
    pointBackgroundColor: runs.value.map((r) => ({ PASS: '#22c55e', FAIL: '#ef4444', SKIP: '#f97316' })[displayedTestOutcome(r)] || '#94a3b8')
  }]
}))
const durationOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#111827', padding: 10, cornerRadius: 8, callbacks: { label: (c) => `${c.parsed.y} min` } }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#9ca3af', maxRotation: 60, minRotation: 30 } },
    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v) => v + 'm' } }
  }
}

async function load() {
  const wf = nav.params.value?.workflow
  if (!wf) { error.value = 'No workflow specified'; return }
  workflow.value = wf
  loading.value = true
  error.value = ''
  try {
    const data = await getWorkflowHistory(wf)
    runs.value = data.runs
    bugs.value = data.bugs
    summary.value = data.summary
    workflowLabel.value = data.workflowLabel || wf
    syncQueryParams(nav, { workflow: workflow.value, ...filterQueryValues(FILTER_KEYS) })
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load test history'
  } finally {
    loading.value = false
  }
}

watch(() => nav.params.value?.workflow, load)
onMounted(load)
</script>
