import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export function usePoHubBacklogData() {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function request(path, options) {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest(`/modules/releases/po-hub/${path}`, options)
    } catch (cause) {
      error.value = cause.message
    } finally {
      loading.value = false
    }
  }

  function load() { return request('backlog') }
  function refresh() { return request('backlog/refresh', { method: 'POST' }) }

  load()
  return { data, loading, error, load, refresh }
}
