<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Workflows</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Every validated workflow with its pass rate and latest result. Click for full history.</p>
    </div>

    <FilterBar @change="load" />

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
          @click="activeTag = ''"
        >All</button>
        <button
          v-for="t in tags"
          :key="t.tag"
          class="px-3 py-1 rounded-full text-xs font-medium border transition"
          :class="activeTag === t.tag ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300'"
          @click="activeTag = activeTag === t.tag ? '' : t.tag"
        >{{ t.tag }} <span class="opacity-60">{{ t.count }}</span></button>
      </div>

      <div v-if="loading" class="text-center py-10 text-gray-400 dark:text-gray-500">Loading workflows…</div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <button
          v-for="w in filteredWorkflows"
          :key="w.workflow"
          class="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition"
          @click="openHistory(w)"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">{{ w.workflow }}</h3>
            <StatusBadge :value="w.latestVerdict" />
          </div>

          <div class="flex items-center gap-2 mb-3">
            <div class="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div class="h-full rounded-full" :class="barColor(w.passRate)" :style="{ width: pct(w.passRate) }"></div>
            </div>
            <span class="font-mono text-xs text-gray-600 dark:text-gray-300 w-10 text-right">{{ formatPercent(w.passRate) }}</span>
          </div>

          <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ w.runs }} run{{ w.runs === 1 ? '' : 's' }}</span>
            <span>{{ formatUsd(w.aiCost) }} AI</span>
            <span>{{ formatDuration(w.avgDuration) }} avg</span>
            <span v-if="w.bugs" class="text-red-600 dark:text-red-400 font-medium">{{ w.bugs }} bug{{ w.bugs === 1 ? '' : 's' }}</span>
            <span v-if="w.latestVersion" class="ml-auto font-mono">latest {{ w.latestVersion }}</span>
          </div>
        </button>
      </div>

      <p v-if="!loading && !filteredWorkflows.length" class="text-center py-10 text-gray-400 dark:text-gray-500">No workflows match the current filters</p>
    </template>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import FilterBar from '../components/FilterBar.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useWorkflowValidation, formatUsd, formatDuration, formatPercent } from '../composables/useWorkflowValidation'

const nav = inject('moduleNav')
const { getWorkflows } = useWorkflowValidation()

const workflows = ref([])
const tags = ref([])
const activeTag = ref('')
const loading = ref(false)
const unreachable = ref('')

const filteredWorkflows = computed(() =>
  activeTag.value ? workflows.value.filter((w) => w.tag === activeTag.value) : workflows.value
)

function pct(rate) { return (rate == null ? 0 : Math.round(rate * 100)) + '%' }
function barColor(rate) {
  if (rate == null) return 'bg-gray-400'
  return rate >= 0.9 ? 'bg-green-500' : rate >= 0.7 ? 'bg-amber-500' : 'bg-red-500'
}
function openHistory(w) { nav.navigateTo('workflow-history', { workflow: w.workflow }) }

async function load() {
  loading.value = true
  unreachable.value = ''
  try {
    const data = await getWorkflows()
    workflows.value = data.workflows
    tags.value = data.tags
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') {
      unreachable.value = err.data?.error || err.message
    } else {
      unreachable.value = err.message || 'Failed to load workflows'
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
