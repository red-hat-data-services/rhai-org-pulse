<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Doughnut, Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  ArcElement, CategoryScale, LinearScale, BarElement,
  PointElement, LineElement, Filler, Title, Tooltip, Legend
)

const props = defineProps({
  components: { type: Object, default: () => ({}) },
  expanded: { type: Boolean, default: true }
})

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

const textColor = computed(() => isDark.value ? 'rgba(209,213,219,1)' : 'rgba(107,114,128,1)')
const gridColor = computed(() => isDark.value ? 'rgba(75,85,99,0.5)' : 'rgba(229,231,235,1)')

const componentList = computed(() => Object.values(props.components))

// ── Chart 1: Status distribution (Doughnut) ──
const statusChartData = computed(() => {
  const completed = componentList.value.filter(c => c.completionStatus === 'completed').length
  const inProgress = componentList.value.filter(c => c.completionStatus === 'in-progress').length
  return {
    labels: ['Completed', 'In Progress'],
    datasets: [{
      data: [completed, inProgress],
      backgroundColor: ['#10b981', '#f59e0b'],
      borderWidth: 0
    }]
  }
})

const statusChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: textColor.value, font: { size: 11 }, padding: 12 } }
  }
}))

// ── Chart 2: By product context (Horizontal Bar) ──
const productChartData = computed(() => {
  const rhoaiCompleted = componentList.value.filter(c => c.productContext === 'RHOAI' && c.completionStatus === 'completed').length
  const rhoaiInProgress = componentList.value.filter(c => c.productContext === 'RHOAI' && c.completionStatus === 'in-progress').length
  const odhCompleted = componentList.value.filter(c => c.productContext === 'ODH' && c.completionStatus === 'completed').length
  const odhInProgress = componentList.value.filter(c => c.productContext === 'ODH' && c.completionStatus === 'in-progress').length
  return {
    labels: ['RHOAI', 'ODH'],
    datasets: [
      { label: 'Completed', data: [rhoaiCompleted, odhCompleted], backgroundColor: '#10b981' },
      { label: 'In Progress', data: [rhoaiInProgress, odhInProgress], backgroundColor: '#f59e0b' }
    ]
  }
})

const productChartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { color: textColor.value, font: { size: 11 }, padding: 10 } } },
  scales: {
    x: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: textColor.value, font: { size: 10 } }, grid: { color: gridColor.value } },
    y: { stacked: true, ticks: { color: textColor.value, font: { size: 11 } }, grid: { color: gridColor.value } }
  }
}))

// ── Chart 3: Onboarded over time (cumulative line) ──
const timelineChartData = computed(() => {
  const completed = componentList.value
    .filter(c => c.completionStatus === 'completed' && c.resolved)
    .map(c => ({ month: c.resolved.slice(0, 7) }))
    .sort((a, b) => a.month.localeCompare(b.month))

  if (!completed.length) return { labels: [], datasets: [] }

  const counts = {}
  for (const { month } of completed) {
    counts[month] = (counts[month] || 0) + 1
  }
  const months = Object.keys(counts).sort()
  let cumulative = 0
  const data = months.map(m => { cumulative += counts[m]; return cumulative })

  return {
    labels: months,
    datasets: [{
      label: 'Cumulative Onboarded',
      data,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16,185,129,0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 4
    }]
  }
})

const timelineChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: textColor.value, font: { size: 10 } }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { precision: 0, color: textColor.value, font: { size: 10 } }, title: { display: true, text: 'Total Onboarded', color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

// ── Chart 4: Components by Feature (top 10 by most recent onboarding date) ──
const TOP_FEATURE_LIMIT = 10

const featureChartData = computed(() => {
  // Build feature → { components, latestCreated } map
  const featureMap = {}

  for (const comp of componentList.value) {
    for (const feat of (comp.linkedFeatures || [])) {
      if (!featureMap[feat]) {
        featureMap[feat] = { completed: 0, inProgress: 0, latestCreated: '' }
      }
      if (comp.completionStatus === 'completed') {
        featureMap[feat].completed++
      } else {
        featureMap[feat].inProgress++
      }
      if ((comp.created || '') > featureMap[feat].latestCreated) {
        featureMap[feat].latestCreated = comp.created || ''
      }
    }
  }

  if (!Object.keys(featureMap).length) return { labels: [], datasets: [] }

  // Sort by most recent onboarding date, take top N
  const sorted = Object.entries(featureMap)
    .sort(([, a], [, b]) => b.latestCreated.localeCompare(a.latestCreated))
    .slice(0, TOP_FEATURE_LIMIT)
    .reverse() // bottom → top for horizontal bar

  return {
    labels: sorted.map(([key]) => key),
    datasets: [
      {
        label: 'Completed',
        data: sorted.map(([, v]) => v.completed),
        backgroundColor: '#10b981'
      },
      {
        label: 'In Progress',
        data: sorted.map(([, v]) => v.inProgress),
        backgroundColor: '#f59e0b'
      }
    ]
  }
})

const featureChartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: textColor.value, font: { size: 11 }, padding: 10 } },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x} component${ctx.parsed.x !== 1 ? 's' : ''}`
      }
    }
  },
  scales: {
    x: {
      stacked: true,
      beginAtZero: true,
      ticks: { precision: 0, color: textColor.value, font: { size: 10 } },
      grid: { color: gridColor.value }
    },
    y: {
      stacked: true,
      ticks: { color: textColor.value, font: { size: 11 } },
      grid: { color: gridColor.value }
    }
  }
}))

const hasFeatureData = computed(() => componentList.value.some(c => c.linkedFeatures?.length > 0))
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
        Onboarding Charts
      </span>
      <svg
        class="h-4 w-4 transition-transform dark:text-gray-300"
        :class="{ 'rotate-180': expanded }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="expanded" class="px-6 pb-6">
      <div class="flex flex-wrap gap-6">
        <!-- Status Distribution -->
        <div class="min-w-[220px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium dark:text-gray-300 mb-3">Status Distribution</h3>
          <div class="h-[200px]">
            <Doughnut :data="statusChartData" :options="statusChartOptions" />
          </div>
        </div>

        <!-- By Product Context -->
        <div class="min-w-[260px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium dark:text-gray-300 mb-3">By Product Context</h3>
          <div class="h-[200px]">
            <Bar :data="productChartData" :options="productChartOptions" />
          </div>
        </div>

        <!-- Onboarded Over Time -->
        <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium dark:text-gray-300 mb-3">Onboarded Over Time</h3>
          <div class="h-[200px]">
            <Line :data="timelineChartData" :options="timelineChartOptions" />
          </div>
        </div>

        <!-- Components by Feature -->
        <div class="min-w-[300px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium dark:text-gray-300 mb-1">Components by Feature</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-3">Top {{ TOP_FEATURE_LIMIT }} features by most recent onboarding activity</p>
          <div v-if="hasFeatureData" class="h-[220px]">
            <Bar :data="featureChartData" :options="featureChartOptions" />
          </div>
          <div v-else class="h-[220px] flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            No feature links found
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
