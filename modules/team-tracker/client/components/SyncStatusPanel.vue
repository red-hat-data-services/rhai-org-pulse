<template>
  <div class="space-y-3 mb-6">
    <!-- Config dirty banner -->
    <div
      v-if="configDirty"
      class="flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg"
    >
      <div class="flex items-center gap-2">
        <svg class="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-sm text-amber-800 dark:text-amber-200">Configuration saved. Sync needed for changes to take effect.</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="handleSync"
          :disabled="syncing"
          class="px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Sync Now
        </button>
        <button
          @click="dismissConfigDirty"
          class="p-1 text-amber-400 dark:text-amber-500 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
          title="Dismiss"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Sync status panel -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Sync Status</h3>

          <!-- Roster sync info -->
          <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>People:</span>
            <span v-if="status?.rosterSync?.lastSyncAt">
              {{ formatRelativeTime(status.rosterSync.lastSyncAt) }}
            </span>
            <span v-else class="text-gray-400 dark:text-gray-500">never</span>
            <span
              v-if="status?.stale?.roster"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            >
              Stale
            </span>
          </div>

          <!-- Metadata sync info -->
          <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>Teams:</span>
            <span v-if="status?.metadataSync?.lastSyncAt">
              {{ formatRelativeTime(status.metadataSync.lastSyncAt) }}
            </span>
            <span v-else class="text-gray-400 dark:text-gray-500">never</span>
            <span
              v-if="status?.stale?.metadata"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
            >
              Stale
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Phase progress during sync -->
          <span v-if="syncing" class="text-xs text-primary-600 dark:text-primary-400">
            {{ phaseProgress }}
          </span>

          <button
            @click="handleSync"
            :disabled="syncing"
            class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <svg class="h-4 w-4" :class="{ 'animate-spin': syncing }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ syncing ? 'Syncing...' : 'Sync People & Teams' }}
          </button>
        </div>
      </div>

      <!-- Error display -->
      <div v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSyncStatus } from '../composables/useSyncStatus'

const emit = defineEmits(['toast'])

const {
  syncing,
  currentPhase,
  phaseLabel,
  status,
  error,
  configDirty,
  triggerSync,
  dismissConfigDirty
} = useSyncStatus()

const phaseProgress = computed(() => {
  if (!currentPhase.value) return ''
  const phaseNum = currentPhase.value === 'roster' ? 1 : 2
  return `Step ${phaseNum}/2: ${phaseLabel.value || ''}`
})

function formatRelativeTime(isoString) {
  if (!isoString) return 'never'
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

async function handleSync() {
  try {
    await triggerSync()
    emit('toast', { message: 'Sync started', type: 'success' })
  } catch (err) {
    emit('toast', { message: `Sync failed: ${err.message}`, type: 'error' })
  }
}
</script>
