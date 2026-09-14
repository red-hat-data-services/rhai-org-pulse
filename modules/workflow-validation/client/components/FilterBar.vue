<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-3 mb-6">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <FilterIcon :size="16" class="text-gray-400" />
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Filters</span>
      </div>

      <select v-model="filters.version" :class="inputClass" @change="emitChange">
        <option value="">All versions</option>
        <option v-for="v in options.versions" :key="v.value" :value="v.value">
          {{ v.value }} ({{ v.count }})
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

      <select v-model="datePreset" aria-label="Date range" :class="inputClass" @change="applyDatePreset">
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 90 days</option>
        <option value="all">All time</option>
        <option value="custom">Custom dates</option>
      </select>

      <input
        v-model="filters.dateFrom"
        type="date"
        aria-label="Start date"
        :max="filters.dateTo || undefined"
        :class="inputClass"
        @change="useCustomDates"
      />
      <span class="text-xs text-gray-400">to</span>
      <input
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
import { computed, onMounted, ref } from 'vue'
import { Filter as FilterIcon, Search as SearchIcon } from 'lucide-vue-next'
import { defaultDateRange, filters, resetFilters, useWorkflowValidation } from '../composables/useWorkflowValidation'

const emit = defineEmits(['change'])
const { showVerdict, showTest, showSearch, searchPlaceholder } = defineProps({
  showVerdict: { type: Boolean, default: true },
  showTest: { type: Boolean, default: false },
  showSearch: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: 'Search…' }
})
const { getFilters } = useWorkflowValidation()

const inputClass = 'text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40'

const options = ref({ versions: [], providers: [], models: [], workflows: [] })
const datePreset = ref('90')

const hasActive = computed(() =>
  filters.version || (showTest && filters.workflow) || (showVerdict && filters.verdict) || (showSearch && filters.q) || filters.dateFrom || filters.dateTo
)

function emitChange() {
  emit('change')
}

function applyDatePreset() {
  if (datePreset.value === 'all') {
    filters.dateFrom = ''
    filters.dateTo = ''
  } else if (datePreset.value !== 'custom') {
    Object.assign(filters, defaultDateRange(Number(datePreset.value)))
  }
  emitChange()
}

function useCustomDates() {
  datePreset.value = 'custom'
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
  datePreset.value = '90'
  emit('change')
}

onMounted(async () => {
  try {
    options.value = await getFilters()
    datePreset.value = detectDatePreset()
  } catch {
    // filter options are best-effort; the bar still works with free text
  }
})
</script>
