<script setup>
import { provide, ref } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import PoHubPriorityView from './PoHubPriorityView.vue'

const lastRefreshed = ref(null)
const refreshing = ref(false)
const triggerRefresh = ref(0)

provide('triggerRefresh', triggerRefresh)
provide('onDataLoaded', timestamp => {
  lastRefreshed.value = timestamp
  refreshing.value = false
})
provide('onDataError', () => { refreshing.value = false })

function refresh() {
  refreshing.value = true
  triggerRefresh.value++
}
</script>

<template>
  <div class="space-y-4">
    <header class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-center gap-4 px-5 py-4">
        <div class="min-w-0">
          <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">PO Hub</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">AIPCC Ecosystems single backlog</p>
        </div>
        <div class="flex-1" />
        <span v-if="lastRefreshed" class="text-xs text-gray-500 dark:text-gray-400">
          Latest refresh: <span class="font-medium text-gray-700 dark:text-gray-200">{{ new Date(lastRefreshed).toLocaleString() }}</span>
        </span>
        <button
          type="button"
          :disabled="refreshing"
          class="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          @click="refresh"
        >
          <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
          {{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <p class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      Closed issues are hidden from this dashboard.
    </p>

    <PoHubPriorityView />
  </div>
</template>
