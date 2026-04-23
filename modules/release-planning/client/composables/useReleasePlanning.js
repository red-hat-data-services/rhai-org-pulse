import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const API_BASE = '/modules/release-planning'

// Module-level refs -- singleton pattern so all components share state
const candidates = ref(null)
const loading = ref(false)
const error = ref(null)
const refreshing = ref(false)
const cacheStale = ref(false)
const permissions = ref(null)

export function useReleasePlanning() {
  async function loadCandidates(version, opts) {
    loading.value = true
    error.value = null

    const params = new URLSearchParams()
    if (opts && opts.rockFilter) params.set('rockFilter', opts.rockFilter)
    if (opts && opts.refresh) params.set('refresh', 'true')

    const qs = params.toString()
    const url = `${API_BASE}/releases/${encodeURIComponent(version)}/candidates${qs ? '?' + qs : ''}`

    try {
      const data = await apiRequest(url)
      candidates.value = data
      refreshing.value = !!data._refreshing
      cacheStale.value = !!data._cacheStale
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function triggerRefresh(version) {
    try {
      await apiRequest(`${API_BASE}/releases/${encodeURIComponent(version)}/refresh`, {
        method: 'POST'
      })
      refreshing.value = true
    } catch (err) {
      error.value = err.message
    }
  }

  async function checkRefreshStatus() {
    try {
      const status = await apiRequest(`${API_BASE}/refresh/status`)
      refreshing.value = status.running
      return status
    } catch {
      return { running: false }
    }
  }

  async function loadPermissions() {
    try {
      const data = await apiRequest(`${API_BASE}/permissions`)
      permissions.value = data
    } catch {
      permissions.value = { canEdit: false }
    }
  }

  async function saveBigRock(version, name, data) {
    if (name) {
      // Update existing
      return apiRequest(
        `${API_BASE}/releases/${encodeURIComponent(version)}/big-rocks/${encodeURIComponent(name)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      )
    } else {
      // Create new
      return apiRequest(
        `${API_BASE}/releases/${encodeURIComponent(version)}/big-rocks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      )
    }
  }

  async function deleteBigRock(version, name) {
    return apiRequest(
      `${API_BASE}/releases/${encodeURIComponent(version)}/big-rocks/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    )
  }

  async function validateJiraKeys(keys) {
    return apiRequest(`${API_BASE}/jira/validate-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keys })
    })
  }

  /**
   * After a successful save/delete, update the bigRocks in the current
   * candidates data so the table re-renders immediately.
   */
  function updateBigRocksInPlace(updatedBigRocks) {
    if (candidates.value) {
      candidates.value = {
        ...candidates.value,
        bigRocks: updatedBigRocks
      }
    }
  }

  async function previewDocImport(version, docId) {
    return apiRequest(
      `${API_BASE}/releases/${encodeURIComponent(version)}/import/doc/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docId })
      }
    )
  }

  async function executeDocImport(version, docId, mode) {
    return apiRequest(
      `${API_BASE}/releases/${encodeURIComponent(version)}/import/doc`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docId, mode: mode })
      }
    )
  }

  async function reorderBigRocks(version, orderedNames) {
    return apiRequest(
      `${API_BASE}/releases/${encodeURIComponent(version)}/big-rocks/reorder`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderedNames })
      }
    )
  }

  async function createRelease(version, cloneFrom) {
    var body = { version: version }
    if (cloneFrom) {
      body.cloneFrom = cloneFrom
    }
    return apiRequest(`${API_BASE}/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  }

  async function deleteRelease(version) {
    return apiRequest(
      `${API_BASE}/releases/${encodeURIComponent(version)}`,
      { method: 'DELETE' }
    )
  }

  async function seedFromFixture() {
    var fixture = await apiRequest(`${API_BASE}/admin/seed/fixture`)
    return apiRequest(`${API_BASE}/admin/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fixture)
    })
  }

  async function fetchSmartSheetReleases() {
    try {
      var data = await apiRequest(`${API_BASE}/smartsheet/releases`)
      return data
    } catch {
      return { available: [], configured: [] }
    }
  }

  return {
    candidates,
    loading,
    error,
    refreshing,
    cacheStale,
    permissions,
    loadCandidates,
    triggerRefresh,
    checkRefreshStatus,
    loadPermissions,
    saveBigRock,
    deleteBigRock,
    validateJiraKeys,
    updateBigRocksInPlace,
    previewDocImport,
    executeDocImport,
    reorderBigRocks,
    createRelease,
    deleteRelease,
    seedFromFixture,
    fetchSmartSheetReleases
  }
}

export function useReleases() {
  const releases = ref([])
  const loading = ref(false)

  async function loadReleases() {
    loading.value = true
    try {
      const data = await apiRequest(`${API_BASE}/releases`)
      releases.value = data || []
    } catch {
      releases.value = []
    } finally {
      loading.value = false
    }
  }

  return { releases, loading, loadReleases }
}
