<script setup>
import { computed } from 'vue'

const props = defineProps({
  rice: { type: Object, default: null }
})

const hasScore = computed(function() {
  return props.rice && props.rice.score != null
})

const scoreLabel = computed(function() {
  if (!hasScore.value) return 'N/A'
  return String(props.rice.score)
})
</script>

<template>
  <span
    class="text-xs font-mono font-semibold px-1.5 py-0.5 rounded inline-block"
    :class="hasScore
      ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10'
      : 'text-gray-400 dark:text-gray-500'"
    :title="hasScore ? 'RICE score: ' + rice.score : 'RICE scoring not configured or data unavailable'"
  >
    {{ scoreLabel }}
  </span>
</template>
