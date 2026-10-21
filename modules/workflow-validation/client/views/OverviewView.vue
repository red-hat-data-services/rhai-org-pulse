<template>
  <div>
    <!-- Header -->
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflow Validation</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Results from one test run against a selected RHOAI release
      </p>
    </div>

    <div v-if="exactRun" class="mb-4 text-sm text-gray-600 dark:text-gray-300">
      <a href="#/workflow-validation/recent-runs" class="font-medium text-primary-700 underline dark:text-primary-300">Recent Runs</a>
      <p class="mt-2 break-all">{{ formatSuiteName(nav.params.value.testSuite) }} · {{ nav.params.value.invocationId }}</p>
    </div>
    <FilterBar
      v-else
      :show-verdict="false"
      :show-search="false"
      show-test-suite
      suite-execution-only
      @change="loadAll"
      @ready="loadAll"
      @suite-execution="selectedSuiteExecution = $event"
    />

    <p v-if="exactRun && loading" role="status" class="mb-4 text-sm text-gray-500 dark:text-gray-400">Loading selected run…</p>
    <div v-if="unreachable" role="alert" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ exactRun ? 'Unable to load the selected run' : 'OpenSearch is unreachable' }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
      <button v-if="exactRun" type="button" class="mt-3 font-medium text-primary-700 underline dark:text-primary-300" @click="loadAll">Retry</button>
      <p v-else class="text-xs text-gray-500 dark:text-gray-500 mt-3">Check the backend OpenSearch endpoint and read-only credentials.</p>
    </div>

    <template v-else-if="!exactRun || hasLoaded">
      <!-- KPI tiles -->
      <div class="flex flex-wrap justify-center gap-4 mb-6 [&>*]:w-[calc(50%-0.5rem)] md:[&>*]:w-[calc(33.333%-0.75rem)] lg:[&>*]:w-[calc(25%-0.75rem)] xl:[&>*]:w-[calc(20%-0.8rem)]">
        <MetricCard :value="charts.tests.length" label="Tests" />
        <MetricCard :value="outcomeCounts.pass" label="Passed" tone="green" />
        <MetricCard :value="outcomeCounts.fail" label="Failed" tone="red" />
        <MetricCard :value="outcomeCounts.skip" label="Skipped" tone="amber" />
        <MetricCard :value="formatPercent(dashboardPassRate)" label="Pass Rate"
          :tone="passTone(dashboardPassRate)" />
        <MetricCard :value="selectedSuiteExecution?.rhoaiVersion || overview.runs.version || (exactRun ? nav.params.value.version : filters.version) || 'Unknown'" label="Version" />
        <MetricCard
          v-if="buildDigest"
          :value="formatBuildId(buildDigest)"
          label="RHODS Image"
          sub="Build ID"
          :title="buildDigest"
        />
        <MetricCard :value="visibleNewProductBugs.length" label="Issues Opened" tone="red" />
        <MetricCard :value="visibleKnownProductBugs.length" label="Existing Issues Encountered" tone="amber" />
        <MetricCard v-if="costsVisible" :value="formatUsd(overview.runs.aiCost)" label="AI Cost" tone="teal" />
        <MetricCard v-if="costsVisible" :value="formatUsd(overview.runs.infraCost)" label="Infra Cost" tone="teal" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">New Product and UX Issues Opened</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Product bugs and UX defects first reported and filed as new Jira issues during this test run.</p>
          </div>
          <div v-if="visibleNewProductBugs.length" class="divide-y divide-gray-100 dark:divide-gray-700/60">
            <BugRow v-for="bug in visibleNewProductBugs" :key="bug.id" :bug="bug" />
          </div>
          <p v-else class="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No new product or UX issues were opened during this test run.</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Known Product and UX Issues Encountered</h3>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Previously reported product bugs and UX defects encountered again during this test run; no new Jira issue was opened.</p>
          </div>
          <div v-if="visibleKnownProductBugs.length" class="divide-y divide-gray-100 dark:divide-gray-700/60">
            <BugRow v-for="bug in visibleKnownProductBugs" :key="bug.id" :bug="bug" />
          </div>
          <p v-else class="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No known product or UX issues were encountered during this test run.</p>
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
import { computed, inject, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import DashboardTestTable from '../components/DashboardTestTable.vue'
import BugRow from '../components/BugRow.vue'
import { isVisibleProductBug } from '../utils/product-bugs'
import { useCostVisibility } from '../composables/useCostVisibility'
import {
  displayedOutcomeCounts, filterQueryValues, filters, hydrateFilters, syncQueryParams, useWorkflowValidation,
  formatBuildId, formatSuiteName, formatUsd, formatPercent
} from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const FILTER_KEYS = ['version', 'testSuite', 'invocationId', 'datePreset', 'dateFrom', 'dateTo']
if (nav?.params?.value?.exactRun !== '1') hydrateFilters(nav?.params?.value, FILTER_KEYS)
const { getOverview, getCharts, getTestSuite } = useWorkflowValidation()
const exactRun = computed(() => nav?.params?.value?.exactRun === '1')
const costsVisible = useCostVisibility()

const loading = ref(false)
const hasLoaded = ref(false)
let requestId = 0
const unreachable = ref('')
const selectedSuiteExecution = ref(null)
const overview = reactive({
  runs: { total: 0, passRate: null, passed: 0, failed: 0, aiCost: null, infraCost: null, suiteDuration: null, version: null, rhodsOperatorDigest: null },
  bugs: { total: 0, opened: 0, distinctJira: 0 }
})
const charts = reactive({ tests: [], newProductBugs: [], knownProductBugs: [] })
const visibleNewProductBugs = computed(() => charts.newProductBugs.filter(isVisibleProductBug))
const visibleKnownProductBugs = computed(() => charts.knownProductBugs.filter(isVisibleProductBug))
const outcomeCounts = computed(() => displayedOutcomeCounts(charts.tests))
const dashboardPassRate = computed(() => charts.tests.length ? outcomeCounts.value.pass / charts.tests.length : null)
const buildDigest = computed(() => {
  const digest = selectedSuiteExecution.value?.rhodsOperatorDigest || overview.runs.rhodsOperatorDigest
  return digest && digest.toLowerCase() !== 'unknown' ? digest : null
})

function passTone(rate) { if (rate == null) return 'neutral'; return rate >= 0.9 ? 'green' : rate >= 0.7 ? 'amber' : 'red' }
function openTest(test) { nav.navigateTo('run-detail', { runKey: test.execution_id || test.id }) }

async function loadAll() {
  const id = ++requestId
  loading.value = true
  hasLoaded.value = false
  unreachable.value = ''
  try {
    const suiteScoped = Boolean(filters.testSuite)
    const dashboardScope = {
      verdict: '', q: '',
      ...(suiteScoped ? { dateFrom: '', dateTo: '' } : {}),
      ...(exactRun.value ? {
        version: nav.params.value.version || '',
        testSuite: nav.params.value.testSuite || '',
        invocationId: nav.params.value.invocationId || '',
        dateFrom: '', dateTo: ''
      } : {})
    }
    if (exactRun.value) {
      if (!dashboardScope.testSuite || !dashboardScope.invocationId) throw new Error('The run link is incomplete.')
      const execution = await getTestSuite(dashboardScope.testSuite, dashboardScope.invocationId)
      if (id !== requestId) return
      selectedSuiteExecution.value = execution
    }
    const [ov, ch] = await Promise.all([getOverview(dashboardScope), getCharts(dashboardScope)])
    if (id !== requestId) return
    Object.assign(overview, ov)
    Object.assign(charts, ch)
    hasLoaded.value = true
    if (!exactRun.value) syncQueryParams(nav, filterQueryValues(FILTER_KEYS))
  } catch (err) {
    if (id !== requestId) return
    if (exactRun.value && err.status === 404) {
      unreachable.value = 'This run is no longer available. Select another run from Recent Runs.'
    } else if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load data'
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(() => [nav?.params?.value?.exactRun, nav?.params?.value?.testSuite, nav?.params?.value?.invocationId, nav?.params?.value?.version], () => {
  if (exactRun.value) loadAll()
}, { immediate: true })
onBeforeUnmount(() => { requestId += 1 })
</script>
