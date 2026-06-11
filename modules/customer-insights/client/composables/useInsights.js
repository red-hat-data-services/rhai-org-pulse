import { ref, watch } from 'vue'

/**
 * Composable for fetching AI insights
 */
export function useInsights(componentFilter) {
  const insights = ref(null)
  const history = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchInsights() {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (componentFilter?.value && componentFilter.value !== 'all') {
        params.append('component', componentFilter.value)
      }

      const [insightsRes, historyRes] = await Promise.all([
        fetch(`/api/modules/customer-insights/insights?${params}`),
        fetch(`/api/modules/customer-insights/insights/history?${params}`)
      ])

      if (!insightsRes.ok) throw new Error(`HTTP ${insightsRes.status}`)
      if (!historyRes.ok) throw new Error(`HTTP ${historyRes.status}`)

      insights.value = await insightsRes.json()
      history.value = await historyRes.json()
    } catch (err) {
      error.value = err.message
      console.error('Error fetching insights:', err)
    } finally {
      loading.value = false
    }
  }

  if (componentFilter) {
    watch(componentFilter, fetchInsights, { immediate: true })
  }

  return {
    insights,
    history,
    loading,
    error,
    refresh: fetchInsights,
  }
}
