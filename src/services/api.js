/**
 * API Service
 * Handles communication with the backend
 * Automatically includes Firebase ID token in requests
 * Uses localStorage for stale-while-revalidate caching
 */

import { useAuth } from '../composables/useAuth'

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '/api'
const CACHE_PREFIX = 'tt_cache:'

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

function cacheDelete(key) {
  localStorage.removeItem(CACHE_PREFIX + key)
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

/**
 * Get Firebase ID token for authentication
 */
async function getAuthToken() {
  const { getIdToken, loading } = useAuth()

  if (loading.value) {
    await new Promise((resolve) => {
      const checkLoading = setInterval(() => {
        if (!loading.value) {
          clearInterval(checkLoading)
          resolve()
        }
      }, 50)
      setTimeout(() => {
        clearInterval(checkLoading)
        resolve()
      }, 10000)
    })
  }

  try {
    return await getIdToken()
  } catch (error) {
    console.error('Failed to get auth token:', error)
    throw new Error('Authentication required. Please sign in again.')
  }
}

async function apiRequest(path, options = {}) {
  const token = await getAuthToken()
  const response = await fetch(`${API_ENDPOINT}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })

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

// ─── Roster & Person Metrics ───

export async function getRoster(onData) {
  return cachedRequest('roster', '/roster', onData)
}

export async function getAllPeopleMetrics(onData) {
  return cachedRequest('people-metrics', '/people/metrics', onData)
}

export async function getPersonMetrics(jiraDisplayName, { refresh = false } = {}) {
  const params = refresh ? '?refresh=true' : ''
  const cacheKey = `person:${jiraDisplayName}`
  if (refresh) {
    cacheDelete(cacheKey)
    const data = await apiRequest(`/person/${encodeURIComponent(jiraDisplayName)}/metrics${params}`)
    cacheSet(cacheKey, data)
    return data
  }
  return cachedRequest(cacheKey, `/person/${encodeURIComponent(jiraDisplayName)}/metrics`)
}

export async function getTeamMetrics(teamKey, onData) {
  return cachedRequest(`team:${teamKey}`, `/team/${encodeURIComponent(teamKey)}/metrics`, onData)
}

export async function refreshAllMetrics() {
  return apiRequest('/roster/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function refreshTeamMetrics(teamKey) {
  return apiRequest(`/team/${encodeURIComponent(teamKey)}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

// ─── GitHub Contributions ───

export async function getGithubContributions(onData) {
  return cachedRequest('github-contributions', '/github/contributions', onData)
}

export async function refreshGithubContribution(username) {
  return apiRequest(`/github/contributions/${encodeURIComponent(username)}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function refreshGithubContributions() {
  return apiRequest('/github/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

// ─── Trends ───

export async function getTrends(onData) {
  return cachedRequest('trends', '/trends', onData)
}

export async function refreshTrendsJira() {
  return apiRequest('/trends/jira/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function refreshTrendsGithub() {
  return apiRequest('/trends/github/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
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
