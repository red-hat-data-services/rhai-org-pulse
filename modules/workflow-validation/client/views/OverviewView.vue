<template>
  <div>
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflow Validation</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Results from one test run against a selected RHOAI release
      </p>
    </div>

    <FilterBar
      :show-verdict="false"
      :show-search="false"
      show-test-suite
      suite-execution-only
      @change="loadAll"
      @ready="loadAll"
      @suite-execution="selectedSuiteExecution = $event"
    />

    <!-- OpenSearch unreachable -->
    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
      <p class="text-xs text-gray-500 dark:text-gray-500 mt-3">Check the backend OpenSearch endpoint and read-only credentials.</p>
    </div>

    <template v-else>
      <!-- KPI tiles -->
      <div class="flex flex-wrap justify-center gap-4 mb-6 [&>*]:w-[calc(50%-0.5rem)] md:[&>*]:w-[calc(33.333%-0.75rem)] lg:[&>*]:w-[calc(25%-0.75rem)] xl:[&>*]:w-[calc(20%-0.8rem)]">
        <MetricCard :value="charts.tests.length" label="Tests" />
        <MetricCard :value="outcomeCounts.pass" label="Passed" tone="green" />
        <MetricCard :value="outcomeCounts.fail" label="Failed" tone="red" />
        <MetricCard :value="outcomeCounts.aborted" label="Aborted" tone="amber" />
        <MetricCard :value="formatPercent(dashboardPassRate)" label="Pass Rate"
          :tone="passTone(dashboardPassRate)" />
        <MetricCard :value="selectedSuiteExecution?.rhoaiVersion || overview.runs.version || filters.version || 'Unknown'" label="Version" />
        <MetricCard
          v-if="buildDigest"
          :value="formatBuildId(buildDigest)"
          label="RHODS Image"
          sub="Build ID"
          :title="buildDigest"
        />
        <MetricCard :value="charts.newProductBugs.length" label="Bugs Opened" tone="red" />
        <MetricCard :value="charts.knownProductBugs.length" label="Existing Bugs Encountered" tone="amber" />
        <MetricCard v-if="costsVisible" :value="formatUsd(overview.runs.aiCost)" label="AI Cost" tone="teal" />
        <MetricCard v-if="costsVisible" :value="formatUsd(overview.runs.infraCost)" label="Infra Cost" tone="teal" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">New Product Bugs Opened</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Product bugs first reported and filed as new Jira issues during this test run.</p>
          </div>
          <div v-if="charts.newProductBugs.length" class="divide-y divide-gray-100 dark:divide-gray-700/60">
            <BugRow v-for="bug in charts.newProductBugs" :key="bug.id" :bug="bug" />
          </div>
          <p v-else class="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No new product bugs were opened during this test run.</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Known Product Bugs Encountered</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Previously reported product bugs encountered again during this test run; no new Jira issue was opened.</p>
          </div>
          <div v-if="charts.knownProductBugs.length" class="divide-y divide-gray-100 dark:divide-gray-700/60">
            <BugRow v-for="bug in charts.knownProductBugs" :key="bug.id" :bug="bug" />
          </div>
          <p v-else class="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No known product bugs were encountered during this test run.</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Test Results</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Every test recorded in this test run.</p>
          </div>
        </div>
        <DashboardTestTable
          :tests="charts.tests"
          :loading="loading"
          :costs-visible="costsVisible"
          empty-message="No tests were recorded for this test run"
          @select="openTest"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import DashboardTestTable from '../components/DashboardTestTable.vue'
import BugRow from '../components/BugRow.vue'
import { useCostVisibility } from '../composables/useCostVisibility'
import {
  displayedOutcomeCounts, filterQueryValues, filters, hydrateFilters, syncQueryParams, useWorkflowValidation,
  formatBuildId, formatUsd, formatPercent
} from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const FILTER_KEYS = ['version', 'testSuite', 'invocationId', 'datePreset', 'dateFrom', 'dateTo']
hydrateFilters(nav?.params?.value, FILTER_KEYS)
const { getOverview, getCharts } = useWorkflowValidation()
const costsVisible = useCostVisibility()

const loading = ref(false)
const unreachable = ref('')
const selectedSuiteExecution = ref(null)
const overview = reactive({
  runs: { total: 0, passRate: null, passed: 0, failed: 0, aiCost: null, infraCost: null, suiteDuration: null, version: null, rhodsOperatorDigest: null },
  bugs: { total: 0, opened: 0, distinctJira: 0 }
})
const charts = reactive({ tests: [], newProductBugs: [], knownProductBugs: [] })
const outcomeCounts = computed(() => displayedOutcomeCounts(charts.tests))
const dashboardPassRate = computed(() => charts.tests.length ? outcomeCounts.value.pass / charts.tests.length : null)
const buildDigest = computed(() => {
  const digest = selectedSuiteExecution.value?.rhodsOperatorDigest || overview.runs.rhodsOperatorDigest
  return digest && digest.toLowerCase() !== 'unknown' ? digest : null
})

function passTone(rate) { if (rate == null) return 'neutral'; return rate >= 0.9 ? 'green' : rate >= 0.7 ? 'amber' : 'red' }
function openTest(test) { nav.navigateTo('run-detail', { runKey: test.execution_id || test.id }) }

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
    syncQueryParams(nav, filterQueryValues(FILTER_KEYS))
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

</script>
