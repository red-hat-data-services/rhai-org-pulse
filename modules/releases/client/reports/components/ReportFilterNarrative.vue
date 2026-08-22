<template>
  <div class="flex items-start justify-between gap-4">
    <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
      <!-- No filters active -->
      <template v-if="!filters.hasActiveFilters.value">
        {{ noFilterText }}
        <button @click="filters.openFilterModal()" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">Manage filters</button>
        or apply a
        <button @click="filters.openFilterModalToPresets()" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">saved preset</button>.
      </template>

      <!-- Preset applied -->
      <template v-else-if="filters.appliedPreset.value">
        {{ filterPrefix }}
        <span class="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-baseline gap-1">
          {{ filters.appliedPreset.value.name }}
          <span v-if="filters.appliedPreset.value.description" class="relative group inline-flex">
            <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help self-center" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 text-xs font-normal text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">{{ filters.appliedPreset.value.description }}</span>
          </span>
        </span>.
      </template>

      <!-- Ad-hoc filters -->
      <template v-else>
        {{ filterPrefix }}
        <template v-for="(part, idx) in filters.filterNarrativeParts.value" :key="part.field">
          <template v-if="idx > 0 && idx === filters.filterNarrativeParts.value.length - 1"> {{ filters.crossFieldMode.value }} </template>
          <template v-else-if="idx > 0">, </template>
          <span class="font-semibold text-gray-900 dark:text-gray-100">{{ part.label }}: {{ part.values }}</span>
        </template>.
      </template>

      <!-- Editing indicator -->
      <span v-if="filters.editingFilterId.value" class="ml-1 text-xs text-amber-600 dark:text-amber-400">
        (editing preset · <button @click="filters.cancelEditFilter()" class="hover:underline">cancel</button>)
      </span>
    </div>

    <!-- Filter action buttons -->
    <div class="flex items-center gap-2 shrink-0">
      <button
        @click="filters.openFilterModal()"
        class="px-3 py-1.5 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
      >{{ filters.hasActiveFilters.value ? 'Edit' : 'Manage Filters' }}</button>
      <button
        v-if="filters.hasActiveFilters.value"
        @click="filters.clearAllFilters()"
        class="px-3 py-1.5 text-sm font-medium rounded-md text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >Clear</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  filters: {
    type: Object,
    required: true
  },
  noFilterText: {
    type: String,
    default: 'Showing all items.'
  },
  filterPrefix: {
    type: String,
    default: 'Showing items filtered by'
  }
})
</script>
