<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Sustaining</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Issues labeled <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">AIBU_Feedback</code> from Jira, ordered by creation date.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="fetchedAt" class="text-xs text-gray-400 dark:text-gray-500">
          {{ issues.length }} issue{{ issues.length !== 1 ? 's' : '' }}
        </span>
        <button
          @click="loadData"
          :disabled="loading"
          class="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
        >
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">
      {{ error }}
    </div>

    <div v-if="loading && !issues.length" class="text-sm text-gray-500 dark:text-gray-400">Loading BU feedback issues...</div>

    <div v-if="warning" class="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 px-4 py-3 text-sm">
      {{ warning }}
    </div>

    <BuFeedbackTable v-if="issues.length || (!loading && !error)" :issues="issues" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getApiBase } from '@shared/client/services/api'
import BuFeedbackTable from '../components/BuFeedbackTable.vue'

var issues = ref([])
var loading = ref(false)
var error = ref(null)
var warning = ref(null)
var fetchedAt = ref(null)

async function loadData() {
  loading.value = true
  error.value = null
  warning.value = null

  try {
    var response = await fetch(getApiBase() + '/modules/releases/planning/bu-feedback')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    var data = await response.json()
    issues.value = data.issues || []
    fetchedAt.value = data.fetchedAt || null
    if (data.warning) warning.value = data.warning
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
