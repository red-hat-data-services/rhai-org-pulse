import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export function usePipelines() {
  const pipelines = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await apiRequest('/modules/pipeline-ops/pipelines')
      pipelines.value = data.pipelines || []
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { pipelines, loading, error, load }
}

export function usePipelineDetail() {
  const pipeline = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function load(slug) {
    loading.value = true
    error.value = null
    try {
      pipeline.value = await apiRequest(`/modules/pipeline-ops/pipelines/${encodeURIComponent(slug)}`)
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { pipeline, loading, error, load }
}
