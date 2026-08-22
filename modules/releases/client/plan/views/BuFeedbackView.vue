<template>
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          {{ activeView === 'feedback' ? 'Field and BU Feedback' : 'SFDC Issues' }}
        </h2>
        <p v-if="activeView === 'feedback'" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Jira issues labeled
          <span class="inline-block px-1.5 py-0.5 text-[11px] font-semibold rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title="AIBU_Feedback">BU</span>
          or
          <span class="inline-block px-1.5 py-0.5 text-[11px] font-semibold rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" title="AISSA_Feedback">SSA</span>.
          Click a row for reporter, resolution, and dates.
        </p>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Open issues with linked SFDC cases across AI Engineering projects.
          Click a row for details.
        </p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-0.5" role="tablist" aria-label="Switch report view">
          <button
            role="tab"
            :aria-selected="activeView === 'feedback'"
            :class="[
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeView === 'feedback'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
            @click="switchView('feedback')"
          >BU Feedback</button>
          <button
            role="tab"
            :aria-selected="activeView === 'sfdc'"
            :class="[
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeView === 'sfdc'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
            @click="switchView('sfdc')"
          >SFDC Issues</button>
        </div>

        <span v-if="fetchedAt" class="text-xs text-gray-400 dark:text-gray-500">
          {{ issues.length }} issue{{ issues.length !== 1 ? 's' : '' }}
          <span v-if="cacheAgeLabel"> · {{ cacheAgeLabel }}</span>
        </span>
        <button
          @click="forceRefresh"
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

    <div v-if="loading && !issues.length" class="text-sm text-gray-500 dark:text-gray-400">
      {{ activeView === 'feedback' ? 'Loading BU feedback issues...' : 'Loading SFDC issues...' }}
    </div>

    <div v-if="warning" class="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 px-4 py-3 text-sm">
      {{ warning }}
    </div>

    <BuFeedbackExecutiveSummary v-if="issues.length" :issues="issues" />

    <BuFeedbackTable v-if="issues.length || (!loading && !error)" :issues="issues" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getApiBase } from '@shared/client/services/api'
import BuFeedbackExecutiveSummary from '../components/BuFeedbackExecutiveSummary.vue'
import BuFeedbackTable from '../components/BuFeedbackTable.vue'

var ENDPOINTS = {
  feedback: '/modules/releases/planning/bu-feedback',
  sfdc: '/modules/releases/planning/sfdc-issues'
}

var activeView = ref('feedback')
var issues = ref([])
var loading = ref(false)
var error = ref(null)
var warning = ref(null)
var fetchedAt = ref(null)
var cachedAt = ref(null)

var cacheAgeLabel = computed(function() {
  if (!cachedAt.value) return null
  var ageMs = Date.now() - new Date(cachedAt.value).getTime()
  if (ageMs < 0) return null
  var mins = Math.floor(ageMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  var hours = Math.floor(mins / 60)
  if (hours < 24) return hours + 'h ago'
  return Math.floor(hours / 24) + 'd ago'
})

async function loadData(refresh) {
  loading.value = true
  error.value = null
  warning.value = null

  try {
    var url = getApiBase() + ENDPOINTS[activeView.value]
    if (refresh) url += '?refresh=true'
    var response = await fetch(url)
    if (!response.ok) throw new Error('HTTP ' + response.status)
    var data = await response.json()
    issues.value = data.issues || []
    fetchedAt.value = data.fetchedAt || null
    cachedAt.value = data.cachedAt || null
    if (data.warning) warning.value = data.warning
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function switchView(view) {
  if (activeView.value === view) return
  activeView.value = view
  issues.value = []
  fetchedAt.value = null
  cachedAt.value = null
  loadData(false)
}

function forceRefresh() {
  loadData(true)
}

onMounted(function() { loadData(false) })
</script>
