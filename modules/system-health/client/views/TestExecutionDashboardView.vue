<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ExternalLink, RefreshCw, AlertTriangle, Maximize2, Minimize2 } from 'lucide-vue-next'

const DASHBOARD_BASE = '/test-dashboard'

const dashboardUrl = ref('')
const iframeRef = ref(null)
const loading = ref(true)
const error = ref(null)
const isExpanded = ref(false)

// Filters
const version = ref('All')
const release = ref('All')
const fromDate = ref('')
const toDate = ref('')

const versionOptions = ['All', '2.25', '3.4', '3.5', '3.6']
const releaseOptions = ['All', 'GA', 'EA1', 'EA2']

onMounted(() => {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  toDate.value = now.toISOString().split('T')[0]
  fromDate.value = thirtyDaysAgo.toISOString().split('T')[0]
  buildUrl()
})

function buildUrl() {
  loading.value = true
  error.value = null

  const params = new URLSearchParams({
    environment: 'RHOAI',
    version: version.value,
    release: release.value,
    from_date: fromDate.value,
    to_date: toDate.value,
    provider: 'All',
    cluster_type: 'All',
    gate: 'All',
  })

  dashboardUrl.value = `${DASHBOARD_BASE}/index.html?${params.toString()}`
}

watch([version, release, fromDate, toDate], () => {
  buildUrl()
})

function onIframeLoad() {
  loading.value = false
}

function onIframeError() {
  loading.value = false
  error.value = 'Failed to load the Test Execution Dashboard.'
}

function openInNewTab() {
  window.open(dashboardUrl.value, '_blank')
}

function refreshDashboard() {
  loading.value = true
  if (iframeRef.value) {
    iframeRef.value.src = dashboardUrl.value
  }
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

const containerClass = computed(() =>
  isExpanded.value
    ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col'
    : 'space-y-4'
)
</script>

<template>
  <div :class="containerClass">
    <!-- Header -->
    <div class="flex items-center justify-between" :class="isExpanded ? 'px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0' : ''">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Test Execution Dashboard</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          RHOAI quality gate results from Jenkins CI — heatmap and per-component views
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="refreshDashboard"
          class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Refresh dashboard"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </button>
        <button
          type="button"
          @click="toggleExpand"
          class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          :title="isExpanded ? 'Exit fullscreen' : 'Fullscreen'"
        >
          <Minimize2 v-if="isExpanded" class="h-4 w-4" />
          <Maximize2 v-else class="h-4 w-4" />
        </button>
        <button
          type="button"
          @click="openInNewTab"
          class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Open in new tab"
        >
          <ExternalLink class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Filters Bar -->
    <div
      class="bg-white dark:bg-gray-800 shadow rounded-lg px-4 py-3"
      :class="isExpanded ? 'mx-4 mt-2 shrink-0' : ''"
    >
      <div class="flex flex-wrap items-center gap-4">
        <!-- Version -->
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Version</label>
          <select
            v-model="version"
            class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white"
          >
            <option v-for="v in versionOptions" :key="v" :value="v">{{ v }}</option>
          </select>
        </div>

        <!-- Release -->
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Release</label>
          <select
            v-model="release"
            class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white"
          >
            <option v-for="r in releaseOptions" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>

        <!-- Date Range -->
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">From</label>
          <input
            type="date"
            v-model="fromDate"
            class="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">To</label>
          <input
            type="date"
            v-model="toDate"
            class="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-if="error"
      class="rounded-md bg-red-50 dark:bg-red-900/20 p-4"
      :class="isExpanded ? 'mx-4 shrink-0' : ''"
    >
      <div class="flex">
        <AlertTriangle class="h-5 w-5 text-red-400" />
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800 dark:text-red-200">Dashboard unavailable</h3>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">{{ error }}</p>
          <button
            type="button"
            class="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            @click="refreshDashboard"
          >
            Try again
          </button>
        </div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-8"
      :class="isExpanded ? 'shrink-0' : ''"
    >
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      <span class="ml-3 text-sm text-gray-600 dark:text-gray-400">Loading dashboard...</span>
    </div>

    <!-- iframe Dashboard -->
    <div
      class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm"
      :class="isExpanded ? 'mx-4 mb-4 flex-1 min-h-0' : ''"
    >
      <iframe
        ref="iframeRef"
        :src="dashboardUrl"
        title="RHOAI Test Execution Dashboard"
        class="w-full border-0 block"
        :style="isExpanded ? 'height: 100%' : 'min-height: calc(100vh - 14rem)'"
        @load="onIframeLoad"
        @error="onIframeError"
        allow="clipboard-write"
      />
    </div>
  </div>
</template>
