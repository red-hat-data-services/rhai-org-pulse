<script setup>
defineProps({
  metrics: { type: Object, default: null }
})
</script>

<template>
  <div v-if="metrics" class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="grid gap-6 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <!-- Total Onboarded -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Onboarded
        </p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold text-green-600 dark:text-green-400">{{ metrics.totalOnboarded }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">completed</span>
        </div>
      </div>

      <!-- In Progress -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          In Progress
        </p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold text-amber-600 dark:text-amber-400">{{ metrics.totalInProgress }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">ongoing</span>
        </div>
      </div>

      <!-- In Queue -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          In Queue
        </p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold text-blue-600 dark:text-blue-400">{{ metrics.totalInQueue }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">waiting</span>
        </div>
      </div>

      <!-- Completion Rate -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Completion Rate</p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold dark:text-gray-100">{{ metrics.completionRate }}%</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            class="bg-green-500 h-1.5 rounded-full transition-all"
            :style="{ width: metrics.completionRate + '%' }"
          />
        </div>
      </div>

      <!-- RHOAI / ODH split -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">By Product Context</p>
        <div class="flex items-center gap-3">
          <div class="text-center">
            <span class="text-2xl font-bold text-red-600 dark:text-red-400">{{ metrics.rhoaiCount }}</span>
            <p class="text-xs text-gray-400 dark:text-gray-500">RHOAI</p>
          </div>
          <span class="text-gray-300 dark:text-gray-600">/</span>
          <div class="text-center">
            <span class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ metrics.odhCount }}</span>
            <p class="text-xs text-gray-400 dark:text-gray-500">ODH</p>
          </div>
        </div>
      </div>

      <!-- Avg time to onboard -->
      <div class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">Avg. Time to Onboard</p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold dark:text-gray-100">{{ metrics.avgDaysAutomated || metrics.avgOnboardingDays }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">days (AI)</span>
        </div>
        <p v-if="metrics.avgDaysManual" class="text-xs text-gray-400 dark:text-gray-500">Manual avg: {{ metrics.avgDaysManual }} days</p>
        <p v-else class="text-xs text-gray-400 dark:text-gray-500">for completed components</p>
      </div>

      <!-- AI Time Savings -->
      <div v-if="metrics.manualCount > 0" class="space-y-1">
        <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          <svg class="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          AI Time Savings
        </p>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-bold" :class="metrics.timeSavingsPercent >= 50 ? 'text-emerald-600 dark:text-emerald-400' : metrics.timeSavingsPercent >= 20 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'">{{ metrics.timeSavingsPercent }}%</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">faster</span>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500">{{ metrics.avgDaysManual }}d → {{ metrics.avgDaysAutomated }}d</p>
      </div>
    </div>
  </div>
</template>
