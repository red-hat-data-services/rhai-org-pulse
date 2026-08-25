<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span class="flex items-center gap-1.5"><span class="w-3 h-0.5 rounded-full bg-blue-600"></span>Pass rate</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-2 rounded-sm bg-gray-300 dark:bg-gray-600"></span>Runs</span>
      </div>
    </div>
    <div v-if="data.length" class="relative" style="height: 260px">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex items-center justify-center py-16 text-sm text-gray-400 dark:text-gray-500">
      No trend data for the current filters
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const props = defineProps({
  title: { type: String, default: 'Pass Rate Trend' },
  data: { type: Array, default: () => [] } // [{ date, total, pass, fail }]
})

const labels = computed(() => props.data.map((d) => {
  const dt = new Date(d.date)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}))

const passRatePct = computed(() => props.data.map((d) => d.total ? Math.round((d.pass / d.total) * 100) : 0))

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      type: 'bar',
      label: 'Runs',
      data: props.data.map((d) => d.total),
      backgroundColor: 'rgba(156,163,175,0.35)',
      borderRadius: 3,
      yAxisID: 'y1',
      order: 2
    },
    {
      type: 'line',
      label: 'Pass rate',
      data: passRatePct.value,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.12)',
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
      yAxisID: 'y',
      order: 1
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827', padding: 10, cornerRadius: 8,
      callbacks: {
        label: (ctx) => ctx.dataset.label === 'Pass rate'
          ? `Pass rate: ${ctx.parsed.y}%`
          : `Runs: ${ctx.parsed.y}`
      }
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af', maxTicksLimit: 10 } },
    y: {
      position: 'left', beginAtZero: true, max: 100,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { font: { size: 10 }, color: '#9ca3af', callback: (v) => v + '%' }
    },
    y1: {
      position: 'right', beginAtZero: true,
      grid: { display: false },
      ticks: { font: { size: 10 }, color: '#9ca3af', precision: 0 }
    }
  }
}
</script>
