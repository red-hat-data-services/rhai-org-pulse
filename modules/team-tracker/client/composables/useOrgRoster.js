import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const CACHE_PREFIX = 'org_roster_cache:'

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
    // localStorage full, skip
  }
}

async function cachedRequest(cacheKey, path, onData) {
  const cached = cacheGet(cacheKey)
  if (cached && onData) onData(cached)

  try {
    const fresh = await apiRequest(`/modules/team-tracker${path}`)
    cacheSet(cacheKey, fresh)
    if (onData) onData(fresh)
    return fresh
  } catch (err) {
    if (cached) {
      console.warn(`Using cached data for ${path}:`, err.message)
      return cached
    }
    throw err
  }
}

// Shared reactive state
const teams = ref([])
const people = ref([])
const orgs = ref([])
const selectedOrg = ref(null)
const loading = ref(false)
const error = ref(null)
const fetchedAt = ref(null)
const searchQuery = ref('')
const sortBy = ref('name')

export function useOrgRoster() {
  async function loadTeams(orgFilter) {
    loading.value = true
    error.value = null
    try {
      const path = orgFilter ? `/org-teams?org=${encodeURIComponent(orgFilter)}` : '/org-teams'
      const cacheKey = orgFilter ? `teams:${orgFilter}` : 'teams:all'
      await cachedRequest(cacheKey, path, (data) => {
        teams.value = data.teams || []
        fetchedAt.value = data.fetchedAt || null
      })
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function loadOrgs() {
    try {
      await cachedRequest('orgs', '/org-list', (data) => {
        orgs.value = data.orgs || []
      })
    } catch (err) {
      console.warn('Failed to load orgs:', err.message)
    }
  }

  async function loadPeople(filters = {}) {
    try {
      let path = '/registry/people'
      const params = []
      if (filters.org) params.push(`org=${encodeURIComponent(filters.org)}`)
      if (filters.team) params.push(`team=${encodeURIComponent(filters.team)}`)
      if (params.length > 0) path += '?' + params.join('&')

      const cacheKey = `people:${filters.org || 'all'}:${filters.team || 'all'}`
      await cachedRequest(cacheKey, path, (data) => {
        people.value = data.people || []
      })
    } catch (err) {
      console.warn('Failed to load people:', err.message)
    }
  }

  async function loadTeamDetail(teamKey, onData) {
    return cachedRequest(`team:${teamKey}`, `/org-teams/${encodeURIComponent(teamKey)}`, onData)
  }

  async function loadTeamMembers(teamKey) {
    return cachedRequest(`members:${teamKey}`, `/org-teams/${encodeURIComponent(teamKey)}/members`)
  }

  async function loadOrgSummary(orgName) {
    return cachedRequest(`org-summary:${orgName}`, `/org-summary/${encodeURIComponent(orgName)}`)
  }

  async function loadComponents() {
    return cachedRequest('components', '/components')
  }

  async function loadRfeBacklog(orgFilter) {
    const path = orgFilter ? `/rfe-backlog?org=${encodeURIComponent(orgFilter)}` : '/rfe-backlog'
    const cacheKey = orgFilter ? `rfe:${orgFilter}` : 'rfe:all'
    return cachedRequest(cacheKey, path)
  }

  async function loadRfeConfig() {
    return apiRequest('/modules/team-tracker/rfe-config')
  }

  async function loadSyncStatus() {
    return apiRequest('/modules/team-tracker/org-sync/status')
  }

  async function triggerSync() {
    return apiRequest('/modules/team-tracker/org-sync/trigger', { method: 'POST' })
  }

  async function loadSheetOrgs() {
    return apiRequest('/modules/team-tracker/sheet-orgs')
  }

  async function loadConfiguredOrgs() {
    return apiRequest('/modules/team-tracker/configured-orgs')
  }

  async function loadJiraComponents() {
    return apiRequest('/modules/team-tracker/jira-components')
  }

  async function loadConfig() {
    return apiRequest('/modules/team-tracker/org-config')
  }

  async function saveConfig(configData) {
    return apiRequest('/modules/team-tracker/org-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    })
  }

  const filteredTeams = computed(() => {
    let result = teams.value

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.productManagers || []).some(pm => pm.toLowerCase().includes(q)) ||
        (t.engLeads || []).some(el => el.toLowerCase().includes(q)) ||
        (t.components || []).some(c => c.toLowerCase().includes(q))
      )
    }

    if (sortBy.value === 'headcount') {
      result = [...result].sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
    } else if (sortBy.value === 'rfe') {
      result = [...result].sort((a, b) => (b.rfeCount || 0) - (a.rfeCount || 0))
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    }

    return result
  })

  return {
    teams,
    people,
    orgs,
    selectedOrg,
    loading,
    error,
    fetchedAt,
    searchQuery,
    sortBy,
    filteredTeams,
    loadTeams,
    loadOrgs,
    loadPeople,
    loadTeamDetail,
    loadTeamMembers,
    loadOrgSummary,
    loadComponents,
    loadRfeBacklog,
    loadRfeConfig,
    loadSyncStatus,
    triggerSync,
    loadSheetOrgs,
    loadConfiguredOrgs,
    loadJiraComponents,
    loadConfig,
    saveConfig,
  }
}
