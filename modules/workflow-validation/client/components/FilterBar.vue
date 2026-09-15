<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-3 mb-6">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <FilterIcon :size="16" class="text-gray-400" />
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Filters</span>
      </div>

      <select v-if="!showTestSuite || !filters.testSuite" v-model="filters.version" :class="inputClass" @change="changeVersion">
        <option value="">All versions</option>
        <option v-for="v in options.versions" :key="v.value" :value="v.value">
          {{ v.value }} ({{ v.count }})
        </option>
      </select>

      <select v-if="showTestSuite" v-model="filters.testSuite" aria-label="Test suite" :class="inputClass" @change="changeTestSuite">
        <option value="">All test suites</option>
        <option v-for="suite in options.testSuites" :key="suite.value" :value="suite.value">
          {{ formatSuiteName(suite.value) }}
        </option>
      </select>

      <select
        v-if="showTestSuite && filters.testSuite"
        v-model="filters.invocationId"
        aria-label="Suite execution"
        :class="inputClass"
        :disabled="loadingSuiteExecutions"
        @change="emitChange"
      >
        <option v-if="loadingSuiteExecutions" value="">Loading executions…</option>
        <option v-for="execution in suiteExecutions" :key="execution.invocationId" :value="execution.invocationId">
          {{ suiteExecutionLabel(execution) }}
        </option>
      </select>

      <select v-if="showTest" v-model="filters.workflow" aria-label="Test" :class="inputClass" @change="emitChange">
        <option value="">All tests</option>
        <option v-for="workflow in options.workflows" :key="workflow.value" :value="workflow.value">
          {{ workflow.label }}
        </option>
      </select>

      <select v-if="showVerdict" v-model="filters.verdict" aria-label="Verdict" :class="inputClass" @change="emitChange">
        <option value="">Any verdict</option>
        <option value="UNSUCCESSFUL">Failed or error</option>
        <option value="PASS">Pass</option>
        <option value="FAIL">Fail</option>
        <option value="ERROR">Error</option>
      </select>

      <select v-if="!showTestSuite || !filters.testSuite" v-model="filters.datePreset" aria-label="Date range" :class="inputClass" @change="applyDatePreset">
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="all">All time</option>
        <option value="custom">Custom dates</option>
      </select>

      <input
        v-if="!showTestSuite || !filters.testSuite"
        v-model="filters.dateFrom"
        type="date"
        aria-label="Start date"
        :max="filters.dateTo || undefined"
        :class="inputClass"
        @change="useCustomDates"
      />
      <span v-if="!showTestSuite || !filters.testSuite" class="text-xs text-gray-400">to</span>
      <input
        v-if="!showTestSuite || !filters.testSuite"
        v-model="filters.dateTo"
        type="date"
        aria-label="End date"
        :min="filters.dateFrom || undefined"
        :class="inputClass"
        @change="useCustomDates"
      />

      <div v-if="showSearch" class="relative flex-1 min-w-[160px]">
        <SearchIcon :size="15" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="filters.q"
          type="text"
          :aria-label="searchPlaceholder"
          :placeholder="searchPlaceholder"
          :class="[inputClass, 'pl-8 w-full']"
          @keyup.enter="emitChange"
        />
      </div>

      <button
        v-if="hasActive"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1"
        @click="clear"
      >
        Clear
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, ref } from 'vue'
import { Filter as FilterIcon, Search as SearchIcon } from 'lucide-vue-next'
import { defaultDateRange, filters, formatBuildId, formatDate, formatSuiteName, resetFilters, useWorkflowValidation } from '../composables/useWorkflowValidation'

const emit = defineEmits(['change'])
const nav = inject('moduleNav', null)
const { showVerdict, showTest, showTestSuite, showSearch, searchPlaceholder } = defineProps({
  showVerdict: { type: Boolean, default: true },
  showTest: { type: Boolean, default: false },
  showTestSuite: { type: Boolean, default: false },
  showSearch: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: 'Search…' }
})
const { getFilters, getTestSuites } = useWorkflowValidation()

const inputClass = 'text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40'

const options = ref({ versions: [], providers: [], models: [], workflows: [], testSuites: [] })
const suiteExecutions = ref([])
const loadingSuiteExecutions = ref(false)
const generalVersion = ref('')

const hasActive = computed(() =>
  filters.version || (showTest && filters.workflow) || (showTestSuite && filters.testSuite) || (showVerdict && filters.verdict) || (showSearch && filters.q) || filters.dateFrom || filters.dateTo
)

function suiteExecutionLabel(execution) {
  const details = [execution.rhoaiVersion, formatBuildId(execution.rhodsOperatorDigest)].filter((value) => value && value !== 'Unknown')
  return `${formatDate(execution.timestamp)}${details.length ? ` · ${details.join(' · ')}` : ''}`
}

async function loadSuiteExecutions() {
  if (!filters.testSuite) {
    suiteExecutions.value = []
    filters.invocationId = ''
    return
  }
  loadingSuiteExecutions.value = true
  try {
    const response = await getTestSuites({ suite: filters.testSuite })
    suiteExecutions.value = response.rows || []
    if (!suiteExecutions.value.some((row) => row.invocationId === filters.invocationId)) {
      filters.invocationId = suiteExecutions.value[0]?.invocationId || ''
    }
  } finally {
    loadingSuiteExecutions.value = false
  }
}

async function changeTestSuite() {
  if (filters.testSuite) {
    generalVersion.value = filters.version
    filters.version = ''
  } else {
    filters.version = generalVersion.value
  }
  filters.invocationId = ''
  try {
    await loadSuiteExecutions()
  } catch {
    filters.testSuite = ''
    filters.version = generalVersion.value
  }
  emitChange()
}

function emitChange() {
  emit('change')
}

async function changeVersion() {
  emitChange()
}

function applyDatePreset() {
  if (filters.datePreset === 'all') {
    filters.dateFrom = ''
    filters.dateTo = ''
  } else if (filters.datePreset !== 'custom') {
    Object.assign(filters, defaultDateRange(Number(filters.datePreset)))
  }
  emitChange()
}

function useCustomDates() {
  filters.datePreset = 'custom'
  emitChange()
}

function detectDatePreset() {
  if (!filters.dateFrom && !filters.dateTo) return 'all'
  for (const days of [7, 30, 90]) {
    const range = defaultDateRange(days)
    if (filters.dateFrom === range.dateFrom && filters.dateTo === range.dateTo) return String(days)
  }
  return 'custom'
}

function clear() {
  resetFilters()
  filters.datePreset = '90'
  emit('change')
}

onMounted(async () => {
  try {
    options.value = await getFilters()
    if (!Object.prototype.hasOwnProperty.call(nav?.params?.value || {}, 'datePreset')) filters.datePreset = detectDatePreset()
    if (showTestSuite && filters.testSuite) {
      generalVersion.value = filters.version
      filters.version = ''
      await loadSuiteExecutions()
    }
  } catch {
    // filter options are best-effort; the bar still works with free text
  }
})
</script>
