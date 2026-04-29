import { ref } from 'vue'
import { apiRequest, getApiBase } from '@shared/client/services/api'

const API_BASE = '/modules/release-planning'

// Module-level refs -- singleton pattern so all components share state
const healthData = ref(null)
const healthLoading = ref(false)
const healthError = ref(null)
const healthRefreshing = ref(false)
const healthCacheStale = ref(false)
const etagCache = {}

export function useReleaseHealth() {
  async function loadHealth(version, phase) {
    healthLoading.value = true
    healthError.value = null

    var url = API_BASE + '/releases/' + encodeURIComponent(version) + '/health'
    if (phase) {
      url += '?phase=' + encodeURIComponent(phase)
    }

    var cacheKey = version + ':' + (phase || 'all')
    var headers = {}
    if (etagCache[cacheKey]) {
      headers['If-None-Match'] = etagCache[cacheKey]
    }

    try {
      var response = await fetch(getApiBase() + url, { headers: headers })

      if (response.status === 304) {
        healthLoading.value = false
        return
      }

      if (!response.ok) {
        var errorData = await response.json().catch(function() { return {} })
        throw new Error(errorData.error || 'HTTP ' + response.status)
      }

      var etag = response.headers.get('etag')
      if (etag) {
        etagCache[cacheKey] = etag
      }

      var data = await response.json()
      healthData.value = data
      healthRefreshing.value = !!data._refreshing
      healthCacheStale.value = !!data._cacheStale
    } catch (err) {
      healthError.value = err.message
    } finally {
      healthLoading.value = false
    }
  }

  async function updateDorItem(version, featureKey, items, notes) {
    var body = { items: items }
    if (notes !== undefined) {
      body.notes = notes
    }
    return apiRequest(
      API_BASE + '/releases/' + encodeURIComponent(version) + '/health/dor/' + encodeURIComponent(featureKey),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    )
  }

  async function setRiskOverride(version, featureKey, level, reason) {
    return apiRequest(
      API_BASE + '/releases/' + encodeURIComponent(version) + '/health/override/' + encodeURIComponent(featureKey),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskOverride: level, reason: reason })
      }
    )
  }

  async function removeRiskOverride(version, featureKey) {
    return apiRequest(
      API_BASE + '/releases/' + encodeURIComponent(version) + '/health/override/' + encodeURIComponent(featureKey),
      { method: 'DELETE' }
    )
  }

  async function triggerHealthRefresh(version, phase) {
    try {
      var url = API_BASE + '/releases/' + encodeURIComponent(version) + '/health/refresh'
      if (phase) {
        url += '?phase=' + encodeURIComponent(phase)
      }
      await apiRequest(url, { method: 'POST' })
      healthRefreshing.value = true
    } catch (err) {
      healthError.value = err.message
    }
  }

  async function checkHealthRefreshStatus(version, phase) {
    try {
      var url = API_BASE + '/releases/' + encodeURIComponent(version) + '/health/refresh/status'
      if (phase) {
        url += '?phase=' + encodeURIComponent(phase)
      }
      var status = await apiRequest(url)
      healthRefreshing.value = status.running
      return status
    } catch {
      return { running: false }
    }
  }

  async function searchJiraFields(query) {
    return apiRequest(API_BASE + '/releases/health-admin/jira-fields?query=' + encodeURIComponent(query))
  }

  async function loadRiceConfig() {
    return apiRequest(API_BASE + '/releases/health-admin/config')
  }

  async function saveRiceConfig(fieldIds, enableRice) {
    return apiRequest(API_BASE + '/releases/health-admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riceFieldIds: fieldIds, enableRice: enableRice })
    })
  }

  async function testRiceFields() {
    return apiRequest(API_BASE + '/releases/health-admin/rice-test', { method: 'POST' })
  }

  async function createSnapshot(version, phase) {
    return apiRequest(
      API_BASE + '/releases/' + encodeURIComponent(version) + '/health/snapshot/' + encodeURIComponent(phase),
      { method: 'POST' }
    )
  }

  return {
    healthData: healthData,
    healthLoading: healthLoading,
    healthError: healthError,
    healthRefreshing: healthRefreshing,
    healthCacheStale: healthCacheStale,
    loadHealth: loadHealth,
    updateDorItem: updateDorItem,
    setRiskOverride: setRiskOverride,
    removeRiskOverride: removeRiskOverride,
    triggerHealthRefresh: triggerHealthRefresh,
    checkHealthRefreshStatus: checkHealthRefreshStatus,
    createSnapshot: createSnapshot,
    searchJiraFields: searchJiraFields,
    loadRiceConfig: loadRiceConfig,
    saveRiceConfig: saveRiceConfig,
    testRiceFields: testRiceFields
  }
}
