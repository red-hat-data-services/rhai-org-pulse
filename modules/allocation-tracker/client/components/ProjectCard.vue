<template>
  <div
    class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-primary-300 hover:bg-primary-50 transition-all cursor-pointer group"
    @click="$emit('select-project', project)"
    data-testid="project-card"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0">
        <h3 class="font-semibold text-gray-900 truncate">{{ project.name }}</h3>
        <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded shrink-0">{{ project.pillar }}</span>
      </div>
      <svg class="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors shrink-0 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </div>

    <template v-if="displayTotal > 0">
      <div class="mt-3">
        <AllocationBar :buckets="aggregatedBuckets" :totalPoints="totalPoints" :totalCount="totalCount" :metricMode="metricMode" />
      </div>

      <div class="flex items-center justify-between mt-2 text-sm">
        <span class="text-gray-600">
          <span class="font-medium">{{ displayTotal }}</span> {{ unitLabel }}
        </span>
        <span class="text-gray-500">
          {{ boardCount }} {{ boardCount === 1 ? 'board' : 'boards' }}
        </span>
      </div>
    </template>

    <p v-else class="text-sm text-gray-500 mt-3">No data available</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AllocationBar from './AllocationBar.vue'
import { useAllocationData } from '../composables/useAllocationData.js'

const { aggregateBuckets } = useAllocationData()

const props = defineProps({
  project: {
    type: Object,
    required: true
  },
  summary: {
    type: Object,
    default: null
  },
  metricMode: {
    type: String,
    default: 'points'
  }
})

defineEmits(['select-project'])

const boardCount = computed(() => {
  if (!props.summary?.boards) return 0
  return Object.keys(props.summary.boards).length
})

const aggregated = computed(() => {
  if (!props.summary?.boards) return { buckets: {}, totalPoints: 0, totalCount: 0 }
  return aggregateBuckets(props.summary.boards)
})

const aggregatedBuckets = computed(() => aggregated.value.buckets)
const totalPoints = computed(() => aggregated.value.totalPoints)
const totalCount = computed(() => aggregated.value.totalCount)

const displayTotal = computed(() => props.metricMode === 'counts' ? totalCount.value : totalPoints.value)
const unitLabel = computed(() => props.metricMode === 'counts' ? 'issues' : 'pts')
</script>
