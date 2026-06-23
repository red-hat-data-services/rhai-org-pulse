<template>
  <div v-if="sprintState === 'closed'" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Sprint Completion</h3>

    <div class="mb-4">
      <div class="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
        <span>{{ displayCompleted }}/{{ displayTotal }} {{ unitLabel }} completed</span>
        <span class="font-medium">{{ completionPercent }}%</span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
        <div
          data-testid="completion-bar"
          class="bg-green-500 h-3 rounded-full transition-all"
          :style="{ width: completionPercent + '%' }"
        ></div>
      </div>
    </div>

    <div class="space-y-2">
      <div
        v-for="bucket in visibleBuckets"
        :key="bucket.key"
        class="flex justify-between text-sm"
      >
        <span class="text-gray-600 dark:text-gray-400">{{ bucket.label }}</span>
        <span class="text-gray-900 dark:text-gray-100 font-medium">{{ bucket.displayCompleted }}/{{ bucket.displayValue }} {{ unitLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAllocationStrategy } from '../../composables/useAllocationStrategy'

const { categories } = useAllocationStrategy()

const props = defineProps({
  summary: {
    type: Object,
    required: true
  },
  sprintState: {
    type: String,
    required: true
  },
  metricMode: {
    type: String,
    default: 'points'
  }
})

const unitLabel = computed(() => props.metricMode === 'counts' ? 'issues' : 'pts')

const displayTotal = computed(() => {
  if (props.metricMode === 'counts') return props.summary.totalCount || 0
  return props.summary.totalPoints || 0
})

const displayCompleted = computed(() => {
  if (props.metricMode === 'counts') {
    return Object.values(props.summary.buckets)
      .reduce((sum, b) => sum + (b.completedCount || 0), 0)
  }
  return props.summary.completedPoints || 0
})

const completionPercent = computed(() => {
  if (displayTotal.value === 0) return 0
  return Math.round((displayCompleted.value / displayTotal.value) * 100)
})

const categoryLabels = computed(() => {
  const labels = {}
  for (const cat of categories.value) {
    labels[cat.key] = cat.name
  }
  labels['uncategorized'] = 'Uncategorized'
  return labels
})

const visibleBuckets = computed(() => {
  const valueField = props.metricMode === 'counts' ? 'count' : 'points'
  const completedField = props.metricMode === 'counts' ? 'completedCount' : 'completedPoints'
  return Object.entries(props.summary.buckets)
    .filter(([, data]) => (data[valueField] || 0) > 0)
    .map(([key, data]) => ({
      key,
      label: categoryLabels.value[key] || key,
      displayValue: data[valueField] || 0,
      displayCompleted: data[completedField] || 0
    }))
})
</script>
