<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h3>
      <div v-if="labels.length" class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-0.5 rounded-full bg-blue-600"></span>
          Team
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-3 h-0.5 rounded-full bg-gray-300 dark:bg-gray-500"></span>
          Total
        </span>
      </div>
    </div>
    <div v-if="labels.length" class="relative" :style="{ height: height + 'px' }">
      <Line :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex items-center justify-center py-12 text-sm text-gray-400 dark:text-gray-500">
      No trend data available
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps({
  dailyBreakdown: { type: Array, default: () => [] },
  title: { type: String, default: 'Contribution Trend' },
  height: { type: Number, default: 260 }
})

const labels = computed(() =>
  props.dailyBreakdown.map(d => {
    const date = new Date(d.date)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
)

const teamData = computed(() =>
  props.dailyBreakdown.map(d => {
    const c = d.commits || {}
    const pr = d.pullRequests || {}
    const r = d.reviews || {}
    const i = d.issues || {}
    return (c.team || 0) + (pr.team || 0) + (r.team || 0) + (i.team || 0)
  })
)

const totalData = computed(() =>
  props.dailyBreakdown.map(d => {
    const c = d.commits || {}
    const pr = d.pullRequests || {}
    const r = d.reviews || {}
    const i = d.issues || {}
    return (c.total || 0) + (pr.total || 0) + (r.total || 0) + (i.total || 0)
  })
)

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: 'Total',
      data: totalData.value,
      borderColor: '#d1d5db',
      backgroundColor: 'rgba(209,213,219,0.08)',
      borderWidth: 1.5,
      borderDash: [4, 3],
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
      order: 1
    },
    {
      label: 'Team',
      data: teamData.value,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.12)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.3,
      fill: true,
      order: 0
    }
  ]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      titleFont: { size: 11 },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        title(items) {
          return items[0]?.label || ''
        },
        label(context) {
          return `${context.dataset.label}: ${context.parsed.y}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 10 },
        color: '#9ca3af',
        maxTicksLimit: 8
      }
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: {
        font: { size: 10 },
        color: '#9ca3af'
      }
    }
  }
}))
</script>
