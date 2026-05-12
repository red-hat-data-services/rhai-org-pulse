import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client'

const dashboardData = ref(null)
const pagesData = ref(null)
const userTypesData = ref(null)
const loading = ref(false)
const error = ref(null)

export function useMetricsDashboard() {
  async function fetchDashboard(from, to) {
    loading.value = true
    error.value = null
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      dashboardData.value = await apiRequest(`/health-metrics/dashboard${qs ? '?' + qs : ''}`)
    } catch (err) {
      error.value = err.message || 'Failed to load dashboard data'
    } finally {
      loading.value = false
    }
  }

  async function fetchPages(options = {}) {
    try {
      const params = new URLSearchParams()
      if (options.from) params.set('from', options.from)
      if (options.to) params.set('to', options.to)
      if (options.sort) params.set('sort', options.sort)
      if (options.limit) params.set('limit', String(options.limit))
      const qs = params.toString()
      pagesData.value = await apiRequest(`/health-metrics/pages${qs ? '?' + qs : ''}`)
    } catch (err) {
      error.value = err.message || 'Failed to load pages data'
    }
  }

  async function fetchPageDetail(pageId, from, to) {
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      return await apiRequest(`/health-metrics/pages/${pageId}${qs ? '?' + qs : ''}`)
    } catch (err) {
      error.value = err.message || 'Failed to load page detail'
      return null
    }
  }

  async function fetchUserTypes(from, to) {
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      userTypesData.value = await apiRequest(`/health-metrics/user-types${qs ? '?' + qs : ''}`)
    } catch (err) {
      error.value = err.message || 'Failed to load user types'
    }
  }

  const totalViews = computed(() => dashboardData.value?.totalViews || 0)
  const uniqueUsers = computed(() => dashboardData.value?.uniqueUsers || 0)
  const activePages = computed(() => dashboardData.value?.activePages || 0)
  const topPages = computed(() => dashboardData.value?.topPages || [])
  const userTypes = computed(() => dashboardData.value?.userTypes || {})
  const daily = computed(() => dashboardData.value?.daily || {})

  return {
    dashboardData,
    pagesData,
    userTypesData,
    loading,
    error,
    fetchDashboard,
    fetchPages,
    fetchPageDetail,
    fetchUserTypes,
    totalViews,
    uniqueUsers,
    activePages,
    topPages,
    userTypes,
    daily,
  }
}
