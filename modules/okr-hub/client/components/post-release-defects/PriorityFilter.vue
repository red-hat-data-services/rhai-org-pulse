<template>
  <div
    class="relative"
    @keydown.esc="isOpen = false"
  >
    <div v-if="selected.length > 0" class="flex flex-wrap gap-1.5 mb-2">
      <span
        v-for="priorityName in selected"
        :key="priorityName"
        class="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium"
      >
        {{ priorityName }}
        <button
          type="button"
          class="ml-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-bold text-base leading-none"
          :aria-label="`Remove ${priorityName} priority`"
          @click="togglePriority(priorityName)"
        >
          ×
        </button>
      </span>
    </div>

    <button
      id="post-release-priority"
      type="button"
      aria-label="Priority"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      class="w-full px-3 py-2 text-sm border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 text-left flex items-center justify-between gap-2"
      @click="isOpen = !isOpen"
    >
      <span class="truncate">
        {{ selected.length ? `${selected.length} priorities selected` : 'All Priorities' }}
      </span>
      <svg class="w-4 h-4 shrink-0 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
      role="listbox"
      aria-label="Jira priorities"
      aria-multiselectable="true"
    >
      <button
        v-for="priority in priorities"
        :key="priority.name"
        type="button"
        role="option"
        :aria-selected="selected.includes(priority.name)"
        class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center justify-between gap-4"
        @click="togglePriority(priority.name)"
      >
        <span class="flex items-center gap-2">
          <span
            class="flex items-center justify-center w-4 h-4 border rounded text-xs"
            :class="selected.includes(priority.name) ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-400 dark:border-gray-500'"
            aria-hidden="true"
          >
            <span v-if="selected.includes(priority.name)">✓</span>
          </span>
          <span>{{ priority.name }}</span>
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ priority.count }}</span>
      </button>
      <p v-if="priorities.length === 0" class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        No priorities found
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Array, required: true },
  priorities: { type: Array, required: true }
})

const emit = defineEmits(['update:modelValue'])
const isOpen = ref(false)
const selected = computed(() => props.modelValue || [])

function togglePriority(priorityName) {
  const next = selected.value.includes(priorityName)
    ? selected.value.filter(name => name !== priorityName)
    : [...selected.value, priorityName]
  emit('update:modelValue', next)
}
</script>
