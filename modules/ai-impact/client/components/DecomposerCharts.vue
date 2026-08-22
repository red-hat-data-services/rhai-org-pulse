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

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Filler, Title, Tooltip, Legend
)

const props = defineProps({
  runs: { type: Array, default: () => [] },
  aggregates: { type: Object, default: null },
  // Optional cutoff date (ms) — truncates the run trend to on/after this date.
  cutoff: { type: Number, default: null }
})

const { textColor, gridColor } = useChartTheme()

const sortedRuns = computed(() => {
  const runs = [...props.runs].sort((a, b) => new Date(a.started) - new Date(b.started))
  if (!props.cutoff) return runs
  return runs.filter(r => new Date(r.started).getTime() >= props.cutoff)
})

const runLabels = computed(() => sortedRuns.value.map(r => (r.started || '').slice(0, 10)))

// ─── Trend: epics generated + strategies processed per run ───
const trendData = computed(() => ({
  labels: runLabels.value,
  datasets: [
    {
      type: 'bar',
      label: 'Epics generated',
      data: sortedRuns.value.map(r => r.submitted_epics || 0),
      backgroundColor: 'rgba(59, 130, 246, 0.6)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      yAxisID: 'y'
    },
    {
      type: 'line',
      label: 'Strategies decomposed',
      data: sortedRuns.value.map(r => r.total || 0),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.3,
      yAxisID: 'y'
    }
  ]
}))

const trendOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, color: textColor.value } } },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Count per run', color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

// ─── AI Implementability distribution ───
const implData = computed(() => {
  const dist = props.aggregates?.implementability_distribution || {}
  const entries = Object.entries(dist)
  return {
    labels: entries.map(([k]) => k),
    datasets: [{ data: entries.map(([, v]) => v), backgroundColor: ['#22c55e', '#eab308', '#ef4444'], borderWidth: 0 }]
  }
})

const barOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, grid: { color: gridColor.value } }
  }
}))

// ─── Component distribution: ALL components, every label shown ───
const componentEntries = computed(() => Object.entries(props.aggregates?.component_distribution || {}))
const componentData = computed(() => ({
  labels: componentEntries.value.map(([k]) => k),
  datasets: [{ data: componentEntries.value.map(([, v]) => v), backgroundColor: '#0ea5e9', borderWidth: 0 }]
}))
// Grow height so every label fits (Chart.js autoSkip disabled below).
const componentHeight = computed(() => Math.max(180, componentEntries.value.length * 22))
const componentOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, grid: { color: gridColor.value } },
    y: { ticks: { font: { size: 10 }, color: textColor.value, autoSkip: false }, grid: { color: gridColor.value } }
  }
}))

const hasComponents = computed(() => componentEntries.value.length > 0)
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- Row 1: volume trend (left) + AI implementability (right) -->
    <div class="flex flex-wrap gap-6">
      <div class="min-w-[320px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-medium dark:text-gray-300 mb-3">Decomposition Volume by Run</h3>
        <div class="h-[220px]"><Line :data="trendData" :options="trendOptions" /></div>
      </div>
      <div class="min-w-[320px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-medium dark:text-gray-300 mb-3">AI Implementability</h3>
        <div class="h-[220px]"><Bar :data="implData" :options="barOptions" /></div>
      </div>
    </div>

    <!-- Row 2: components by epic count (own full-width card so every label fits) -->
    <div v-if="hasComponents" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-medium dark:text-gray-300 mb-3">Epics by Component ({{ componentEntries.length }})</h3>
      <div :style="{ height: componentHeight + 'px' }"><Bar :data="componentData" :options="componentOptions" /></div>
    </div>
  </div>
</template>
