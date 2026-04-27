<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
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

import ScoreDistributionChart from './ScoreDistributionChart.vue'
import CriteriaBreakdownChart from './CriteriaBreakdownChart.vue'

const props = defineProps({
  trendData: { type: Array, default: () => [] },
  breakdown: { type: Array, default: () => [] },
  expanded: { type: Boolean, default: true },
  filteredAssessments: { type: Object, default: () => ({}) },
  timeWindow: { type: String, default: 'month' }
})

const hasAssessments = computed(() => Object.keys(props.filteredAssessments).length > 0)

const emit = defineEmits(['toggle'])

const isDark = ref(false)
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onBeforeUnmount(() => observer.disconnect())
})

const textColor = computed(() => isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)')
const gridColor = computed(() => isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)')

const trailingWeeks = computed(() => {
  if (props.timeWindow === 'week') return 4
  if (props.timeWindow === '3months') return 13
  return 8
})

const trailingLabel = computed(() => `Weekly trend · trailing ${trailingWeeks.value} weeks`)

const createdPctChartData = computed(() => ({
  labels: props.trendData.map(p => p.date),
  datasets: [{
    label: 'Created with AI (%)',
    data: props.trendData.map(p => p.createdPct),
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    fill: true,
    tension: 0.3
  }]
}))

const createdPctChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { min: 0, max: 100, ticks: { font: { size: 10 }, color: textColor.value, callback: v => v + '%' }, title: { display: true, text: '% Created with AI', color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const revisedCountChartData = computed(() => ({
  labels: props.trendData.map(p => p.date),
  datasets: [{
    label: 'Revised with AI',
    data: props.trendData.map(p => p.revisedCount),
    backgroundColor: 'rgba(245, 158, 11, 0.6)',
    borderColor: 'rgba(245, 158, 11, 0.8)',
    borderWidth: 1
  }]
}))

const revisedCountChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Revised (count)', color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const breakdownChartData = computed(() => ({
  labels: props.breakdown.map(b => b.name),
  datasets: [{
    data: props.breakdown.map(b => b.value),
    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#d1d5db']
  }]
}))

const breakdownChartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))
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
        <span class="text-xs font-normal text-gray-400 dark:text-gray-500">{{ trailingLabel }}</span>
      </span>
      <svg
        class="h-4 w-4 transition-transform dark:text-gray-300"
        :class="{ 'rotate-180': expanded }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="expanded" class="px-6 pb-6 space-y-6">
      <div class="flex flex-wrap gap-6">
      <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium dark:text-gray-300">Created with AI (%)</h3>
          <div class="relative group">
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
              Percentage of RFEs created with AI per week over the selected time window.
            </div>
          </div>
        </div>
        <div class="h-[180px]">
          <Line :data="createdPctChartData" :options="createdPctChartOptions" />
        </div>
      </div>

      <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium dark:text-gray-300">Revised with AI</h3>
          <div class="relative group">
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
              Count of RFEs revised with AI per week over the selected time window.
            </div>
          </div>
        </div>
        <div class="h-[180px]">
          <Bar :data="revisedCountChartData" :options="revisedCountChartOptions" />
        </div>
      </div>

      <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
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

      <!-- Assessment Quality Charts -->
      <div v-if="hasAssessments" class="flex flex-wrap gap-6">
        <ScoreDistributionChart class="min-w-[280px] flex-1" :assessments="filteredAssessments" />
        <CriteriaBreakdownChart class="min-w-[280px] flex-1" :assessments="filteredAssessments" />
      </div>
    </div>
  </div>
</template>
