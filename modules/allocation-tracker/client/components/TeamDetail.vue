<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Back button + team name -->
    <div class="flex items-center gap-3 mb-4">
      <button
        data-testid="back-button"
        @click="$emit('back')"
        class="text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>
    </div>

    <h2 class="text-xl font-bold text-gray-900 mb-4">{{ board?.displayName || board?.name }}</h2>

    <!-- No sprint data message -->
    <div v-if="sprints.length === 0 && !isLoading" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
      No sprint data available for this team.
    </div>

    <!-- Loading spinner -->
    <div v-else-if="isLoading && !sprintData" data-testid="loading-spinner" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Sprint detail content -->
    <template v-else-if="selectedSprint && sprintData">
      <!-- Sprint selector row -->
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <SprintSelector
          :sprints="sprints"
          :selectedSprintId="selectedSprint.id"
          @select-sprint="$emit('select-sprint', $event)"
        />
        <SprintStatusBadge :state="selectedSprint.state" />
        <span class="text-sm text-gray-500">
          {{ formatDate(selectedSprint.startDate) }} – {{ formatDate(selectedSprint.endDate) }}
        </span>
      </div>

      <!-- Metric toggle -->
      <div class="flex items-center justify-end mb-4">
        <MetricToggle :modelValue="metricMode" @update:modelValue="$emit('update:metricMode', $event)" />
      </div>

      <!-- Allocation bar -->
      <div class="mb-4">
        <AllocationBar
          :buckets="sprintData.summary.buckets"
          :totalPoints="sprintData.summary.totalPoints"
          :totalCount="sprintData.summary.totalCount || 0"
          :metricMode="metricMode"
          class="h-8"
        />
      </div>

      <!-- Total summary -->
      <div class="text-sm text-gray-600 mb-4">
        <span class="font-semibold text-gray-900">{{ displayTotal }}</span> total {{ metricMode === 'counts' ? 'issues' : 'points' }}
      </div>

      <!-- Unestimated panel -->
      <div class="mb-4">
        <UnestimatedPanel :issues="unestimatedIssues" />
      </div>

      <!-- Bucket breakdown grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <BucketBreakdown
          v-for="bucket in bucketConfigs"
          :key="bucket.key"
          :name="bucket.name"
          :bucketKey="bucket.key"
          :points="getBucketData(bucket.key).points"
          :count="getBucketData(bucket.key).count"
          :percentage="getBucketData(bucket.key).percentage"
          :targetPercentage="bucket.target"
          :completedPoints="getBucketData(bucket.key).completedPoints"
          :completedCount="getBucketData(bucket.key).completedCount"
          :color="bucket.color"
          :issues="sprintData.issues[bucket.key] || []"
          :metricMode="metricMode"
        />
      </div>

      <!-- Completion summary (only visible for closed sprints) -->
      <CompletionSummary
        :summary="sprintData.summary"
        :sprintState="selectedSprint.state"
        :metricMode="metricMode"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SprintSelector from './SprintSelector.vue'
import SprintStatusBadge from './SprintStatusBadge.vue'
import AllocationBar from './AllocationBar.vue'
import BucketBreakdown from './BucketBreakdown.vue'
import MetricToggle from './MetricToggle.vue'
import UnestimatedPanel from './UnestimatedPanel.vue'
import CompletionSummary from './CompletionSummary.vue'

const props = defineProps({
  board: { type: Object, default: null },
  sprints: { type: Array, default: () => [] },
  selectedSprint: { type: Object, default: null },
  sprintData: { type: Object, default: null },
  isLoading: { type: Boolean, default: false },
  metricMode: { type: String, default: 'points' }
})

defineEmits(['select-sprint', 'back', 'update:metricMode'])

const bucketConfigs = [
  { key: 'tech-debt-quality', name: 'Tech Debt & Quality', target: 40, color: 'amber' },
  { key: 'new-features', name: 'New Features', target: 40, color: 'blue' },
  { key: 'learning-enablement', name: 'Learning & Enablement', target: 20, color: 'green' },
  { key: 'uncategorized', name: 'Uncategorized', target: 0, color: 'gray' }
]

const displayTotal = computed(() => {
  if (!props.sprintData) return 0
  if (props.metricMode === 'counts') return props.sprintData.summary.totalCount || 0
  return props.sprintData.summary.totalPoints || 0
})

function getBucketData(key) {
  const bucket = props.sprintData?.summary?.buckets?.[key]
  let percentage
  if (props.metricMode === 'counts') {
    const total = displayTotal.value
    const count = bucket?.count || 0
    percentage = total > 0 ? Math.round((count / total) * 100) : 0
  } else {
    percentage = bucket?.percentage || 0
  }
  return {
    points: bucket?.points || 0,
    count: bucket?.count || 0,
    percentage,
    completedPoints: bucket?.completedPoints || 0,
    completedCount: bucket?.completedCount || 0
  }
}

const unestimatedIssues = computed(() => {
  if (!props.sprintData?.issues) return []
  return Object.values(props.sprintData.issues)
    .flat()
    .filter(issue => issue.storyPoints == null)
})

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>
