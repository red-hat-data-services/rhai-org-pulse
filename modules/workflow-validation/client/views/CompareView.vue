<template>
  <div>
    <div class="mb-4">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Run Comparison</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Diff two CI runs to spot fixed and regressed workflows between releases.</p>
    </div>

    <div v-if="unreachable" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-10 text-center">
      <ServerCrashIcon :size="28" class="mx-auto mb-3 text-amber-500" />
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">OpenSearch is unreachable</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">{{ unreachable }}</p>
    </div>

    <template v-else>
      <!-- Run selectors -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Baseline (A)</label>
            <select v-model="selA" :class="inputClass" @change="compare">
              <option v-for="c in ciRuns" :key="c.runId" :value="c.runId">{{ ciLabel(c) }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">Target (B)</label>
            <select v-model="selB" :class="inputClass" @change="compare">
              <option v-for="c in ciRuns" :key="c.runId" :value="c.runId">{{ ciLabel(c) }}</option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-10 text-gray-400 dark:text-gray-500">Comparing…</div>

      <template v-else-if="result">
        <!-- Tally -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <MetricCard :value="result.tally.fixed || 0" label="Fixed" tone="green" />
          <MetricCard :value="result.tally.regressed || 0" label="Regressed" tone="red" />
          <MetricCard :value="(result.tally['same-pass'] || 0)" label="Still Passing" tone="green" />
          <MetricCard :value="(result.tally['same-fail'] || 0)" label="Still Failing" tone="amber" />
          <MetricCard :value="(result.tally.added || 0) + (result.tally.removed || 0)" label="Added / Removed" />
        </div>

        <!-- Diff table -->
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 overflow-hidden">
          <div class="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60 px-6 py-3 font-semibold">
            <span>Workflow</span>
            <span class="w-24 text-center">A · {{ result.a.version || '?' }}</span>
            <span class="w-24 text-center">B · {{ result.b.version || '?' }}</span>
            <span class="w-28 text-right">Change</span>
          </div>
          <div
            v-for="row in sortedRows"
            :key="row.workflow"
            class="grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center px-6 py-3 border-b border-gray-50 dark:border-gray-700/40 border-l-4"
            :class="rowAccent(row.change)"
          >
            <span class="text-sm font-medium text-gray-800 dark:text-gray-200 pr-3">{{ row.workflow }}</span>
            <span class="w-24 flex justify-center"><StatusBadge v-if="row.a" :value="row.a" /><span v-else class="text-gray-300 dark:text-gray-600 text-xs">—</span></span>
            <span class="w-24 flex justify-center"><StatusBadge v-if="row.b" :value="row.b" /><span v-else class="text-gray-300 dark:text-gray-600 text-xs">—</span></span>
            <span class="w-28 text-right">
              <span class="inline-block px-2 py-0.5 rounded-full text-[0.7rem] font-semibold" :class="changeBadge(row.change)">{{ changeLabel(row.change) }}</span>
            </span>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ServerCrash as ServerCrashIcon } from 'lucide-vue-next'
import MetricCard from '../components/MetricCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { useWorkflowValidation, formatPercent } from '../composables/useWorkflowValidation'

const { getCiRuns, getCompare } = useWorkflowValidation()

const inputClass = 'w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/40'

const ciRuns = ref([])
const selA = ref('')
const selB = ref('')
const result = ref(null)
const loading = ref(false)
const unreachable = ref('')

// Order: fixed and regressed first (the interesting changes), then the rest.
const ORDER = { regressed: 0, fixed: 1, added: 2, removed: 3, 'same-fail': 4, changed: 5, 'same-pass': 6 }
const sortedRows = computed(() =>
  result.value ? [...result.value.rows].sort((a, b) => (ORDER[a.change] ?? 9) - (ORDER[b.change] ?? 9) || a.workflow.localeCompare(b.workflow)) : []
)

function ciLabel(c) {
  const d = c.timestamp ? new Date(c.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  return `${c.version || c.runId} · ${d} · ${c.workflows} wf · ${formatPercent(c.passRate)}`
}

function rowAccent(change) {
  return {
    fixed: 'border-green-500', regressed: 'border-red-500',
    'same-pass': 'border-green-200 dark:border-green-900/50', 'same-fail': 'border-amber-400',
    added: 'border-blue-400', removed: 'border-gray-300 dark:border-gray-600', changed: 'border-purple-400'
  }[change] || 'border-gray-200 dark:border-gray-700'
}
function changeBadge(change) {
  return {
    fixed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    regressed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    'same-pass': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    'same-fail': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    added: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    removed: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    changed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
  }[change] || 'bg-gray-100 text-gray-600'
}
function changeLabel(change) {
  return { 'same-pass': 'Unchanged', 'same-fail': 'Still failing', fixed: 'Fixed', regressed: 'Regressed', added: 'Added', removed: 'Removed', changed: 'Changed' }[change] || change
}

async function compare() {
  if (!selA.value || !selB.value) return
  loading.value = true
  try {
    result.value = await getCompare(selA.value, selB.value)
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') unreachable.value = err.data?.error || err.message
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const data = await getCiRuns()
    ciRuns.value = data.ciRuns
    if (ciRuns.value.length >= 2) {
      selB.value = ciRuns.value[0].runId          // newest = target
      selA.value = ciRuns.value[1].runId          // previous = baseline
      await compare()
    } else if (ciRuns.value.length === 1) {
      selA.value = selB.value = ciRuns.value[0].runId
      await compare()
    }
  } catch (err) {
    if (err.status === 503 || err.data?.code === 'OS_UNREACHABLE') unreachable.value = err.data?.error || err.message
    else unreachable.value = err.message || 'Failed to load CI runs'
  }
})
</script>
