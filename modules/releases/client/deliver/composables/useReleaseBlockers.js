import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export function useReleaseBlockers(releaseNumberRef, codeFreezeRef) {
  const data = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function fetchBlockers(releaseNumber, codeFreezeDate) {
    if (!releaseNumber) {
      data.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      let url = `/modules/releases/delivery/blockers/${encodeURIComponent(releaseNumber)}`
      if (codeFreezeDate) {
        url += `?codeFreezeDate=${encodeURIComponent(codeFreezeDate)}`
      }
      data.value = await apiRequest(url)
    } catch (err) {
      error.value = err.status === 404
        ? 'No blocker data available for this release.'
        : (err.message || 'Failed to load blocker data.')
      data.value = null
    } finally {
      loading.value = false
    }
  }

  watch(
    [releaseNumberRef, codeFreezeRef],
    function ([rn, cf]) { fetchBlockers(rn, cf) },
    { immediate: true }
  )

  return {
    data,
    loading,
    error,
    refresh: function () { fetchBlockers(releaseNumberRef.value, codeFreezeRef.value) }
  }
}
