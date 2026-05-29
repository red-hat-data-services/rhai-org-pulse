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
  Tooltip,
  Legend
} from 'chart.js'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import MrKpiCharts from './MrKpiCharts.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

const isDark = ref(false)
let darkObserver = null
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  darkObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => { if (darkObserver) darkObserver.disconnect() })

const textColor = computed(() => isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)')
const gridColor = computed(() => isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)')

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  docData: { type: Object, default: null },
  mrKpiData: { type: Object, default: null }
})

const emit = defineEmits(['retry'])

const searchQuery = ref('')
const docFilter = ref('all')

const jiraHost = computed(() => props.docData?.jiraHost || 'https://redhat.atlassian.net')
const isEmpty = computed(() => !props.docData?.fetchedAt)
const metrics = computed(() => props.docData?.metrics || null)
const trendData = computed(() => props.docData?.trendData || [])

const filteredIssues = computed(() => {
  if (!props.docData?.issues) return []
  let issues = props.docData.issues

  if (docFilter.value === 'contributed') {
    issues = issues.filter(i => i.hasDocContributed)
  } else if (docFilter.value === 'skipped') {
    issues = issues.filter(i => i.hasDocSkipped)
  } else if (docFilter.value === 'not-contributed') {
    issues = issues.filter(i => !i.hasDocContributed && !i.hasDocSkipped)
  }

  const q = searchQuery.value.toLowerCase()
  if (q) {
    issues = issues.filter(i =>
      i.key.toLowerCase().includes(q) ||
      i.summary.toLowerCase().includes(q) ||
      (i.ccsEpic?.key && i.ccsEpic.key.toLowerCase().includes(q))
    )
  }

  return issues.slice().sort((a, b) => {
    const aScore = a.hasDocContributed ? 2 : a.hasDocSkipped ? 1 : 0
    const bScore = b.hasDocContributed ? 2 : b.hasDocSkipped ? 1 : 0
    return aScore - bScore
  })
})

const completedIssues = computed(() => props.docData?.completedIssues || [])
const cumulativeStats = computed(() => props.docData?.cumulativeStats || null)

// ─── Graph A: Documentation Demand ───

const demandChartData = computed(() => ({
  labels: trendData.value.map(p => p.date),
  datasets: [{
    label: 'Issues requiring docs',
    data: trendData.value.map(p => p.demand),
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    fill: true,
    tension: 0.3,
    pointRadius: 2,
    borderWidth: 2
  }]
}))

const demandChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(ctx) { return `${ctx.parsed.y} issues` }
      }
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 }, color: textColor.value, maxRotation: 0, maxTicksLimit: 8 }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Issue count', font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

// ─── Graph B: Coverage (stacked bar) ───

const coverageChartData = computed(() => ({
  labels: trendData.value.map(p => p.date),
  datasets: [
    {
      label: 'Skipped',
      data: trendData.value.map(p => p.skippedCount || 0),
      backgroundColor: 'rgba(107, 114, 128, 0.7)',
      borderColor: '#6b7280',
      borderWidth: 1,
      stack: 'coverage'
    },
    {
      label: 'AI Generated',
      data: trendData.value.map(p => p.contributedCount || 0),
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
      borderColor: '#10b981',
      borderWidth: 1,
      stack: 'coverage'
    }
  ]
}))

const coverageChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: textColor.value } },
    tooltip: {
      callbacks: {
        afterBody(items) {
          if (!items.length) return ''
          const point = trendData.value[items[0].dataIndex]
          if (!point) return ''
          return `Total coverage: ${point.coverageCount || 0} of ${point.demand || 0}`
        }
      }
    }
  },
  scales: {
    x: { stacked: true, ticks: { font: { size: 9 }, color: textColor.value, maxRotation: 0, maxTicksLimit: 8 }, grid: { color: gridColor.value } },
    y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Issues covered', font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

// ─── Graph C: Tool Activity ───

const activityChartData = computed(() => ({
  labels: trendData.value.map(p => p.date),
  datasets: [
    {
      label: 'invoked (7d avg)',
      data: trendData.value.map(p => p.invokedRate),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2
    },
    {
      label: 'contributed (7d avg)',
      data: trendData.value.map(p => p.contributedRate),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2
    },
  ]
}))

const activityChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: textColor.value } },
    tooltip: {
      callbacks: {
        label(ctx) {
          return `${ctx.dataset.label}: ${ctx.parsed.y} events/day`
        }
      }
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 }, color: textColor.value, maxRotation: 0, maxTicksLimit: 8 }, grid: { color: gridColor.value } },
    y: { ticks: { font: { size: 10 }, color: textColor.value }, title: { display: true, text: 'Events/day (7d avg)', font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

function jiraJqlUrl(jql) {
  return `${jiraHost.value}/issues/?jql=${encodeURIComponent(jql)}`
}

const cumulativeJqls = computed(() => ({
  stratsContributed: 'project = "RHAISTRAT" AND labels = "ai1st-doc-contributed"',
  allContributed: 'project IN ("RHAISTRAT", "RHOAIENG") AND labels = "ai1st-doc-contributed"',
  allInvoked: 'project IN ("RHAISTRAT", "RHOAIENG") AND labels = "ai1st-doc-invoked"',
  allResolvedContributed: 'project IN ("RHAISTRAT", "RHOAIENG") AND status IN ("Resolved", "Closed") AND labels = "ai1st-doc-contributed"',
  stratsResolvedContributed: 'project = "RHAISTRAT" AND status IN ("Resolved", "Closed") AND labels = "ai1st-doc-contributed"'
}))

const MR_STATUS_ICONS = {
  merged: {
    title: 'Merged',
    color: 'text-purple-600 dark:text-purple-400',
    path: 'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z'
  },
  opened: {
    title: 'Open',
    color: 'text-green-600 dark:text-green-400',
    path: 'M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z'
  },
  closed: {
    title: 'Closed',
    color: 'text-red-500 dark:text-red-400',
    path: 'M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l2 2a.75.75 0 0 1-1.06 1.06L12 3.56l-.72.72a.75.75 0 1 1-1.06-1.06l2-2ZM3.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z'
  }
}

function mrLabel(url) {
  if (!url) return ''
  const match = url.match(/merge_requests\/(\d+)/)
  if (match) return `!${match[1]}`
  const prMatch = url.match(/pull\/(\d+)/)
  if (prMatch) return `#${prMatch[1]}`
  try {
    return new URL(url).hostname
  } catch {
    return url.slice(0, 30)
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Top Bar -->
    <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold dark:text-gray-100">
          Documentation
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          AI-First<i>-driven</i> documentation for dev complete Features
          <span v-if="docData?.fetchedAt" class="ml-2 text-gray-400 dark:text-gray-500">&middot; {{ new Date(docData.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }} {{ new Date(docData.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }}</span>
        </p>
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-auto">
      <LoadingOverlay v-if="loading && !docData" />

      <div v-else-if="error" class="p-6">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 class="text-red-800 dark:text-red-200 font-medium">Failed to load data</h3>
          <p class="text-red-600 dark:text-red-400 text-sm mt-1">{{ error }}</p>
          <button
            @click="emit('retry')"
            class="mt-3 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >Retry</button>
        </div>
      </div>

      <div v-else-if="isEmpty" class="p-6 flex flex-col items-center justify-center h-full">
        <div class="text-center max-w-md">
          <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">No documentation data yet</h3>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            An admin can trigger a data refresh from Settings &gt; AI Impact.
          </p>
        </div>
      </div>

      <template v-else>
        <!-- Cumulative KPIs -->
        <div class="px-6 pt-6" v-if="cumulativeStats">
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <a :href="jiraJqlUrl(cumulativeJqls.stratsContributed)" target="_blank" rel="noopener" class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{{ cumulativeStats.stratsContributed }}</a>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">RHAISTRATs with AI Generated docs</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <a :href="jiraJqlUrl(cumulativeJqls.allContributed)" target="_blank" rel="noopener" class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 hover:underline">{{ cumulativeStats.allContributed }}</a>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Total Jiras with AI Generated docs</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <a :href="jiraJqlUrl(cumulativeJqls.allInvoked)" target="_blank" rel="noopener" class="text-2xl font-bold text-blue-600 dark:text-blue-400 hover:underline">{{ cumulativeStats.allInvoked }}</a>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Total Jiras with AI-First doc invoked</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <a :href="jiraJqlUrl(cumulativeJqls.allResolvedContributed)" target="_blank" rel="noopener" class="text-2xl font-bold text-green-600 dark:text-green-400 hover:underline">{{ cumulativeStats.allResolvedContributed }}</a>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Resolved/Closed with AI Generated docs</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
              <a :href="jiraJqlUrl(cumulativeJqls.stratsResolvedContributed)" target="_blank" rel="noopener" class="text-2xl font-bold text-green-600 dark:text-green-400 hover:underline">{{ cumulativeStats.stratsResolvedContributed }}</a>
              <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">RHAISTRATs Resolved/Closed with AI Generated docs</div>
            </div>
          </div>
        </div>

        <!-- Top Row — KPI Graphs -->
        <div class="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Graph A: Documentation Demand -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Features Ready for Documentation</h3>
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                    RHAISTRAT issues in Review or Release Pending with "Product Documentation Required" = Yes. This demand signal is independent of the AI-First tool. Use trend to inspect rising/stable/decreasing for doc demand.
                  </div>
                </div>
              </div>
              <span class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ metrics?.demandCount || 0 }}</span>
            </div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-3">demand for docs</div>
            <div class="h-[160px]">
              <Line :data="demandChartData" :options="demandChartOptions" />
            </div>
          </div>

          <!-- Graph B: Documentation Coverage Rate -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Coverage Rate</h3>
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                    Coverage of demand issues: those with <code class="px-1 py-0.5 rounded-md bg-gray-200/80 dark:bg-gray-700/80 text-gray-800 dark:text-gray-200 font-mono text-[10px] border border-gray-300/60 dark:border-gray-600/60">ai1st-doc-contributed</code> (AI-First MR raised) or <code class="px-1 py-0.5 rounded-md bg-gray-200/80 dark:bg-gray-700/80 text-gray-800 dark:text-gray-200 font-mono text-[10px] border border-gray-300/60 dark:border-gray-600/60">ai1st-doc-skip</code> (already has docs/release notes).
                  </div>
                </div>
              </div>
              <span class="text-lg font-bold" :class="(metrics?.coverageRate || 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'">{{ metrics?.coverageRate || 0 }}%</span>
            </div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-3">{{ metrics?.coverageCount || 0 }} of {{ metrics?.demandCount || 0 }} features covered ({{ metrics?.contributedCount || 0 }} contributed, {{ metrics?.skippedCount || 0 }} skipped)</div>
            <div class="h-[160px]">
              <Bar :data="coverageChartData" :options="coverageChartOptions" />
            </div>
          </div>

          <!-- Graph C: Tool Activity -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Tool Activity</h3>
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-72 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                    7-day <i>rolling average</i> of daily label additions from Jira changelog. Use trend to understand tool usage; Rising = tool accelerating; flat = stable.
                  </div>
                </div>
              </div>
              <span class="text-lg font-bold text-indigo-600 dark:text-indigo-400">{{ metrics?.totalLabelEvents || 0 }}</span>
            </div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-3">label events (30d)</div>
            <div class="h-[160px]">
              <Line :data="activityChartData" :options="activityChartOptions" />
            </div>
          </div>
        </div>

        <!-- MR Quality KPIs -->
        <MrKpiCharts :data="mrKpiData" />

        <!-- Issue Tables -->
        <div class="px-6 flex items-center gap-2 mb-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Jira Issue Details</h3>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ filteredIssues.length }} features{{ completedIssues.length ? `, ${completedIssues.length} recently completed` : '' }}</span>
        </div>
        <div class="px-6 pb-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Features Ready for Documentation</h3>
              <div class="flex items-center gap-2">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search issues..."
                  class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 w-48"
                />
                <select
                  v-model="docFilter"
                  class="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300"
                >
                  <option value="all">All</option>
                  <option value="contributed">Contributed</option>
                  <option value="skipped">Skipped</option>
                  <option value="not-contributed">Not Contributed</option>
                </select>
              </div>
            </div>
            <div class="px-5 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-500/10 text-xs text-gray-600 dark:text-gray-400">
              To trigger AI-First documentation, add the label <code class="px-1.5 py-0.5 rounded-md bg-gray-200/80 dark:bg-gray-700/80 text-gray-800 dark:text-gray-200 font-mono text-[11px] border border-gray-300/60 dark:border-gray-600/60">ai1st-doc-start</code> to the Jira issue (preferably RHAISTRAT, but not required). <a href="#/ai-impact/ai-factory-guide?section=documentation" class="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">See AI Factory Guide for more info</a>.
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 dark:border-gray-700">
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Key</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Summary</th>
                    <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium w-20">Status</th>
                    <th class="px-2 py-2 text-center text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">AI Generated</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">CCS Epic</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">MR Link(s)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="issue in filteredIssues"
                    :key="issue.key"
                    class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-5 py-2">
                      <a
                        :href="`${jiraHost}/browse/${issue.key}`"
                        target="_blank"
                        rel="noopener"
                        class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                      >{{ issue.key }}</a>
                    </td>
                    <td class="px-5 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">{{ issue.summary }}</td>
                    <td class="px-3 py-2 text-center">
                      <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                        {{ issue.status }}
                      </span>
                    </td>
                    <td class="px-2 py-2 text-center">
                      <span
                        v-if="issue.hasDocContributed"
                        class="inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                      >Yes</span>
                      <span
                        v-else-if="issue.hasDocSkipped"
                        class="inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 dark:bg-gray-600/40 text-gray-700 dark:text-gray-300"
                      >Skip</span>
                      <span
                        v-else
                        class="inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-600/20 text-gray-500 dark:text-gray-400"
                      >Not yet</span>
                    </td>
                    <td class="px-5 py-2">
                      <a
                        v-if="issue.ccsEpic"
                        :href="`${jiraHost}/browse/${issue.ccsEpic.key}`"
                        target="_blank"
                        rel="noopener"
                        class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                        :title="issue.ccsEpic.summary"
                      >{{ issue.ccsEpic.key }}</a>
                      <span v-else class="text-gray-400 dark:text-gray-500">&mdash;</span>
                    </td>
                    <td class="px-5 py-2">
                      <template v-if="issue.mrLinks && issue.mrLinks.length > 0">
                        <span v-for="(mr, idx) in issue.mrLinks" :key="mr">
                          <a
                            :href="mr"
                            target="_blank"
                            rel="noopener"
                            class="text-primary-600 dark:text-blue-400 text-xs hover:underline inline-flex items-center gap-0.5"
                            :title="mr"
                          >
                            <svg v-if="MR_STATUS_ICONS[issue.mrStatuses?.[mr]]" :class="['w-3 h-3 shrink-0', MR_STATUS_ICONS[issue.mrStatuses[mr]].color]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><title>{{ MR_STATUS_ICONS[issue.mrStatuses[mr]].title }}</title><path :d="MR_STATUS_ICONS[issue.mrStatuses[mr]].path" /></svg>
                            {{ mrLabel(mr) }}
                          </a><span v-if="idx < issue.mrLinks.length - 1" class="text-gray-300 dark:text-gray-600 mx-1">·</span>
                        </span>
                      </template>
                      <span v-else class="text-gray-400 dark:text-gray-500">&mdash;</span>
                    </td>
                  </tr>
                  <tr v-if="filteredIssues.length === 0">
                    <td colspan="6" class="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      No issues found matching the current filters.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <!-- Completed Issues Table -->
        <div class="px-6 pb-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Completed with Documentation</h3>
                <span class="text-xs text-gray-400 dark:text-gray-500">Resolved/Closed in last 30 days</span>
              </div>
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ completedIssues.length }} issues</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 dark:border-gray-700">
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Key</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Summary</th>
                    <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium w-20">Status</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">CCS Epic</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">MR Link(s)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="issue in completedIssues"
                    :key="issue.key"
                    class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-5 py-2">
                      <a
                        :href="`${jiraHost}/browse/${issue.key}`"
                        target="_blank"
                        rel="noopener"
                        class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                      >{{ issue.key }}</a>
                    </td>
                    <td class="px-5 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">{{ issue.summary }}</td>
                    <td class="px-3 py-2 text-center">
                      <span
                        class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                        :class="issue.status === 'Closed'
                          ? 'bg-gray-100 dark:bg-gray-600/20 text-gray-600 dark:text-gray-400'
                          : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'"
                      >{{ issue.status }}</span>
                    </td>
                    <td class="px-5 py-2">
                      <a
                        v-if="issue.ccsEpic"
                        :href="`${jiraHost}/browse/${issue.ccsEpic.key}`"
                        target="_blank"
                        rel="noopener"
                        class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                        :title="issue.ccsEpic.summary"
                      >{{ issue.ccsEpic.key }}</a>
                      <span v-else class="text-gray-400 dark:text-gray-500">&mdash;</span>
                    </td>
                    <td class="px-5 py-2">
                      <template v-if="issue.mrLinks && issue.mrLinks.length > 0">
                        <span v-for="(mr, idx) in issue.mrLinks" :key="mr">
                          <a
                            :href="mr"
                            target="_blank"
                            rel="noopener"
                            class="text-primary-600 dark:text-blue-400 text-xs hover:underline inline-flex items-center gap-0.5"
                            :title="mr"
                          >
                            <svg v-if="MR_STATUS_ICONS[issue.mrStatuses?.[mr]]" :class="['w-3 h-3 shrink-0', MR_STATUS_ICONS[issue.mrStatuses[mr]].color]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><title>{{ MR_STATUS_ICONS[issue.mrStatuses[mr]].title }}</title><path :d="MR_STATUS_ICONS[issue.mrStatuses[mr]].path" /></svg>
                            {{ mrLabel(mr) }}
                          </a><span v-if="idx < issue.mrLinks.length - 1" class="text-gray-300 dark:text-gray-600 mx-1">·</span>
                        </span>
                      </template>
                      <span v-else class="text-gray-400 dark:text-gray-500">&mdash;</span>
                    </td>
                  </tr>
                  <tr v-if="completedIssues.length === 0">
                    <td colspan="5" class="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      No completed issues with documentation contributions in the last 30 days.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
