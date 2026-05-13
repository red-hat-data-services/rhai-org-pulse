<script setup>
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import TestPlanMetricsRow from './TestPlanMetricsRow.vue'
import TestPlanCharts from './TestPlanCharts.vue'
import TestPlanList from './TestPlanList.vue'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  testPlans: { type: Object, default: () => ({}) },
  testPlanMeta: { type: Object, default: () => ({}) },
  searchQuery: { type: String, default: '' },
  verdictFilter: { type: String, default: 'all' },
  sortBy: { type: String, default: 'default' },
  selectedPlan: { type: Object, default: null }
})

const emit = defineEmits([
  'update:searchQuery',
  'update:verdictFilter',
  'update:sortBy',
  'selectPlan',
  'retry'
])
</script>

<template>
  <main class="flex-1 flex flex-col overflow-auto">
    <!-- Loading -->
    <LoadingOverlay v-if="loading" message="Loading test plan reviews..." />

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center">
      <div class="text-red-500 dark:text-red-400 mb-2">Failed to load test plan data</div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ error }}</p>
      <button
        @click="emit('retry')"
        class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
      >
        Retry
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="Object.keys(testPlans).length === 0" class="flex-1 flex flex-col items-center justify-center">
      <div class="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
        <svg class="h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      </div>
      <h2 class="text-xl font-semibold mb-2 dark:text-gray-100">No Test Plan Reviews Yet</h2>
      <p class="text-gray-500 dark:text-gray-400 text-center max-w-md">
        Test plan review data will appear here once the assessment pipeline pushes results.
      </p>
    </div>

    <!-- Data loaded -->
    <template v-else>
      <TestPlanMetricsRow :testPlans="testPlans" />
      <TestPlanCharts :testPlans="testPlans" />
      <TestPlanList
        :testPlans="testPlans"
        :selectedPlan="selectedPlan"
        :searchQuery="searchQuery"
        :verdictFilter="verdictFilter"
        :sortBy="sortBy"
        @update:searchQuery="emit('update:searchQuery', $event)"
        @update:verdictFilter="emit('update:verdictFilter', $event)"
        @update:sortBy="emit('update:sortBy', $event)"
        @selectPlan="emit('selectPlan', $event)"
      />
    </template>
  </main>
</template>
