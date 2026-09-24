<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-3 mb-6">
    <div class="flex flex-wrap items-center gap-3">
      <div v-if="suiteExecutionOnly || !showTestSuite || !filters.testSuite" :class="showLabels || suiteExecutionOnly ? 'flex flex-col gap-1' : ''">
        <label v-if="showLabels || suiteExecutionOnly" class="text-xs font-semibold text-gray-500 dark:text-gray-400">RHOAI Version</label>
        <select v-model="filters.version" aria-label="RHOAI Version" :class="inputClass" @change="changeVersion">
          <option value="">All versions</option>
          <option v-for="v in options.versions" :key="v.value" :value="v.value">
            {{ v.value }}<template v-if="!suiteExecutionOnly"> ({{ v.count }})</template>
          </option>
        </select>
      </div>

      <div v-if="showTestSuite" :class="showLabels || suiteExecutionOnly ? 'flex flex-col gap-1' : ''">
        <label v-if="showLabels || suiteExecutionOnly" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Test Suite</label>
        <select v-model="filters.testSuite" :aria-label="showLabels || suiteExecutionOnly ? 'Test Suite' : 'Test run'" :class="inputClass" @change="changeTestSuite">
          <option v-if="!suiteExecutionOnly" value="">All test runs</option>
          <option v-for="suite in options.testSuites" :key="suite.value" :value="suite.value">
            {{ formatSuiteName(suite.value) }}
          </option>
        </select>
      </div>

      <div
        v-if="showTestSuite && filters.testSuite"
        :class="showLabels || suiteExecutionOnly ? 'flex flex-col gap-1' : ''"
      >
        <label v-if="showLabels || suiteExecutionOnly" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Test Run</label>
        <select
          v-model="filters.invocationId"
          :aria-label="showLabels || suiteExecutionOnly ? 'Test Run' : 'Run date'"
          :class="inputClass"
          :disabled="loadingSuiteExecutions"
          @change="changeInvocation"
        >
          <option v-if="loadingSuiteExecutions" value="">Loading executions…</option>
          <option v-for="execution in suiteExecutions" :key="execution.invocationId" :value="execution.invocationId">
            {{ suiteExecutionLabel(execution) }}
          </option>
        </select>
      </div>

      <div v-if="suiteExecutionOnly" class="flex flex-col gap-1">
        <span aria-hidden="true" class="invisible text-xs font-semibold">Action</span>
        <button
          type="button"
          class="text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          :disabled="loadingSuiteExecutions"
          title="Show the newest test run for the latest RHOAI release"
          @click="showLatest"
        >
          Latest
        </button>
      </div>

      <div v-if="showTest" :class="showLabels ? 'flex flex-col gap-1' : ''">
        <label v-if="showLabels" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Test</label>
        <select v-model="filters.workflow" aria-label="Test" :class="inputClass" @change="emitChange">
          <option value="">All tests</option>
          <option v-for="workflow in options.workflows" :key="workflow.value" :value="workflow.value">{{ workflow.label }}</option>
        </select>
      </div>

      <select v-if="showVerdict" v-model="filters.verdict" aria-label="Verdict" :class="inputClass" @change="emitChange">
        <option value="">Any verdict</option>
        <option value="UNSUCCESSFUL">Failed or error</option>
        <option value="PASS">Pass</option>
        <option value="FAIL">Fail</option>
        <option value="ERROR">Error</option>
      </select>

      <div v-if="!suiteExecutionOnly && (!showTestSuite || !filters.testSuite)" :class="showLabels ? 'flex flex-col gap-1' : ''">
        <label v-if="showLabels" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Date Range</label>
        <select v-model="filters.datePreset" aria-label="Date Range" :class="inputClass" @change="applyDatePreset">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
          <option value="custom">Custom dates</option>
        </select>
      </div>

      <div
        v-if="!suiteExecutionOnly && (!showTestSuite || !filters.testSuite)"
        :class="showLabels ? 'flex flex-col gap-1' : ''"
      >
        <label v-if="showLabels" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Start Date</label>
        <input
          v-model="filters.dateFrom"
          type="date"
          aria-label="Start Date"
          :max="filters.dateTo || undefined"
          :class="inputClass"
          @change="useCustomDates"
        />
      </div>
      <span v-if="!suiteExecutionOnly && (!showTestSuite || !filters.testSuite)" :class="['text-xs text-gray-400', showLabels ? 'self-end pb-2' : '']">to</span>
      <div
        v-if="!suiteExecutionOnly && (!showTestSuite || !filters.testSuite)"
        :class="showLabels ? 'flex flex-col gap-1' : ''"
      >
        <label v-if="showLabels" class="text-xs font-semibold text-gray-500 dark:text-gray-400">End Date</label>
        <input
          v-model="filters.dateTo"
          type="date"
          aria-label="End Date"
          :min="filters.dateFrom || undefined"
          :class="inputClass"
          @change="useCustomDates"
        />
      </div>

      <div v-if="showSearch" :class="['flex-1 min-w-[160px]', showLabels ? 'flex flex-col gap-1' : 'relative']">
        <label v-if="showLabels" class="text-xs font-semibold text-gray-500 dark:text-gray-400">Search</label>
        <div class="relative">
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
      </div>

      <button
        v-if="hasActive && !suiteExecutionOnly"
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
import { Search as SearchIcon } from 'lucide-vue-next'
import { defaultDateRange, filters, formatDate, formatSuiteName, highestNumberedVersion, resetFilters, useWorkflowValidation } from '../composables/useWorkflowValidation'

const emit = defineEmits(['change', 'ready', 'suite-execution'])
const nav = inject('moduleNav', null)
const { showVerdict, showLabels, showTest, showTestSuite, suiteExecutionOnly, showSearch, searchPlaceholder } = defineProps({
  showVerdict: { type: Boolean, default: true },
  showLabels: { type: Boolean, default: false },
  showTest: { type: Boolean, default: false },
  showTestSuite: { type: Boolean, default: false },
  suiteExecutionOnly: { type: Boolean, default: false },
  showSearch: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: 'Search…' }
})
const { getFilters, getTestSuite, getTestSuites } = useWorkflowValidation()

const inputClass = 'text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40'

const options = ref({ versions: [], providers: [], models: [], workflows: [], testSuites: [] })
const suiteExecutions = ref([])
const loadingSuiteExecutions = ref(false)
const generalVersion = ref('')
const generalWorkflows = ref([])

const hasActive = computed(() =>
  filters.version || (showTest && filters.workflow) || (showTestSuite && filters.testSuite) || (showVerdict && filters.verdict) || (showSearch && filters.q) || filters.dateFrom || filters.dateTo
)

function suiteExecutionLabel(execution) {
  return formatDate(execution.timestamp)
}

async function loadSuiteExecutions() {
  if (!filters.testSuite) {
    suiteExecutions.value = []
    filters.invocationId = ''
    return
  }
  loadingSuiteExecutions.value = true
  try {
    const response = await getTestSuites({
      suite: filters.testSuite,
      ...(suiteExecutionOnly && filters.version ? { version: filters.version } : {})
    })
    suiteExecutions.value = response.rows || []
    if (!suiteExecutions.value.some((row) => row.invocationId === filters.invocationId)) {
      filters.invocationId = suiteExecutions.value[0]?.invocationId || ''
    }
  } finally {
    loadingSuiteExecutions.value = false
  }
}

async function changeTestSuite() {
  if (!suiteExecutionOnly && filters.testSuite) {
    generalVersion.value = filters.version
    filters.version = ''
  } else if (!suiteExecutionOnly) {
    filters.version = generalVersion.value
  }
  filters.invocationId = ''
  try {
    await loadSuiteExecutions()
    if (suiteExecutionOnly && !suiteExecutions.value.length) await selectLatestSuiteExecution()
    await loadExecutionTests()
  } catch {
    if (!suiteExecutionOnly) {
      filters.testSuite = ''
      filters.version = generalVersion.value
    }
  }
  emitChange()
}

async function changeInvocation() {
  await loadExecutionTests()
  emitChange()
}

async function loadExecutionTests() {
  if (!showTest) return
  if (!filters.testSuite || !filters.invocationId) {
    options.value.workflows = generalWorkflows.value
    return
  }
  const response = await getTestSuite(filters.testSuite, filters.invocationId)
  const workflows = new Map()
  for (const test of response.tests || []) {
    if (test.workflow && !workflows.has(test.workflow)) workflows.set(test.workflow, {
      value: test.workflow,
      label: test.workflow_label || test.workflow
    })
  }
  options.value.workflows = [...workflows.values()].sort((a, b) => a.label.localeCompare(b.label))
  if (filters.workflow && !workflows.has(filters.workflow)) filters.workflow = ''
}

function emitChange() {
  emitSuiteExecution()
  emit('change')
}

function emitSuiteExecution() {
  const execution = suiteExecutions.value.find((row) => row.invocationId === filters.invocationId) || null
  emit('suite-execution', execution)
}

async function changeVersion() {
  if (suiteExecutionOnly) {
    await loadVersionSuites()
    filters.invocationId = ''
    if (options.value.testSuites.some((suite) => suite.value === filters.testSuite)) {
      await loadSuiteExecutions()
    } else {
      await selectLatestSuiteExecution()
    }
  }
  emitChange()
}

async function loadVersionSuites() {
  const response = await getTestSuites({ ...(filters.version ? { version: filters.version } : {}) })
  const counts = new Map()
  for (const row of response.rows || []) counts.set(row.suite, (counts.get(row.suite) || 0) + 1)
  options.value.testSuites = [...counts].map(([value, count]) => ({ value, count }))
  return response.rows || []
}

async function selectLatestSuiteExecution(rows) {
  const availableRows = rows || await loadVersionSuites()
  const latest = availableRows[0]
  filters.testSuite = latest?.suite || ''
  filters.invocationId = latest?.invocationId || ''
  suiteExecutions.value = availableRows.filter((row) => row.suite === filters.testSuite)
}

async function showLatest() {
  filters.version = highestNumberedVersion(options.value.versions) || ''
  filters.testSuite = ''
  filters.invocationId = ''
  loadingSuiteExecutions.value = true
  try {
    await selectLatestSuiteExecution(await loadVersionSuites())
  } finally {
    loadingSuiteExecutions.value = false
  }
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
    generalWorkflows.value = options.value.workflows || []
    if (suiteExecutionOnly && !filters.version) filters.version = highestNumberedVersion(options.value.versions) || ''
    if (!Object.prototype.hasOwnProperty.call(nav?.params?.value || {}, 'datePreset')) filters.datePreset = detectDatePreset()
    if (suiteExecutionOnly) {
      const rows = await loadVersionSuites()
      if (!options.value.testSuites.some((suite) => suite.value === filters.testSuite)) {
        await selectLatestSuiteExecution(rows)
      } else {
        await loadSuiteExecutions()
      }
      await loadExecutionTests()
    } else if (showTestSuite && filters.testSuite) {
      generalVersion.value = filters.version
      if (!suiteExecutionOnly) filters.version = ''
      await loadSuiteExecutions()
      await loadExecutionTests()
    }
  } catch {
    // filter options are best-effort; the bar still works with free text
  } finally {
    emitSuiteExecution()
    emit('ready')
  }
})
</script>
