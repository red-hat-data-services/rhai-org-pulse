<script setup>
import { computed } from 'vue'

const props = defineProps({
  scores: {
    type: Object,
    default: () => ({ feasibility: 0, testability: 0, scope: 0, architecture: 0 })
  },
  showTotal: { type: Boolean, default: true }
})

const DIMENSIONS = [
  { key: 'feasibility', label: 'F' },
  { key: 'testability', label: 'T' },
  { key: 'scope', label: 'S' },
  { key: 'architecture', label: 'A' }
]

function scoreClass(score) {
  if (score === 2) return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  if (score === 1) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
}

const total = computed(() => {
  return DIMENSIONS.reduce((sum, d) => sum + (props.scores?.[d.key] ?? 0), 0)
})
</script>

<template>
  <div class="flex items-center gap-1 flex-wrap">
    <span
      v-for="dim in DIMENSIONS"
      :key="dim.key"
      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold"
      :class="scoreClass(scores?.[dim.key] ?? 0)"
      :title="`${dim.key.charAt(0).toUpperCase() + dim.key.slice(1)}: ${scores?.[dim.key] ?? 0}/2`"
    >
      {{ dim.label }}&nbsp;{{ scores?.[dim.key] ?? 0 }}
    </span>
    <span
      v-if="showTotal"
      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      title="Total rubric score"
    >
      {{ total }}/8
    </span>
  </div>
</template>
