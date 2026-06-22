/**
 * API Service — handles communication with the backend.
 *
 * Authentication is handled by the OpenShift OAuth proxy —
 * no client-side token management needed.
 */

import { impersonatingUid } from '@shared/client/state/impersonation'

/** Prefix for sessionStorage-only caches. */
export const SESSION_CACHE_PREFIX = 'app_cache:session:'

/**
 * Base URL for REST calls. Relative paths default to `/api` (Vite proxy in dev).
 * Absolute URLs must point at the API root: if you set only the host (e.g.
 * `http://localhost:3001`), `/api` is appended so paths like `/modules/...`
 * resolve to `/api/modules/...` on the backend.
 */
let _cachedApiBase = null
export function getApiBase() {
  if (_cachedApiBase !== null) return _cachedApiBase
  const raw = import.meta.env.VITE_API_ENDPOINT
  if (raw === undefined || raw === '') { _cachedApiBase = '/api'; return _cachedApiBase }
  const s = String(raw).trim()
  if (!s) { _cachedApiBase = '/api'; return _cachedApiBase }
  if (!/^https?:\/\//i.test(s)) {
    _cachedApiBase = s.replace(/\/$/, '') || '/api'
    return _cachedApiBase
  }
  try {
    const u = new URL(s)
    const p = u.pathname.replace(/\/$/, '') || '/'
    if (p === '/') {
      _cachedApiBase = `${u.origin}/api`
    } else {
      _cachedApiBase = s.replace(/\/$/, '')
    }
  } catch {
    _cachedApiBase = '/api'
  }
  return _cachedApiBase
}

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (impersonatingUid.value) {
    headers['X-Impersonate-Uid'] = impersonatingUid.value
  }

  const response = await fetch(`${getApiBase()}${path}`, { ...options, headers })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 401) {
      throw new Error('Authentication failed. Please sign in again.')
    }
    if (response.status === 403) {
      const err = new Error(errorData.error || 'Access denied')
      err.status = 403
      err.data = errorData
      throw err
    }
    const err = new Error(errorData.error || `HTTP ${response.status}`)
    err.status = response.status
    err.data = errorData
    throw err
  }

  return response.json()
}

// ─── Site Config ───

export async function getSiteConfig() {
  return apiRequest('/site-config')
}

export async function saveSiteConfig(config) {
  return apiRequest('/site-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
}

// ─── Last Refreshed ───

export async function getLastRefreshed() {
  return apiRequest('/last-refreshed')
}

// ─── Roster & Person Metrics ───

export async function getRoster() {
  return apiRequest('/roster')
}

export async function getAllPeopleMetrics() {
  return apiRequest('/people/metrics')
}

export async function getPersonMetrics(jiraDisplayName) {
  return apiRequest(`/person/${encodeURIComponent(jiraDisplayName)}/metrics`)
}

export async function getTeamMetrics(teamKey) {
  return apiRequest(`/team/${encodeURIComponent(teamKey)}/metrics`)
}

// ─── Unified Refresh ───

export async function refreshMetrics({ scope, name, teamKey, orgKey, force, sources } = {}) {
  return apiRequest('/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, name, teamKey, orgKey, force, sources })
  })
}

// ─── GitHub Contributions ───

export async function getGithubContributions() {
  return apiRequest('/github/contributions')
}

// ─── GitLab Contributions ───

export async function getGitlabContributions() {
  return apiRequest('/gitlab/contributions')
}

// ─── Trends ───

export async function getTrends() {
  return apiRequest('/trends')
}

// ─── Annotations ───

export async function getSprintAnnotations(sprintId) {
  return apiRequest(`/sprints/${encodeURIComponent(sprintId)}/annotations`)
}

export async function saveAnnotation(sprintId, assignee, text) {
  return apiRequest(`/sprints/${encodeURIComponent(sprintId)}/annotations`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignee, text })
  })
}

export async function deleteAnnotation(sprintId, assignee, annotationId) {
  return apiRequest(`/sprints/${encodeURIComponent(sprintId)}/annotations/${encodeURIComponent(assignee)}/${encodeURIComponent(annotationId)}`, {
    method: 'DELETE'
  })
}

// ─── Roster Sync ───

export async function isRosterSyncConfigured() {
  return apiRequest('/roster-sync/configured')
}

export async function getRosterSyncFieldDefinitions() {
  return apiRequest('/admin/roster-sync/field-definitions')
}

export async function saveCustomFields(customFields) {
  return apiRequest('/admin/roster-sync/custom-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customFields })
  })
}

export async function getRosterSyncConfig() {
  return apiRequest('/admin/roster-sync/config')
}

export async function saveRosterSyncConfig(data) {
  return apiRequest('/admin/roster-sync/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
}

export async function triggerRosterSync() {
  return apiRequest('/admin/roster-sync/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function getRosterSyncStatus() {
  return apiRequest('/admin/roster-sync/status')
}

// ─── Unified Sync ───

export async function triggerUnifiedSync() {
  return apiRequest('/admin/roster-sync/unified', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

// ─── Jira Sync Admin ───

export async function getJiraSyncConfig() {
  return apiRequest('/admin/jira-sync/config')
}

export async function saveJiraSyncConfig(data) {
  return apiRequest('/admin/jira-sync/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
}

// ─── Snapshots ───

export async function getTeamSnapshots(teamKey) {
  return apiRequest(`/modules/team-tracker/snapshots/${encodeURIComponent(teamKey)}`)
}

export async function getPersonSnapshots(teamKey, personName) {
  return apiRequest(`/modules/team-tracker/snapshots/${encodeURIComponent(teamKey)}/${encodeURIComponent(personName)}`)
}

export async function generateSnapshots(options = {}) {
  return apiRequest('/modules/team-tracker/snapshots/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  })
}

export async function deleteAllSnapshots() {
  return apiRequest('/modules/team-tracker/snapshots', { method: 'DELETE' })
}

// ─── Modules ───

export async function getModules() {
  return apiRequest('/modules')
}

// Generic admin API request (not cached)
export async function apiAdmin(path, options = {}) {
  return apiRequest(path, options)
}

// ─── Allowlist ───

export async function getAllowlist() {
  return apiRequest('/allowlist')
}

export async function addToAllowlist(email) {
  return apiRequest('/allowlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
}

export async function removeFromAllowlist(email) {
  return apiRequest(`/allowlist/${encodeURIComponent(email)}`, {
    method: 'DELETE'
  })
}

// ─── Roles ───

export async function fetchRoles() {
  return apiRequest('/roles')
}

export async function fetchMyRoles() {
  return apiRequest('/roles/me')
}

export async function assignRole(email, role) {
  return apiRequest('/roles/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role })
  })
}

export async function revokeRole(email, role) {
  return apiRequest('/roles/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role })
  })
}
