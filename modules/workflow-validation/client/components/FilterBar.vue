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

      <select v-model="filters.verdict" :class="inputClass" @change="emitChange">
        <option value="">Any verdict</option>
        <option value="PASS">Pass</option>
        <option value="FAIL">Fail</option>
      </select>

      <select v-if="options.providers.length" v-model="filters.provider" :class="inputClass" @change="emitChange">
        <option value="">Any provider</option>
        <option v-for="p in options.providers" :key="p.value" :value="p.value">
          {{ p.value }} ({{ p.count }})
        </option>
      </select>

      <div class="relative flex-1 min-w-[160px]">
        <SearchIcon :size="15" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          v-model="filters.q"
          type="text"
          placeholder="Search summaries…"
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
import { filters, resetFilters, useWorkflowValidation } from '../composables/useWorkflowValidation'

const emit = defineEmits(['change'])
const { getFilters } = useWorkflowValidation()

const inputClass = 'text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500/40'

const options = ref({ versions: [], providers: [], models: [], workflows: [] })

const hasActive = computed(() =>
  filters.version || filters.verdict || filters.provider || filters.q || filters.dateFrom || filters.dateTo
)

function emitChange() {
  emit('change')
}

function clear() {
  resetFilters()
  emit('change')
}

onMounted(async () => {
  try {
    options.value = await getFilters()
  } catch {
    // filter options are best-effort; the bar still works with free text
  }
})
</script>
