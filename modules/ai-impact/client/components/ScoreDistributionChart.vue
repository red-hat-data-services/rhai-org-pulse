<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps({
  assessments: { type: Object, default: () => ({}) }
})

const buckets = computed(() => {
  const counts = Array(11).fill(0)
  for (const a of Object.values(props.assessments)) {
    const score = Math.max(0, Math.min(10, a.total))
    counts[score]++
  }
  return counts
})

const chartData = computed(() => ({
  labels: Array.from({ length: 11 }, (_, i) => String(i)),
  datasets: [{
    label: 'RFEs',
    data: buckets.value,
    backgroundColor: buckets.value.map((_, i) => i < 5 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)'),
    borderColor: buckets.value.map((_, i) => i < 5 ? '#ef4444' : '#22c55e'),
    borderWidth: 1
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items) => `Score: ${items[0].label}`,
        label: (item) => `${item.raw} RFE${item.raw !== 1 ? 's' : ''}`
      }
    }
  },
  scales: {
    x: {
      title: { display: true, text: 'Quality Score', font: { size: 11 } },
      ticks: { font: { size: 10 } }
    },
    y: {
      title: { display: true, text: 'Count', font: { size: 11 } },
      ticks: { font: { size: 10 }, precision: 0 },
      beginAtZero: true
    }
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium dark:text-gray-300">Score Distribution</h3>
      <div class="relative group">
        <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-56 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
          Distribution of quality scores across filtered RFEs. Red bars indicate failing scores (0-4), green bars indicate passing scores (5-10).
        </div>
      </div>
    </div>
    <div class="h-[180px]">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
