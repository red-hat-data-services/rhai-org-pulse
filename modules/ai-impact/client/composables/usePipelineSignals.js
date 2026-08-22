import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const cache = ref({})

/**
 * Load pipeline signals for a feature key. Results are cached per key
 * for the lifetime of the session.
 *
 * @param {string} featureKey - RHAISTRAT-xxx or RHOAIENG-xxx
 * @returns {Promise<object|null>} Resolved pipeline signals or null on error
 */
async function loadPipelineSignals(featureKey) {
  if (!featureKey) return null
  if (cache.value[featureKey]) return cache.value[featureKey]

  try {
    const data = await apiRequest(`/modules/ai-impact/pipeline-signals/${encodeURIComponent(featureKey)}`)
    cache.value[featureKey] = data
    return data
  } catch {
    return null
  }
}

export function usePipelineSignals() {
  return { loadPipelineSignals, cache }
}
