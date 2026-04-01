/**
 * API Service
 * Handles communication with the backend
 * Uses localStorage for stale-while-revalidate caching
 *
 * Authentication is handled by the OpenShift OAuth proxy —
 * no client-side token management needed.
 */

const CACHE_PREFIX = 'tt_cache:'
/** Prefix for sessionStorage-only caches (same family as tt_cache: localStorage keys). */
export const SESSION_CACHE_PREFIX = 'tt_cache:session:'

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

// ─── LocalStorage Cache ───

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data))
  } catch {
    // localStorage full — evict oldest cache entries and retry
    evictOldest()
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data))
    } catch {
      // still full, skip caching
    }
  }
}

function evictOldest() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k.startsWith(CACHE_PREFIX)) keys.push(k)
  }
  // Remove first half of cache keys (oldest by insertion order)
  const toRemove = keys.slice(0, Math.max(1, Math.floor(keys.length / 2)))
  for (const k of toRemove) {
    localStorage.removeItem(k)
  }
}

/**
 * Clear all API cache entries from localStorage
 */
export function clearApiCache() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k.startsWith(CACHE_PREFIX)) keys.push(k)
  }
  for (const k of keys) {
    localStorage.removeItem(k)
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${getApiBase()}${path}`, options)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 401) {
      throw new Error('Authentication failed. Please sign in again.')
    }
    if (response.status === 403) {
      const err = new Error(errorData.error || 'Access denied')
      err.status = 403
      throw err
    }
    const err = new Error(errorData.error || `HTTP ${response.status}`)
    err.status = response.status
    throw err
  }

  return response.json()
}

/**
 * Stale-while-revalidate: return cached data immediately via onData callback,
 * then fetch fresh data and call onData again if it changed.
 * If no cache exists, fetches and returns normally.
 */
async function cachedRequest(cacheKey, path, onData) {
  const cached = cacheGet(cacheKey)

  if (cached && onData) {
    onData(cached)
  }

  try {
    const fresh = await apiRequest(path)
    cacheSet(cacheKey, fresh)
    if (onData) {
      onData(fresh)
    }
    return fresh
  } catch (err) {
    // If we have cached data, swallow network errors silently
    if (cached) {
      console.warn(`Using cached data for ${path}:`, err.message)
      return cached
    }
    throw err
  }
}

// ─── Last Refreshed ───

export async function getLastRefreshed() {
  return apiRequest('/last-refreshed')
}

// ─── Roster & Person Metrics ───

export async function getRoster(onData) {
  return cachedRequest('roster', '/roster', onData)
}

export async function getAllPeopleMetrics(onData) {
  return cachedRequest('people-metrics', '/people/metrics', onData)
}

export async function getPersonMetrics(jiraDisplayName) {
  return cachedRequest(`person:${jiraDisplayName}`, `/person/${encodeURIComponent(jiraDisplayName)}/metrics`)
}

export async function getTeamMetrics(teamKey, onData) {
  return cachedRequest(`team:${teamKey}`, `/team/${encodeURIComponent(teamKey)}/metrics`, onData)
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

export async function getGithubContributions(onData) {
  return cachedRequest('github-contributions', '/github/contributions', onData)
}

// ─── GitLab Contributions ───

export async function getGitlabContributions(onData) {
  return cachedRequest('gitlab-contributions', '/gitlab/contributions', onData)
}

// ─── Trends ───

export async function getTrends(onData) {
  return cachedRequest('trends', '/trends', onData)
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

export async function generateSnapshots() {
  return apiRequest('/modules/team-tracker/snapshots/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function deleteAllSnapshots() {
  return apiRequest('/modules/team-tracker/snapshots', { method: 'DELETE' })
}

// ─── Modules ───

export async function getModules(onData) {
  return cachedRequest('modules', '/modules', onData)
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
