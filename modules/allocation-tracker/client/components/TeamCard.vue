<template>
  <div
    class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-primary-300 hover:bg-primary-50 transition-all cursor-pointer group"
    @click="$emit('select-team', board)"
  >
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-gray-900 truncate">{{ board.displayName || board.name }}</h3>
      <svg class="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </div>

    <template v-if="sprintData">
      <div class="flex items-center gap-2 mt-1">
        <span class="text-sm text-gray-600">{{ sprintData.sprint.name }}</span>
        <SprintStatusBadge :state="sprintData.sprint.state" />
      </div>

      <div class="text-xs text-gray-400 mt-0.5">
        {{ formatDate(sprintData.sprint.startDate) }} – {{ formatDate(sprintData.sprint.endDate) }}
      </div>

      <div class="mt-3">
        <AllocationBar :buckets="sprintData.summary.buckets" :totalPoints="sprintData.summary.totalPoints" :totalCount="sprintData.summary.totalCount || 0" :metricMode="metricMode" />
      </div>

      <div class="flex items-center justify-between mt-2 text-sm">
        <span class="text-gray-600">
          <span class="font-medium">{{ displayTotal }}</span> {{ unitLabel }}
        </span>
        <span
          v-if="sprintData.summary.unestimatedIssueCount > 0"
          data-testid="unestimated-count"
          class="text-amber-600"
        >
          {{ sprintData.summary.unestimatedIssueCount }} unestimated
        </span>
        <span v-else class="text-gray-400 text-xs">All estimated</span>
      </div>

      <div v-if="sprintData.sprint.state === 'closed' && displayTotal > 0" class="mt-1 text-xs text-gray-500">
        Completed: {{ completionPercent }}%
      </div>
    </template>

    <p v-else class="text-sm text-gray-500 mt-1">No sprint data</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SprintStatusBadge from './SprintStatusBadge.vue'
import AllocationBar from './AllocationBar.vue'

const props = defineProps({
  board: {
    type: Object,
    required: true
  },
  sprintData: {
    type: Object,
    default: null
  },
  metricMode: {
    type: String,
    default: 'points'
  }
})

defineEmits(['select-team'])

const displayTotal = computed(() => {
  if (!props.sprintData) return 0
  if (props.metricMode === 'counts') return props.sprintData.summary.totalCount || 0
  return props.sprintData.summary.totalPoints || 0
})

const unitLabel = computed(() => props.metricMode === 'counts' ? 'issues' : 'pts')

const completionPercent = computed(() => {
  if (!props.sprintData) return 0
  if (props.metricMode === 'counts') {
    const total = props.sprintData.summary.totalCount || 0
    if (total === 0) return 0
    const completed = Object.values(props.sprintData.summary.buckets)
      .reduce((sum, b) => sum + (b.completedCount || 0), 0)
    return Math.round((completed / total) * 100)
  }
  if (props.sprintData.summary.totalPoints === 0) return 0
  const completedPoints = Object.values(props.sprintData.summary.buckets)
    .reduce((sum, b) => sum + (b.completedPoints || 0), 0)
  return Math.round((completedPoints / props.sprintData.summary.totalPoints) * 100)
})

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>
