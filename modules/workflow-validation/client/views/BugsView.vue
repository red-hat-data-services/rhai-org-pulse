<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Bugs</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Defects surfaced by workflow validation, with JIRA links. Filed = we opened it.</p>
    </div>

    <FilterBar @change="reload" />

    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <MetricCard :value="kpis.total" label="Bug Records" tone="amber" />
        <MetricCard :value="kpis.opened" label="Opened (Filed)" tone="red" />
        <MetricCard :value="kpis.distinctJira" label="Distinct JIRA" tone="teal" />
      </div>

      <!-- Breakdown chips -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4">
          <h3 class="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-3">By Category</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in byCategory"
              :key="c.category"
              class="inline-flex items-center gap-1.5 rounded-full transition"
              :class="filters.category === c.category ? 'ring-2 ring-red-400/50' : ''"
              @click="toggle('category', c.category)"
            >
              <StatusBadge :value="c.category" />
              <span class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ c.count }}</span>
            </button>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4">
          <h3 class="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-3">By Action</h3>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="a in byAction"
              :key="a.action"
              class="inline-flex items-center gap-1.5 rounded-full transition"
              :class="filters.action === a.action ? 'ring-2 ring-red-400/50' : ''"
              @click="toggle('action', a.action)"
            >
              <StatusBadge :value="a.action" />
              <span class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ a.count }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Bug list -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Bug Records</h3>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ total }} total</span>
        </div>
        <div v-if="loading" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">Loading bugs…</div>
        <div v-else-if="bugs.length" class="divide-y divide-gray-50 dark:divide-gray-700/40">
          <BugRow v-for="b in bugs" :key="b.id" :bug="b" />
        </div>
        <p v-else class="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No bugs match the current filters</p>

        <div class="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-gray-700/60 text-sm">
          <span class="text-gray-500 dark:text-gray-400">
            {{ total ? (page * size + 1) : 0 }}–{{ Math.min((page + 1) * size, total) }} of {{ total }}
          </span>
          <div class="flex items-center gap-2">
            <button class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="page === 0 || loading" @click="go(page - 1)">Prev</button>
            <button class="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
              :disabled="(page + 1) * size >= total || loading" @click="go(page + 1)">Next</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import BugRow from '../components/BugRow.vue'
import { filters, useWorkflowValidation } from '../composables/useWorkflowValidation'

const { getBugs } = useWorkflowValidation()

const bugs = ref([])
const total = ref(0)
const page = ref(0)
const size = ref(50)
const loading = ref(false)
const unreachable = ref('')
const kpis = reactive({ total: 0, opened: 0, distinctJira: 0 })
const byCategory = ref([])
const byAction = ref([])

async function load() {
  loading.value = true
  unreachable.value = ''
  try {
    const data = await getBugs(page.value, size.value)
    bugs.value = data.bugs
    total.value = data.total
    Object.assign(kpis, data.kpis)
    byCategory.value = data.byCategory
    byAction.value = data.byAction
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load bugs'
    }
  } finally {
    loading.value = false
  }
}

function reload() { page.value = 0; load() }
function go(p) { page.value = p; load() }
function toggle(field, value) {
  filters[field] = filters[field] === value ? '' : value
  reload()
}

onMounted(load)
</script>
