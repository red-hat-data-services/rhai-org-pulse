<script setup>
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import FeatureMetricsRow from './FeatureMetricsRow.vue'
import FeatureCharts from './FeatureCharts.vue'
import FeatureList from './FeatureList.vue'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  features: { type: Object, default: () => ({}) },
  featureMeta: { type: Object, default: () => ({}) },
  searchQuery: { type: String, default: '' },
  recommendationFilter: { type: String, default: 'all' },
  priorityFilter: { type: String, default: 'all' },
  humanReviewFilter: { type: String, default: 'all' },
  needsAttentionFilter: { type: String, default: 'all' },
  sortBy: { type: String, default: 'default' },
  selectedFeature: { type: Object, default: null }
})

const emit = defineEmits([
  'update:searchQuery',
  'update:recommendationFilter',
  'update:priorityFilter',
  'update:humanReviewFilter',
  'update:needsAttentionFilter',
  'update:sortBy',
  'selectFeature',
  'retry'
])
</script>

<template>
  <main class="flex-1 flex flex-col overflow-auto">
    <!-- Loading -->
    <LoadingOverlay v-if="loading" message="Loading feature reviews..." />

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center">
      <div class="text-red-500 dark:text-red-400 mb-2">Failed to load feature data</div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ error }}</p>
      <button
        @click="emit('retry')"
        class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
      >
        Retry
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="Object.keys(features).length === 0" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
        <svg class="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <h2 class="text-xl font-semibold mb-2 dark:text-gray-100">No Feature Reviews Yet</h2>
      <p class="text-gray-500 dark:text-gray-400 text-center max-w-md">
        Feature review data will appear here once the strat creator pipeline pushes results.
      </p>
    </div>

    <!-- Data loaded -->
    <template v-else>
      <FeatureMetricsRow :features="features" />
      <FeatureCharts :features="features" />
      <FeatureList
        :features="features"
        :selectedFeature="selectedFeature"
        :searchQuery="searchQuery"
        :recommendationFilter="recommendationFilter"
        :priorityFilter="priorityFilter"
        :humanReviewFilter="humanReviewFilter"
        :needsAttentionFilter="needsAttentionFilter"
        :sortBy="sortBy"
        @update:searchQuery="emit('update:searchQuery', $event)"
        @update:recommendationFilter="emit('update:recommendationFilter', $event)"
        @update:priorityFilter="emit('update:priorityFilter', $event)"
        @update:humanReviewFilter="emit('update:humanReviewFilter', $event)"
        @update:needsAttentionFilter="emit('update:needsAttentionFilter', $event)"
        @update:sortBy="emit('update:sortBy', $event)"
        @selectFeature="emit('selectFeature', $event)"
      />
    </template>
  </main>
</template>
