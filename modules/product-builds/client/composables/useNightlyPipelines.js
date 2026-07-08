import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const BASE = '/modules/product-builds/nightly-pipelines'

export function useNightlyPipelines() {
  const pipelines = ref([])
  const schedule = ref(null)
  const jobs = ref(null)
  const selectedPipelineId = ref(null)
  const loading = ref(false)
  const jobsLoading = ref(false)
  const error = ref(null)
  const packages = ref({})
  const packagesLoading = ref(new Set())

  async function loadPipelines(limit = 14) {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest(`${BASE}?limit=${limit}`)
      pipelines.value = data.pipelines || []
      schedule.value = data.schedule || null
    } catch (e) {
      error.value = e.message
      pipelines.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadPipelineJobs(pipelineId) {
    jobsLoading.value = true
    error.value = null
    selectedPipelineId.value = pipelineId
    jobs.value = null
    packages.value = {}
    packagesLoading.value = new Set()
    try {
      jobs.value = await apiRequest(`${BASE}/${pipelineId}/jobs`)
    } catch (e) {
      error.value = e.message
      jobs.value = null
    } finally {
      jobsLoading.value = false
    }
  }

  async function loadCollectionPackages(pipelineId, collection) {
    if (packages.value[collection] || packagesLoading.value.has(collection)) return
    packagesLoading.value = new Set([...packagesLoading.value, collection])
    try {
      const data = await apiRequest(`${BASE}/${pipelineId}/packages?collection=${encodeURIComponent(collection)}`)
      packages.value = { ...packages.value, [collection]: data }
    } catch (e) {
      packages.value = { ...packages.value, [collection]: { error: e.message } }
    } finally {
      const next = new Set(packagesLoading.value)
      next.delete(collection)
      packagesLoading.value = next
    }
  }

  const latestPipeline = computed(() => pipelines.value[0] || null)

  const successRate = computed(() => {
    if (!pipelines.value.length) return 0
    const passed = pipelines.value.filter(p => p.status === 'success').length
    return Math.round((passed / pipelines.value.length) * 100)
  })

  const currentStreak = computed(() => {
    if (!pipelines.value.length) return { status: null, count: 0 }
    const first = pipelines.value[0].status
    let count = 0
    for (const p of pipelines.value) {
      if (p.status !== first) break
      count++
    }
    return { status: first, count }
  })

  const lastSuccess = computed(() => {
    return pipelines.value.find(p => p.status === 'success') || null
  })

  return {
    pipelines,
    schedule,
    jobs,
    selectedPipelineId,
    loading,
    jobsLoading,
    error,
    packages,
    packagesLoading,
    loadPipelines,
    loadPipelineJobs,
    loadCollectionPackages,
    latestPipeline,
    successRate,
    currentStreak,
    lastSuccess,
  }
}