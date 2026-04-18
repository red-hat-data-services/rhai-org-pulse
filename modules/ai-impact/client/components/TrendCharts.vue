<script setup>
import { computed } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Filler, Title, Tooltip, Legend
)

const props = defineProps({
  trendData: { type: Array, default: () => [] },
  breakdown: { type: Array, default: () => [] },
  expanded: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle'])

const adoptionChartData = computed(() => ({
  labels: props.trendData.map(p => p.date),
  datasets: [
    {
      label: 'Created with AI (%)',
      data: props.trendData.map(p => p.createdPct),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.3,
      type: 'line',
      yAxisID: 'y'
    },
    {
      label: 'Revised with AI',
      data: props.trendData.map(p => p.revisedCount),
      backgroundColor: 'rgba(245, 158, 11, 0.5)',
      type: 'bar',
      yAxisID: 'y1'
    }
  ]
}))

const adoptionChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 } } } },
  scales: {
    x: { ticks: { font: { size: 10 } } },
    y: { position: 'left', ticks: { font: { size: 10 } }, title: { display: true, text: '% Created with AI' } },
    y1: { position: 'right', ticks: { font: { size: 10 }, precision: 0 }, title: { display: true, text: 'Revised (count)' }, grid: { drawOnChartArea: false } }
  }
}

const breakdownChartData = computed(() => ({
  labels: props.breakdown.map(b => b.name),
  datasets: [{
    data: props.breakdown.map(b => b.value),
    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#d1d5db']
  }]
}))

const breakdownChartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 } } },
    y: { ticks: { font: { size: 10 } } }
  }
}
</script>

<template>
  <div class="border-b border-gray-200 dark:border-gray-700">
    <button
      @click="emit('toggle')"
      class="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
    >
      <span class="flex items-center gap-2 text-sm font-medium dark:text-gray-300">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Trend Visualization
      </span>
      <svg
        class="h-4 w-4 transition-transform dark:text-gray-300"
        :class="{ 'rotate-180': expanded }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="expanded" class="px-6 pb-6 grid md:grid-cols-2 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium dark:text-gray-300">Adoption Over Time</h3>
          <div class="relative group">
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
              Shows the percentage of RFEs created with AI per week (line) and the count of RFEs revised with AI per week (bars) over the selected time window.
            </div>
          </div>
        </div>
        <div class="h-[180px]">
          <Line :data="adoptionChartData" :options="adoptionChartOptions" />
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium dark:text-gray-300">AI Involvement Breakdown</h3>
          <div class="relative group">
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
              Counts of RFEs by AI involvement: created with AI, revised with AI, both, or no AI involvement.
            </div>
          </div>
        </div>
        <div class="h-[180px]">
          <Bar :data="breakdownChartData" :options="breakdownChartOptions" />
        </div>
      </div>
    </div>
  </div>
</template>
