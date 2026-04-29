<script setup>
import { computed } from 'vue'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import MetricsRow from './MetricsRow.vue'
import TrendCharts from './TrendCharts.vue'
import RFEList from './RFEList.vue'

const props = defineProps({
  phase: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  rfeData: { type: Object, default: null },
  metrics: { type: Object, default: null },
  trendData: { type: Array, default: () => [] },
  breakdown: { type: Array, default: () => [] },
  filteredRFEs: { type: Array, default: () => [] },
  timeWindow: { type: String, default: 'month' },
  filter: { type: String, default: 'all' },
  searchQuery: { type: String, default: '' },
  chartExpanded: { type: Boolean, default: true },
  assessments: { type: Object, default: () => ({}) },
  filteredAssessments: { type: Object, default: () => ({}) },
  sortBy: { type: String, default: 'default' },
  passFailFilter: { type: String, default: 'all' },
  priorityFilter: { type: String, default: 'all' },
  statusFilter: { type: String, default: 'all' },
  selectedRFE: { type: Object, default: null }
})

const emit = defineEmits([
  'update:timeWindow',
  'update:filter',
  'update:searchQuery',
  'update:chartExpanded',
  'update:sortBy',
  'update:passFailFilter',
  'update:priorityFilter',
  'update:statusFilter',
  'selectRFE',
  'retry'
])

const isEmpty = computed(() => !props.rfeData?.fetchedAt)
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Top Bar -->
    <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold dark:text-gray-100">{{ phase.name }}</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">AI adoption metrics and RFE tracking</p>
      </div>
      <div class="flex items-center gap-2">
        <label for="time-window" class="text-sm text-gray-500 dark:text-gray-400">Showing:</label>
        <select
          id="time-window"
          :value="timeWindow"
          @change="emit('update:timeWindow', $event.target.value)"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
        </select>
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-auto">

      <!-- Loading -->
      <LoadingOverlay v-if="loading && !rfeData" />

      <!-- Error -->
      <div v-else-if="error" class="p-6">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 class="text-red-800 dark:text-red-200 font-medium">Failed to load data</h3>
          <p class="text-red-600 dark:text-red-400 text-sm mt-1">{{ error }}</p>
          <button
            @click="emit('retry')"
            class="mt-3 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Empty (no data yet) -->
      <div v-else-if="isEmpty" class="p-6 flex flex-col items-center justify-center h-full">
        <div class="text-center max-w-md">
          <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">No data yet</h3>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            An admin can trigger a data refresh from Settings &gt; AI Impact.
          </p>
        </div>
      </div>

      <!-- Data display -->
      <template v-else>
        <MetricsRow :metrics="metrics" />

        <TrendCharts
          :trendData="trendData"
          :breakdown="breakdown"
          :expanded="chartExpanded"
          :filteredAssessments="filteredAssessments"
          :timeWindow="timeWindow"
          @toggle="emit('update:chartExpanded', !chartExpanded)"
        />

        <RFEList
          :rfes="filteredRFEs"
          :filter="filter"
          :searchQuery="searchQuery"
          :jiraHost="rfeData?.jiraHost"
          :assessments="assessments"
          :sortBy="sortBy"
          :passFailFilter="passFailFilter"
          :priorityFilter="priorityFilter"
          :statusFilter="statusFilter"
          :selectedRFE="selectedRFE"
          @update:filter="emit('update:filter', $event)"
          @update:searchQuery="emit('update:searchQuery', $event)"
          @update:sortBy="emit('update:sortBy', $event)"
          @update:passFailFilter="emit('update:passFailFilter', $event)"
          @update:priorityFilter="emit('update:priorityFilter', $event)"
          @update:statusFilter="emit('update:statusFilter', $event)"
          @selectRFE="emit('selectRFE', $event)"
        />
      </template>
    </div>

  </div>
</template>
