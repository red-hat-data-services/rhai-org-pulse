import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

function isDemoResponse(data) {
  return data && data.demo === true
}

export function useTeams() {
  const teams = ref([])
  const loading = ref(false)
  const demoToast = ref(null)

  async function fetchTeams(orgKey) {
    loading.value = true
    try {
      const params = orgKey ? `?orgKey=${encodeURIComponent(orgKey)}` : ''
      const data = await apiRequest(`/modules/team-tracker/structure/teams${params}`)
      teams.value = data.teams || []
    } catch {
      teams.value = []
    } finally {
      loading.value = false
    }
  }

  async function createTeam(name, orgKey) {
    const result = await apiRequest('/modules/team-tracker/structure/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, orgKey })
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    teams.value.push(result)
    return result
  }

  async function renameTeam(teamId, name) {
    const result = await apiRequest(`/modules/team-tracker/structure/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    const idx = teams.value.findIndex(t => t.id === teamId)
    if (idx !== -1) teams.value[idx] = result
    return result
  }

  async function deleteTeam(teamId) {
    const result = await apiRequest(`/modules/team-tracker/structure/teams/${teamId}`, {
      method: 'DELETE'
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    teams.value = teams.value.filter(t => t.id !== teamId)
    return result
  }

  async function assignMember(teamId, uid) {
    const result = await apiRequest(`/modules/team-tracker/structure/teams/${teamId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    return result
  }

  async function assignMembersBulk(teamId, uids) {
    const result = await apiRequest(`/modules/team-tracker/structure/teams/${teamId}/members/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uids })
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    return result
  }

  async function unassignMember(teamId, uid) {
    const result = await apiRequest(`/modules/team-tracker/structure/teams/${teamId}/members/${uid}`, {
      method: 'DELETE'
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    return result
  }

  async function fetchUnassigned(scope = 'all') {
    const data = await apiRequest(`/modules/team-tracker/structure/unassigned?scope=${encodeURIComponent(scope)}`)
    return data.people || []
  }

  async function updateTeamFields(teamId, fields) {
    const result = await apiRequest(`/modules/team-tracker/structure/teams/${teamId}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    return result
  }

  return {
    teams,
    loading,
    demoToast,
    fetchTeams,
    createTeam,
    renameTeam,
    deleteTeam,
    assignMember,
    assignMembersBulk,
    unassignMember,
    fetchUnassigned,
    updateTeamFields
  }
}
