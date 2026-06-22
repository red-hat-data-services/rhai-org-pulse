import { ref, computed } from 'vue'
import {
  getRosterSyncConfig,
  saveRosterSyncConfig,
  triggerRosterSync,
  getRosterSyncStatus,
  getRosterSyncFieldDefinitions,
  saveCustomFields as apiSaveCustomFields
} from '@shared/client/services/api'
import { useRoster } from '@shared/client/composables/useRoster'

const config = ref(null)
const fieldDefinitions = ref(null)
const syncStatus = ref(null)
const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)

const isConfigured = computed(() => {
  return config.value && config.value.configured === true
})

async function fetchFieldDefinitions() {
  try {
    const result = await getRosterSyncFieldDefinitions()
    fieldDefinitions.value = result.customFields || []
  } catch (err) {
    console.error('Failed to fetch field definitions:', err)
  }
}

async function saveCustomFields(customFields) {
  saving.value = true
  try {
    const result = await apiSaveCustomFields(customFields)
    fieldDefinitions.value = result.customFields || []
    return result
  } finally {
    saving.value = false
  }
}

async function fetchConfig() {
  loading.value = true
  try {
    config.value = await getRosterSyncConfig()
  } catch (err) {
    console.error('Failed to fetch roster sync config:', err)
  } finally {
    loading.value = false
  }
}

async function fetchStatus() {
  try {
    syncStatus.value = await getRosterSyncStatus()
    syncing.value = syncStatus.value.syncing
  } catch (err) {
    console.error('Failed to fetch roster sync status:', err)
  }
}

async function saveConfig(data) {
  saving.value = true
  try {
    config.value = await saveRosterSyncConfig(data)
    return config.value
  } finally {
    saving.value = false
  }
}

async function triggerSync() {
  syncing.value = true
  try {
    await triggerRosterSync()
    // Poll for completion
    const poll = setInterval(async () => {
      await fetchStatus()
      if (!syncStatus.value.syncing) {
        clearInterval(poll)
        syncing.value = false
        await fetchConfig()
        const { reloadRoster } = useRoster()
        await reloadRoster()
      }
    }, 3000)
    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(poll), 300000)
  } catch (err) {
    syncing.value = false
    throw err
  }
}

async function discoverSheets(spreadsheetId) {
  const res = await fetch(`/api/modules/team-tracker/sheets/discover?spreadsheetId=${encodeURIComponent(spreadsheetId)}`)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'Failed to discover sheets')
  }
  return data.sheets
}

export function useRosterSync() {
  return {
    config,
    fieldDefinitions,
    syncStatus,
    loading,
    saving,
    syncing,
    isConfigured,
    fetchConfig,
    fetchFieldDefinitions,
    fetchStatus,
    saveConfig,
    saveCustomFields,
    triggerSync,
    discoverSheets
  }
}
