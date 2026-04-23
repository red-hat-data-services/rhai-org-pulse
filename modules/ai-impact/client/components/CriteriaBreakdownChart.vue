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

const CRITERIA = ['what', 'why', 'how', 'task', 'size']
const CRITERIA_LABELS = { what: 'What', why: 'Why', how: 'How', task: 'Task', size: 'Size' }

const stats = computed(() => {
  const entries = Object.values(props.assessments)
  const count = entries.length
  if (count === 0) {
    return CRITERIA.map(c => ({ criterion: c, avg: 0, zeroPct: 0 }))
  }
  return CRITERIA.map(c => {
    let sum = 0
    let zeros = 0
    for (const a of entries) {
      const score = a.scores?.[c] ?? 0
      sum += score
      if (score === 0) zeros++
    }
    return {
      criterion: c,
      avg: Math.round((sum / count) * 100) / 100,
      zeroPct: Math.round((zeros / count) * 100)
    }
  })
})

const chartData = computed(() => ({
  labels: CRITERIA.map(c => CRITERIA_LABELS[c]),
  datasets: [
    {
      label: 'Avg Score (0-2)',
      data: stats.value.map(s => s.avg),
      backgroundColor: 'rgba(99, 102, 241, 0.7)',
      borderColor: '#6366f1',
      borderWidth: 1,
      yAxisID: 'y'
    },
    {
      label: 'Zero-Score %',
      data: stats.value.map(s => s.zeroPct),
      backgroundColor: 'rgba(239, 68, 68, 0.4)',
      borderColor: '#ef4444',
      borderWidth: 1,
      yAxisID: 'y1'
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 11 } } },
    tooltip: {
      callbacks: {
        label: (item) => {
          if (item.datasetIndex === 0) return `Avg: ${item.raw}/2`
          return `Zero-score: ${item.raw}%`
        }
      }
    }
  },
  scales: {
    y: {
      position: 'left',
      min: 0,
      max: 2,
      title: { display: true, text: 'Avg Score', font: { size: 11 } },
      ticks: { font: { size: 10 }, stepSize: 0.5 }
    },
    y1: {
      position: 'right',
      min: 0,
      max: 100,
      title: { display: true, text: 'Zero-Score %', font: { size: 11 } },
      ticks: { font: { size: 10 } },
      grid: { drawOnChartArea: false }
    },
    x: {
      ticks: { font: { size: 10 } }
    }
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium dark:text-gray-300">Criteria Performance</h3>
      <div class="relative group">
        <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
          Average score per criterion (0-2 scale, blue bars) and percentage of RFEs scoring zero per criterion (red bars). Identifies which quality dimensions are weakest.
        </div>
      </div>
    </div>
    <div class="h-[180px]">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
