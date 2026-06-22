import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

// Singleton state — fetch once, share refs
const assessments = ref({})
const assessmentMeta = ref({ lastSyncedAt: null, totalAssessed: 0 })
const assessmentLoading = ref(false)
const assessmentError = ref(null)
const detailCache = ref({})
let hasFetched = false

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
  if (detailCache.value[key]) {
    return detailCache.value[key]
  }
  try {
    const data = await apiRequest(`/modules/ai-impact/assessments/${encodeURIComponent(key)}`)
    detailCache.value[key] = data
    return data
  } catch (e) {
    if (e.message && e.message.includes('404')) {
      return null
    }
    throw e
  }
}

export function useAssessments() {
  if (!hasFetched) {
    hasFetched = true
    loadAssessments()
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

export function _resetForTesting() {
  assessments.value = {}
  assessmentMeta.value = { lastSyncedAt: null, totalAssessed: 0 }
  assessmentLoading.value = false
  assessmentError.value = null
  detailCache.value = {}
  hasFetched = true // prevent auto-fetch so tests control when loading happens
}
