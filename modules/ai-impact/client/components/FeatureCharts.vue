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
import { useChartTheme } from '../composables/useChartTheme.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Title, Tooltip, Legend)

const props = defineProps({
  trendData: { type: Array, default: () => [] },
  breakdown: { type: Array, default: () => [] },
  expanded: { type: Boolean, default: true },
  timeWindow: { type: String, default: 'month' },
  features: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['toggle'])

const { textColor, gridColor } = useChartTheme()

const featureList = computed(() => Object.values(props.features))

const trailingWeeks = computed(() => {
  if (props.timeWindow === 'week') return 4
  if (props.timeWindow === '3months') return 13
  return 8
})

const trailingLabel = computed(() => `Weekly trend · trailing ${trailingWeeks.value} weeks`)

// ─── Trend charts ───

const featuresProcessedChartData = computed(() => ({
  labels: props.trendData.map(p => p.date),
  datasets: [{
    label: 'Features Processed via AI',
    data: props.trendData.map(p => p.total),
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    fill: true,
    tension: 0.3
  }]
}))

const featuresProcessedChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Features (count)', color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const needsAttentionChartData = computed(() => ({
  labels: props.trendData.map(p => p.date),
  datasets: [{
    label: 'Needs Attention',
    data: props.trendData.map(p => p.needsAttentionCount),
    backgroundColor: 'rgba(245, 158, 11, 0.6)',
    borderColor: 'rgba(245, 158, 11, 0.8)',
    borderWidth: 1
  }]
}))

const needsAttentionChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Needs Attention (count)', color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const breakdownChartData = computed(() => ({
  labels: props.breakdown.map(b => b.name),
  datasets: [{
    data: props.breakdown.map(b => b.value),
    backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
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

// ─── Existing quality charts ───

const scoreDistributionData = computed(() => {
  const buckets = Array(9).fill(0)
  for (const f of featureList.value) {
    const total = f.scores?.total ?? 0
    if (total >= 0 && total <= 8) buckets[total]++
  }
  return {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
    datasets: [{
      label: 'Features',
      data: buckets,
      backgroundColor: buckets.map((_, i) => {
        if (i <= 2) return 'rgba(239, 68, 68, 0.7)'
        if (i <= 5) return 'rgba(245, 158, 11, 0.7)'
        return 'rgba(16, 185, 129, 0.7)'
      })
    }]
  }
})

const scoreDistributionOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: true, text: 'Score Distribution', color: textColor.value },
    legend: { display: false }
  },
  scales: {
    x: { title: { display: true, text: 'Total Score', color: textColor.value }, ticks: { color: textColor.value }, grid: { color: gridColor.value } },
    y: { title: { display: true, text: 'Count', color: textColor.value }, beginAtZero: true, ticks: { stepSize: 1, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const dimensionBreakdownData = computed(() => {
  const dims = ['feasibility', 'testability', 'scope', 'architecture']
  const counts = { pass: [], partial: [], fail: [] }

  for (const dim of dims) {
    let pass = 0, partial = 0, fail = 0
    for (const f of featureList.value) {
      const score = f.scores?.[dim] ?? 0
      if (score === 2) pass++
      else if (score === 1) partial++
      else fail++
    }
    counts.pass.push(pass)
    counts.partial.push(partial)
    counts.fail.push(fail)
  }

  return {
    labels: dims.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
    datasets: [
      { label: 'Pass (2)', data: counts.pass, backgroundColor: 'rgba(16, 185, 129, 0.7)' },
      { label: 'Partial (1)', data: counts.partial, backgroundColor: 'rgba(245, 158, 11, 0.7)' },
      { label: 'Fail (0)', data: counts.fail, backgroundColor: 'rgba(239, 68, 68, 0.7)' }
    ]
  }
})

const dimensionBreakdownOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: true, text: 'Dimension Breakdown', color: textColor.value },
    legend: { display: true, position: 'bottom', labels: { color: textColor.value } }
  },
  scales: {
    x: { stacked: true, ticks: { color: textColor.value }, grid: { color: gridColor.value } },
    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: textColor.value }, grid: { color: gridColor.value } }
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
      <!-- Trend charts -->
      <div class="flex flex-wrap gap-6">
        <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-medium dark:text-gray-300">Features Processed via AI</h3>
            <div class="relative group">
              <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                Number of features processed via AI per week over the selected time window.
              </div>
            </div>
          </div>
          <div class="h-[180px]">
            <Line :data="featuresProcessedChartData" :options="featuresProcessedChartOptions" />
          </div>
        </div>

        <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-medium dark:text-gray-300">Needs Attention</h3>
            <div class="relative group">
              <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                Count of features flagged as needing attention per week over the selected time window.
              </div>
            </div>
          </div>
          <div class="h-[180px]">
            <Bar :data="needsAttentionChartData" :options="needsAttentionChartOptions" />
          </div>
        </div>

        <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-medium dark:text-gray-300">Recommendation Breakdown</h3>
            <div class="relative group">
              <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                Counts of features by AI recommendation: Approve, Revise, or Reject for the selected time window.
              </div>
            </div>
          </div>
          <div class="h-[180px]">
            <Bar :data="breakdownChartData" :options="breakdownChartOptions" />
          </div>
        </div>
      </div>

      <!-- Quality distribution charts -->
      <div v-if="featureList.length > 0" class="flex flex-wrap gap-6">
        <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="h-[200px]">
            <Bar :data="scoreDistributionData" :options="scoreDistributionOptions" />
          </div>
        </div>
        <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="h-[200px]">
            <Bar :data="dimensionBreakdownData" :options="dimensionBreakdownOptions" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
