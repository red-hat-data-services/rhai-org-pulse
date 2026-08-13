<template>
  <div>
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflow Validation</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        AI-driven RHOAI workflow validation — pass/fail, cost, and bugs across releases
      </p>
    </div>

    <FilterBar @change="loadAll" />

    <!-- OpenSearch unreachable -->
    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
      <p class="text-xs text-gray-500 dark:text-gray-500 mt-3">Expected at <code>http://localhost:9200</code> (indices <code>workflow-runs</code>, <code>workflow-bugs</code>).</p>
    </div>

    <template v-else>
      <!-- KPI grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        <MetricCard :value="overview.runs.total" label="Test Runs" />
        <MetricCard :value="formatPercent(overview.runs.passRate)" label="Pass Rate"
          :tone="passTone(overview.runs.passRate)" />
        <MetricCard :value="overview.runs.passed" label="Passed" tone="green" />
        <MetricCard :value="overview.runs.failed" label="Failed" tone="red" />
        <MetricCard :value="overview.runs.workflows" label="Workflows" />
        <MetricCard :value="overview.runs.versions" label="Versions" />
        <MetricCard :value="formatUsd(overview.runs.aiCost)" label="AI Cost" tone="teal" />
        <MetricCard :value="formatUsd(overview.runs.infraCost)" label="Infra Cost" tone="teal" />
        <MetricCard :value="formatDuration(overview.runs.avgDuration)" label="Avg Duration" />
        <MetricCard :value="overview.bugs.total" label="Bugs" tone="amber" />
        <MetricCard :value="overview.bugs.opened" label="Bugs Opened" tone="red"
          :sub="overview.bugs.distinctJira + ' distinct JIRA'" />
        <MetricCard
          :value="overview.runs.tasksPassed + '/' + overview.runs.tasksTotal"
          label="Tasks Passed" tone="green" />
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <RunsOverTimeChart :data="charts.overTime" />
        <PassRateByVersionChart :data="charts.byVersion" />
      </div>

      <!-- Per-workflow breakdown -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden mb-6">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Per-Workflow Breakdown</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                <th class="px-6 py-3 font-semibold">Workflow</th>
                <th class="px-4 py-3 font-semibold text-right">Runs</th>
                <th class="px-4 py-3 font-semibold">Pass Rate</th>
                <th class="px-4 py-3 font-semibold text-right">AI Cost</th>
                <th class="px-4 py-3 font-semibold text-right">Avg Duration</th>
                <th class="px-4 py-3 font-semibold text-right">Bugs</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="w in charts.byWorkflow"
                :key="w.workflow"
                class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                @click="drillToRuns(w.workflow)"
              >
                <td class="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{{ w.workflow }}</td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ w.runs }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <div class="flex-1 min-w-[60px] max-w-[120px] h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div class="h-full rounded-full" :class="barColor(w.passRate)" :style="{ width: pct(w.passRate) }"></div>
                    </div>
                    <span class="font-mono text-xs text-gray-600 dark:text-gray-300 w-9">{{ formatPercent(w.passRate) }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatUsd(w.aiCost) }}</td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatDuration(w.avgDuration) }}</td>
                <td class="px-4 py-3 text-right">
                  <span v-if="w.bugs" class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{{ w.bugs }}</span>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
              </tr>
              <tr v-if="!loading && !charts.byWorkflow.length">
                <td colspan="6" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">No workflows match the current filters</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bug breakdowns -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BreakdownCard title="Bugs by Category" :items="charts.bugsByCategory" field="category" />
        <BreakdownCard title="Bugs by Action" :items="charts.bugsByAction" field="action" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { inject, onMounted, reactive, ref, h } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import RunsOverTimeChart from '../components/RunsOverTimeChart.vue'
import PassRateByVersionChart from '../components/PassRateByVersionChart.vue'
import {
  filters, useWorkflowValidation,
  formatUsd, formatDuration, formatPercent
} from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getOverview, getCharts } = useWorkflowValidation()

const loading = ref(false)
const unreachable = ref('')
const overview = reactive({
  runs: { total: 0, passRate: null, passed: 0, failed: 0, tasksTotal: 0, tasksPassed: 0, aiCost: 0, infraCost: 0, avgDuration: 0, workflows: 0, versions: 0 },
  bugs: { total: 0, opened: 0, distinctJira: 0 }
})
const charts = reactive({ overTime: [], byVersion: [], byWorkflow: [], bugsByCategory: [], bugsByAction: [] })

function pct(rate) { return (rate == null ? 0 : Math.round(rate * 100)) + '%' }
function passTone(rate) { if (rate == null) return 'neutral'; return rate >= 0.9 ? 'green' : rate >= 0.7 ? 'amber' : 'red' }
function barColor(rate) {
  if (rate == null) return 'bg-gray-400'
  return rate >= 0.9 ? 'bg-green-500' : rate >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
}

function drillToRuns(workflow) {
  filters.workflow = workflow
  nav.navigateTo('runs')
}

async function loadAll() {
  loading.value = true
  unreachable.value = ''
  try {
    const [ov, ch] = await Promise.all([getOverview(), getCharts()])
    Object.assign(overview, ov)
    Object.assign(charts, ch)
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

// Small inline breakdown component (category/action bars) rendered via render fn
const BreakdownCard = {
  props: { title: String, items: { type: Array, default: () => [] }, field: String },
  setup(props) {
    return () => {
      const max = Math.max(1, ...props.items.map((i) => i.count))
      return h('div', { class: 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6' }, [
        h('h3', { class: 'text-base font-semibold text-gray-900 dark:text-gray-100 mb-4' }, props.title),
        props.items.length
          ? h('div', { class: 'space-y-2.5' }, props.items.map((i) =>
            h('div', { class: 'flex items-center gap-3', key: i[props.field] }, [
              h('div', { class: 'w-40 shrink-0' }, [h(StatusBadge, { value: i[props.field] })]),
              h('div', { class: 'flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden' }, [
                h('div', { class: 'h-full rounded-full bg-red-400 dark:bg-red-500/70', style: { width: (i.count / max * 100) + '%' } })
              ]),
              h('span', { class: 'font-mono text-xs text-gray-600 dark:text-gray-300 w-6 text-right' }, String(i.count))
            ])))
          : h('p', { class: 'text-sm text-gray-400 dark:text-gray-500 py-6 text-center' }, 'No bugs match the current filters')
      ])
    }
  }
}

onMounted(loadAll)
</script>
