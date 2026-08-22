import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const reportMap = ref({})
const meta = ref({ lastSyncedAt: null, totalReports: 0 })
const loading = ref(false)
const error = ref(null)
let hasFetched = false

async function loadReports() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/system-health/quality/reports')
    reportMap.value = data.reports || {}
    meta.value = {
      lastSyncedAt: data.lastSyncedAt,
      totalReports: data.totalReports || 0
    }
  } catch (e) {
    error.value = e.message || 'Failed to load quality reports'
    reportMap.value = {}
  } finally {
    loading.value = false
  }
}

function htmlReportUrl(repoKey) {
  return `/api/modules/system-health/quality/reports/${encodeURIComponent(repoKey)}/html`
}

export function useQualityReports() {
  if (!hasFetched) {
    hasFetched = true
    loadReports().catch(() => {
      // Reset hasFetched on error so retries are possible
      hasFetched = false
    })
  }

  const reports = computed(() => {
    return Object.entries(reportMap.value).map(([key, r]) => ({
      id: key,
      label: r.repository || key.replace('--', '/'),
      githubUrl: r.githubUrl || '',
      score: r.overallScore,
      gapCount: r.gapCount || 0,
      tier: r.tier || '',
      component: r.component || '',
      team: r.team || '',
      hasHtmlReport: r.hasHtmlReport || false,
      reportUrl: r.hasHtmlReport ? htmlReportUrl(key) : null,
      assessedAt: r.assessedAt
    }))
  })

  return {
    reports,
    reportMap,
    meta,
    loading,
    error,
    loadReports,
    htmlReportUrl
  }
}

export function _resetForTesting() {
  reportMap.value = {}
  meta.value = { lastSyncedAt: null, totalReports: 0 }
  loading.value = false
  error.value = null
  hasFetched = true
}
