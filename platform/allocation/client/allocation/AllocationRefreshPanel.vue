<template>
  <div
    data-testid="allocation-refresh-panel"
    class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center"
  >
    <svg class="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>

    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{{ title }}</h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{{ description }}</p>

    <p v-if="lastUpdated" class="mt-2 text-xs text-gray-400 dark:text-gray-500">
      Last synced {{ formattedLastUpdated }}
    </p>

    <!-- Refresh action -->
    <div v-if="canRefresh" class="mt-4 flex flex-col items-center gap-2">
      <button
        type="button"
        data-testid="allocation-refresh-button"
        :disabled="refreshing"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        @click="$emit('refresh')"
      >
        <svg v-if="refreshing" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        {{ refreshing ? 'Refreshing…' : buttonLabel }}
      </button>
      <p v-if="message" data-testid="allocation-refresh-message" class="text-xs text-gray-500 dark:text-gray-400">
        {{ message }}
      </p>
    </div>

    <!-- Guidance when the viewer can't refresh from here -->
    <p v-else-if="hint" class="mt-4 text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  buttonLabel: { type: String, default: 'Refresh data' },
  canRefresh: { type: Boolean, default: false },
  refreshing: { type: Boolean, default: false },
  message: { type: String, default: '' },
  hint: { type: String, default: '' },
  lastUpdated: { type: String, default: null }
})

defineEmits(['refresh'])

const formattedLastUpdated = computed(() => {
  if (!props.lastUpdated) return ''
  const d = new Date(props.lastUpdated)
  return isNaN(d.getTime()) ? '' : d.toLocaleString()
})
</script>
