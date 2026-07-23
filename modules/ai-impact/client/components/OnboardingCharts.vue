<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink'
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
  featureTitles: { type: Object, default: () => ({}) },
  expanded: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle'])

const { navigateTo: navigateToModule } = useModuleLink()
const featureChartRef = ref(null)

function navigateToFeature(key) {
  if (key) navigateToModule('releases', 'feature-detail', { key })
}

function handleFeatureChartClick(event) {
  const chart = featureChartRef.value?.chart
  if (!chart) return
  const yScale = chart.scales.y
  const rect = chart.canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  if (x >= yScale.right) return
  const labels = featureChartData.value.labels
  for (let i = 0; i < labels.length; i++) {
    const tickY = yScale.getPixelForTick(i)
    if (Math.abs(y - tickY) < 12) {
      navigateToFeature(labels[i])
      return
    }
  }
}

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
const automatedList = computed(() => componentList.value.filter(c => (c.onboardingMethod || 'automated') === 'automated'))

// ── Chart 1: Status distribution (Doughnut) ──
const statusChartData = computed(() => {
  const completed = automatedList.value.filter(c => c.completionStatus === 'completed').length
  const inProgress = automatedList.value.filter(c => c.completionStatus === 'in-progress').length
  const inQueue = automatedList.value.filter(c => c.completionStatus === 'in_queue').length
  return {
    labels: ['Completed', 'In Progress', 'In Queue'],
    datasets: [{
      data: [completed, inProgress, inQueue],
      backgroundColor: ['#10b981', '#f59e0b', '#3b82f6'],
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
  const rhoaiCompleted = automatedList.value.filter(c => c.productContext === 'RHOAI' && c.completionStatus === 'completed').length
  const rhoaiInProgress = automatedList.value.filter(c => c.productContext === 'RHOAI' && c.completionStatus === 'in-progress').length
  const rhoaiInQueue = automatedList.value.filter(c => c.productContext === 'RHOAI' && c.completionStatus === 'in_queue').length
  const odhCompleted = automatedList.value.filter(c => c.productContext === 'ODH' && c.completionStatus === 'completed').length
  const odhInProgress = automatedList.value.filter(c => c.productContext === 'ODH' && c.completionStatus === 'in-progress').length
  const odhInQueue = automatedList.value.filter(c => c.productContext === 'ODH' && c.completionStatus === 'in_queue').length
  return {
    labels: ['RHOAI', 'ODH'],
    datasets: [
      { label: 'Completed', data: [rhoaiCompleted, odhCompleted], backgroundColor: '#10b981' },
      { label: 'In Progress', data: [rhoaiInProgress, odhInProgress], backgroundColor: '#f59e0b' },
      { label: 'In Queue', data: [rhoaiInQueue, odhInQueue], backgroundColor: '#3b82f6' }
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
  const completed = automatedList.value
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

  for (const comp of automatedList.value) {
    for (const feat of (comp.linkedFeatures || [])) {
      if (!featureMap[feat]) {
        featureMap[feat] = { completed: 0, inProgress: 0, inQueue: 0, latestCreated: '' }
      }
      if (comp.completionStatus === 'completed') {
        featureMap[feat].completed++
      } else if (comp.completionStatus === 'in_queue') {
        featureMap[feat].inQueue++
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
      },
      {
        label: 'In Queue',
        data: sorted.map(([, v]) => v.inQueue),
        backgroundColor: '#3b82f6'
      }
    ]
  }
})

const featureChartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  onClick(event, elements) {
    if (!elements.length) return
    const index = elements[0].index
    const key = featureChartData.value.labels[index]
    navigateToFeature(key)
  },
  onHover(event, elements) {
    event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
  },
  plugins: {
    legend: { position: 'bottom', labels: { color: textColor.value, font: { size: 11 }, padding: 10 } },
    tooltip: {
      callbacks: {
        title: ([item]) => {
          const key = item.label
          const title = props.featureTitles[key]
          return title ? `${key}: ${title}` : key
        },
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
      ticks: { color: '#3b82f6', font: { size: 11 } },
      grid: { color: gridColor.value }
    }
  }
}))

const hasFeatureData = computed(() => automatedList.value.some(c => c.linkedFeatures?.length > 0))

const hasManualData = computed(() => componentList.value.some(c => c.onboardingMethod === 'manual'))

// ── Chart 5: Avg Duration Comparison (Horizontal Bar) ──
function calcAvgDaysAutomated(list) {
  const measurable = list.filter(c => c.completionStatus === 'completed' && c.resolved && (c.validationDate || c.created))
  if (!measurable.length) return 0
  return Math.round(
    measurable.reduce((sum, c) => {
      const start = c.validationDate || c.created
      return sum + (new Date(c.resolved) - new Date(start)) / 86400000
    }, 0) / measurable.length
  )
}

function calcAvgDaysManual(list) {
  const measurable = list.filter(c => c.completionStatus === 'completed' && c.resolved)
  if (!measurable.length) return 0
  return Math.round(
    measurable.reduce((sum, c) => {
      const start = c.firstCommentDate || c.created
      return sum + (new Date(c.resolved) - new Date(start)) / 86400000
    }, 0) / measurable.length
  )
}

const durationChartData = computed(() => {
  const automated = componentList.value.filter(c => (c.onboardingMethod || 'automated') === 'automated')
  const manual = componentList.value.filter(c => c.onboardingMethod === 'manual')
  return {
    labels: ['AI-Automated', 'Manual'],
    datasets: [{
      label: 'Avg. Days',
      data: [calcAvgDaysAutomated(automated), calcAvgDaysManual(manual)],
      backgroundColor: ['#10b981', '#f59e0b'],
      borderRadius: 4,
      barThickness: 28
    }]
  }
})

const durationChartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { color: textColor.value, font: { size: 10 } }, grid: { color: gridColor.value }, title: { display: true, text: 'Days', color: textColor.value } },
    y: { ticks: { color: textColor.value, font: { size: 12, weight: 'bold' } }, grid: { display: false } }
  }
}))

// ── Chart 6: Quarterly Throughput (grouped bar) ──
const quarterlyKeys = computed(() => {
  const map = {}
  const completed = componentList.value.filter(c => c.completionStatus === 'completed' && c.resolved && c.resolution === 'Done')
  for (const c of completed) {
    const d = new Date(c.resolved)
    const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
    if (!map[q]) map[q] = { automated: [], manual: [] }
    const method = (c.onboardingMethod || 'automated') === 'automated' ? 'automated' : 'manual'
    map[q][method].push(c.key)
  }
  return map
})

const quarterlyChartData = computed(() => {
  const keys = quarterlyKeys.value
  const quarters = Object.keys(keys)
  if (!quarters.length) return { labels: [], datasets: [] }

  const sorted = quarters.sort((a, b) => {
    const [qa, ya] = [parseInt(a[1]), parseInt(a.slice(3))]
    const [qb, yb] = [parseInt(b[1]), parseInt(b.slice(3))]
    return ya !== yb ? ya - yb : qa - qb
  })

  return {
    labels: sorted,
    datasets: [
      { label: 'AI-Automated', data: sorted.map(q => keys[q].automated.length), backgroundColor: '#10b981', borderRadius: 4 },
      { label: 'Manual', data: sorted.map(q => keys[q].manual.length), backgroundColor: '#f59e0b', borderRadius: 4 }
    ]
  }
})

function openQuarterlyJiraLink(datasetIndex, barIndex) {
  const quarter = quarterlyChartData.value.labels[barIndex]
  const method = datasetIndex === 0 ? 'automated' : 'manual'
  const keys = quarterlyKeys.value[quarter]?.[method] || []
  if (!keys.length) return
  const jql = `key in (${keys.join(',')})`
  window.open(`https://redhat.atlassian.net/issues/?jql=${encodeURIComponent(jql)}`, '_blank')
}

const quarterlyChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick(event, elements) {
    if (!elements.length) return
    openQuarterlyJiraLink(elements[0].datasetIndex, elements[0].index)
  },
  onHover(event, elements) {
    event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
  },
  plugins: {
    legend: { position: 'bottom', labels: { color: textColor.value, font: { size: 11 }, padding: 10 } },
    tooltip: {
      callbacks: {
        afterBody(items) {
          if (!items.length) return ''
          return 'Click to view in Jira'
        }
      }
    }
  },
  scales: {
    x: { ticks: { color: textColor.value, font: { size: 10 } }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { precision: 0, color: textColor.value, font: { size: 10 } }, grid: { color: gridColor.value }, title: { display: true, text: 'Components Onboarded', color: textColor.value } }
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

      </div>

      <!-- AI Automation Impact section -->
      <div v-if="hasManualData" class="w-full border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
        <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-4">AI Automation Impact</h3>
      </div>

      <div class="flex flex-wrap gap-6" :class="{ 'mt-6': !hasManualData }">
        <!-- Components by Feature -->
        <div class="min-w-[300px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium dark:text-gray-300 mb-1">Components by Feature</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-3">Top {{ TOP_FEATURE_LIMIT }} features by most recent onboarding activity</p>
          <div v-if="hasFeatureData" class="h-[220px]">
            <Bar ref="featureChartRef" :data="featureChartData" :options="featureChartOptions" @click="handleFeatureChartClick" />
          </div>
          <div v-else class="h-[220px] flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            No feature links found
          </div>
        </div>

        <!-- Avg Duration Comparison -->
        <div v-if="hasManualData" class="min-w-[240px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium dark:text-gray-300 mb-3">Avg. Onboarding Duration</h3>
          <div class="h-[140px]">
            <Bar :data="durationChartData" :options="durationChartOptions" />
          </div>
        </div>

        <!-- Quarterly Throughput -->
        <div class="min-w-[280px] flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-medium dark:text-gray-300 mb-3">Quarterly Throughput</h3>
          <div v-if="quarterlyChartData.labels.length" class="h-[200px]">
            <Bar :data="quarterlyChartData" :options="quarterlyChartOptions" />
          </div>
          <div v-else class="h-[200px] flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
            No completed onboardings yet
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
