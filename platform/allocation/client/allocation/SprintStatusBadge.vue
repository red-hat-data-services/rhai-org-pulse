<template>
  <span :class="badgeClasses" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium">
    {{ capitalizedState }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  state: {
    type: String,
    required: true
  }
})

const capitalizedState = computed(() => {
  return props.state.charAt(0).toUpperCase() + props.state.slice(1)
})

const badgeClasses = computed(() => {
  switch (props.state) {
    case 'active':
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    case 'closed':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    case 'future':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }
})
</script>
