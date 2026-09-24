import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const DATA_ENDPOINT = '/modules/system-health/quality/test-execution/data'

/**
 * Fetch the detail payloads needed for a single component's drill-down view:
 * the component's entry from `components.json` (daily series + quality gates)
 * and its `by_vr` heatmap entry (for the version trend), plus `jira_config`.
 *
 * Returns { component, detail, heatmapEntry, jiraConfig } or throws.
 */
export async function fetchComponentDetail(componentName) {
  const [components, heatmap, jira_config] = await Promise.all([
    apiRequest(`${DATA_ENDPOINT}?file=components`),
    apiRequest(`${DATA_ENDPOINT}?file=heatmap`),
    apiRequest(`${DATA_ENDPOINT}?file=jira_config`)
  ])

  const detail = components && components[componentName] ? components[componentName] : null
  const heatmapComponents = Array.isArray(heatmap)
    ? heatmap
    : (heatmap && Array.isArray(heatmap.components) ? heatmap.components : [])
  const heatmapEntry = heatmapComponents.find((c) => c.component === componentName) || null

  return {
    component: componentName,
    detail,
    heatmapEntry,
    jiraConfig: jira_config && Object.keys(jira_config).length ? jira_config : null
  }
}

/**
 * Fetches and holds the test-execution dashboard payloads.
 *
 * The data is pushed into org-pulse storage by the external test-reports
 * pipeline (see docs/DATA-FORMATS.md) and served as a combined object:
 *   { heatmap, components, jira_config, meta, lastUpload }
 *
 * `heatmap` is the primary payload consumed by the dashboard and is either an
 * array of components or an object `{ components: [...] }`. This composable
 * normalizes it to an array.
 */
export function useTestDashboard() {
  const loading = ref(false)
  const error = ref(null)

  const heatmap = ref([]) // normalized array of { component, overall, days }
  const jiraConfig = ref(null)
  const meta = ref(null)
  const lastUpload = ref(null)

  function normalizeHeatmap(raw) {
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object' && Array.isArray(raw.components)) return raw.components
    return []
  }

  async function loadData() {
    loading.value = true
    error.value = null
    try {
      const res = await apiRequest(DATA_ENDPOINT)
      heatmap.value = normalizeHeatmap(res.heatmap)
      jiraConfig.value = res.jira_config || null
      meta.value = res.meta || null
      lastUpload.value = res.lastUpload || null
    } catch (err) {
      error.value = err.message || 'Failed to load test execution data'
      heatmap.value = []
    } finally {
      loading.value = false
    }
  }

  const hasData = computed(() => heatmap.value.length > 0)

  return {
    loading,
    error,
    hasData,
    heatmap,
    jiraConfig,
    meta,
    lastUpload,
    loadData,
    refetch: loadData
  }
}
