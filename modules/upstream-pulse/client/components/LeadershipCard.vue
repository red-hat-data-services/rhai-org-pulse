<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
    <div class="flex items-center gap-3 mb-3">
      <div class="p-2 rounded-lg" :class="bgColor">
        <component :is="icon" :size="16" :class="color" />
      </div>
      <span class="text-sm font-medium text-gray-600 dark:text-gray-400">{{ label }}</span>
    </div>
    <div class="flex items-center justify-between mb-2">
      <div>
        <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ team }}</span>
        <span class="text-sm text-gray-500 dark:text-gray-400 ml-1.5">of {{ total }}</span>
      </div>
      <span
        class="text-xs font-semibold px-2.5 py-1 rounded-full"
        :class="percent >= percentThreshold
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
      >{{ Number(percent).toFixed(1) }}%</span>
    </div>
    <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-700 ease-out"
        :class="barColor"
        :style="{ width: Math.min(percent, 100) + '%' }"
      ></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  icon: Object,
  team: { type: [Number, String], default: 0 },
  total: { type: [Number, String], default: 0 },
  percent: { type: Number, default: 0 },
  percentThreshold: { type: Number, default: 10 },
  color: { type: String, default: 'text-blue-600 dark:text-blue-400' },
  bgColor: { type: String, default: 'bg-blue-50 dark:bg-blue-900/20' },
  barColor: { type: String, default: 'bg-blue-600' },
})
</script>
