import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

/**
 * Composable for loading and caching assessment data.
 * - assessments: Map<string, SlimAssessment> (keyed by RFE key)
 * - loadAssessments(): fetches GET /assessments (slim projection)
 * - loadAssessmentDetail(key): fetches GET /assessments/:key (full + history)
 */
export function useAssessments() {
  const assessments = ref({})
  const assessmentMeta = ref({ lastSyncedAt: null, totalAssessed: 0 })
  const assessmentLoading = ref(false)
  const assessmentError = ref(null)

  // Cache for full detail fetches (keyed by RFE key)
  const detailCache = ref({})

  async function loadAssessments() {
    assessmentLoading.value = true
    assessmentError.value = null
    try {
      const data = await apiRequest('/modules/ai-impact/assessments')
      assessments.value = data.assessments || {}
      assessmentMeta.value = {
        lastSyncedAt: data.lastSyncedAt,
        totalAssessed: data.totalAssessed
      }
    } catch (e) {
      assessmentError.value = e.message
    } finally {
      assessmentLoading.value = false
    }
  }

  async function loadAssessmentDetail(key) {
    // Return cached detail if available
    if (detailCache.value[key]) {
      return detailCache.value[key]
    }
    try {
      const data = await apiRequest(`/modules/ai-impact/assessments/${encodeURIComponent(key)}`)
      detailCache.value[key] = data
      return data
    } catch (e) {
      // 404 is expected for unassessed RFEs
      if (e.message && e.message.includes('404')) {
        return null
      }
      throw e
    }
  }

  return {
    assessments,
    assessmentMeta,
    assessmentLoading,
    assessmentError,
    loadAssessments,
    loadAssessmentDetail,
    detailCache
  }
}
