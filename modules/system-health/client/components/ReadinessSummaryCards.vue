<script setup>
import { computed } from 'vue'
import { PackageIcon, CircleCheckIcon, CircleXIcon, BarChart3Icon } from 'lucide-vue-next'

const props = defineProps({
  totalRepos: { type: Number, default: 0 },
  readyCount: { type: Number, default: 0 },
  notReadyCount: { type: Number, default: 0 },
  readinessPercent: { type: Number, default: 0 }
})

const readyPercent = computed(() =>
  props.totalRepos > 0 ? Math.round((props.readyCount / props.totalRepos) * 100) : 0
)
const notReadyPercent = computed(() =>
  props.totalRepos > 0 ? Math.round((props.notReadyCount / props.totalRepos) * 100) : 0
)

const readinessColor = computed(() => {
  if (props.readinessPercent >= 80) return {
    badge: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    bar: 'bg-green-500',
    icon: 'bg-green-50 dark:bg-green-900/20',
    iconColor: 'text-green-600 dark:text-green-400'
  }
  if (props.readinessPercent >= 50) return {
    badge: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500',
    icon: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-600 dark:text-amber-400'
  }
  return {
    badge: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    bar: 'bg-red-500',
    icon: 'bg-red-50 dark:bg-red-900/20',
    iconColor: 'text-red-600 dark:text-red-400'
  }
})
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
      <div class="flex items-center gap-3 mb-3">
        <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <PackageIcon :size="16" class="text-blue-600 dark:text-blue-400" />
        </div>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Total repos</span>
      </div>
      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ totalRepos }}</span>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
      <div class="flex items-center gap-3 mb-3">
        <div class="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <CircleCheckIcon :size="16" class="text-green-600 dark:text-green-400" />
        </div>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Ready</span>
      </div>
      <div class="flex items-center justify-between mb-2">
        <div>
          <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ readyCount }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400 ml-1.5">of {{ totalRepos }}</span>
        </div>
        <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">{{ readyPercent }}%</span>
      </div>
      <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700 ease-out bg-green-500" :style="{ width: readyPercent + '%' }" />
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
      <div class="flex items-center gap-3 mb-3">
        <div class="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <CircleXIcon :size="16" class="text-red-600 dark:text-red-400" />
        </div>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Not ready</span>
      </div>
      <div class="flex items-center justify-between mb-2">
        <div>
          <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ notReadyCount }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400 ml-1.5">of {{ totalRepos }}</span>
        </div>
        <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">{{ notReadyPercent }}%</span>
      </div>
      <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700 ease-out bg-red-500" :style="{ width: notReadyPercent + '%' }" />
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
      <div class="flex items-center gap-3 mb-3">
        <div class="p-2 rounded-lg" :class="readinessColor.icon">
          <BarChart3Icon :size="16" :class="readinessColor.iconColor" />
        </div>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Overall readiness</span>
      </div>
      <div class="flex items-center justify-between mb-2">
        <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ readinessPercent }}%</span>
        <span class="text-xs font-semibold px-2.5 py-1 rounded-full" :class="readinessColor.badge">{{ readyCount }}/{{ readyCount + notReadyCount }} pass</span>
      </div>
      <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700 ease-out" :class="readinessColor.bar" :style="{ width: readinessPercent + '%' }" />
      </div>
    </div>
  </div>
</template>
