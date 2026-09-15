<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Jira</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Product bug occurrences observed by workflow validation and their linked Jira issues.
      </p>
    </div>

    <FilterBar :show-verdict="false" show-test search-placeholder="Search Jira keys, tests, components, or bug details…" @change="reload" />

    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard :value="kpis.total" label="Product Bug Occurrences" tone="amber" />
        <MetricCard :value="kpis.opened" label="New Jira Issues" tone="red" />
        <MetricCard :value="kpis.distinctJira" label="Distinct Jira Issues" tone="teal" />
        <MetricCard :value="existingCount" label="Existing Bug Occurrences" tone="neutral" />
      </div>

      <!-- Activity feed -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Product Bug Occurrences</h3>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ total }} records</span>
        </div>
        <div v-if="loading" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">Loading product bugs…</div>
        <div v-else-if="bugs.length" class="divide-y divide-gray-50 dark:divide-gray-700/40">
          <BugRow v-for="b in bugs" :key="b.id" :bug="b" @open-test="openTest" />
        </div>
        <p v-else class="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No product bugs match the current filters</p>

        <div class="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-700/60 text-sm">
          <span class="text-gray-500 dark:text-gray-400">
            Showing {{ bugs.length }} of {{ total }}
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
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import BugRow from '../components/BugRow.vue'
import { filterQueryValues, filters, hydrateFilters, syncQueryParams, useWorkflowValidation } from '../composables/useWorkflowValidation'

const { getBugs } = useWorkflowValidation()
const nav = inject('moduleNav')
const FILTER_KEYS = ['version', 'workflow', 'q', 'datePreset', 'dateFrom', 'dateTo']
hydrateFilters(nav?.params?.value, FILTER_KEYS)

const bugs = ref([])
const total = ref(0)
const size = ref(50)
const cursor = ref('')
const nextCursor = ref(null)
const cursorHistory = ref([])
const loading = ref(false)
const unreachable = ref('')
const kpis = reactive({ total: 0, opened: 0, distinctJira: 0 })
const byAction = ref([])

const existingCount = computed(() => byAction.value
  .filter((item) => ['EXISTING', 'MATCH'].includes(item.action))
  .reduce((total, item) => total + item.count, 0))

async function load() {
  filters.category = 'PRODUCT_BUG'
  filters.action = ''
  filters.verdict = ''
  loading.value = true
  unreachable.value = ''
  try {
    const data = await getBugs(cursor.value, size.value)
    bugs.value = data.bugs
    total.value = data.total
    nextCursor.value = data.nextCursor
    Object.assign(kpis, data.kpis)
    byAction.value = data.byAction
    syncQueryParams(nav, filterQueryValues(FILTER_KEYS))
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load product bugs'
    }
  } finally {
    loading.value = false
  }
}

function reload() { cursor.value = ''; cursorHistory.value = []; load() }
function openTest(executionId) { nav.navigateTo('run-detail', { runKey: executionId }) }
function next() { cursorHistory.value.push(cursor.value); cursor.value = nextCursor.value; load() }
function previous() { cursor.value = cursorHistory.value.pop() || ''; load() }
onMounted(load)
</script>
