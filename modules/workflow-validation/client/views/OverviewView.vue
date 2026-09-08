<template>
  <div>
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflow Validation</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Workflow executions, task outcomes, cost, and RCA findings across releases
      </p>
    </div>

    <FilterBar @change="loadAll" />

    <!-- OpenSearch unreachable -->
    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
      <p class="text-xs text-gray-500 dark:text-gray-500 mt-3">Expected at <code>http://localhost:9200</code> (execution, task, and root-cause indices).</p>
    </div>

    <template v-else>
      <!-- KPI grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        <MetricCard :value="overview.runs.total" label="Executions" />
        <MetricCard :value="formatPercent(overview.runs.passRate)" label="Pass Rate"
          :tone="passTone(overview.runs.passRate)" />
        <MetricCard :value="overview.runs.passed" label="Passed" tone="green" />
        <MetricCard :value="overview.runs.failed" label="Failed" tone="red" />
        <MetricCard :value="overview.runs.workflows" label="Workflows" />
        <MetricCard :value="overview.runs.versions" label="Versions" />
        <MetricCard :value="formatUsd(overview.runs.aiCost)" label="AI Cost" tone="teal" />
        <MetricCard :value="formatUsd(overview.runs.infraCost)" label="Infra Cost" tone="teal" />
        <MetricCard :value="formatDuration(overview.runs.avgDuration)" label="Avg Duration" />
        <MetricCard :value="overview.bugs.total" label="Root Causes" tone="amber" />
        <MetricCard :value="overview.bugs.opened" label="Bugs Opened" tone="red"
          :sub="overview.bugs.distinctJira + ' distinct JIRA'" />
        <MetricCard
          :value="overview.runs.tasksPassed + '/' + overview.runs.tasksTotal"
          label="Tasks Passed" tone="green" />
      </div>

      <!-- Trend line + category donut -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TrendLineChart title="Pass Rate & Volume Over Time" :data="charts.overTime" />
        <CategoryDonut title="Root Causes by Category" center-label="causes" :items="donutItems" />
      </div>

      <div v-if="charts.failedTasks.length" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 mb-6">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Most Frequently Failing Tasks</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div v-for="task in charts.failedTasks" :key="task.task" class="flex items-center justify-between rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
            <span class="text-sm text-gray-800 dark:text-gray-200 truncate mr-3">{{ task.task }}</span>
            <span class="text-xs font-semibold text-red-700 dark:text-red-300">{{ task.count }} failures</span>
          </div>
        </div>
      </div>

      <!-- Pass rate by version (bonus) -->
      <div class="mb-6">
        <PassRateByVersionChart :data="charts.byVersion" />
      </div>

      <!-- Recent runs -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Runs</h3>
          <button class="text-sm text-blue-600 dark:text-blue-400 hover:underline" @click="nav.navigateTo('runs')">View all →</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                <th class="px-6 py-3 font-semibold">Verdict</th>
                <th class="px-4 py-3 font-semibold">Workflow</th>
                <th class="px-4 py-3 font-semibold">Version</th>
                <th class="px-4 py-3 font-semibold text-right">Tasks</th>
                <th class="px-4 py-3 font-semibold text-right">AI Cost</th>
                <th class="px-4 py-3 font-semibold text-right">Bugs</th>
                <th class="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in recentRuns"
                :key="r.id"
                class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                @click="nav.navigateTo('run-detail', { runKey: r.id })"
              >
                <td class="px-6 py-3"><StatusBadge :value="r.verdict" /></td>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{{ r.workflow_label }}</td>
                <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{{ r.rhoai_version }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">{{ r.tasks_passed }}/{{ r.tasks_total }}</td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatUsd(r.cost_usd) }}</td>
                <td class="px-4 py-3 text-right">
                  <span v-if="r.bug_count" class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{{ r.bug_count }}</span>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(r.timestamp) }}</td>
              </tr>
              <tr v-if="!loading && !recentRuns.length">
                <td colspan="7" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">No runs match the current filters</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import TrendLineChart from '../components/TrendLineChart.vue'
import CategoryDonut from '../components/CategoryDonut.vue'
import PassRateByVersionChart from '../components/PassRateByVersionChart.vue'
import {
  useWorkflowValidation,
  formatUsd, formatDuration, formatPercent, formatDate
} from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getOverview, getCharts, getRuns } = useWorkflowValidation()

const loading = ref(false)
const unreachable = ref('')
const overview = reactive({
  runs: { total: 0, passRate: null, passed: 0, failed: 0, tasksTotal: 0, tasksPassed: 0, aiCost: 0, infraCost: 0, avgDuration: 0, workflows: 0, versions: 0 },
  bugs: { total: 0, opened: 0, distinctJira: 0 }
})
const charts = reactive({ overTime: [], byVersion: [], byWorkflow: [], bugsByCategory: [], bugsByAction: [], failedTasks: [] })
const recentRuns = ref([])

const donutItems = computed(() => charts.bugsByCategory.map((c) => ({ label: c.category, count: c.count })))

function passTone(rate) { if (rate == null) return 'neutral'; return rate >= 0.9 ? 'green' : rate >= 0.7 ? 'amber' : 'red' }

async function loadAll() {
  loading.value = true
  unreachable.value = ''
  try {
    const [ov, ch, rr] = await Promise.all([getOverview(), getCharts(), getRuns(0, 8)])
    Object.assign(overview, ov)
    Object.assign(charts, ch)
    recentRuns.value = rr.runs
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load data'
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>
