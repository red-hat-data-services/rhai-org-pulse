import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client'
import { buildComponentLeadsMap, getComponentLeads } from './componentLeads'

/**
 * Fetch PM Hub pillar-config and expose component → PM/ENG lead lookup.
 */
export function useComponentLeads() {
  var pillarConfig = ref({ pillars: [] })
  var loading = ref(false)
  var error = ref(null)

  var leadsMap = computed(function () {
    return buildComponentLeadsMap(pillarConfig.value)
  })

  async function fetchLeads() {
    loading.value = true
    error.value = null
    try {
      var result = await apiRequest('/modules/releases/pm-hub/pillar-config')
      if (result && Array.isArray(result.pillars)) {
        pillarConfig.value = result
      }
    } catch (err) {
      error.value = (err && err.message) || 'Failed to load component leads'
      pillarConfig.value = { pillars: [] }
    } finally {
      loading.value = false
    }
  }

  function leadsFor(componentName) {
    return getComponentLeads(leadsMap.value, componentName)
  }

  onMounted(function () {
    fetchLeads()
  })

  return {
    pillarConfig,
    leadsMap,
    loading,
    error,
    fetchLeads,
    leadsFor,
  }
}
