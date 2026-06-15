import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const summary = ref(null)
const loading = ref(false)
const error = ref(null)

export function useDisconnectedReadiness() {
  async function loadSummary() {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest('/modules/system-health/disconnected/summary')
      summary.value = data
      return data
    } catch (err) {
      error.value = err.message || 'Failed to load disconnected readiness data'
      summary.value = null
      return null
    } finally {
      loading.value = false
    }
  }

  async function loadRepoDetail(repoKey) {
    return apiRequest(`/modules/system-health/disconnected/repos/${encodeURIComponent(repoKey)}`)
  }

  const readyCount = computed(() => summary.value?.readyCount || 0)
  const notReadyCount = computed(() => summary.value?.notReadyCount || 0)
  const totalRepos = computed(() => summary.value?.repoCount || 0)
  const readinessPercent = computed(() => summary.value?.readinessPercent || 0)

  return {
    summary, loading, error,
    readyCount, notReadyCount, totalRepos, readinessPercent,
    loadSummary, loadRepoDetail
  }
}
