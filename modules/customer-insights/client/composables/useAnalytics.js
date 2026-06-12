import { ref, watch } from 'vue'

/**
 * Composable for fetching analytics data
 */
export function useAnalytics(componentFilter) {
  const analytics = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchAnalytics() {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (componentFilter?.value && componentFilter.value !== 'all') {
        params.append('component', componentFilter.value)
      }

      const response = await fetch(`/api/modules/customer-insights/analytics?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      analytics.value = data
    } catch (err) {
      error.value = err.message
      console.error('Error fetching analytics:', err)
    } finally {
      loading.value = false
    }
  }

  if (componentFilter) {
    watch(componentFilter, fetchAnalytics, { immediate: true })
  }

  return {
    analytics,
    loading,
    error,
    refresh: fetchAnalytics,
  }
}
