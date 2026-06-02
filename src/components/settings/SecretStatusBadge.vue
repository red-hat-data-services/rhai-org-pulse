<template>
  <span
    class="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
    :class="badgeClass"
  >
    <span v-if="configured" class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
    <span v-else-if="required" class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
    <span v-else class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500"></span>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  configured: { type: Boolean, required: true },
  required: { type: Boolean, default: false }
})

const label = computed(() => {
  if (props.configured) return 'Configured'
  if (props.required) return 'Missing (required)'
  return 'Not configured'
})

const badgeClass = computed(() => {
  if (props.configured) return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (props.required) return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
})
</script>
