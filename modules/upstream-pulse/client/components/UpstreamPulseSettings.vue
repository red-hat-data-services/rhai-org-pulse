<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Upstream Pulse Connection</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        This module connects to an Upstream Pulse instance to display open-source contribution metrics.
      </p>
    </div>

    <!-- Connection status -->
    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
        <span v-if="testing" class="text-sm text-gray-500 dark:text-gray-400">Testing...</span>
        <span v-else-if="config?.connection?.reachable" class="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          Connected
        </span>
        <span v-else class="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-400">
          <span class="w-2 h-2 rounded-full bg-red-500"></span>
          Unreachable
        </span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">API URL</span>
        <code class="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300 max-w-xs truncate">
          {{ config?.baseUrl || '—' }}
        </code>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Configured via</span>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ config?.configured ? 'UPSTREAM_PULSE_API_URL env var' : 'Default (in-cluster)' }}
        </span>
      </div>

      <div v-if="config?.connection?.error" class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
        {{ config.connection.error }}
      </div>
    </div>

    <button
      @click="testConnection"
      :disabled="testing"
      class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <span v-if="testing" class="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 dark:border-gray-300"></span>
      {{ testing ? 'Testing...' : 'Test Connection' }}
    </button>

    <div class="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-4">
      To change the API URL, set the <code class="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">UPSTREAM_PULSE_API_URL</code>
      environment variable on the backend deployment and restart.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const MODULE_API = '/modules/upstream-pulse'

const config = ref(null)
const testing = ref(false)

async function testConnection() {
  testing.value = true
  try {
    config.value = await apiRequest(`${MODULE_API}/config`)
  } catch (err) {
    config.value = {
      baseUrl: config.value?.baseUrl || '—',
      configured: false,
      connection: { reachable: false, error: err.message }
    }
  } finally {
    testing.value = false
  }
}

onMounted(() => testConnection())
</script>
