<script setup>
import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import ExecutionSettings from '../execute/components/ExecutionSettings.vue'
import DeliverySettings from '../deliver/components/DeliverySettings.vue'

const refreshing = ref({ execution: false, delivery: false })
const refreshResult = ref({ execution: null, delivery: null })

async function triggerRefresh(domain) {
  refreshing.value[domain] = true
  refreshResult.value[domain] = null
  try {
    const result = await apiRequest(`/modules/releases/${domain}/refresh`, { method: 'POST' })
    refreshResult.value[domain] = result
  } catch (e) {
    refreshResult.value[domain] = {
      status: e.status === 429 ? 'cooldown' : 'error',
      message: e.status === 429 ? 'Please wait before refreshing again.' : e.message
    }
  } finally {
    refreshing.value[domain] = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Data Refresh</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Manually trigger data refreshes for each releases domain.
      </p>
      <div class="flex flex-wrap gap-3">
        <div v-for="domain in ['execution', 'delivery']" :key="domain" class="flex items-center gap-2">
          <button
            @click="triggerRefresh(domain)"
            :disabled="refreshing[domain]"
            class="px-3 py-1.5 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-900 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 capitalize"
          >
            {{ refreshing[domain] ? 'Refreshing...' : `Refresh ${domain}` }}
          </button>
          <span v-if="refreshResult[domain]" class="text-sm" :class="{
            'text-green-600 dark:text-green-400': refreshResult[domain].status === 'success',
            'text-red-600 dark:text-red-400': refreshResult[domain].status === 'error',
            'text-yellow-600 dark:text-yellow-400': refreshResult[domain].status === 'cooldown'
          }">
            {{ refreshResult[domain].status }}
            <span v-if="refreshResult[domain].message"> &mdash; {{ refreshResult[domain].message }}</span>
          </span>
        </div>
      </div>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Release Registry</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Registry management and auto-discover will be available after full module integration.
      </p>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Planning</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Planning settings (RICE config, release outcomes) will be migrated in Phase 2.
      </p>
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Execution</h3>
      <ExecutionSettings />
    </div>
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Delivery</h3>
      <DeliverySettings />
    </div>
  </div>
</template>
