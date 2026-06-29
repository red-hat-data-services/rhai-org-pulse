<script setup>
import { useCategories } from '../composables/useCategories.js'

defineProps({
  selectedCategory: { type: String, default: '' },
  selectedStatus: { type: String, default: '' },
  selectedSource: { type: String, default: '' },
  selectedSort: { type: String, default: 'impact' }
})

const emit = defineEmits(['update:selectedCategory', 'update:selectedStatus', 'update:selectedSource', 'update:selectedSort'])

const { CATEGORIES, CATEGORY_KEYS, DECISION_STATUSES, SOURCE_LABELS } = useCategories()

const sortOptions = [
  { value: 'impact', label: 'Impact Score' },
  { value: 'feasibility', label: 'Feasibility' },
  { value: 'stars', label: 'Stars' },
  { value: 'newest', label: 'Newest' }
]
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <!-- Category tabs -->
    <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      <button
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
          !selectedCategory ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="emit('update:selectedCategory', '')"
      >
        All
      </button>
      <button
        v-for="key in CATEGORY_KEYS"
        :key="key"
        :class="[
          'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
          selectedCategory === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        ]"
        @click="emit('update:selectedCategory', key)"
      >
        {{ CATEGORIES[key].shortName }}
      </button>
    </div>

    <div class="flex items-center gap-2 ml-auto">
      <!-- Status filter -->
      <select
        :value="selectedStatus"
        class="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300"
        @change="emit('update:selectedStatus', $event.target.value)"
      >
        <option value="">All statuses</option>
        <option v-for="(meta, key) in DECISION_STATUSES" :key="key" :value="key">{{ meta.label }}</option>
      </select>

      <!-- Source filter -->
      <select
        :value="selectedSource"
        class="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300"
        @change="emit('update:selectedSource', $event.target.value)"
      >
        <option value="">All sources</option>
        <option v-for="(label, key) in SOURCE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>

      <!-- Sort -->
      <select
        :value="selectedSort"
        class="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300"
        @change="emit('update:selectedSort', $event.target.value)"
      >
        <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>
  </div>
</template>
