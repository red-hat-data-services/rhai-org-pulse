<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Test Trends</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Results grouped by test. Select a test to view its execution history and trends.</p>
    </div>

    <FilterBar :show-verdict="false" search-placeholder="Search test names…" @change="load" />

    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
    </div>

    <template v-else>
      <!-- Tag chip filter bar -->
      <div v-if="tags.length" class="flex flex-wrap items-center gap-2 mb-5">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mr-1">Tags</span>
        <button
          class="px-3 py-1 rounded-full text-xs font-medium border transition"
          :class="!activeTag ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300'"
          @click="selectTag('')"
        >All</button>
        <button
          v-for="t in tags"
          :key="t.tag"
          class="px-3 py-1 rounded-full text-xs font-medium border transition"
          :class="activeTag === t.tag ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300'"
          @click="selectTag(activeTag === t.tag ? '' : t.tag)"
        >{{ t.tag }} <span class="opacity-60">{{ t.count }}</span></button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                <th class="px-5 py-3 font-semibold"><button @click="setSort('workflowLabel')">Test {{ sortMark('workflowLabel') }}</button></th>
                <th class="px-4 py-3 font-semibold min-w-52"><button @click="setSort('passRate')">Pass rate {{ sortMark('passRate') }}</button></th>
                <th class="px-4 py-3 font-semibold text-right"><button @click="setSort('runs')">Executions {{ sortMark('runs') }}</button></th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('latestVerdict')">Latest result {{ sortMark('latestVerdict') }}</button></th>
                <th v-if="costsVisible" class="px-4 py-3 font-semibold text-right">AI cost</th>
                <th class="px-4 py-3 font-semibold min-w-72">Product bugs observed</th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('latestVersion')">Latest version {{ sortMark('latestVersion') }}</button></th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('latestTimestamp')">Last executed {{ sortMark('latestTimestamp') }}</button></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td :colspan="costsVisible ? 8 : 7" class="px-5 py-10 text-center text-gray-400 dark:text-gray-500">Loading test trends…</td>
              </tr>
              <tr
                v-for="w in filteredWorkflows"
                v-else
                :key="w.workflow"
                tabindex="0"
                class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                @click="openHistory(w)"
                @keydown.enter="openHistory(w)"
              >
                <td class="px-5 py-3 font-medium text-gray-800 dark:text-gray-200">{{ w.workflowLabel || w.workflow }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-32 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
                      <div class="h-full rounded-full" :class="barColor(w.passRate)" :style="{ width: pct(w.passRate) }"></div>
                    </div>
                    <span class="font-mono text-xs text-gray-600 dark:text-gray-300">{{ formatPercent(w.passRate) }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ w.runs }}</td>
                <td class="px-4 py-3"><StatusBadge :value="w.latestVerdict" /></td>
                <td v-if="costsVisible" class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatUsd(w.aiCost) }}</td>
                <td class="px-4 py-3"><ProductBugStatus :findings="w.productBugs" /></td>
                <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{{ w.latestVersion || '—' }}</td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(w.latestTimestamp) }}</td>
              </tr>
              <tr v-if="!loading && !filteredWorkflows.length">
                <td :colspan="costsVisible ? 8 : 7" class="px-5 py-10 text-center text-gray-400 dark:text-gray-500">No tests match the current filters</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import ProductBugStatus from '../components/ProductBugStatus.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useCostVisibility } from '../composables/useCostVisibility'
import { compareTableValues, filterQueryValues, filters, hydrateFilters, syncQueryParams, useWorkflowValidation, formatUsd, formatPercent, formatDate } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const FILTER_KEYS = ['version', 'q', 'datePreset', 'dateFrom', 'dateTo']
hydrateFilters(nav?.params?.value, FILTER_KEYS)
const { getWorkflows } = useWorkflowValidation()
const costsVisible = useCostVisibility()

const workflows = ref([])
const tags = ref([])
const activeTag = ref(nav?.params?.value?.tag || '')
const loading = ref(false)
const unreachable = ref('')
const sortBy = ref('latestTimestamp')
const sortDir = ref('desc')

const filteredWorkflows = computed(() =>
  (activeTag.value ? workflows.value.filter((w) => (w.tags || []).includes(activeTag.value)) : workflows.value)
    .slice()
    .sort((a, b) => compareTableValues(a[sortBy.value], b[sortBy.value], sortDir.value))
)

function pct(rate) { return (rate == null ? 0 : Math.round(rate * 100)) + '%' }
function barColor(rate) {
  if (rate == null) return 'bg-gray-400'
  return rate >= 0.9 ? 'bg-green-500' : rate >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
}
function openHistory(w) {
  nav.navigateTo('workflow-history', {
    workflow: w.workflow,
    version: filters.version,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo
  })
}
function selectTag(tag) {
  activeTag.value = tag
  syncQueryParams(nav, { ...filterQueryValues(FILTER_KEYS), tag: activeTag.value })
}
function setSort(column) {
  sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'
  sortBy.value = column
}
function sortMark(column) { return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : '' }

async function load() {
  loading.value = true
  unreachable.value = ''
  try {
    const data = await getWorkflows({ verdict: '' })
    workflows.value = data.workflows
    tags.value = data.tags
    syncQueryParams(nav, { ...filterQueryValues(FILTER_KEYS), tag: activeTag.value })
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load test trends'
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
