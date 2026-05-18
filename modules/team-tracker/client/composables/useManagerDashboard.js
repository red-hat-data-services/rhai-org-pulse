import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const manager = ref(null)
const directReports = ref([])
const indirectReports = ref([])
const teams = ref([])
const allOrgTeams = ref([])
const allPeople = ref([])
const referencedPeople = ref({})
const fieldDefinitions = ref({ person: [], team: [] })
const loading = ref(false)
const error = ref(null)
const reason = ref(null)
const includeIndirect = ref(false)

export function useManagerDashboard() {
  async function load() {
    loading.value = true
    error.value = null
    reason.value = null
    try {
      const params = includeIndirect.value ? '?includeIndirect=true' : ''
      const data = await apiRequest(`/modules/team-tracker/manager/dashboard${params}`)
      manager.value = data.manager || null
      directReports.value = data.directReports || []
      indirectReports.value = data.indirectReports || []
      teams.value = data.teams || []
      allOrgTeams.value = data.allOrgTeams || []
      allPeople.value = data.allPeople || []
      referencedPeople.value = data.referencedPeople || {}
      fieldDefinitions.value = data.fieldDefinitions || { person: [], team: [] }
      reason.value = data.reason || null
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    return load()
  }

  return {
    manager,
    directReports,
    indirectReports,
    teams,
    allOrgTeams,
    allPeople,
    referencedPeople,
    fieldDefinitions,
    loading,
    error,
    reason,
    includeIndirect,
    load,
    refresh
  }
}
