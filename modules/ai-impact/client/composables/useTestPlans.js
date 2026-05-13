import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

/**
 * Composable for loading and caching test plan quality data.
 * - testPlans: Map<string, SlimTestPlan> (keyed by RHAISTRAT key)
 * - loadTestPlans(): fetches GET /test-plans (slim projection)
 * - loadTestPlanDetail(key): fetches GET /test-plans/:key (full + history)
 */
export function useTestPlans() {
  const testPlans = ref({})
  const testPlanMeta = ref({ lastSyncedAt: null, totalTestPlans: 0 })
  const testPlanLoading = ref(false)
  const testPlanError = ref(null)

  // Cache for full detail fetches (keyed by RHAISTRAT key)
  const detailCache = ref({})

  async function loadTestPlans() {
    testPlanLoading.value = true
    testPlanError.value = null
    try {
      const data = await apiRequest('/modules/ai-impact/test-plans')
      testPlans.value = data.testPlans || {}
      detailCache.value = {}
      testPlanMeta.value = {
        lastSyncedAt: data.lastSyncedAt,
        totalTestPlans: data.totalTestPlans
      }
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

  return {
    testPlans,
    testPlanMeta,
    testPlanLoading,
    testPlanError,
    loadTestPlans,
    loadTestPlanDetail,
    detailCache
  }
}
