import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

var API_BASE = '/modules/release-planning'

export function useAuditLog() {
  var entries = ref([])
  var total = ref(0)
  var loading = ref(false)
  var error = ref(null)

  async function loadAuditLog(options) {
    loading.value = true
    error.value = null

    var params = new URLSearchParams()
    if (options && options.version) params.set('version', options.version)
    if (options && options.action) params.set('action', options.action)
    if (options && options.limit) params.set('limit', String(options.limit))
    if (options && options.offset) params.set('offset', String(options.offset))

    var qs = params.toString()
    var url = API_BASE + '/audit-log' + (qs ? '?' + qs : '')

    try {
      var data = await apiRequest(url)
      entries.value = data.entries || []
      total.value = data.total || 0
    } catch (err) {
      error.value = err.message
      entries.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  return { entries, total, loading, error, loadAuditLog }
}
