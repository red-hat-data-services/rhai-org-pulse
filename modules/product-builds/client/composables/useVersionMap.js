import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/product-builds/version-map'

export function useVersionMap() {
  const data = ref(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await apiRequest(BASE)
    } catch (e) {
      error.value = e.message || 'Failed to load version map'
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    refreshing.value = true
    error.value = null
    try {
      data.value = await apiRequest(`${BASE}/refresh`, { method: 'POST' })
    } catch (e) {
      error.value = e.message || 'Failed to refresh version map'
    } finally {
      refreshing.value = false
    }
  }

  const releases = computed(() => data.value ? data.value.releases : [])

  const accelerators = computed(() => data.value ? data.value.accelerators : [])

  const source = computed(() => data.value ? data.value.source : null)

  const allPackageNames = computed(() => {
    if (!data.value) return []
    const names = new Set()
    for (const acc of data.value.accelerators) {
      for (const sv of acc.sub_variants) {
        for (const pkg of sv.packages) names.add(pkg.name)
        for (const inf of sv.infra) names.add(inf.name)
      }
    }
    return [...names].sort()
  })

  const totalVariants = computed(() => {
    if (!data.value) return 0
    let count = 0
    for (const acc of data.value.accelerators) count += acc.sub_variants.length
    return count
  })

  const jiraLinks = ref(null)
  const jiraLinksLoading = ref(false)

  async function loadJiraLinks() {
    jiraLinksLoading.value = true
    try {
      jiraLinks.value = await apiRequest(`${BASE}/jira-links`)
    } catch {
      jiraLinks.value = null
    } finally {
      jiraLinksLoading.value = false
    }
  }

  return {
    data,
    loading,
    error,
    load,
    refresh,
    refreshing,
    releases,
    accelerators,
    source,
    allPackageNames,
    totalVariants,
    jiraLinks,
    jiraLinksLoading,
    loadJiraLinks,
  }
}
