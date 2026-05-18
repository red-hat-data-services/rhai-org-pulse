<template>
  <div class="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
    <div>
      <div class="text-sm font-medium text-gray-900 dark:text-white">Usage Tracking</div>
      <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {{ optedOut ? 'Your page views are not being tracked.' : 'Your page views are tracked for usage analytics.' }}
      </div>
    </div>
    <button
      @click="toggle"
      :disabled="toggling"
      class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
      :class="optedOut
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'"
    >
      {{ toggling ? '...' : (optedOut ? 'Opt In' : 'Opt Out') }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client'

const optedOut = ref(false)
const toggling = ref(false)

async function loadStatus() {
  try {
    const data = await apiRequest('/health-metrics/tracking/status')
    optedOut.value = data.optedOut
  } catch { /* ignore */ }
}

async function toggle() {
  toggling.value = true
  try {
    if (optedOut.value) {
      await apiRequest('/health-metrics/tracking/opt-out', { method: 'DELETE' })
      optedOut.value = false
    } else {
      await apiRequest('/health-metrics/tracking/opt-out', { method: 'POST' })
      optedOut.value = true
    }
  } catch { /* ignore */ }
  finally {
    toggling.value = false
  }
}

onMounted(loadStatus)
</script>
