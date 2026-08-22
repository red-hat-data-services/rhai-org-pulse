import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/team-tracker/allocation'

export async function getTeamAllocationSummary(teamId) {
  return apiRequest(`${BASE}/team/${encodeURIComponent(teamId)}/summary`)
}

export async function getTeamAllocationSettings(teamId) {
  return apiRequest(`${BASE}/team/${encodeURIComponent(teamId)}/settings`)
}

export async function updateTeamAllocationSettings(teamId, allocationMode) {
  return apiRequest(`${BASE}/team/${encodeURIComponent(teamId)}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allocationMode })
  })
}

export async function getBoardSprints(boardId, sprintFilter) {
  const params = sprintFilter ? `?sprintFilter=${encodeURIComponent(sprintFilter)}` : ''
  return apiRequest(`${BASE}/board/${encodeURIComponent(boardId)}/sprints${params}`)
}

// Live, unfiltered sprint list from Jira — used to preview a name filter.
export async function getBoardAllSprints(boardId) {
  return apiRequest(`${BASE}/board/${encodeURIComponent(boardId)}/all-sprints`)
}

// Update a team's boards via core team-tracker (owns board metadata, incl.
// sprintFilter). The endpoint replaces the whole boards array.
export async function updateTeamBoards(teamId, boards) {
  return apiRequest(`/modules/team-tracker/structure/teams/${encodeURIComponent(teamId)}/boards`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boards })
  })
}

// Shared substring match used both for the live preview and (implicitly) by the
// server's orchestration filter, so the preview matches what a refresh produces.
export function sprintMatchesFilter(sprintName, filter) {
  const f = (filter || '').trim().toLowerCase()
  if (!f) return true
  return String(sprintName || '').toLowerCase().includes(f)
}

export async function getSprintIssues(sprintId) {
  return apiRequest(`${BASE}/sprints/${encodeURIComponent(sprintId)}/issues`)
}

export async function refreshAllocation(teamId, hardRefresh) {
  const body = {}
  if (teamId) body.teamId = teamId
  if (hardRefresh) body.hardRefresh = true
  return apiRequest(`${BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function getRefreshStatus() {
  return apiRequest(`${BASE}/refresh/status`)
}

export async function getOrgAllocationSummary(orgKey) {
  return apiRequest(`${BASE}/org/${encodeURIComponent(orgKey)}/summary`)
}

export async function getGlobalAllocationSummary() {
  return apiRequest(`${BASE}/global/summary`)
}

export async function getAllocationStrategy() {
  return apiRequest(`${BASE}/strategy`)
}

