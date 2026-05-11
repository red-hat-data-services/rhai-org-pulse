<script setup>
import { ref } from 'vue'

const props = defineProps({
  fieldDefinitions: { type: Array, default: () => [] },
  activeFilters: { type: Object, default: () => ({}) },
  filterCounts: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:filter', 'clear:filter', 'clear:all'])

const collapsed = ref({})

function toggle(fieldId) {
  collapsed.value = { ...collapsed.value, [fieldId]: !collapsed.value[fieldId] }
}

function isSelected(fieldId, value) {
  return (props.activeFilters[fieldId] || []).includes(value)
}

function toggleValue(fieldId, value) {
  const current = props.activeFilters[fieldId] || []
  const values = isSelected(fieldId, value)
    ? current.filter(v => v !== value)
    : [...current, value]
  emit('update:filter', { fieldId, values })
}

function activeCount(fieldId) {
  return (props.activeFilters[fieldId] || []).length
}

function hasAnyFilter() {
  return Object.values(props.activeFilters).some(v => v && v.length > 0)
}
</script>

<template>
  <div v-if="fieldDefinitions.length > 0" class="space-y-2">
    <div v-for="field in fieldDefinitions" :key="field.id">
      <button
        class="flex items-center justify-between w-full text-left"
        @click="toggle(field.id)"
      >
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
          {{ field.label }}
          <span v-if="activeCount(field.id) > 0" class="text-primary-600 dark:text-primary-400 normal-case ml-1">
            ({{ activeCount(field.id) }} selected)
          </span>
        </label>
        <svg
          class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform"
          :class="{ 'rotate-180': !collapsed[field.id] }"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="!collapsed[field.id]" class="space-y-1 mt-1 max-h-48 overflow-y-auto">
        <label
          v-for="opt in (field.allowedValues || [])"
          :key="opt"
          class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="isSelected(field.id, opt)"
            @change="toggleValue(field.id, opt)"
            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300 flex-1">{{ opt }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ (filterCounts[field.id] || {})[opt] || 0 }}</span>
        </label>
      </div>
    </div>
    <button
      v-if="hasAnyFilter()"
      class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
      @click="emit('clear:all')"
    >Clear all filters</button>
  </div>
</template>
