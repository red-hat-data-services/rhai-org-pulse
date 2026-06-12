import { ref, watch } from 'vue'

/**
 * Composable for fetching product roadmap data
 */
export function useRoadmap(componentFilter) {
  const roadmap = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchRoadmap() {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (componentFilter?.value && componentFilter.value !== 'all') {
        params.append('component', componentFilter.value)
      }

      const res = await fetch(`/api/modules/customer-insights/roadmap?${params}`)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      roadmap.value = await res.json()
    } catch (err) {
      error.value = err.message
      console.error('Error fetching roadmap:', err)
    } finally {
      loading.value = false
    }
  }

  if (componentFilter) {
    watch(componentFilter, fetchRoadmap, { immediate: true })
  }

  return {
    roadmap,
    loading,
    error,
    refresh: fetchRoadmap,
  }
}
