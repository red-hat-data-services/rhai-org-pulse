import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const healthData = ref(null)
const runHistory = ref(null)
const loading = ref(false)
const error = ref(null)
let hasFetched = false

// Auto-filed E2E blocker JIRAs (loaded lazily when the JIRAs tab is opened)
const blockerJiras = ref(null)
const blockerJirasLoading = ref(false)
const blockerJirasError = ref(null)
let hasFetchedBlockerJiras = false

async function loadHealthData(force = false) {
  loading.value = true
  error.value = null
  try {
    // Add cache busting for forced reloads
    const cacheBuster = force ? `?_cb=${Date.now()}` : ''
    const data = await apiRequest(`/modules/system-health/odh-e2e-health${cacheBuster}`)
    healthData.value = data
  } catch (e) {
    error.value = e.message || 'Failed to load opendatahub-operator E2E health data'
    healthData.value = null
  } finally {
    loading.value = false
  }
}

async function loadRunHistory(options = {}) {
  const { page = 1, limit = 20, suite, status, append = false } = options

  if (!append) {
    loading.value = true
    error.value = null
  }

  try {
    const params = new URLSearchParams()
    params.append('page', page)
    params.append('limit', limit)
    if (suite) params.append('suite', suite)
    if (status) params.append('status', status)

    const data = await apiRequest(`/modules/system-health/odh-e2e-health/runs?${params}`)

    if (append && runHistory.value) {
      // Append new runs to existing data
      runHistory.value = {
        ...data,
        runs: [...runHistory.value.runs, ...data.runs]
      }
    } else {
      runHistory.value = data
    }
  } catch (e) {
    if (!append) {
      error.value = e.message || 'Failed to load opendatahub-operator E2E run history'
      runHistory.value = null
    }
  } finally {
    if (!append) {
      loading.value = false
    }
  }
}

async function loadBlockerJiras(force = false) {
  // Fetch once per session unless forced (lazy — triggered on tab open).
  if (hasFetchedBlockerJiras && !force) return

  hasFetchedBlockerJiras = true
  blockerJirasLoading.value = true
  blockerJirasError.value = null
  try {
    const cacheBuster = force ? `?_cb=${Date.now()}` : ''
    const data = await apiRequest(`/modules/system-health/odh-e2e-health/blocker-jiras${cacheBuster}`)
    blockerJiras.value = data
  } catch (e) {
    blockerJirasError.value = e.message || 'Failed to load E2E blocker JIRAs'
    blockerJiras.value = null
    // Allow retry after a failure
    hasFetchedBlockerJiras = false
  } finally {
    blockerJirasLoading.value = false
  }
}

export function useOdhOperatorE2eHealth() {
  if (!hasFetched) {
    hasFetched = true
    loadHealthData().catch(() => {
      // Reset hasFetched on error so retries are possible
      hasFetched = false
    })
  }

  // Computed properties for enhanced data access
  const currentlyBlockingComponents = computed(() => {
    if (!healthData.value?.topFailingComponents?.components) return []
    return healthData.value.topFailingComponents.components.filter(component =>
      component.consecutiveFailures > 0
    )
  })

  const suiteHealthSummary = computed(() => {
    if (!healthData.value?.summary) return null

    const { odh, rhoai } = healthData.value.summary

    return {
      odh: {
        status: odh?.status || 'unknown',
        timeSinceGreen: odh?.timeSinceGreen || 'N/A',
        isHealthy: odh?.status === 'passing'
      },
      rhoai: {
        status: rhoai?.status || 'unknown',
        timeSinceGreen: rhoai?.timeSinceGreen || 'N/A',
        isHealthy: rhoai?.status === 'passing'
      }
    }
  })

  const overallHealth = computed(() => {
    if (!healthData.value) return { status: 'unknown', level: 'unknown' }

    const passRate = healthData.value.overallPassRate || 0
    const blockingComponents = currentlyBlockingComponents.value.length

    let status, level
    if (passRate >= 0.8 && blockingComponents === 0) {
      status = 'healthy'
      level = 'success'
    } else if (passRate >= 0.6 || blockingComponents <= 2) {
      status = 'degraded'
      level = 'warning'
    } else {
      status = 'unhealthy'
      level = 'error'
    }

    return {
      status,
      level,
      passRate,
      blockingComponents,
      totalRuns: healthData.value.totalRuns || 0
    }
  })

  const recentFailures = computed(() => {
    if (!runHistory.value?.runs) return []

    return runHistory.value.runs
      .filter(run => run.status === 'failed')
      .slice(0, 5) // Last 5 failures
      .map(run => ({
        ...run,
        timeAgo: formatTimeAgo(run.timestamp),
        primaryFailedComponent: run.failedComponents?.[0] || 'unknown'
      }))
  })

  const componentTrends = computed(() => {
    if (!healthData.value?.topFailingComponents?.components) return {}

    return healthData.value.topFailingComponents.components.reduce((trends, component) => {
      trends[component.component] = {
        name: component.component,
        failureRate: component.failureRate,
        consecutiveFailures: component.consecutiveFailures,
        trend: component.failureRate > 0.3 ? 'worsening' :
               component.failureRate < 0.1 ? 'improving' : 'stable',
        severity: component.failureRate > 0.5 ? 'high' :
                 component.failureRate > 0.2 ? 'medium' : 'low'
      }
      return trends
    }, {})
  })

  return {
    // Core data
    healthData,
    runHistory,
    loading,
    error,

    // Blocker JIRAs
    blockerJiras,
    blockerJirasLoading,
    blockerJirasError,

    // Computed insights
    currentlyBlockingComponents,
    suiteHealthSummary,
    overallHealth,
    recentFailures,
    componentTrends,

    // Actions
    loadHealthData,
    loadRunHistory,
    loadBlockerJiras
  }
}

// Utility functions

function formatTimeAgo(timestamp) {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now - then

  const minutes = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// Advanced composable for detailed component analysis
export function useComponentAnalysis(componentName) {
  const { healthData, runHistory } = useOdhOperatorE2eHealth()

  const componentData = computed(() => {
    if (!healthData.value?.topFailingComponents) return null
    return healthData.value.topFailingComponents.find(c => c.component === componentName)
  })

  const componentRuns = computed(() => {
    if (!runHistory.value?.runs) return []
    return runHistory.value.runs.filter(run =>
      run.failedComponents?.includes(componentName) ||
      (run.status === 'passed' && !run.failedComponents?.length)
    )
  })

  const componentHealth = computed(() => {
    if (!componentData.value) return { status: 'unknown', trend: 'stable' }

    const { failureRate, consecutiveFailures } = componentData.value

    let status
    if (failureRate > 0.5) status = 'critical'
    else if (failureRate > 0.2) status = 'degraded'
    else if (failureRate > 0.05) status = 'flaky'
    else status = 'healthy'

    // Simple trend analysis based on consecutive failures
    let trend
    if (consecutiveFailures >= 3) trend = 'worsening'
    else if (consecutiveFailures === 0 && failureRate < 0.1) trend = 'improving'
    else trend = 'stable'

    return {
      status,
      trend,
      failureRate,
      consecutiveFailures,
      affectedSuites: componentData.value.affectedSuites || []
    }
  })

  return {
    componentData,
    componentRuns,
    componentHealth
  }
}

// Composable for dashboard metrics and KPIs
export function useE2EMetrics() {
  const { healthData, runHistory } = useOdhOperatorE2eHealth()

  const metrics = computed(() => {
    if (!healthData.value) return null

    const passRate = healthData.value.overallPassRate || 0
    const totalRuns = healthData.value.totalRuns || 0
    const failingComponents = healthData.value.topFailingComponents?.length || 0

    // Calculate additional metrics
    const recentRunsCount = runHistory.value?.runs?.length || 0
    const recentFailures = runHistory.value?.runs?.filter(r => r.status === 'failed').length || 0

    return {
      // Core metrics
      passRate: Math.round(passRate * 100),
      totalRuns,
      failingComponents,

      // Recent metrics
      recentRunsCount,
      recentFailures,
      recentPassRate: recentRunsCount > 0 ?
        Math.round(((recentRunsCount - recentFailures) / recentRunsCount) * 100) : 0,

      // Health indicators
      isHealthy: passRate >= 0.8 && failingComponents === 0,
      needsAttention: passRate < 0.6 || failingComponents > 2,

      // Trend indicators
      trendStatus: passRate >= 0.8 ? 'improving' : passRate >= 0.6 ? 'stable' : 'declining'
    }
  })

  return {
    metrics
  }
}