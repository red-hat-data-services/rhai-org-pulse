<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip
} from 'chart.js'
import { useCategories } from '../composables/useCategories.js'

ChartJS.register(ArcElement, Tooltip)

const props = defineProps({
  candidates: { type: Array, required: true }
})

const { CATEGORY_KEYS, getCategoryMeta } = useCategories()

const COLORS = {
  'model-inference': '#3b82f6',
  'model-customization': '#a855f7',
  'agentic-ai': '#22c55e',
  'management-observability-security': '#f59e0b'
}

const categoryCounts = computed(() => {
  const counts = {}
  for (const key of CATEGORY_KEYS) counts[key] = 0
  for (const c of props.candidates) {
    const cat = c.category || 'agentic-ai'
    if (counts[cat] !== undefined) counts[cat]++
    else counts[cat] = 1
  }
  return counts
})

const chartData = computed(() => ({
  labels: CATEGORY_KEYS.map(k => getCategoryMeta(k).shortName),
  datasets: [{
    data: CATEGORY_KEYS.map(k => categoryCounts.value[k] || 0),
    backgroundColor: CATEGORY_KEYS.map(k => COLORS[k]),
    borderWidth: 0,
    hoverOffset: 6
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '60%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label(ctx) {
          const total = props.candidates.length
          const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(0) : '0'
          return `${ctx.label}: ${ctx.parsed} (${pct}%)`
        }
      }
    }
  }
}

const legendItems = computed(() =>
  CATEGORY_KEYS.map(k => ({
    label: getCategoryMeta(k).shortName,
    color: COLORS[k],
    count: categoryCounts.value[k] || 0
  }))
)
</script>

<template>
  <div data-testid="category-donut" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">By Category</h3>
    <div class="flex flex-col items-center gap-3">
      <div class="relative w-36 h-36">
        <Doughnut :data="chartData" :options="chartOptions" />
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ candidates.length }}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 justify-center">
        <div v-for="item in legendItems" :key="item.label" class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: item.color }"></span>
          {{ item.label }} ({{ item.count }})
        </div>
      </div>
    </div>
  </div>
</template>
