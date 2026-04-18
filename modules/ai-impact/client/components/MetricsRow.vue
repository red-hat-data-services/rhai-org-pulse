<script setup>
defineProps({
  metrics: {
    type: Object,
    default: null
  }
})

function getTrendClass(trend) {
  if (trend === 'growing') return 'text-green-600 dark:text-green-400'
  if (trend === 'declining') return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function formatChange(change) {
  if (change > 0) return `+${change}%`
  return `${change}%`
}
</script>

<template>
  <div v-if="metrics" class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="grid gap-6 grid-cols-2 lg:grid-cols-4">
      <!-- Created with AI -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Created with AI
        </p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold dark:text-gray-100">{{ metrics.createdPct }}%</span>
          <span class="text-sm flex items-center gap-1" :class="getTrendClass(metrics.trend)">
            <!-- Trend arrow -->
            <svg v-if="metrics.trend === 'growing'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <svg v-else-if="metrics.trend === 'declining'" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
            {{ formatChange(metrics.createdChange) }}
          </span>
        </div>
      </div>

      <!-- Revised with AI -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          Revised with AI
        </p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold dark:text-gray-100">{{ metrics.revisedCount }}</span>
          <span v-if="metrics.priorRevisedCount != null" class="text-xs text-gray-400 dark:text-gray-500">
            {{ metrics.priorRevisedCount }} prev period
          </span>
        </div>
      </div>

      <!-- Total RFEs -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Total RFEs</p>
        <span class="text-3xl font-bold dark:text-gray-100">{{ metrics.windowTotal }}</span>
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ metrics.totalRFEs }} all time</p>
      </div>

      <!-- Trend Status -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Trend Status</p>
        <div class="flex items-center gap-2">
          <svg v-if="metrics.trend === 'growing'" class="h-5 w-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <svg v-else-if="metrics.trend === 'declining'" class="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          <svg v-else class="h-5 w-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
          <span class="text-lg font-semibold capitalize dark:text-gray-100">{{ metrics.trend }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
