<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Pass Rate by RHOAI Version</h3>
      <span class="text-xs text-gray-500 dark:text-gray-400">bar height = pass rate · label = run count</span>
    </div>
    <div v-if="data.length" class="relative" style="height: 260px">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex items-center justify-center py-16 text-sm text-gray-400 dark:text-gray-500">
      No version data for the current filters
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps({
  data: { type: Array, default: () => [] } // [{ version, runs, passRate }]
})

// Color each bar by pass rate — green >=90%, amber >=70%, red below.
function colorFor(rate) {
  if (rate == null) return '#9ca3af'
  if (rate >= 0.9) return '#22c55e'
  if (rate >= 0.7) return '#f59e0b'
  return '#ef4444'
}

const chartData = computed(() => ({
  labels: props.data.map((d) => d.version),
  datasets: [{
    label: 'Pass rate',
    data: props.data.map((d) => (d.passRate == null ? 0 : Math.round(d.passRate * 100))),
    backgroundColor: props.data.map((d) => colorFor(d.passRate)),
    borderRadius: 4,
    maxBarThickness: 46
  }]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827', padding: 10, cornerRadius: 8,
      callbacks: {
        label: (ctx) => {
          const d = props.data[ctx.dataIndex]
          return `${ctx.parsed.y}% pass · ${d.runs} run${d.runs === 1 ? '' : 's'}`
        }
      }
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af', maxRotation: 60, minRotation: 30 } },
    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v) => v + '%' } }
  }
}))
</script>
