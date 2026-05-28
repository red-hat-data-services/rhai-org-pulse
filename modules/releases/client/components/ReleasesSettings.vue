<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import ExecutionSettings from '../execute/components/ExecutionSettings.vue'
import DeliverySettings from '../deliver/components/DeliverySettings.vue'

const domains = [
  { id: 'execution', label: 'Execution', description: 'Feature traffic from GitLab CI pipeline', refreshUrl: '/modules/releases/execution/refresh', statusUrl: '/modules/releases/execution/status', async: false },
  { id: 'delivery', label: 'Delivery', description: 'Release analysis from Product Pages', refreshUrl: '/modules/releases/delivery/refresh', statusUrl: '/modules/releases/delivery/refresh/status', async: true },
  { id: 'hygiene', label: 'Hygiene', description: 'Feature hygiene from Jira (all active versions)', refreshUrl: '/modules/releases/hygiene/refresh-all', statusUrl: '/modules/releases/hygiene/refresh/status', async: true }
]

const selected = ref({ execution: false, delivery: false, hygiene: false })
const refreshing = ref({ execution: false, delivery: false, hygiene: false })
const refreshResult = ref({ execution: null, delivery: null, hygiene: null })
const statusData = ref({ execution: null, delivery: null, hygiene: null })
const pollTimers = {}

const allSelected = computed({
  get: () => domains.every(d => selected.value[d.id]),
  set: (val) => domains.forEach(d => { selected.value[d.id] = val })
})
const someSelected = computed(() => domains.some(d => selected.value[d.id]))
const anyRefreshing = computed(() => domains.some(d => refreshing.value[d.id]))

function getLastRefreshed(domainId) {
  const status = statusData.value[domainId]
  if (!status) return null
  if (domainId === 'execution') return (status.lastFetch && status.lastFetch.timestamp) || status.fetchedAt || null
  if (domainId === 'delivery') return (status.lastResult && status.lastResult.completedAt) || null
  if (domainId === 'hygiene') return status.lastSuccessAt || status.completedAt || null
  return null
}

function formatTimestamp(ts) {
  if (!ts) return 'Never'
  return new Date(ts).toLocaleString()
}

function getStaleness(ts) {
  if (!ts) return { label: 'No data', cls: 'text-gray-400 dark:text-gray-500' }
  const ageMs = Date.now() - new Date(ts).getTime()
  const hours = Math.floor(ageMs / (1000 * 60 * 60))
  if (hours < 1) return { label: 'Just now', cls: 'text-green-600 dark:text-green-400' }
  if (hours < 24) return { label: hours + 'h ago', cls: 'text-green-600 dark:text-green-400' }
  const days = Math.floor(hours / 24)
  if (days < 3) return { label: days + 'd ago', cls: 'text-yellow-600 dark:text-yellow-400' }
  return { label: days + 'd ago', cls: 'text-red-600 dark:text-red-400' }
}

async function loadStatus(domainId) {
  try {
    statusData.value[domainId] = await apiRequest(domains.find(d => d.id === domainId).statusUrl)
  } catch {
    // ignore
  }
}

function startPolling(domainId) {
  stopPolling(domainId)
  pollTimers[domainId] = setInterval(async () => {
    try {
      const domain = domains.find(d => d.id === domainId)
      const status = await apiRequest(domain.statusUrl)
      statusData.value[domainId] = status
      if (status.progress) {
        refreshResult.value[domainId] = { status: 'running', message: status.progress.message }
      }
      if (!status.running) {
        stopPolling(domainId)
        refreshing.value[domainId] = false
        refreshResult.value[domainId] = status.lastResult || { status: 'complete' }
      }
    } catch {
      stopPolling(domainId)
      refreshing.value[domainId] = false
    }
  }, 3000)
}

function stopPolling(domainId) {
  if (pollTimers[domainId]) {
    clearInterval(pollTimers[domainId])
    delete pollTimers[domainId]
  }
}

async function triggerRefresh(domainId) {
  const domain = domains.find(d => d.id === domainId)
  refreshing.value[domainId] = true
  refreshResult.value[domainId] = null
  try {
    const result = await apiRequest(domain.refreshUrl, { method: 'POST' })
    refreshResult.value[domainId] = result
    if (domain.async && (result.status === 'started' || result.status === 'already_running')) {
      startPolling(domainId)
    } else {
      refreshing.value[domainId] = false
      loadStatus(domainId)
    }
  } catch (e) {
    refreshResult.value[domainId] = {
      status: e.status === 429 ? 'cooldown' : 'error',
      message: e.status === 429 ? 'Please wait before refreshing again.' : e.message
    }
    refreshing.value[domainId] = false
  }
}

async function refreshSelected() {
  const toRefresh = domains.filter(d => selected.value[d.id])
  await Promise.allSettled(toRefresh.map(d => triggerRefresh(d.id)))
}

onMounted(() => {
  domains.forEach(d => loadStatus(d.id))
})

onUnmounted(() => {
  domains.forEach(d => stopPolling(d.id))
})
</script>

<template>
  <div class="space-y-6">
    <!-- Data Freshness Panel -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Data Freshness</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Monitor and refresh data sources for the releases module.</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" v-model="allSelected" class="rounded border-gray-300 dark:border-gray-600 text-primary-600" />
            Select all
          </label>
          <button
            @click="refreshSelected"
            :disabled="!someSelected || anyRefreshing"
            class="px-3 py-1.5 bg-primary-600 text-white rounded-md text-xs font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh Selected
          </button>
        </div>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700/50">
        <div v-for="domain in domains" :key="domain.id" class="px-4 py-3 flex items-center gap-4">
          <input
            type="checkbox"
            v-model="selected[domain.id]"
            :disabled="refreshing[domain.id]"
            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 flex-shrink-0"
          />

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ domain.label }}</span>
              <span class="text-xs" :class="getStaleness(getLastRefreshed(domain.id)).cls">
                {{ getStaleness(getLastRefreshed(domain.id)).label }}
              </span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ domain.description }}</p>
            <p v-if="getLastRefreshed(domain.id)" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Last refreshed: {{ formatTimestamp(getLastRefreshed(domain.id)) }}
            </p>
            <p v-if="refreshResult[domain.id]" class="text-xs mt-1" :class="{
              'text-green-600 dark:text-green-400': refreshResult[domain.id].status === 'success' || refreshResult[domain.id].status === 'complete',
              'text-blue-600 dark:text-blue-400': refreshResult[domain.id].status === 'started' || refreshResult[domain.id].status === 'running',
              'text-red-600 dark:text-red-400': refreshResult[domain.id].status === 'error',
              'text-yellow-600 dark:text-yellow-400': refreshResult[domain.id].status === 'cooldown'
            }">
              {{ refreshResult[domain.id].message || refreshResult[domain.id].status }}
            </p>
          </div>

          <button
            @click="triggerRefresh(domain.id)"
            :disabled="refreshing[domain.id]"
            class="flex-shrink-0 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <template v-if="refreshing[domain.id]">
              <svg class="animate-spin -ml-0.5 mr-1.5 h-3 w-3 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Refreshing...
            </template>
            <template v-else>Refresh</template>
          </button>
        </div>
      </div>
    </div>

    <!-- Execution Config -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Execution</h3>
      <ExecutionSettings />
    </div>

    <!-- Delivery Config -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Delivery</h3>
      <DeliverySettings />
    </div>
  </div>
</template>
