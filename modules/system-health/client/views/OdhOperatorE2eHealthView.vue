<script setup>
import { computed, inject, ref, onMounted, onUnmounted } from 'vue'
import { useOdhOperatorE2eHealth } from '../composables/useOdhOperatorE2eHealth.js'
import BlockerJiraTable from '../components/BlockerJiraTable.vue'
import { Line } from 'vue-chartjs'
import {
  RefreshCw,
  ChevronRight,
  ExternalLink,
  BarChart3,
  AlertTriangle
} from 'lucide-vue-next'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Title)

const nav = inject('moduleNav', null)
const {
  healthData,
  runHistory,
  loading,
  error,
  loadHealthData,
  loadRunHistory,
  blockerJiras,
  blockerJirasLoading,
  blockerJirasError,
  loadBlockerJiras
} = useOdhOperatorE2eHealth()

// Filters
const suiteFilter = ref('all')
const statusFilter = ref('all')

// Runs / Blocker JIRAs toggle
const activeTab = ref('runs')

function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'jiras') {
    // Lazy-load on first open (no-op if already fetched)
    loadBlockerJiras()
  }
}


// Enhanced 14-day window calculation with temporal status information
function calculateCurrent14DayStatus(suite) {
  const runs = healthData.value?.recentRuns || []

  // Filter to last 14 days and specific suite
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const recentRuns = runs.filter(run =>
    run.suite === suite && new Date(run.timestamp) >= cutoff
  )

  if (recentRuns.length === 0) {
    // Fallback to suite data if no individual runs (e.g., RHOAI runs missing from recentRuns)
    const suiteData = healthData.value?.suites?.[suite]
    if (suiteData?.totalJobs > 0) {
      const passRate = suiteData.passedJobs / suiteData.totalJobs
      return {
        passRate: Math.round(passRate * 100),
        totalRuns: suiteData.totalJobs,
        passedRuns: suiteData.passedJobs,
        status: calculateTemporalStatus(suite, runs), // Use all runs for temporal analysis
        direction: passRate >= 0.7 ? 'stable' : passRate >= 0.5 ? 'down' : 'down',
        confidence: 'medium'
      }
    }

    return {
      passRate: 0,
      totalRuns: 0,
      passedRuns: 0,
      status: 'No recent data',
      direction: 'stable',
      confidence: 'low'
    }
  }

  // Deduplicate by PR number - keep only the latest result per PR
  const prMap = new Map()
  recentRuns.forEach(run => {
    const prNumber = run.prNumber
    if (!prNumber) return // Skip runs without PR numbers

    const existing = prMap.get(prNumber)
    if (!existing || new Date(run.timestamp) > new Date(existing.timestamp)) {
      prMap.set(prNumber, run)
    }
  })

  // Convert back to array of deduplicated runs
  const deduplicatedRuns = Array.from(prMap.values())
  const passedRuns = deduplicatedRuns.filter(run => run.status === 'passed').length
  const passRate = deduplicatedRuns.length > 0 ? passedRuns / deduplicatedRuns.length : 0

  // Calculate temporal status and direction
  const temporalStatus = calculateTemporalStatus(suite, runs) // Use all runs for temporal analysis
  const direction = passRate >= 0.7 ? 'stable' : passRate >= 0.5 ? 'down' : 'down'

  // Confidence based on sample size (number of unique PRs tested)
  const confidence = deduplicatedRuns.length >= 10 ? 'high' :
                    deduplicatedRuns.length >= 5 ? 'medium' : 'low'

  return {
    passRate: Math.round(passRate * 100),
    totalRuns: deduplicatedRuns.length,
    passedRuns,
    status: temporalStatus,
    direction,
    confidence
  }
}

/**
 * Calculate simple temporal status message using actual test runs
 * @param {number} currentPassRate - Current pass rate (0-1)
 * @param {string} suite - Test suite (odh/rhoai)
 * @param {Array} recentRuns - Array of individual test runs
 * @returns {string} Temporal status message
 */
function formatTimeAgo(timestamp) {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now - then
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0)
  const yesterdayMidnight = new Date(todayMidnight); yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1)
  if (then >= yesterdayMidnight) return 'yesterday'
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function calculateTemporalStatus(suite, recentRuns) {
  if (!recentRuns || recentRuns.length === 0) return null

  // Filter to this suite and sort by timestamp (newest first)
  const suiteRuns = recentRuns
    .filter(run => run.suite === suite)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  if (suiteRuns.length === 0) return null

  const mostRecentRun = suiteRuns[0]

  // If the most recent run passed, always show that — regardless of overall pass rate.
  // This handles RHOAI-style cases: degraded overall but currently recovering.
  if (mostRecentRun.status === 'passed') {
    return `Last run passed ${formatTimeAgo(mostRecentRun.timestamp)}`
  }

  // Most recent run failed — find the start of the continuous failure streak
  let failureStartTimestamp = null

  for (const run of suiteRuns) {
    if (run.status === 'failed') {
      failureStartTimestamp = run.timestamp
    } else {
      break
    }
  }

  if (!failureStartTimestamp) return null

  const failureStart = new Date(failureStartTimestamp)
  const now = new Date()
  const diffMs = now - failureStart
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0)
  const yesterdayMidnight = new Date(todayMidnight); yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1)

  if (failureStart >= todayMidnight) {
    if (diffMins < 60) return `Failing for ${diffMins}m`
    return `Failing for ${diffHours}h`
  }

  if (failureStart >= yesterdayMidnight) {
    const timeStr = failureStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    return `Failing since yesterday, ${timeStr}`
  }

  return `Failing since ${failureStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}


const odhTrend = computed(() => calculateCurrent14DayStatus('odh'))
const rhoaiTrend = computed(() => calculateCurrent14DayStatus('rhoai'))

// Weekly aggregation using real Prow API data from recentRuns
const weeklyChartData = computed(() => {
  // Use historical trends data instead of individual recent runs
  const historicalTrends = healthData.value?.historical_trends
  if (!historicalTrends?.daily_status || historicalTrends.daily_status.length === 0) {
    return null
  }

  const dailyStatus = historicalTrends.daily_status
  if (dailyStatus.length < 2) {
    return null // Need at least 2 days for trend visualization
  }

  // Sort by date (oldest to newest for chart)
  const sortedDays = [...dailyStatus].sort((a, b) => new Date(a.date) - new Date(b.date))

  // If we have 14+ days, group by weeks for better readability
  if (sortedDays.length >= 14) {
    const chartData = []
    const maxWeeks = Math.min(6, Math.floor(sortedDays.length / 7)) // Max 6 weeks for 30-day window

    for (let week = 0; week < maxWeeks; week++) {
      const weekStart = week * 7
      const weekEnd = Math.min(weekStart + 7, sortedDays.length)
      const weekDays = sortedDays.slice(weekStart, weekEnd)

      if (weekDays.length === 0) continue

      // Calculate average pass rates for the week
      const odhPassRates = weekDays.map(d => d.odh?.passRate || 0).filter(r => r > 0)
      const rhoaiPassRates = weekDays.map(d => d.rhoai?.passRate || 0).filter(r => r > 0)

      const startDate = weekDays[0]?.date
      const endDate = weekDays[weekDays.length - 1]?.date
      const weekLabel = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `W${week + 1}`

      chartData.push({
        week: week + 1,
        label: weekLabel,
        dateRange: `${startDate} - ${endDate}`,
        odhPassRate: odhPassRates.length > 0 ? Math.round((odhPassRates.reduce((sum, r) => sum + r, 0) / odhPassRates.length) * 100) : null,
        rhoaiPassRate: rhoaiPassRates.length > 0 ? Math.round((rhoaiPassRates.reduce((sum, r) => sum + r, 0) / rhoaiPassRates.length) * 100) : null,
        totalRuns: odhPassRates.length + rhoaiPassRates.length,
        odhRuns: odhPassRates.length,
        rhoaiRuns: rhoaiPassRates.length
      })
    }

    return chartData
  } else {
    // For less than 14 days, use daily data
    const chartData = sortedDays.map(day => ({
      label: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dateRange: day.date,
      odhPassRate: day.odh?.passRate ? Math.round(day.odh.passRate * 100) : null,
      rhoaiPassRate: day.rhoai?.passRate ? Math.round(day.rhoai.passRate * 100) : null,
      totalRuns: (day.odh?.totalJobs || 0) + (day.rhoai?.totalJobs || 0),
      odhRuns: day.odh?.totalJobs || 0,
      rhoaiRuns: day.rhoai?.totalJobs || 0
    }))

    return chartData
  }
})

// Chart configuration with dark mode support
const isDark = ref(false)
let observer

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  loadHealthData()
})

onUnmounted(() => {
  observer?.disconnect()
})

const chartData = computed(() => {
  const weeklyData = weeklyChartData.value
  if (!weeklyData) return null

  return {
    labels: weeklyData.map(w => w.label),
    datasets: [
      {
        label: 'ODH E2E',
        data: weeklyData.map(w => w.odhPassRate),
        borderColor: '#3B82F6', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      },
      {
        label: 'RHOAI E2E',
        data: weeklyData.map(w => w.rhoaiPassRate),
        borderColor: '#A855F7', // Purple
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.3,
        pointBackgroundColor: '#A855F7',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  }
})

// Computed property to get component failures
const actualComponentFailures = computed(() => {
  if (!healthData.value?.topFailingComponents?.components) return []

  return healthData.value.topFailingComponents.components
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: weeklyChartData.value?.length >= 14 ? 'Weekly Pass Rate Trends (30-Day Window)' : 'Daily Pass Rate Trends (30-Day Window)',
      color: isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)',
      font: { size: 16, weight: 'bold' }
    },
    legend: {
      position: 'top',
      labels: {
        color: isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)',
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        title: (context) => {
          const weekData = weeklyChartData.value
          const weekInfo = weekData?.[context[0].dataIndex]
          return weekInfo ? `Week ending ${weekInfo.label} (${weekInfo.dateRange})` : ''
        },
        label: (context) => {
          const value = context.parsed.y
          return value !== null ? `${context.dataset.label}: ${value}%` : `${context.dataset.label}: No data`
        }
      }
    }
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Week Ending (Oldest → Current)',
        color: isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)'
      },
      ticks: {
        color: isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)'
      },
      grid: {
        color: isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)'
      }
    },
    y: {
      beginAtZero: true,
      max: 100,
      title: {
        display: true,
        text: 'Pass Rate (%)',
        color: isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)'
      },
      ticks: {
        color: isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)',
        callback: (value) => `${value}%`
      },
      grid: {
        color: isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)'
      }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}))

const filteredRuns = computed(() => {
  if (!healthData.value?.recentRuns) return []

  return healthData.value.recentRuns.filter(run =>
    (suiteFilter.value === 'all' || run.suite === suiteFilter.value) &&
    (statusFilter.value === 'all' || run.status === statusFilter.value)
  )
})

const suiteOptions = computed(() => [
  { value: 'all', label: 'All Suites' },
  { value: 'odh', label: 'OpenDataHub E2E' },
  { value: 'rhoai', label: 'RHOAI E2E' }
])

const statusOptions = computed(() => [
  { value: 'all', label: 'All Status' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' }
])



// Status helpers (enhanced for daily status + legacy support)
function getStatusBadgeClass(status) {
  switch (status) {
    // NEW: System Health status ranges
    case 'healthy': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'stable': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'degraded': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'failing': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'broken': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    // Legacy support (for backward compatibility)
    case 'excellent': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'good': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'bad': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'worst': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    case 'passing': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'flaky': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'passed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
  }
}


function getFailureRateColor(rate) {
  if (rate > 0.5) return 'text-red-600 dark:text-red-400'
  if (rate > 0.2) return 'text-amber-600 dark:text-amber-400'
  return 'text-green-600 dark:text-green-400'
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString()
}

function formatPassRate(rate) {
  return `${Math.round(rate * 100)}%`
}







// Removed duplicate onMounted - now handled above with dark mode detection

function handleRowClick(run) {
  // Navigate to internal test run detail view
  if (nav) {
    nav.navigateTo('e2e-run-detail', { buildId: run.buildId })
  } else {
    // Fallback navigation
    window.location.hash = `#/system-health/e2e-run-detail?buildId=${run.buildId}`
  }
}

function loadMoreRuns() {
  if (!runHistory.value?.pagination?.hasNextPage || loading.value) {
    return
  }

  const nextPage = (runHistory.value.pagination.page || 1) + 1
  loadRunHistory({
    page: nextPage,
    limit: 20,
    suite: suiteFilter.value !== 'all' ? suiteFilter.value : undefined,
    status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
    append: true
  })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">opendatahub-operator E2E health</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          End-to-end test health monitoring for OpenDataHub and RHOAI
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !healthData" class="flex items-center justify-center h-32">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      <span class="ml-2 text-gray-600 dark:text-gray-400">Loading E2E health data...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
      <div class="flex">
        <AlertTriangle class="h-5 w-5 text-red-400" />
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">Failed to load E2E health data</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <template v-else-if="healthData">
      <!-- E2E Status Section -->
      <div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- ODH Suite Status -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div class="text-center">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">OpenDataHub E2E</div>
                <!-- Status badge with trend -->
                <div class="mb-4">
                  <div class="flex items-center justify-center">
                    <span
                      :class="[
                        'inline-flex items-center px-4 py-2 rounded-full text-lg font-medium',
                        healthData.suites?.odh?.dailyStatus?.bgClass || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                      ]"
                    >
                      {{ healthData.suites?.odh?.dailyStatus?.label || 'Loading...' }}
                    </span>
                  </div>
                </div>
                <!-- NEW: 14-day pass rate -->
                <div class="space-y-2">
                  <div class="text-3xl font-bold" :class="odhTrend?.direction === 'up' ? 'text-green-600' : odhTrend?.direction === 'down' ? 'text-red-600' : 'text-yellow-600'">
                    {{ odhTrend?.passRate || 0 }}%
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-300">
                    {{ odhTrend?.passedRuns || 0 }}/{{ odhTrend?.totalRuns || 0 }} tests
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <div v-if="odhTrend?.status">{{ odhTrend.status }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- RHOAI Suite Status -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div class="text-center">
                <div class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">RHOAI E2E</div>
                <!-- Status badge with trend -->
                <div class="mb-4">
                  <div class="flex items-center justify-center">
                    <span
                      :class="[
                        'inline-flex items-center px-4 py-2 rounded-full text-lg font-medium',
                        healthData.suites?.rhoai?.dailyStatus?.bgClass || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                      ]"
                    >
                      {{ healthData.suites?.rhoai?.dailyStatus?.label || 'Loading...' }}
                    </span>
                  </div>
                </div>
                <!-- NEW: 14-day pass rate -->
                <div class="space-y-2">
                  <div class="text-3xl font-bold" :class="rhoaiTrend?.direction === 'up' ? 'text-green-600' : rhoaiTrend?.direction === 'down' ? 'text-red-600' : 'text-yellow-600'">
                    {{ rhoaiTrend?.passRate || 0 }}%
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-300">
                    {{ rhoaiTrend?.passedRuns || 0 }}/{{ rhoaiTrend?.totalRuns || 0 }} tests
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <div v-if="rhoaiTrend?.status">{{ rhoaiTrend.status }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status Legend -->
        <div class="mt-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">Status Guide</h3>
          <div class="mb-3 text-xs text-gray-600 dark:text-gray-400">
            Status based on recent E2E runs (last ~48 hours).
          </div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div class="flex items-center">
              <span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              <span class="text-gray-700 dark:text-gray-300">
                <span class="font-medium">Healthy:</span> ≥80% pass rate
              </span>
            </div>
            <div class="flex items-center">
              <span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              <span class="text-gray-700 dark:text-gray-300">
                <span class="font-medium">Stable:</span> 70-79% pass rate
              </span>
            </div>
            <div class="flex items-center">
              <span class="inline-block w-3 h-3 rounded-full bg-orange-500 mr-2"></span>
              <span class="text-gray-700 dark:text-gray-300">
                <span class="font-medium">Degraded:</span> 50-69% pass rate
              </span>
            </div>
            <div class="flex items-center">
              <span class="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
              <span class="text-gray-700 dark:text-gray-300">
                <span class="font-medium">Failing:</span> &lt;50% pass rate
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Historical Trend Chart -->
      <div v-if="chartData && healthData.historical_trends?.daily_status?.length >= 2" class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <div class="mb-4">
            <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">Historical Trends</h3>
            <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Pass rate trends from E2E runs
            </p>
          </div>
          <div class="h-80">
            <Line :data="chartData" :options="chartOptions" />
          </div>
          <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div v-if="weeklyChartData">
              <span class="font-medium">Data Points:</span>
              {{ weeklyChartData.length }} {{ weeklyChartData.length >= 14 ? 'weeks' : 'days' }}
            </div>
            <div v-if="healthData.historical_trends?.daily_status">
              <span class="font-medium">Historical Window:</span>
              {{ healthData.historical_trends.daily_status.length }} days
            </div>
            <div v-if="healthData.lastSyncedAt">
              <span class="font-medium">Last Updated:</span>
              {{ new Date(healthData.lastSyncedAt).toLocaleDateString() }}
            </div>
          </div>
        </div>
      </div>

      <!-- Historical Data Unavailable -->
      <div v-else-if="healthData && (!healthData.historical_trends?.daily_status || healthData.historical_trends.daily_status.length < 2)"
           class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
        <div class="text-center">
          <BarChart3 class="mx-auto h-8 w-8 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">Historical Trends Unavailable</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Need at least 2 days of historical data. Currently have {{ healthData.historical_trends?.daily_status?.length || 0 }} days.
          </p>
        </div>
      </div>


      <!-- Top Failing Components -->
      <div v-if="actualComponentFailures.length" class="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <div class="px-4 py-5 sm:px-6">
          <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">Top Failing Components</h3>
          <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Components with highest failure rates over the last 14 days</p>
        </div>
        <ul role="list" class="divide-y divide-gray-200 dark:divide-gray-700">
          <li v-for="component in actualComponentFailures" :key="component.component" class="px-4 py-4 sm:px-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-2.5 w-2.5 rounded-full" :class="component.failureRate > 0.5 ? 'bg-red-500' : component.failureRate > 0.2 ? 'bg-yellow-500' : 'bg-green-500'"></div>
                </div>
                <div class="ml-4">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">
                    {{ component.component }}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    Consecutive failures: {{ component.consecutiveFailures || 0 }}
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div :class="['text-sm font-medium', getFailureRateColor(component.failureRate)]">
                  {{ formatPassRate(component.failureRate) }} failure rate
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400">
                  Affects: {{ component.affectedSuites?.join(', ') || 'Unknown' }}
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Run History Filters -->
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <!-- Runs / Blocker JIRAs toggle -->
          <div class="inline-flex rounded-md border border-gray-300 dark:border-gray-600 p-0.5 mb-5" role="group" aria-label="View toggle">
            <button
              type="button"
              @click="switchTab('runs')"
              :class="[
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                activeTab === 'runs'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              ]"
            >
              Runs
            </button>
            <button
              type="button"
              @click="switchTab('jiras')"
              :class="[
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                activeTab === 'jiras'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              ]"
            >
              Blocker JIRAs
              <span
                v-if="blockerJiras?.count"
                class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold"
                :class="activeTab === 'jiras' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'"
              >{{ blockerJiras.count }}</span>
            </button>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                {{ activeTab === 'runs' ? 'Recent E2E Runs' : 'Auto-filed Blocker JIRAs' }}
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ activeTab === 'runs'
                  ? 'History of recent test executions'
                  : 'Open Jira blockers auto-filed for failing E2E components' }}
              </p>
            </div>
            <div v-if="activeTab === 'runs'" class="mt-4 sm:mt-0 flex space-x-3">
              <select
                v-model="suiteFilter"
                class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
              >
                <option v-for="option in suiteOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <select
                v-model="statusFilter"
                class="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md dark:bg-gray-700 dark:text-white"
              >
                <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div v-else-if="blockerJiras?.jqlUrl" class="mt-4 sm:mt-0">
              <a
                :href="blockerJiras.jqlUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                View all in Jira
                <ExternalLink class="inline ml-1.5 h-3.5 w-3.5" />
              </a>
            </div>
          </div>


          <!-- Run History Table -->
          <div v-if="activeTab === 'runs'" class="mt-6 -mx-4 sm:mx-0">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Suite</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Timestamp</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Duration</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Failed Components</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">PR</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr
                    v-for="run in filteredRuns"
                    :key="run.buildId"
                    class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    @click="handleRowClick(run)"
                    :title="`Click to view details for ${run.suite?.toUpperCase()} test run`"
                  >
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <span :class="[
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          getStatusBadgeClass(run.status)
                        ]">
                          {{ run.status }}
                        </span>
                        <ChevronRight class="ml-2 w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {{ run.suite?.toUpperCase() || 'Unknown' }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {{ formatTimestamp(run.timestamp) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {{ formatDuration(run.runDuration || 0) }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div v-if="run.failedComponents?.length" class="flex flex-wrap gap-1">
                        <span
                          v-for="component in run.failedComponents"
                          :key="component"
                          class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        >
                          {{ component }}
                        </span>
                      </div>
                      <span v-else class="text-gray-400 dark:text-gray-500">None</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        v-if="run.prowUrl"
                        :href="run.prowUrl"
                        target="_blank"
                        class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        #{{ run.prNumber }}
                        <ExternalLink class="inline ml-1 h-3 w-3" />
                      </a>
                      <span v-else class="text-gray-400 dark:text-gray-500">N/A</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Load More Button -->
            <div v-if="runHistory?.pagination?.hasNextPage" class="mt-4 text-center">
              <button
                @click="loadMoreRuns"
                :disabled="loading"
                class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <RefreshCw v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" />
                Load More Runs
              </button>
            </div>
          </div>

          <!-- Blocker JIRAs Table -->
          <div v-else class="mt-6">
            <BlockerJiraTable
              :issues="blockerJiras?.issues || []"
              :loading="blockerJirasLoading"
              :available="blockerJiras?.available === true"
              :reason="blockerJiras?.reason || null"
              :error="blockerJirasError"
              :jql-url="blockerJiras?.jqlUrl || ''"
              :last-synced-at="blockerJiras?.lastSyncedAt || null"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- No Data State -->
    <div v-else class="text-center py-12">
      <AlertTriangle class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No E2E health data available</h3>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        E2E health data is being collected. Please check back later.
      </p>
    </div>
  </div>
</template>