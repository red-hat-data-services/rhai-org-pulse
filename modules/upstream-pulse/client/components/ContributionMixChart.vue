<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Contribution Mix</h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Where your team's effort is concentrated</p>

    <div v-if="hasData" class="flex flex-col lg:flex-row items-center gap-6">
      <div class="relative w-48 h-48 shrink-0">
        <Doughnut :data="chartData" :options="chartOptions" />
      </div>
      <div class="flex-1 grid grid-cols-2 gap-3 w-full">
        <div v-for="item in legendItems" :key="item.label" class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
          <div class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ item.value.toLocaleString() }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ item.label }} · {{ item.percent }}%</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex items-center justify-center py-12 text-sm text-gray-400 dark:text-gray-500">
      No contribution data available
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  contributions: { type: Object, default: () => ({}) }
})

const TYPES = [
  { key: 'commits', label: 'Commits', color: '#2563eb' },
  { key: 'pullRequests', label: 'Pull Requests', color: '#7c3aed' },
  { key: 'reviews', label: 'Reviews', color: '#16a34a' },
  { key: 'issues', label: 'Issues', color: '#f97316' }
]

const values = computed(() =>
  TYPES.map(t => props.contributions?.[t.key]?.team || 0)
)

const total = computed(() => values.value.reduce((a, b) => a + b, 0))
const hasData = computed(() => total.value > 0)

const legendItems = computed(() =>
  TYPES.map((t, i) => ({
    label: t.label,
    color: t.color,
    value: values.value[i],
    percent: total.value > 0 ? ((values.value[i] / total.value) * 100).toFixed(1) : '0'
  }))
)

const chartData = computed(() => ({
  labels: TYPES.map(t => t.label),
  datasets: [{
    data: values.value,
    backgroundColor: TYPES.map(t => t.color),
    borderWidth: 0,
    hoverOffset: 6
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '65%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label(context) {
          const pct = total.value > 0
            ? ((context.parsed / total.value) * 100).toFixed(1)
            : '0'
          return `${context.label}: ${context.parsed} (${pct}%)`
        }
      }
    }
  }
}
</script>
