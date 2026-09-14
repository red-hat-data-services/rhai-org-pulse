<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Test Results</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Individual test executions, newest first. Filter results or select one for task and defect details.</p>
    </div>

    <FilterBar search-placeholder="Search test names…" @change="reload" />

    <!-- Active workflow chip (set from Overview drill-down) -->
    <div v-if="filters.workflow" class="mb-4 flex items-center gap-2">
      <span class="text-xs text-gray-500 dark:text-gray-400">Test:</span>
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-100 dark:border-red-800">
        {{ filters.workflow }}
        <button class="hover:text-red-900 dark:hover:text-red-100" @click="clearWorkflow">
          <XIcon :size="13" />
        </button>
      </span>
    </div>

    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
    </div>

    <template v-else>
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
                <th class="px-5 py-3 font-semibold"><button @click="setSort('verdict')">Verdict {{ sortMark('verdict') }}</button></th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('workflow')">Test {{ sortMark('workflow') }}</button></th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('version')">Version {{ sortMark('version') }}</button></th>
                <th class="px-4 py-3 font-semibold text-right"><button @click="setSort('tasks')">Tasks {{ sortMark('tasks') }}</button></th>
                <th v-if="costsVisible" class="px-4 py-3 font-semibold text-right">AI Cost</th>
                <th class="px-4 py-3 font-semibold text-right"><button @click="setSort('duration')">Duration {{ sortMark('duration') }}</button></th>
                <th class="px-4 py-3 font-semibold min-w-72">Product bug</th>
                <th class="px-4 py-3 font-semibold"><button @click="setSort('timestamp')">When {{ sortMark('timestamp') }}</button></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td :colspan="costsVisible ? 8 : 7" class="px-5 py-10 text-center text-gray-400 dark:text-gray-500">Loading tests…</td>
              </tr>
              <tr
                v-for="r in runs"
                v-else
                :key="r.id"
                class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                @click="openRun(r)"
              >
                <td class="px-5 py-3"><StatusBadge :value="r.verdict" /></td>
                <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{{ r.workflow_label || r.workflow || 'Unknown test' }}</td>
                <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{{ r.rhoai_version }}</td>
                <td class="px-4 py-3 text-right font-mono text-xs text-gray-600 dark:text-gray-300">
                  {{ formatRatio(r.tasks_passed, r.tasks_total) }}
                </td>
                <td v-if="costsVisible" class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatUsd(r.cost_usd) }}</td>
                <td class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatDuration(r.duration_s) }}</td>
                <td class="px-4 py-3"><ProductBugStatus :findings="r.productBugs" :verdict="r.verdict" /></td>
                <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(r.timestamp) }}</td>
              </tr>
              <tr v-if="!loading && !runs.length">
                <td :colspan="costsVisible ? 8 : 7" class="px-5 py-10 text-center text-gray-400 dark:text-gray-500">No tests match the current filters</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700/60 text-sm">
          <span class="text-gray-500 dark:text-gray-400">
            Showing {{ runs.length }} of {{ total }}
          </span>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="!cursorHistory.length || loading" @click="previous">Prev</button>
            <button class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="!nextCursor || loading" @click="next">Next</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { inject, onMounted, ref } from 'vue'
import { ServerCrash as ServerCrashIcon, X as XIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import StatusBadge from '../components/StatusBadge.vue'
import ProductBugStatus from '../components/ProductBugStatus.vue'
import { useCostVisibility } from '../composables/useCostVisibility'
import {
  filters, useWorkflowValidation, formatUsd, formatDuration, formatDate, formatRatio
} from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getRuns } = useWorkflowValidation()
const costsVisible = useCostVisibility()

const runs = ref([])
const total = ref(0)
const size = ref(25)
const cursor = ref('')
const nextCursor = ref(null)
const cursorHistory = ref([])
const loading = ref(false)
const unreachable = ref('')
const sortBy = ref('timestamp')
const sortDir = ref('desc')

async function load() {
  loading.value = true
  unreachable.value = ''
  try {
    const data = await getRuns(cursor.value, size.value, { sortBy: sortBy.value, sortDir: sortDir.value })
    runs.value = data.runs
    total.value = data.total
    nextCursor.value = data.nextCursor
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load tests'
    }
  } finally {
    loading.value = false
  }
}

function reload() { cursor.value = ''; cursorHistory.value = []; load() }
function next() { cursorHistory.value.push(cursor.value); cursor.value = nextCursor.value; load() }
function previous() { cursor.value = cursorHistory.value.pop() || ''; load() }
function clearWorkflow() { filters.workflow = ''; reload() }
function openRun(r) { nav.navigateTo('run-detail', { runKey: r.execution_id || r.id }) }
function setSort(column) {
  sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'
  sortBy.value = column
  reload()
}
function sortMark(column) { return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : '' }

onMounted(() => {
  const params = nav?.params?.value || {}
  if (Object.prototype.hasOwnProperty.call(params, 'workflow')) filters.workflow = params.workflow
  if (Object.prototype.hasOwnProperty.call(params, 'version')) filters.version = params.version
  if (Object.prototype.hasOwnProperty.call(params, 'verdict')) filters.verdict = params.verdict
  filters.q = Object.prototype.hasOwnProperty.call(params, 'q') ? params.q : ''
  load()
})
</script>
