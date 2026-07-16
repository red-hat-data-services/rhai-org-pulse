<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useFeatureTracking } from '../composables/useFeatureTracking.js'
import { useFeatureTrackingFilters } from '../composables/useFeatureTrackingFilters.js'
import FeatureTrackingTable from '../components/FeatureTrackingTable.vue'
import FeatureTrackingSettingsPanel from '../components/FeatureTrackingSettingsPanel.vue'
import HygieneSelect from '../components/hygiene/HygieneSelect.vue'
import { getApiBase } from '@shared/client/services/api'

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
const settingsOpen = ref(false)
const trackingConfig = ref({ releases: {} })

const portfolioVersions = computed(() => {
  return (versions.value || []).map(v => v.version)
})

const currentData = computed(() => trackingData.value)
const groups = computed(() => currentData.value ? currentData.value.groups || [] : [])
const featureFreezeDate = computed(() => currentData.value ? currentData.value.planningFreezeDate : null)
const freezeStatus = computed(() => {
  if (!featureFreezeDate.value) return 'unknown'
  var today = new Date().toISOString().split('T')[0]
  return today >= featureFreezeDate.value ? 'past' : 'future'
})

const {
  searchQuery,
  selectedProducts,
  selectedStatuses,
  selectedComponents,
  selectedOwners,
  activeCardFilter,

  availableProducts,
  availableStatuses,
  availableComponents,
  availableOwners,

  totalFeatures,
  totalAddedCount,
  totalDroppedCount,
  totalBlockedCount,

  filteredGroups,
  filteredFeatureCount,
  isToolbarFiltered,
  isFiltered,
  activeFilterLabels,

  setCardFilter,
  removeFilter,
  clearAllFilters,
  restoreFilters,
  resetFilters
} = useFeatureTrackingFilters(groups, selectedVersion)

function handleCardClick(type) {
  var counts = { added: totalAddedCount.value, dropped: totalDroppedCount.value, blocked: totalBlockedCount.value }
  if (counts[type] === 0) return
  setCardFilter(type)
  if (activeCardFilter.value === type) {
    nextTick(() => {
      if (tableRef.value) tableRef.value.expandAll()
    })
  }
}

var productOptions = computed(() => {
  return availableProducts.value.map(p => ({ value: p, label: p.toUpperCase() }))
})

var statusOptions = computed(() => {
  return availableStatuses.value.map(s => ({ value: s, label: s }))
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

async function fetchTrackingConfig() {
  try {
    var response = await fetch(getApiBase() + '/modules/releases/execution/tracking/config')
    if (response.ok) {
      trackingConfig.value = await response.json()
    }
  } catch (e) { void e }
}

async function onSettingsSaved(newConfig) {
  trackingConfig.value = newConfig
  settingsOpen.value = false
  await loadVersions()
  if (selectedVersion.value) {
    await refreshTracking(selectedVersion.value)
  }
}

watch(selectedVersion, async (v) => {
  resetFilters()
  if (v) {
    await loadTrackingData(v)
    if (selectedVersion.value !== v) return
    nextTick(() => restoreFilters())
  }
})

onMounted(async () => {
  await fetchTrackingConfig()
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
          Track features committed at Planning Freeze across RHOAI, RHAIIS, and RHELAI.
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
          @click="settingsOpen = true"
          class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          title="Configure releases"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
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

    <!-- Filter toolbar -->
    <div v-if="currentData && !loading" class="flex flex-wrap gap-3 items-center mb-5">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search features..."
        class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
      />
      <HygieneSelect
        :modelValue="selectedProducts"
        :options="productOptions"
        placeholder="All Products"
        @update:modelValue="v => selectedProducts = v"
      />
      <HygieneSelect
        :modelValue="selectedStatuses"
        :options="statusOptions"
        placeholder="All Statuses"
        @update:modelValue="v => selectedStatuses = v"
      />
      <HygieneSelect
        :modelValue="selectedComponents"
        :options="availableComponents"
        placeholder="All Components"
        @update:modelValue="v => selectedComponents = v"
      />
      <HygieneSelect
        :modelValue="selectedOwners"
        :options="availableOwners"
        placeholder="All Owners"
        @update:modelValue="v => selectedOwners = v"
      />
      <span
        v-if="isToolbarFiltered"
        class="text-xs text-gray-500 dark:text-gray-400"
      >Showing {{ filteredFeatureCount }} of {{ totalFeatures }}</span>
      <button
        v-if="isToolbarFiltered"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        @click="clearAllFilters"
      >Clear Filters</button>
    </div>

    <!-- Summary cards -->
    <div v-if="currentData && !loading" class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      <!-- Total features (click = clear card filter) -->
      <div
        @click="setCardFilter(null)"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 cursor-pointer transition-all duration-150 hover:shadow-md"
        :class="!activeCardFilter
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
          <span v-if="activeCardFilter" class="ml-auto text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">Show all</span>
        </div>
        <div class="text-2xl font-bold text-gray-900 dark:text-gray-100 ml-7">
          {{ totalFeatures }}
        </div>
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
          <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Planning Freeze</span>
        </div>
        <div class="text-sm font-bold ml-7" :class="freezeStatus === 'past' ? 'text-orange-600 dark:text-orange-400' : freezeStatus === 'future' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'">
          {{ featureFreezeDate ? formatDate(featureFreezeDate) : 'Not set' }}
        </div>
      </div>

      <!-- Late additions -->
      <div
        @click="handleCardClick('added')"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeCardFilter === 'added'
            ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          totalAddedCount > 0
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
          <svg v-if="activeCardFilter === 'added'" class="ml-auto w-3.5 h-3.5 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold ml-7" :class="totalAddedCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'">{{ totalAddedCount }}</div>
      </div>

      <!-- Dropped -->
      <div
        @click="handleCardClick('dropped')"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeCardFilter === 'dropped'
            ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-200 dark:ring-amber-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          totalDroppedCount > 0
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
          <svg v-if="activeCardFilter === 'dropped'" class="ml-auto w-3.5 h-3.5 text-amber-500 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold ml-7" :class="totalDroppedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'">{{ totalDroppedCount }}</div>
      </div>

      <!-- Blocked -->
      <div
        @click="handleCardClick('blocked')"
        class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3.5 transition-all duration-150"
        :class="[
          activeCardFilter === 'blocked'
            ? 'border-red-400 dark:border-red-500 ring-2 ring-red-200 dark:ring-red-800 shadow-sm'
            : 'border-gray-200 dark:border-gray-700',
          totalBlockedCount > 0
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
          <svg v-if="activeCardFilter === 'blocked'" class="ml-auto w-3.5 h-3.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div class="text-2xl font-bold ml-7" :class="totalBlockedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'">{{ totalBlockedCount }}</div>
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

    <!-- Data table (with active filter chips banner) -->
    <template v-else-if="currentData">
      <div
        v-if="isFiltered"
        class="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
      >
        <svg class="w-4 h-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="chip in activeFilterLabels"
            :key="chip.type"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400"
          >
            {{ chip.label }}
            <button
              @click.stop="removeFilter(chip.type)"
              class="hover:text-primary-900 dark:hover:text-primary-200 transition-colors"
            >&times;</button>
          </span>
        </div>
        <button
          @click="clearAllFilters"
          class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          Clear all
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
        :totalUniqueFeatures="totalFeatures"
        :filteredFeatureCount="isFiltered ? filteredFeatureCount : null"
      />
    </template>

    <FeatureTrackingSettingsPanel
      :open="settingsOpen"
      :config="trackingConfig"
      @close="settingsOpen = false"
      @saved="onSettingsSaved"
    />
  </div>
</template>
