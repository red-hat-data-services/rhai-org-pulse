/**
 * Allocation Tracker API Service
 * Uses shared apiRequest from team-tracker — no Firebase, no manual token handling.
 */

import { apiRequest } from '@shared/client'

const BASE = '/modules/allocation-tracker'

/**
 * Refresh data from Jira (async — returns immediately, processes in background)
 */
export async function refreshData(projectKey, { hardRefresh = false } = {}) {
  return apiRequest(`${BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectKey, hardRefresh })
  })
}

/**
 * Get refresh status (polling endpoint)
 */
export async function getRefreshStatus() {
  return apiRequest(`${BASE}/refresh/status`)
}

/**
 * Get pre-computed dashboard summary
 */
export async function getDashboardSummary(projectKey) {
  const query = projectKey ? `?project=${encodeURIComponent(projectKey)}` : ''
  return apiRequest(`${BASE}/dashboard-summary${query}`)
}

/**
 * Get list of boards
 */
export async function getBoards(projectKey) {
  const query = projectKey ? `?project=${encodeURIComponent(projectKey)}` : ''
  return apiRequest(`${BASE}/boards${query}`)
}

/**
 * Get sprints for a specific board
 */
export async function getSprintsForBoard(boardId, { signal, projectKey } = {}) {
  const query = projectKey ? `?project=${encodeURIComponent(projectKey)}` : ''
  const options = signal ? { signal } : {}
  return apiRequest(`${BASE}/boards/${encodeURIComponent(boardId)}/sprints${query}`, options)
}

/**
 * Get issues for a specific sprint
 */
export async function getSprintIssues(sprintId, { signal, projectKey } = {}) {
  const query = projectKey ? `?project=${encodeURIComponent(projectKey)}` : ''
  const options = signal ? { signal } : {}
  return apiRequest(`${BASE}/sprints/${encodeURIComponent(sprintId)}/issues${query}`, options)
}

/**
 * Get team configuration
 */
export async function getTeams(projectKey) {
  const query = projectKey ? `?project=${encodeURIComponent(projectKey)}` : ''
  return apiRequest(`${BASE}/teams${query}`)
}

/**
 * Save team configuration
 */
export async function saveTeams(teams, projectKey) {
  const query = projectKey ? `?project=${encodeURIComponent(projectKey)}` : ''
  return apiRequest(`${BASE}/teams${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teams })
  })
}

/**
 * Discover boards from Jira
 */
export async function discoverBoards(projectKey) {
  return apiRequest(`${BASE}/discover-boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectKey })
  })
}

/**
 * Get list of configured projects
 */
export async function getProjects() {
  return apiRequest(`${BASE}/projects`)
}

/**
 * Get org-wide allocation summary
 */
export async function getOrgSummary() {
  return apiRequest(`${BASE}/org-summary`)
}

/**
 * Get project-level dashboard summary
 */
export async function getProjectSummary(projectKey) {
  return apiRequest(`${BASE}/projects/${encodeURIComponent(projectKey)}/summary`)
}

/**
 * Save project configuration
 */
export async function saveProjects({ orgName, projects }) {
  return apiRequest(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgName, projects })
  })
}

/**
 * Classify a single Jira issue
 */
export async function classifyIssue(issueKey, dryRun = true) {
  return apiRequest(`${BASE}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueKey, dryRun })
  })
}

/**
 * Bulk classify issues matching a JQL query
 */
export async function bulkClassifyIssues(jql, dryRun = true, limit = 100) {
  return apiRequest(`${BASE}/classify/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jql, dryRun, limit })
  })
}
