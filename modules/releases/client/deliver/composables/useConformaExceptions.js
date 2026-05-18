import { reactive } from 'vue'
import { cachedRequest, apiRequest } from '@shared/client/services/api'

export function useConformaExceptions() {
  const state = reactive({
    releases: [],
    fetchedAt: null,
    minDate: null,
    count: 0,
    loading: true,
    error: null
  })

  cachedRequest(
    'conforma:releases',
    '/modules/releases/delivery/conforma/releases',
    (data) => {
      state.releases = data.releases || []
      state.fetchedAt = data.fetchedAt || null
      state.minDate = data.minDate || null
      state.count = data.count || state.releases.length
      state.loading = false
      state.error = null
    }
  ).catch((err) => {
    state.loading = false
    state.error = err.status === 404
      ? 'No conforma data available yet. Run the ingestion pipeline to populate.'
      : (err.message || 'Failed to load conforma data.')
  })

  return state
}

export async function deleteConformaData() {
  return apiRequest('/modules/releases/delivery/conforma', { method: 'DELETE' })
}
