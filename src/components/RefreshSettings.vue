<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const emit = defineEmits(['toast'])

const statusData = ref(null)
const loading = ref(true)
const refreshingAll = ref(false)
const refreshingModules = ref({})
let pollTimer = null

const CADENCE_PRESETS = ['15m', '1h', '6h', '12h', '24h']
const savingCadence = ref({})

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

function formatTimeUntil(ts) {
  if (!ts) return null
  const ms = ts - Date.now()
  if (ms <= 0) return 'Due now'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return minutes + 'm'
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? hours + 'h ' + remainingMinutes + 'm' : hours + 'h'
  }
  const days = Math.floor(hours / 24)
  return days + 'd ' + (hours % 24) + 'h'
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
    const allCompleted = Object.values(handlers).every(h => h.state === 'completed' || h.state === 'skipped')
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
  if (handler.state === 'skipped' && handler.skippedAt) return relativeTime(handler.skippedAt)
  if (handler.completedAt) return relativeTime(handler.completedAt)
  if (handler.startedAt) return relativeTime(handler.startedAt)
  return null
}

function getNextDueDisplay(handler) {
  if (!handler.nextDueAt) return null
  return formatTimeUntil(handler.nextDueAt)
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
    await apiRequest('/admin/refresh-all?force=true', { method: 'POST' })
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

async function onCadenceChange(handler, newValue) {
  var cadence = newValue || null
  savingCadence.value[handler.id] = true
  try {
    await apiRequest('/admin/refresh-cadence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handlerId: handler.id, cadence })
    })
    emit('toast', { type: 'success', message: cadence ? handler.displayName + ' cadence set to ' + cadence : handler.displayName + ' cadence reset to default' })
    await fetchStatus()
  } catch (e) {
    emit('toast', { type: 'error', message: e.message || 'Failed to set cadence override' })
  } finally {
    savingCadence.value[handler.id] = false
  }
}

function getCadenceSelectValue(handler) {
  if (handler.cadenceOverride) return handler.cadenceOverride
  return ''
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
            Trigger data refreshes for registered module handlers. Each handler runs at its own cadence.
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

      <!-- Column headers -->
      <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        <div class="flex-1 min-w-0">Handler</div>
        <div class="w-28 text-center flex-shrink-0">Cadence</div>
        <div class="w-20 text-center flex-shrink-0">Next Run</div>
        <div class="w-20 text-center flex-shrink-0">Status</div>
        <div class="w-16 text-right flex-shrink-0">Last Run</div>
      </div>

      <div class="divide-y divide-gray-100 dark:divide-gray-700/50">
        <div v-for="handler in group.handlers" :key="handler.id" class="px-4 py-2.5 flex items-center gap-3">
          <!-- Handler name -->
          <div class="flex-1 min-w-0">
            <span class="text-sm text-gray-900 dark:text-gray-100">{{ handler.displayName }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5 tabular-nums">#{{ handler.order || 100 }}</span>
          </div>

          <!-- Cadence select — always visible -->
          <div class="w-28 flex-shrink-0 flex justify-center">
            <div class="relative">
              <select
                :value="getCadenceSelectValue(handler)"
                @change="onCadenceChange(handler, $event.target.value)"
                :disabled="savingCadence[handler.id]"
                class="text-xs border rounded px-2 py-1 pr-6 appearance-none cursor-pointer bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none disabled:opacity-50 disabled:cursor-wait"
                :class="handler.cadenceOverride ? 'border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''"
              >
                <option value="">{{ handler.baseCadence || '24h' }} (default)</option>
                <option v-for="p in CADENCE_PRESETS.filter(v => v !== (handler.baseCadence || '24h') || handler.cadenceOverride)" :key="p" :value="p"
                >{{ p }}</option>
              </select>
              <svg v-if="savingCadence[handler.id]" class="animate-spin absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <!-- Next due -->
          <div class="w-20 text-center flex-shrink-0">
            <span v-if="getHandlerState(handler) === 'running'" class="text-xs text-blue-500 font-medium">Now</span>
            <span v-else-if="getNextDueDisplay(handler)" class="text-xs tabular-nums"
              :class="getNextDueDisplay(handler) === 'Due now' ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-500 dark:text-gray-400'"
            >{{ getNextDueDisplay(handler) }}</span>
            <span v-else class="text-xs text-gray-400 dark:text-gray-500">&mdash;</span>
          </div>

          <!-- Status badge -->
          <div class="w-20 text-center flex-shrink-0">
            <span v-if="getHandlerState(handler) === 'completed'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
            >
              Completed
            </span>
            <span v-else-if="getHandlerState(handler) === 'failed'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
              :title="handler.error || ''"
            >
              Failed
            </span>
            <span v-else-if="getHandlerState(handler) === 'running'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
            >
              <svg class="animate-spin -ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running
            </span>
            <span v-else-if="getHandlerState(handler) === 'skipped'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              :title="'Skipped — ' + (handler.reason || 'not due')"
            >
              Skipped
            </span>
            <span v-else-if="getHandlerState(handler) === 'pending'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              Pending
            </span>
            <span v-else
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              &mdash;
            </span>
          </div>

          <!-- Last run time -->
          <span class="text-xs text-gray-400 dark:text-gray-500 w-16 text-right flex-shrink-0 tabular-nums">
            {{ getHandlerTime(handler) || '' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
