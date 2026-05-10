<script setup>
import { ref, computed } from 'vue'
import OnboardingMetricsRow from './OnboardingMetricsRow.vue'
import OnboardingCharts from './OnboardingCharts.vue'
import ComponentOnboardingTable from './ComponentOnboardingTable.vue'

const props = defineProps({
  loading: { type: Boolean, default: true },
  error: { type: String, default: null },
  data: { type: Object, default: null },
  search: { type: String, default: '' },
  completionFilter: { type: String, default: 'all' },
  productFilter: { type: String, default: 'all' },
  detailCache: { type: Object, default: () => ({}) }
})

const emit = defineEmits([
  'update:search',
  'update:completionFilter',
  'update:productFilter',
  'loadDetail',
  'retry'
])

const chartsExpanded = ref(true)

const allComponents = computed(() => {
  if (!props.data?.components) return {}
  return props.data.components
})

const filteredComponents = computed(() => {
  const entries = Object.entries(allComponents.value)
  return Object.fromEntries(
    entries.filter(([, c]) => {
      if (props.completionFilter !== 'all' && c.completionStatus !== props.completionFilter) return false
      if (props.productFilter !== 'all' && c.productContext !== props.productFilter) return false
      if (props.search) {
        const q = props.search.toLowerCase()
        return (
          c.key.toLowerCase().includes(q) ||
          (c.componentName || '').toLowerCase().includes(q) ||
          c.summary.toLowerCase().includes(q)
        )
      }
      return true
    })
  )
})

const metrics = computed(() => {
  const list = Object.values(filteredComponents.value)
  const completed = list.filter(c => c.completionStatus === 'completed')
  const inProgress = list.filter(c => c.completionStatus === 'in-progress')
  const total = list.length

  const avgDays = completed.length
    ? Math.round(
        completed
          .filter(c => c.created && c.resolved)
          .reduce((sum, c) => sum + (new Date(c.resolved) - new Date(c.created)) / 86400000, 0) /
        (completed.filter(c => c.created && c.resolved).length || 1)
      )
    : 0

  return {
    totalOnboarded: completed.length,
    totalInProgress: inProgress.length,
    completionRate: total ? Math.round((completed.length / total) * 100) : 0,
    rhoaiCount: list.filter(c => c.productContext === 'RHOAI').length,
    odhCount: list.filter(c => c.productContext === 'ODH').length,
    avgOnboardingDays: avgDays
  }
})
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-4 bg-white dark:bg-gray-900">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Component Onboarding</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Automated onboarding of components into ODH &amp; RHOAI via Konflux
        </p>
      </div>

      <div class="flex items-center gap-3 ml-auto flex-wrap">
        <!-- Search -->
        <div class="relative">
          <svg class="absolute left-2.5 top-2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search components…"
            class="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            :value="search"
            @input="emit('update:search', $event.target.value)"
          />
        </div>

        <!-- Completion filter -->
        <select
          class="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          :value="completionFilter"
          @change="emit('update:completionFilter', $event.target.value)"
        >
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="in-progress">In Progress</option>
        </select>

        <!-- Product filter -->
        <select
          class="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          :value="productFilter"
          @change="emit('update:productFilter', $event.target.value)"
        >
          <option value="all">All products</option>
          <option value="RHOAI">RHOAI</option>
          <option value="ODH">ODH</option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
      <svg class="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      Loading component onboarding data…
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center gap-3 text-red-600 dark:text-red-400">
      <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p class="text-sm">Failed to load data: {{ error }}</p>
      <button
        class="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        @click="emit('retry')"
      >Retry</button>
    </div>

    <!-- Content -->
    <div v-else class="flex-1 flex flex-col overflow-hidden">
      <OnboardingMetricsRow :metrics="metrics" />
      <OnboardingCharts
        :components="filteredComponents"
        :expanded="chartsExpanded"
        @toggle="chartsExpanded = !chartsExpanded"
      />
      <ComponentOnboardingTable
        :components="filteredComponents"
        :detail-cache="detailCache"
        @load-detail="emit('loadDetail', $event)"
      />
    </div>
  </div>
</template>
