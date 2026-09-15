<template>
  <div>
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflow Validation</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Test executions, task outcomes, cost, and RCA findings across releases
      </p>
    </div>

    <FilterBar :show-verdict="false" :show-search="false" show-test-suite @change="loadAll" />

    <!-- OpenSearch unreachable -->
    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
      <p class="text-xs text-gray-500 dark:text-gray-500 mt-3">Check the backend OpenSearch endpoint and read-only credentials.</p>
    </div>

    <template v-else>
      <!-- KPI tiles -->
      <div class="flex flex-wrap justify-center gap-4 mb-6 [&>*]:w-[calc(50%-0.5rem)] md:[&>*]:w-[calc(33.333%-0.75rem)] lg:[&>*]:w-[calc(25%-0.75rem)] xl:[&>*]:w-[calc(16.666%-0.875rem)]">
        <MetricCard :value="overview.runs.total" label="Executions" />
        <MetricCard :value="formatPercent(overview.runs.passRate)" label="Pass Rate"
          :tone="passTone(overview.runs.passRate)" />
        <MetricCard :value="overview.runs.passed" label="Passed" tone="green" />
        <MetricCard :value="overview.runs.failed" label="Failed" tone="red" />
        <MetricCard v-if="overview.runs.errors" :value="overview.runs.errors" label="Errors" tone="amber" />
        <MetricCard :value="overview.runs.workflows" label="Tests" />
        <MetricCard :value="overview.runs.versions" label="Versions" />
        <MetricCard v-if="costsVisible" :value="formatUsd(overview.runs.aiCost)" label="AI Cost" tone="teal" />
        <MetricCard v-if="costsVisible" :value="formatUsd(overview.runs.infraCost)" label="Infra Cost" tone="teal" />
        <MetricCard :value="formatDuration(overview.runs.avgDuration)" label="Avg Duration" />
        <MetricCard :value="overview.bugs.total" label="Product Bug Occurrences" tone="amber" />
        <MetricCard :value="overview.bugs.opened" label="New Product Bugs" tone="red"
          :sub="overview.bugs.distinctJira + ' distinct linked issues'" />
        <MetricCard
          :value="overview.runs.tasksPassed + '/' + overview.runs.tasksTotal"
          label="Tasks Passed" tone="green" />
      </div>

      <!-- Trend line + recent product bugs -->
      <div class="grid grid-cols-1 gap-6 mb-6" :class="{ 'lg:grid-cols-2': !filters.testSuite }">
        <TrendLineChart v-if="!filters.testSuite" title="Pass Rate & Volume Over Time" :data="charts.overTime" />
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Recently Opened Product Bugs</h3>
            <button class="text-sm text-blue-600 dark:text-blue-400 hover:underline" @click="nav.navigateTo('activity')">View all →</button>
          </div>
          <div v-if="charts.recentProductBugs.length" class="divide-y divide-gray-100 dark:divide-gray-700/60">
            <div v-for="bug in charts.recentProductBugs" :key="bug.id" class="py-3 first:pt-0 last:pb-0">
              <div class="flex items-start justify-between gap-3">
                <a
                  v-if="bug.jira_url"
                  :href="bug.jira_url"
                  target="_blank"
                  rel="noopener"
                  class="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >{{ bug.bug_key || 'JIRA' }}</a>
                <span v-else class="font-mono text-sm font-semibold text-gray-600 dark:text-gray-300">{{ bug.bug_key || 'No JIRA key' }}</span>
                <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(bug.timestamp) }}</span>
              </div>
              <p class="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">{{ bug.error_summary || 'No summary available' }}</p>
              <p v-if="bug.workflow || bug.rhoai_version" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ bug.workflow || 'Unknown workflow' }}<span v-if="bug.rhoai_version"> · {{ bug.rhoai_version }}</span>
              </p>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400 dark:text-gray-500 py-10 text-center">No opened product bugs match the current filters</p>
        </div>
      </div>

      <div v-if="!filters.testSuite && charts.byVersion.length > 1" class="mb-6">
        <PassRateByVersionChart :data="charts.byVersion" />
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Failed Tests</h3>
          <button aria-label="View all failed tests" class="text-sm text-blue-600 dark:text-blue-400 hover:underline" @click="viewFailedTests">View all →</button>
        </div>
        <DashboardTestTable
          :tests="charts.failedTests"
          :loading="loading"
          :costs-visible="costsVisible"
          empty-message="No failed tests match the current filters"
          @select="openTest"
        />
      </div>

      <!-- Recent tests -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Tests</h3>
          <button aria-label="View all recent tests" class="text-sm text-blue-600 dark:text-blue-400 hover:underline" @click="viewRecentTests">View all →</button>
        </div>
        <DashboardTestTable
          :tests="charts.recentTests"
          :loading="loading"
          :costs-visible="costsVisible"
          @select="openTest"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { inject, onMounted, reactive, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import DashboardTestTable from '../components/DashboardTestTable.vue'
import TrendLineChart from '../components/TrendLineChart.vue'
import PassRateByVersionChart from '../components/PassRateByVersionChart.vue'
import { useCostVisibility } from '../composables/useCostVisibility'
import {
  filters, useWorkflowValidation,
  formatUsd, formatDuration, formatPercent, formatDate
} from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getOverview, getCharts } = useWorkflowValidation()
const costsVisible = useCostVisibility()

const loading = ref(false)
const unreachable = ref('')
const overview = reactive({
  runs: { total: 0, passRate: null, passed: 0, failed: 0, errors: 0, tasksTotal: null, tasksPassed: null, aiCost: null, infraCost: null, avgDuration: null, workflows: 0, versions: 0 },
  bugs: { total: 0, opened: 0, distinctJira: 0 }
})
const charts = reactive({ overTime: [], byVersion: [], byWorkflow: [], bugsByCategory: [], bugsByAction: [], failedTests: [], recentTests: [], recentProductBugs: [] })

function passTone(rate) { if (rate == null) return 'neutral'; return rate >= 0.9 ? 'green' : rate >= 0.7 ? 'amber' : 'red' }
function openTest(test) { nav.navigateTo('run-detail', { runKey: test.execution_id || test.id }) }
function viewFailedTests() {
  nav.navigateTo('runs', { verdict: 'UNSUCCESSFUL', q: '' })
}
function viewRecentTests() { nav.navigateTo('runs', { verdict: '', q: '' }) }

async function loadAll() {
  loading.value = true
  unreachable.value = ''
  try {
    const suiteScoped = Boolean(filters.testSuite)
    const dashboardScope = {
      verdict: '', q: '',
      ...(suiteScoped ? { dateFrom: '', dateTo: '' } : {})
    }
    const [ov, ch] = await Promise.all([getOverview(dashboardScope), getCharts(dashboardScope)])
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

onMounted(loadAll)
</script>
