<template>
  <div class="space-y-6">
    <!-- Data Refresh -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Data Refresh</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Trigger a refresh of allocation sprint data across all configured teams.
      </p>

      <div class="flex items-center gap-4">
        <button
          @click="handleRefresh"
          :disabled="isRefreshing"
          class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isRefreshing ? 'Refreshing...' : 'Refresh Allocation Data' }}
        </button>
        <label class="flex items-center gap-2">
          <input
            v-model="hardRefresh"
            type="checkbox"
            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Hard refresh (re-fetch cached sprints)</span>
        </label>
      </div>

      <div v-if="refreshStatus" class="mt-4 p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
        <div class="text-sm space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-700 dark:text-gray-300">Status:</span>
            <span :class="refreshStatus.running ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'">
              {{ refreshStatus.running ? 'Running...' : 'Idle' }}
            </span>
            <svg v-if="refreshStatus.running" class="animate-spin h-4 w-4 text-yellow-600 dark:text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <div v-if="refreshStatus.lastRun" class="text-xs text-gray-500 dark:text-gray-400">
            Last run: {{ new Date(refreshStatus.lastRun).toLocaleString() }}
          </div>
          <div v-if="refreshStatus.teamsProcessed != null" class="text-xs text-gray-500 dark:text-gray-400">
            Teams processed: {{ refreshStatus.teamsProcessed }}
          </div>
          <div v-if="refreshStatus.error" class="text-xs text-red-600 dark:text-red-400">
            Error: {{ refreshStatus.error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  refreshAllocation,
  getRefreshStatus
} from '../services/allocation-api.js'

// --- Data Refresh ---
const isRefreshing = ref(false)
const hardRefresh = ref(false)
const refreshStatus = ref(null)
let pollTimer = null

async function handleRefresh() {
  isRefreshing.value = true
  try {
    await refreshAllocation(null, hardRefresh.value)
    startPolling()
  } catch (error) {
    console.error('Failed to start refresh:', error)
    isRefreshing.value = false
  }
}

async function pollStatus() {
  try {
    const status = await getRefreshStatus()
    refreshStatus.value = status
    if (!status.running) {
      stopPolling()
      isRefreshing.value = false
    }
  } catch {
    stopPolling()
    isRefreshing.value = false
  }
}

function startPolling() {
  stopPolling()
  pollStatus()
  pollTimer = setInterval(pollStatus, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  // Check initial refresh status
  getRefreshStatus().then(status => {
    refreshStatus.value = status
    if (status.running) {
      isRefreshing.value = true
      startPolling()
    }
  }).catch(() => {})
})

onUnmounted(() => {
  stopPolling()
})
</script>
