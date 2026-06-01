<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useFeatureTracking } from '../composables/useFeatureTracking.js'
import FeatureTrackingTable from '../components/FeatureTrackingTable.vue'

const {
  trackingData,
  versions,
  loading,
  error,
  loadVersions,
  loadTrackingData,
  refreshTracking
} = useFeatureTracking()

const selectedVersion = ref(null)
const refreshing = ref(false)
const tableRef = ref(null)

const portfolioVersions = computed(() => {
  return (versions.value || []).map(v => v.version)
})

const currentData = computed(() => trackingData.value)
const groups = computed(() => currentData.value ? currentData.value.groups || [] : [])
const featureFreezeDate = computed(() => currentData.value ? currentData.value.featureFreezeDate : null)
const freezeStatus = computed(() => {
  if (!featureFreezeDate.value) return 'unknown'
  var today = new Date().toISOString().split('T')[0]
  return today >= featureFreezeDate.value ? 'past' : 'future'
})

const totalFeatures = computed(() => {
  var count = 0
  for (var i = 0; i < groups.value.length; i++) {
    count += groups.value[i].featureCount || 0
  }
  return count
})

const addedCount = computed(() => {
  var count = 0
  for (var i = 0; i < groups.value.length; i++) {
    var features = groups.value[i].features || []
    for (var j = 0; j < features.length; j++) {
      if (features[j].scopeChange === 'added') count++
    }
  }
  return count
})

const droppedCount = computed(() => {
  var count = 0
  for (var i = 0; i < groups.value.length; i++) {
    var features = groups.value[i].features || []
    for (var j = 0; j < features.length; j++) {
      if (features[j].scopeChange === 'dropped') count++
    }
  }
  return count
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  var d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function selectVersion(version) {
  selectedVersion.value = version
}

async function handleRefresh() {
  if (!selectedVersion.value || refreshing.value) return
  refreshing.value = true
  try {
    await refreshTracking(selectedVersion.value)
  } finally {
    refreshing.value = false
  }
}

function handleExpandAll() {
  if (tableRef.value) tableRef.value.expandAll()
}

function handleCollapseAll() {
  if (tableRef.value) tableRef.value.collapseAll()
}

watch(selectedVersion, async (v) => {
  if (v) await loadTrackingData(v)
})

onMounted(async () => {
  await loadVersions()
  if (portfolioVersions.value.length > 0) {
    selectedVersion.value = portfolioVersions.value[0]
  }
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Feature Execution Tracking</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Track features committed at Feature Freeze across RHOAI, RHAIIS, and RHELAI.
      </p>
    </div>

    <!-- Version selector + actions bar -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="v in portfolioVersions"
          :key="v"
          @click="selectVersion(v)"
          class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors"
          :class="selectedVersion === v
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ring-1 ring-primary-300 dark:ring-primary-700'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
        >{{ v }}</button>
      </div>

      <div class="flex-1" />

      <div class="flex items-center gap-2">
        <button
          @click="handleExpandAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          :disabled="!currentData"
        >Expand All</button>
        <button
          @click="handleCollapseAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          :disabled="!currentData"
        >Collapse All</button>
        <button
          @click="handleRefresh"
          :disabled="!selectedVersion || refreshing"
          class="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <svg
            class="w-3.5 h-3.5"
            :class="{ 'animate-spin': refreshing }"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ refreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div v-if="currentData && !loading" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Features</div>
        <div class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{{ totalFeatures }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Feature Freeze</div>
        <div class="text-sm font-semibold mt-1" :class="freezeStatus === 'past' ? 'text-orange-600 dark:text-orange-400' : freezeStatus === 'future' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'">
          {{ featureFreezeDate ? formatDate(featureFreezeDate) : 'Not set' }}
        </div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Late Additions</div>
        <div class="text-xl font-bold mt-1" :class="addedCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'">{{ addedCount }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dropped</div>
        <div class="text-xl font-bold mt-1" :class="droppedCount > 0 ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'">{{ droppedCount }}</div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Empty state: no version selected -->
    <div v-else-if="!selectedVersion" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p class="text-sm">Select a portfolio version to view feature tracking data.</p>
    </div>

    <!-- Empty state: no data -->
    <div v-else-if="currentData && groups.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p class="text-sm">No feature data available for {{ selectedVersion }}.</p>
      <p class="text-xs mt-2">Use the Refresh button to fetch data from Jira, or configure releases in the Manage tab.</p>
    </div>

    <!-- Data table -->
    <FeatureTrackingTable
      v-else-if="currentData"
      ref="tableRef"
      :groups="groups"
      :portfolioVersion="selectedVersion"
      :featureFreezeDate="featureFreezeDate"
    />
  </div>
</template>
