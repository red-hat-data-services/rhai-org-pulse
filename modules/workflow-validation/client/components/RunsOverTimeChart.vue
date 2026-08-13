<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Runs Over Time</h3>
      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-green-500"></span>Pass</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-red-500"></span>Fail</span>
      </div>
    </div>
    <div v-if="data.length" class="relative" style="height: 260px">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex items-center justify-center py-16 text-sm text-gray-400 dark:text-gray-500">
      No run data for the current filters
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
  data: { type: Array, default: () => [] } // [{ date, pass, fail, total }]
})

const labels = computed(() => props.data.map((d) => {
  const dt = new Date(d.date)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}))

const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    { label: 'Pass', data: props.data.map((d) => d.pass), backgroundColor: '#22c55e', stack: 'v', borderRadius: 3 },
    { label: 'Fail', data: props.data.map((d) => d.fail), backgroundColor: '#ef4444', stack: 'v', borderRadius: 3 }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#111827', padding: 10, cornerRadius: 8 }
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, color: '#9ca3af', maxTicksLimit: 10 } },
    y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, color: '#9ca3af', precision: 0 } }
  }
}
</script>
