import { ref, onMounted, onUnmounted } from 'vue'
import {
  getRosterSyncStatus,
  triggerUnifiedSync,
  clearApiCache
} from '@shared/client/services/api'
import { useRoster } from '@shared/client/composables/useRoster'

const SESSION_KEY = 'tt_sync_configDirty'
const POLL_INTERVAL_MS = 3000
const POLL_CEILING_MS = 15 * 60 * 1000

const syncing = ref(false)
const currentPhase = ref(null)
const phaseLabel = ref(null)
const status = ref(null)
const error = ref(null)
const configDirty = ref(false)

// Restore configDirty from sessionStorage
try {
  if (sessionStorage.getItem(SESSION_KEY) === 'true') {
    configDirty.value = true
  }
} catch { /* ignore */ }

let pollTimer = null
let pollCeiling = null

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (pollCeiling) {
    clearTimeout(pollCeiling)
    pollCeiling = null
  }
}

async function fetchStatus() {
  try {
    status.value = await getRosterSyncStatus()
    syncing.value = status.value.syncing
    currentPhase.value = status.value.phase || null
    phaseLabel.value = status.value.phaseLabel || null
    if (status.value?.lastSyncStatus === 'error' && status.value?.lastSyncError) {
      error.value = status.value.lastSyncError
    } else {
      error.value = null
    }
  } catch (err) {
    error.value = err.message
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await fetchStatus()
    if (!syncing.value) {
      stopPolling()
      // Sync completed — check for errors, clear configDirty, refresh caches
      if (status.value?.lastSyncStatus === 'error' && status.value?.lastSyncError) {
        error.value = status.value.lastSyncError
      } else {
        configDirty.value = false
        try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
      }
      clearApiCache()
      const { reloadRoster } = useRoster()
      reloadRoster()
    }
  }, POLL_INTERVAL_MS)

  pollCeiling = setTimeout(() => {
    stopPolling()
  }, POLL_CEILING_MS)
}

async function triggerSync() {
  error.value = null
  try {
    await triggerUnifiedSync()
    syncing.value = true
    currentPhase.value = 'roster'
    phaseLabel.value = 'Syncing people (LDAP + Sheets)...'
    startPolling()
  } catch (err) {
    error.value = err.message
    throw err
  }
}

function markConfigDirty() {
  configDirty.value = true
  try { sessionStorage.setItem(SESSION_KEY, 'true') } catch { /* ignore */ }
}

function dismissConfigDirty() {
  configDirty.value = false
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

export function useSyncStatus() {
  onMounted(() => {
    fetchStatus().then(() => {
      if (syncing.value) {
        startPolling()
      }
    })
  })

  onUnmounted(() => {
    stopPolling()
  })

  return {
    syncing,
    currentPhase,
    phaseLabel,
    status,
    error,
    configDirty,
    fetchStatus,
    triggerSync,
    markConfigDirty,
    dismissConfigDirty
  }
}
