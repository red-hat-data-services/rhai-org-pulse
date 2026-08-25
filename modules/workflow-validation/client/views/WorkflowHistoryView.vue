<template>
  <div>
    <button class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
      @click="nav.navigateTo('workflows')">
      <ChevronLeftIcon :size="16" /> Back to workflows
    </button>

    <div v-if="loading" class="text-center py-10 text-gray-400 dark:text-gray-500">Loading history…</div>
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <template v-else>
      <div class="mb-4">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ workflow }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Run history and defect trend across releases</p>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard :value="summary.runs" label="Total Runs" />
        <MetricCard :value="summary.passed" label="Passed" tone="green" />
        <MetricCard :value="summary.failed" label="Failed" tone="red" />
        <MetricCard :value="formatPercent(summary.passRate)" label="Pass Rate" :tone="passTone(summary.passRate)" />
        <MetricCard :value="latestBadge" label="Latest Result" :tone="summary.latestVerdict === 'PASS' ? 'green' : summary.latestVerdict === 'FAIL' ? 'red' : 'neutral'" />
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Task Pass / Fail per Run</h3>
            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-green-500"></span>Passed</span>
              <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-red-500"></span>Failed</span>
            </div>
          </div>
          <div v-if="runs.length" class="relative" style="height: 240px"><Bar :data="outcomeData" :options="outcomeOptions" /></div>
          <div v-else class="py-12 text-center text-sm text-gray-400">No runs</div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Duration Trend</h3>
          <div v-if="runs.length" class="relative" style="height: 240px"><Line :data="durationData" :options="durationOptions" /></div>
          <div v-else class="py-12 text-center text-sm text-gray-400">No runs</div>
        </div>
      </div>

      <!-- Run history table -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Run History</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                <th class="px-6 py-3 font-semibold">Verdict</th>
                <th class="px-4 py-3 font-semibold">Version</th>
                <th class="px-4 py-3 font-semibold text-right">Tasks</th>
                <th class="px-4 py-3 font-semibold text-right">Duration</th>
                <th class="px-4 py-3 font-semibold">Root Cause</th>
                <th class="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in reversedRuns"
                :key="r.id"
                class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer align-top"
                @click="nav.navigateTo('run-detail', { runKey: r.id })"
              >
                <td class="px-6 py-3"><StatusBadge :value="r.verdict" /></td>
                <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{{ r.rhoai_version }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{{ r.tasks_passed }}/{{ r.tasks_total }}</td>
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
import { useWorkflowValidation, formatDuration, formatPercent, formatDate } from '../composables/useWorkflowValidation'

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler)

const nav = inject('moduleNav')
const { getWorkflowHistory } = useWorkflowValidation()

const workflow = ref('')
const runs = ref([])
const bugs = ref([])
const summary = ref({ runs: 0, passed: 0, failed: 0, passRate: null, latestVerdict: null })
const loading = ref(false)
const error = ref('')

const reversedRuns = computed(() => [...runs.value].reverse())
const latestBadge = computed(() => summary.value.latestVerdict || '—')

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

const labels = computed(() => runs.value.map((r) => {
  const d = new Date(r.timestamp)
  return `${r.rhoai_version} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}))

const outcomeData = computed(() => ({
  labels: labels.value,
  datasets: [
    { label: 'Passed', data: runs.value.map((r) => r.tasks_passed || 0), backgroundColor: '#22c55e', stack: 't', borderRadius: 3 },
    { label: 'Failed', data: runs.value.map((r) => r.tasks_failed || 0), backgroundColor: '#ef4444', stack: 't', borderRadius: 3 }
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
    data: runs.value.map((r) => Math.round((r.duration_s || 0) / 60)),
    borderColor: '#0ea5e9',
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0.3, fill: true,
    pointBackgroundColor: runs.value.map((r) => r.verdict === 'FAIL' ? '#ef4444' : '#22c55e')
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
  } catch (err) {
    error.value = err.data?.error || err.message || 'Failed to load workflow history'
  } finally {
    loading.value = false
  }
}

watch(() => nav.params.value?.workflow, load)
onMounted(load)
</script>
