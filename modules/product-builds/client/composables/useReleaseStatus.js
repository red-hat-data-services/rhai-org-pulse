import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

function applyLinks(data, links) {
  if (!data || !links) return
  for (const group of data.groups || []) {
    for (const epic of group.epics || []) {
      const epicLinks = links[epic.key]
      if (epicLinks) {
        epic.merge_requests = epicLinks.merge_requests
        epic.pipeline_runs = epicLinks.pipeline_runs
      }
      for (const child of epic.children || []) {
        const childLinks = links[child.key]
        if (childLinks) {
          child.merge_requests = childLinks.merge_requests
          child.pipeline_run = childLinks.pipeline_run
        }
      }
    }
  }
}

export function useReleaseStatus() {
  const data = ref(null)
  const loading = ref(true)
  const linksLoading = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest('/modules/product-builds/release-status')
    } catch (err) {
      error.value = err.message || 'Failed to load release status'
      return
    } finally {
      loading.value = false
    }
    linksLoading.value = true
    try {
      applyLinks(data.value, (await apiRequest('/modules/product-builds/release-status/links')).links)
    } catch {
      // Links are progressive enrichment; the cards stay usable without them.
    } finally {
      linksLoading.value = false
    }
  }

  return { data, loading, linksLoading, error, load }
}
