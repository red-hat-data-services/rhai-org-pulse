import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const testPlans = ref({})
const testPlanMeta = ref({ lastSyncedAt: null, totalTestPlans: 0 })
const metrics = ref(null)
const trendData = ref([])
const breakdown = ref([])
const reviewStatus = ref(null)
const testPlanLoading = ref(false)
const testPlanError = ref(null)
const detailCache = ref({})

const timeWindow = ref('month')
let hasFetched = false

async function loadTestPlans() {
  testPlanLoading.value = true
  testPlanError.value = null
  try {
    const tw = timeWindow.value || 'month'
    const data = await apiRequest(`/modules/ai-impact/test-plans?timeWindow=${tw}`)
    testPlans.value = data.testPlans || {}
    detailCache.value = {}
    testPlanMeta.value = {
      lastSyncedAt: data.lastSyncedAt,
      totalTestPlans: data.totalTestPlans
    }
    metrics.value = data.metrics || null
    trendData.value = data.trendData || []
    breakdown.value = data.breakdown || []
    reviewStatus.value = data.reviewStatus || null
  } catch (e) {
    testPlanError.value = e.message
  } finally {
    testPlanLoading.value = false
  }
}

async function loadTestPlanDetail(key) {
  if (detailCache.value[key]) {
    return detailCache.value[key]
  }
  try {
    const data = await apiRequest(`/modules/ai-impact/test-plans/${encodeURIComponent(key)}`)
    detailCache.value[key] = data
    return data
  } catch (e) {
    if (e.message && e.message.includes('404')) {
      return null
    }
    throw e
  }
}

watch(timeWindow, () => loadTestPlans())

export function useTestPlans(tw) {
  if (tw) {
    timeWindow.value = tw.value || tw
  }
  if (!hasFetched) {
    hasFetched = true
    loadTestPlans()
  }
  return {
    testPlans,
    testPlanMeta,
    metrics,
    trendData,
    breakdown,
    reviewStatus,
    testPlanLoading,
    testPlanError,
    loadTestPlans,
    loadTestPlanDetail,
    timeWindow
  }
}
