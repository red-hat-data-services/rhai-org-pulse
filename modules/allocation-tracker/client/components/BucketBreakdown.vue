<template>
  <div
    data-testid="bucket-card"
    class="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 p-4"
    :class="borderClass"
  >
    <div class="flex items-start justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-900">{{ name }}</h3>
      <span data-testid="variance" class="text-xs font-medium" :class="varianceColorClass">
        {{ varianceText }}
      </span>
    </div>

    <div class="flex items-baseline gap-2 mb-1">
      <span class="text-2xl font-bold text-gray-900">{{ displayValue }} {{ unitLabel }}</span>
      <span class="text-sm text-gray-500">({{ percentage }}%)</span>
    </div>

    <div class="text-xs text-gray-500 mb-3">
      Target: {{ targetPercentage }}% · {{ displayCompleted }} completed · {{ issues.length }} issues
    </div>

    <IssueList :issues="issues" :expandable="true" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import IssueList from './IssueList.vue'

const props = defineProps({
  name: { type: String, required: true },
  bucketKey: { type: String, required: true },
  points: { type: Number, required: true },
  count: { type: Number, default: 0 },
  percentage: { type: Number, required: true },
  targetPercentage: { type: Number, required: true },
  issues: { type: Array, required: true },
  completedPoints: { type: Number, required: true },
  completedCount: { type: Number, default: 0 },
  color: { type: String, required: true },
  metricMode: { type: String, default: 'points' }
})

const displayValue = computed(() => props.metricMode === 'counts' ? props.count : props.points)
const displayCompleted = computed(() => props.metricMode === 'counts' ? props.completedCount : props.completedPoints)
const unitLabel = computed(() => props.metricMode === 'counts' ? 'issues' : 'pts')

const borderClass = computed(() => {
  const map = {
    amber: 'border-l-amber-400',
    blue: 'border-l-blue-400',
    green: 'border-l-green-400',
    gray: 'border-l-gray-400'
  }
  return map[props.color] || 'border-l-gray-400'
})

const variance = computed(() => props.percentage - props.targetPercentage)

const varianceText = computed(() => {
  if (Math.abs(variance.value) <= 5) return 'on target'
  const sign = variance.value > 0 ? '+' : ''
  const direction = variance.value > 0 ? 'over' : 'under'
  return `${sign}${variance.value}% ${direction}`
})

const varianceColorClass = computed(() => {
  if (Math.abs(variance.value) <= 5) return 'text-green-600'
  return variance.value > 0 ? 'text-amber-600' : 'text-blue-600'
})
</script>
