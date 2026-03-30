<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
    <div class="flex items-center gap-3 mb-3">
      <div v-if="icon" class="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <component :is="icon" :size="16" class="text-gray-600 dark:text-gray-400" />
      </div>
      <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ label }}</span>
    </div>
    <div class="flex items-center justify-between">
      <div>
        <div class="flex items-baseline gap-1.5">
          <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {{ typeof value === 'number' ? value.toLocaleString() : value }}
          </span>
          <span v-if="suffix" class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ suffix }}</span>
        </div>
        <div v-if="subValue" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ subValue }}</div>
      </div>
      <div v-if="trend" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full" :class="trendBg">
        <span class="text-xs font-semibold" :class="trendColor">
          {{ trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→' }}
          {{ Math.abs(trend.changePercent || 0).toFixed(1) }}%
        </span>
      </div>
    </div>
    <div v-if="trend" class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">vs prev period</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: String,
  value: [Number, String],
  suffix: String,
  subValue: String,
  trend: Object,
  icon: Object,
})

const trendColor = computed(() => {
  if (!props.trend) return ''
  if (props.trend.direction === 'up') return 'text-green-600 dark:text-green-400'
  if (props.trend.direction === 'down') return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
})

const trendBg = computed(() => {
  if (!props.trend) return ''
  if (props.trend.direction === 'up') return 'bg-green-50 dark:bg-green-900/20'
  if (props.trend.direction === 'down') return 'bg-red-50 dark:bg-red-900/20'
  return 'bg-gray-50 dark:bg-gray-700/50'
})
</script>
