<template>
  <div class="mb-6 rounded-xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
    <div class="flex flex-wrap items-end gap-3">
      <label :class="labelClass">View By
        <select v-model="filters.jiraScope" aria-label="View By" :class="inputClass" @change="changeScope">
          <option value="suite">Test Suite</option>
          <option value="release">RHOAI Release</option>
          <option value="date">Date Range</option>
          <option value="all">All Bugs</option>
        </select>
      </label>

      <template v-if="filters.jiraScope === 'suite'">
        <label :class="labelClass">Test Suite
          <select v-model="filters.testSuite" aria-label="Test Suite" :class="inputClass" @change="changeSuite">
            <option v-for="suite in options.testSuites" :key="suite.value" :value="suite.value">{{ formatSuiteName(suite.value) }}</option>
          </select>
        </label>
        <label :class="labelClass">Test Run
          <select v-model="filters.invocationId" aria-label="Test Run" :class="inputClass" @change="changeRun">
            <option v-for="run in suiteRuns" :key="run.invocationId" :value="run.invocationId">{{ formatDate(run.timestamp) }}</option>
          </select>
        </label>
      </template>

      <label v-if="filters.jiraScope === 'release'" :class="labelClass">RHOAI Version
        <select v-model="filters.version" aria-label="RHOAI Version" :class="inputClass" @change="emitChange">
          <option v-for="version in options.versions" :key="version.value" :value="version.value">{{ version.value }}</option>
        </select>
      </label>

      <template v-if="filters.jiraScope === 'date'">
        <label :class="labelClass">Date Range
          <select v-model="filters.datePreset" aria-label="Date Range" :class="inputClass" @change="applyDatePreset">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
        <label :class="labelClass">Start Date
          <input v-model="filters.dateFrom" type="date" aria-label="Start Date" :max="filters.dateTo || undefined" :class="inputClass" @change="useCustomDates" />
        </label>
        <label :class="labelClass">End Date
          <input v-model="filters.dateTo" type="date" aria-label="End Date" :min="filters.dateFrom || undefined" :class="inputClass" @change="useCustomDates" />
        </label>
      </template>

      <label :class="labelClass">Test
        <select v-model="filters.workflow" aria-label="Test" :class="inputClass" @change="emitChange">
          <option value="">All tests</option>
          <option v-for="workflow in workflows" :key="workflow.value" :value="workflow.value">{{ workflow.label }}</option>
        </select>
      </label>

      <label class="flex min-w-[240px] flex-1 flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Search
        <span class="relative">
          <SearchIcon :size="15" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input v-model="filters.q" type="text" aria-label="Search Jira keys, tests, components, or bug details…" placeholder="Search Jira keys, tests, components, or bug details…" :class="[inputClass, 'w-full pl-8']" @keyup.enter="emitChange" />
        </span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Search as SearchIcon } from 'lucide-vue-next'
import { defaultDateRange, filters, formatDate, formatSuiteName, highestNumberedVersion, useWorkflowValidation } from '../composables/useWorkflowValidation'

const emit = defineEmits(['change', 'ready'])
const { getFilters, getTestSuite, getTestSuites } = useWorkflowValidation()
const options = ref({ versions: [], workflows: [], testSuites: [] })
const workflows = ref([])
const suiteRuns = ref([])
const inputClass = 'text-sm font-normal rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40'
const labelClass = 'flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400'

function emitChange() { emit('change') }

async function loadSuiteRuns() {
  if (!filters.testSuite) return
  const response = await getTestSuites({ suite: filters.testSuite })
  suiteRuns.value = response.rows || []
  if (!suiteRuns.value.some((run) => run.invocationId === filters.invocationId)) {
    filters.invocationId = suiteRuns.value[0]?.invocationId || ''
  }
  await loadRunTests()
}

async function loadRunTests() {
  if (!filters.testSuite || !filters.invocationId) return
  const response = await getTestSuite(filters.testSuite, filters.invocationId)
  workflows.value = (response.tests || []).map((test) => ({
    value: test.workflow,
    label: test.workflow_label || test.workflow
  })).filter((test, index, rows) => test.value && rows.findIndex((row) => row.value === test.value) === index)
    .sort((a, b) => a.label.localeCompare(b.label))
  if (filters.workflow && !workflows.value.some((workflow) => workflow.value === filters.workflow)) filters.workflow = ''
}

async function changeSuite() {
  filters.invocationId = ''
  await loadSuiteRuns()
  emitChange()
}

async function changeRun() {
  await loadRunTests()
  emitChange()
}

async function changeScope() {
  filters.version = ''
  filters.testSuite = ''
  filters.invocationId = ''
  filters.workflow = ''
  filters.dateFrom = ''
  filters.dateTo = ''
  if (filters.jiraScope === 'suite') {
    filters.testSuite = options.value.testSuites[0]?.value || ''
    await loadSuiteRuns()
  } else {
    workflows.value = options.value.workflows || []
    if (filters.jiraScope === 'release') filters.version = highestNumberedVersion(options.value.versions) || ''
    if (filters.jiraScope === 'date') {
      filters.datePreset = '90'
      Object.assign(filters, defaultDateRange(90))
    }
  }
  emitChange()
}

function applyDatePreset() {
  if (filters.datePreset !== 'custom') Object.assign(filters, defaultDateRange(Number(filters.datePreset)))
  emitChange()
}

function useCustomDates() {
  filters.datePreset = 'custom'
  emitChange()
}

onMounted(async () => {
  const initialScope = filters.jiraScope || (filters.testSuite ? 'suite' : filters.version ? 'release' : filters.dateFrom || filters.dateTo ? 'date' : 'suite')
  options.value = await getFilters()
  workflows.value = options.value.workflows || []
  filters.jiraScope = initialScope
  if (filters.jiraScope === 'suite') {
    filters.version = ''
    filters.dateFrom = ''
    filters.dateTo = ''
    if (!filters.testSuite) filters.testSuite = options.value.testSuites[0]?.value || ''
    await loadSuiteRuns()
  } else if (filters.jiraScope === 'release') {
    filters.testSuite = ''
    filters.invocationId = ''
    filters.dateFrom = ''
    filters.dateTo = ''
    if (!filters.version) filters.version = highestNumberedVersion(options.value.versions) || ''
  } else if (filters.jiraScope === 'date') {
    filters.version = ''
    filters.testSuite = ''
    filters.invocationId = ''
  } else if (filters.jiraScope === 'all') {
    filters.version = ''
    filters.testSuite = ''
    filters.invocationId = ''
    filters.dateFrom = ''
    filters.dateTo = ''
  }
  emit('ready')
})
</script>
