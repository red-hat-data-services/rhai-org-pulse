<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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
const activeFilter = ref(null)

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

const blockedCount = computed(() => {
  var count = 0
  for (var i = 0; i < groups.value.length; i++) {
    var features = groups.value[i].features || []
    for (var j = 0; j < features.length; j++) {
      if (features[j].isBlocked && features[j].scopeChange !== 'dropped') count++
    }
  }
  return count
})

function setFilter(type) {
  if (type === null || activeFilter.value === type) {
    activeFilter.value = null
  } else {
    activeFilter.value = type
    nextTick(() => {
      if (tableRef.value) tableRef.value.expandAll()
    })
  }
}

const filteredGroups = computed(() => {
  if (!activeFilter.value) return groups.value
  return groups.value.map(g => {
    const filtered = (g.features || []).filter(f => {
      if (activeFilter.value === 'added') return f.scopeChange === 'added'
      if (activeFilter.value === 'dropped') return f.scopeChange === 'dropped'
      if (activeFilter.value === 'blocked') return f.isBlocked && f.scopeChange !== 'dropped'
      return true
    })
    return {
      ...g,
      features: filtered,
      featureCount: filtered.filter(f => f.scopeChange !== 'dropped').length
    }
  }).filter(g => g.features.length > 0)
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
  activeFilter.value = null
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
    <div class="mb-5 flex items-start justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </span>
          Feature Execution Tracking
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-9">
          Track features committed at Feature Freeze across RHOAI, RHAIIS, and RHELAI.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="handleExpandAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          :disabled="!currentData"
        >Expand All</button>
        <button
          @click="handleCollapseAll"
          class="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          :disabled="!currentData"
        >Collapse All</button>
        <button
          @click="handleRefresh"
          :disabled="!selectedVersion || refreshing"
          class="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-md hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1.5"
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

    <!-- Version selector chips -->
    <div class="mb-5">
      <div class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-0.5">Release Version</div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="v in portfolioVersions"
          :key="v"
          @click="selectVersion(v)"
          class="relative px-3.5 py-1.5 text-sm font-semibold rounded-full transition-all duration-150"
          :class="selectedVersion === v
            ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-md shadow-primary-500/25 dark:shadow-primary-500/20 scale-[1.02]'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:text-primary-700 dark:hover:text-primary-300 hover:shadow-sm'"
        >
          {{ v }}
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div v-if="currentData && !loading" class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      <!-- Total features (click = clear filter) -->
      <div
        @click="setFilter(null)"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 cursor-pointer transition-all duration-150 hover:shadow-md"
        :class="!activeFilter
          ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800 shadow-sm'
          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/40">
            <svg class="w-3 h-3 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Features</span>
          <span v-if="activeFilter" class="ml-auto text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">Show all</span>
        </div>
        <div class="text-2xl font-bold text-gray-900 dark:text-gray-100 ml-7">{{ totalFeatures }}</div>
      </div>

      <!-- Feature Freeze date -->
      <div class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3.5">
        <div class="absolute top-0 left-0 w-1 h-full rounded-l-xl" :class="freezeStatus === 'past' ? 'bg-orange-500' : freezeStatus === 'future' ? 'bg-emerald-500' : 'bg-gray-400'" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded" :class="freezeStatus === 'past' ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'">
            <svg class="w-3 h-3" :class="freezeStatus === 'past' ? 'text-orange-600 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Freeze Date</span>
        </div>
        <div class="text-sm font-bold ml-7" :class="freezeStatus === 'past' ? 'text-orange-600 dark:text-orange-400' : freezeStatus === 'future' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'">
          {{ featureFreezeDate ? formatDate(featureFreezeDate) : 'Not set' }}
        </div>
      </div>

      <!-- Late additions -->
      <div
        @click="addedCount > 0 ? setFilter('added') : undefined"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeFilter === 'added'
            ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          addedCount > 0
            ? 'cursor-pointer hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600'
            : ''
        ]"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/40">
            <svg class="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Late Added</span>
          <svg v-if="activeFilter === 'added'" class="ml-auto w-3.5 h-3.5 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold ml-7" :class="addedCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'">{{ addedCount }}</div>
      </div>

      <!-- Dropped -->
      <div
        @click="droppedCount > 0 ? setFilter('dropped') : undefined"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeFilter === 'dropped'
            ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-200 dark:ring-amber-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          droppedCount > 0
            ? 'cursor-pointer hover:shadow-md hover:border-amber-300 dark:hover:border-amber-600'
            : ''
        ]"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-amber-500 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-100 dark:bg-amber-900/40">
            <svg class="w-3 h-3 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Dropped</span>
          <svg v-if="activeFilter === 'dropped'" class="ml-auto w-3.5 h-3.5 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold ml-7" :class="droppedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'">{{ droppedCount }}</div>
      </div>

      <!-- Blocked -->
      <div
        @click="blockedCount > 0 ? setFilter('blocked') : undefined"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeFilter === 'blocked'
            ? 'border-red-400 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          blockedCount > 0
            ? 'cursor-pointer hover:shadow-md hover:border-red-300 dark:hover:border-red-600'
            : ''
        ]"
      >
        <div class="absolute top-0 left-0 w-1 h-full bg-red-500 rounded-l-xl" />
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded bg-red-100 dark:bg-red-900/40">
            <svg class="w-3 h-3 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </span>
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Blocked</span>
          <svg v-if="activeFilter === 'blocked'" class="ml-auto w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold ml-7" :class="blockedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'">{{ blockedCount }}</div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-3">
      <svg class="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span class="text-sm text-gray-500 dark:text-gray-400">Loading feature data from Jira...</span>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm text-red-700 dark:text-red-400 flex items-start gap-3">
      <svg class="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      {{ error }}
    </div>

    <!-- Empty state: no version selected -->
    <div v-else-if="!selectedVersion" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p class="text-sm font-medium">Select a release version above to view feature tracking data.</p>
    </div>

    <!-- Empty state: no data -->
    <div v-else-if="currentData && groups.length === 0" class="text-center py-16 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p class="text-sm font-medium">No feature data available for {{ selectedVersion }}.</p>
      <p class="text-xs mt-1">Use the Refresh button to fetch data from Jira.</p>
    </div>

    <!-- Data table (with optional filter indicator) -->
    <template v-else-if="currentData">
      <div
        v-if="activeFilter"
        class="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
        :class="{
          'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300': activeFilter === 'added',
          'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300': activeFilter === 'dropped',
          'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300': activeFilter === 'blocked'
        }"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span>Showing {{ activeFilter === 'added' ? 'late added' : activeFilter }} features only</span>
        <button
          @click="setFilter(null)"
          class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
        >
          Clear filter
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <FeatureTrackingTable
        ref="tableRef"
        :groups="filteredGroups"
        :portfolioVersion="selectedVersion"
        :featureFreezeDate="featureFreezeDate"
      />
    </template>
  </div>
</template>
