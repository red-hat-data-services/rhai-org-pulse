import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'

export const TEAM_PROJECTS = ['RHAISTRAT', 'RHAI']

/**
 * Team project selection and the Jira component options for that project,
 * shared by the AIPCC-E request forms. `onProjectChange` runs before each
 * load so the form can clear its selected team.
 */
export function useRequestTeams(onProjectChange = () => {}) {
  const teamProject = ref('RHAISTRAT')
  const teams = ref([])
  const loadingTeams = ref(false)
  const teamLoadError = ref('')
  let loadId = 0

  async function loadTeams() {
    const id = ++loadId
    onProjectChange()
    teams.value = []
    teamLoadError.value = ''
    loadingTeams.value = true
    try {
      const data = await apiRequest(`/modules/product-builds/package-requests/teams?project=${teamProject.value}`)
      if (id !== loadId) return
      teams.value = Array.isArray(data) ? data : []
    } catch {
      if (id !== loadId) return
      teamLoadError.value = 'Could not load teams. Please try again.'
    } finally {
      if (id === loadId) loadingTeams.value = false
    }
  }

  watch(teamProject, loadTeams, { immediate: true })

  return { teamProject, teams, loadingTeams, teamLoadError, loadTeams }
}
