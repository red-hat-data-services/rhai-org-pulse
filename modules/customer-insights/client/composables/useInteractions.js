import { ref, watch } from 'vue'

/**
 * Composable for managing customer interactions
 * @param {import('vue').Ref<string>} componentFilter - Reactive component filter
 */
export function useInteractions(componentFilter) {
  const interactions = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchInteractions() {
    loading.value = true
    error.value = null
    console.log('[useInteractions] Fetching interactions, component filter:', componentFilter?.value)

    try {
      const params = new URLSearchParams()
      if (componentFilter?.value && componentFilter.value !== 'all') {
        params.append('component', componentFilter.value)
      }

      const url = `/api/modules/customer-insights/interactions?${params}`
      console.log('[useInteractions] Fetching from:', url)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      console.log('[useInteractions] Received data:', data.length, 'interactions')
      interactions.value = data
    } catch (err) {
      error.value = err.message
      console.error('[useInteractions] Error fetching interactions:', err)
    } finally {
      loading.value = false
      console.log('[useInteractions] Loading complete. interactions:', interactions.value.length, 'loading:', loading.value)
    }
  }

  async function createInteraction(data) {
    const response = await fetch('/api/modules/customer-insights/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create interaction')
    }

    const created = await response.json()
    interactions.value.push(created)
    return created
  }

  async function updateInteraction(id, data) {
    const response = await fetch(`/api/modules/customer-insights/interactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to update interaction')
    }

    const updated = await response.json()
    const index = interactions.value.findIndex(i => i.id === id)
    if (index !== -1) {
      interactions.value[index] = updated
    }
    return updated
  }

  async function deleteInteraction(id) {
    const response = await fetch(`/api/modules/customer-insights/interactions/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to delete interaction')
    }

    interactions.value = interactions.value.filter(i => i.id !== id)
  }

  // Auto-fetch when component filter changes
  if (componentFilter) {
    watch(componentFilter, fetchInteractions, { immediate: true })
  }

  return {
    interactions,
    loading,
    error,
    refresh: fetchInteractions,
    createInteraction,
    updateInteraction,
    deleteInteraction,
  }
}
