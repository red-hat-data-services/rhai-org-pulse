import { apiRequest } from '@shared/client/services/api'

const BASE = '/modules/team-tracker/allocation'

export async function getTeamAllocationSummary(teamId) {
  return apiRequest(`${BASE}/team/${encodeURIComponent(teamId)}/summary`)
}

export async function getBoardSprints(boardId, sprintFilter) {
  const params = sprintFilter ? `?sprintFilter=${encodeURIComponent(sprintFilter)}` : ''
  return apiRequest(`${BASE}/board/${encodeURIComponent(boardId)}/sprints${params}`)
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

// Classification Pipeline

export async function getClassificationConfig() {
  return apiRequest(`${BASE}/classification/config`)
}

export async function saveClassificationConfig(config) {
  return apiRequest(`${BASE}/classification/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
}

export async function testClassification(issueKey, dryRun = true) {
  return apiRequest(`${BASE}/classification/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueKey, dryRun })
  })
}

export async function runBulkClassification({ jql, dryRun = true, limit = 1000 }) {
  return apiRequest(`${BASE}/classification/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, dryRun, limit })
  })
}

export async function getScheduleInfo() {
  return apiRequest(`${BASE}/classification/schedule`)
    .then(res => res.schedule)
    .catch(() => null)
}

export async function getPipelineStatus(pipelineId) {
  return apiRequest(`${BASE}/classification/pipeline/${pipelineId}`)
}

