<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const emit = defineEmits(['toast'])

const statusData = ref(null)
const loading = ref(true)
const refreshingAll = ref(false)
const refreshingModules = ref({})
let pollTimer = null

function formatHandlerName(raw) {
  return raw
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

const UPPERCASE_WORDS = new Set(['ai', 'api', 'mr', 'kpi'])

function formatModuleName(slug) {
  return slug
    .split('-')
    .map(w => UPPERCASE_WORDS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function relativeTime(ts) {
  if (!ts) return null
  const ms = Date.now() - ts
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes + 'm ago'
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ago'
  const days = Math.floor(hours / 24)
  return days + 'd ago'
}

const isRunning = computed(() => statusData.value?.running === true)

const moduleGroups = computed(() => {
  if (!statusData.value?.handlers) return []
  const groups = {}
  for (const [id, info] of Object.entries(statusData.value.handlers)) {
    const colonIdx = id.indexOf(':')
    if (colonIdx === -1) continue
    const moduleSlug = id.substring(0, colonIdx)
    const handlerName = id.substring(colonIdx + 1)
    if (!groups[moduleSlug]) {
      groups[moduleSlug] = { slug: moduleSlug, name: formatModuleName(moduleSlug), handlers: [] }
    }
    groups[moduleSlug].handlers.push({
      id,
      name: handlerName,
      displayName: formatHandlerName(handlerName),
      ...info
    })
  }
  // Sort handlers within each module by order
  for (const group of Object.values(groups)) {
    group.handlers.sort((a, b) => (a.order || 100) - (b.order || 100))
  }
  return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name))
})

const globalStatusText = computed(() => {
  if (!statusData.value) return ''
  if (statusData.value.running) {
    const handlers = statusData.value.handlers || {}
    const total = Object.keys(handlers).length
    const completed = Object.values(handlers).filter(h => h.state === 'completed' || h.state === 'failed').length
    return 'Running: ' + completed + '/' + total + ' handlers complete'
  }
  if (statusData.value.completedAt) {
    const handlers = statusData.value.handlers || {}
    const allCompleted = Object.values(handlers).every(h => h.state === 'completed')
    const suffix = allCompleted ? 'all handlers completed' : 'some handlers failed'
    return 'Last run: ' + relativeTime(statusData.value.completedAt) + ' \u2014 ' + suffix
  }
  return 'No refresh has been run yet'
})

function getHandlerState(handler) {
  if (handler.state) return handler.state
  if (handler.registered) return 'never-run'
  return 'unknown'
}

function getHandlerTime(handler) {
  if (handler.completedAt) return relativeTime(handler.completedAt)
  if (handler.startedAt) return relativeTime(handler.startedAt)
  return null
}

async function fetchStatus() {
  try {
    statusData.value = await apiRequest('/admin/refresh/status')
  } catch {
    // ignore
  } finally {
    loading.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await fetchStatus()
    if (!isRunning.value) {
      stopPolling()
      refreshingAll.value = false
      refreshingModules.value = {}
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function refreshAll() {
  refreshingAll.value = true
  try {
    await apiRequest('/admin/refresh-all', { method: 'POST' })
    emit('toast', { type: 'success', message: 'Full refresh started' })
    startPolling()
  } catch (e) {
    refreshingAll.value = false
    if (e.status === 409) {
      emit('toast', { type: 'warning', message: 'A refresh is already running' })
    } else {
      emit('toast', { type: 'error', message: e.message || 'Failed to start refresh' })
    }
  }
}

async function refreshModule(slug) {
  refreshingModules.value[slug] = true
  try {
    await apiRequest('/admin/refresh/' + encodeURIComponent(slug), { method: 'POST' })
    emit('toast', { type: 'success', message: formatModuleName(slug) + ' refresh started' })
    startPolling()
  } catch (e) {
    refreshingModules.value[slug] = false
    if (e.status === 409) {
      emit('toast', { type: 'warning', message: 'A refresh is already running' })
    } else if (e.status === 404) {
      emit('toast', { type: 'error', message: 'No handlers registered for ' + formatModuleName(slug) })
    } else {
      emit('toast', { type: 'error', message: e.message || 'Failed to start refresh' })
    }
  }
}

onMounted(() => {
  fetchStatus()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Top section -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="p-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Data Refresh</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Trigger data refreshes for registered module handlers.
          </p>
          <p v-if="!loading" class="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {{ globalStatusText }}
          </p>
        </div>
        <button
          @click="refreshAll"
          :disabled="isRunning || refreshingAll"
          class="px-3 py-1.5 bg-primary-600 text-white rounded-md text-xs font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <template v-if="refreshingAll || isRunning">
            <svg class="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Running...
          </template>
          <template v-else>Refresh All Modules</template>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-8">
      <svg class="animate-spin h-6 w-6 text-gray-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Loading refresh status...</p>
    </div>

    <!-- No handlers -->
    <div v-else-if="moduleGroups.length === 0" class="text-center py-8">
      <p class="text-sm text-gray-500 dark:text-gray-400">No refresh handlers registered.</p>
    </div>

    <!-- Module cards -->
    <div v-else v-for="group in moduleGroups" :key="group.slug"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ group.name }}</h3>
        <button
          @click="refreshModule(group.slug)"
          :disabled="isRunning || refreshingModules[group.slug]"
          class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <template v-if="refreshingModules[group.slug] && isRunning">
            <svg class="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Refreshing...
          </template>
          <template v-else>Refresh</template>
        </button>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700/50">
        <div v-for="handler in group.handlers" :key="handler.id" class="px-4 py-2.5 flex items-center gap-4">
          <div class="flex-1 min-w-0">
            <span class="text-sm text-gray-900 dark:text-gray-100">{{ handler.displayName }}</span>
          </div>

          <span class="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-12 text-right flex-shrink-0">
            #{{ handler.order || 100 }}
          </span>

          <!-- Status badge -->
          <span class="flex-shrink-0 inline-flex items-center">
            <!-- Completed -->
            <span v-if="getHandlerState(handler) === 'completed'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            >
              Completed
            </span>
            <!-- Failed -->
            <span v-else-if="getHandlerState(handler) === 'failed'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              :title="handler.error || ''"
            >
              Failed
            </span>
            <!-- Running -->
            <span v-else-if="getHandlerState(handler) === 'running'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
            >
              <svg class="animate-spin -ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running
            </span>
            <!-- Pending -->
            <span v-else-if="getHandlerState(handler) === 'pending'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              Pending
            </span>
            <!-- Never run / unknown -->
            <span v-else
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              &mdash;
            </span>
          </span>

          <!-- Time -->
          <span class="text-xs text-gray-400 dark:text-gray-500 w-16 text-right flex-shrink-0">
            {{ getHandlerTime(handler) || '' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
