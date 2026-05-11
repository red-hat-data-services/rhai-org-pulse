import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export function useAuditLog() {
  const entries = ref([])
  const total = ref(0)
  const loading = ref(false)

  async function fetchEntries(filters = {}) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value)
        }
      }
      const query = params.toString() ? `?${params.toString()}` : ''
      const data = await apiRequest(`/modules/team-tracker/structure/audit-log${query}`)
      entries.value = data.entries || []
      total.value = data.total || 0
    } catch {
      entries.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  return {
    entries,
    total,
    loading,
    fetchEntries
  }
}
