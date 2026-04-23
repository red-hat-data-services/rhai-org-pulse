<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Back button + project header -->
    <div class="flex items-center gap-3 mb-4">
      <button
        @click="$emit('back')"
        class="text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        All Projects
      </button>
    </div>

    <!-- Metric toggle -->
    <div class="flex items-center justify-end mb-4">
      <MetricToggle :modelValue="metricMode" @update:modelValue="$emit('update:metricMode', $event)" />
    </div>

    <!-- Project allocation bar -->
    <div v-if="projectSummary && projectSummary.lastUpdated" class="mb-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold text-gray-900">{{ project.name }} — Project Overview</h2>
          <span v-if="displayTotal > 0" class="text-sm text-gray-500">
            {{ displayTotal }} {{ unitLabel }} across {{ boardCount }} {{ boardCount === 1 ? 'board' : 'boards' }}
          </span>
        </div>
        <p class="text-xs text-gray-400 mb-2">Aggregated from each board's currently active sprint</p>
        <AllocationBar v-if="aggregatedBuckets && displayTotal > 0" :buckets="aggregatedBuckets" :totalPoints="totalPoints" :totalCount="totalCount" :metricMode="metricMode" />
      </div>
    </div>

    <!-- Allocation legend -->
    <div class="flex items-center gap-4 mb-4 text-sm text-gray-600 flex-wrap">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-amber-400"></span>
        Tech Debt & Quality (40%)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-blue-400"></span>
        New Features (40%)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-green-400"></span>
        Learning & Enablement (20%)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-gray-400"></span>
        Uncategorized
      </span>
    </div>

    <!-- Filter selector scoped to this project -->
    <FilterSelector
      v-if="boards.length > 0"
      :filters="filters"
      :activeFilterId="activeFilterId"
      @select-filter="$emit('select-filter', $event)"
      @create-filter="$emit('create-filter')"
      @edit-filter="$emit('edit-filter', $event)"
      @delete-filter="$emit('delete-filter', $event)"
    />

    <!-- Section divider -->
    <div class="flex items-center gap-3 mb-4 mt-2">
      <div class="flex-1 border-t border-gray-200"></div>
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Boards{{ boards.length > 0 ? ` (${boards.length})` : '' }}
      </span>
      <div class="flex-1 border-t border-gray-200"></div>
    </div>

    <div v-if="boards.length === 0" class="text-center py-12 text-gray-500">
      <p class="text-lg">No boards found for this project.</p>
      <p>Click Refresh to fetch boards from Jira.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <TeamCard
        v-for="board in filteredBoards"
        :key="board.id"
        :board="board"
        :sprintData="boardSprintData[board.id] || null"
        :metricMode="metricMode"
        @select-team="$emit('select-team', $event)"
      />
    </div>

    <LoadingOverlay v-if="isLoading" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AllocationBar from './AllocationBar.vue'
import FilterSelector from './FilterSelector.vue'
import MetricToggle from './MetricToggle.vue'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import TeamCard from './TeamCard.vue'
import { useAllocationData } from '../composables/useAllocationData.js'

const { aggregateBuckets } = useAllocationData()

const props = defineProps({
  project: {
    type: Object,
    required: true
  },
  projectSummary: {
    type: Object,
    default: null
  },
  boards: {
    type: Array,
    default: () => []
  },
  boardSprintData: {
    type: Object,
    default: () => ({})
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  filters: {
    type: Array,
    default: () => []
  },
  activeFilterId: {
    type: String,
    default: null
  },
  activeFilter: {
    type: Object,
    default: null
  },
  metricMode: {
    type: String,
    default: 'points'
  }
})

defineEmits(['back', 'select-team', 'select-filter', 'create-filter', 'edit-filter', 'delete-filter', 'update:metricMode'])

const filteredBoards = computed(() => {
  const boards = props.activeFilter
    ? props.boards.filter(b => props.activeFilter.boardIds.includes(b.id))
    : [...props.boards]
  return boards.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
})

const boardCount = computed(() => {
  if (!props.projectSummary?.boards) return 0
  return Object.keys(props.projectSummary.boards).length
})

const aggregated = computed(() => {
  if (!props.projectSummary?.boards) return null
  return aggregateBuckets(props.projectSummary.boards)
})

const aggregatedBuckets = computed(() => aggregated.value?.buckets || null)
const totalPoints = computed(() => aggregated.value?.totalPoints || 0)
const totalCount = computed(() => aggregated.value?.totalCount || 0)

const displayTotal = computed(() => props.metricMode === 'counts' ? totalCount.value : totalPoints.value)
const unitLabel = computed(() => props.metricMode === 'counts' ? 'issues' : 'pts')
</script>
