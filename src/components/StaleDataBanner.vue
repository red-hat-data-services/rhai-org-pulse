<template>
  <div
    v-if="visible"
    class="mx-6 lg:mx-8 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3"
  >
    <div class="flex items-center gap-2 text-sm text-amber-800">
      <svg class="h-5 w-5 text-amber-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <span>Jira project filter was updated. Data may be stale until the next refresh.</span>
    </div>
    <button
      @click="dismissed = true"
      class="p-1 text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
      title="Dismiss"
    >
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  configChangedAt: { type: String, default: null },
  lastRefreshedAt: { type: String, default: null }
})

const dismissed = ref(false)

const visible = computed(() => {
  if (dismissed.value) return false
  if (!props.configChangedAt) return false
  if (!props.lastRefreshedAt) return true
  return new Date(props.configChangedAt) > new Date(props.lastRefreshedAt)
})
</script>
