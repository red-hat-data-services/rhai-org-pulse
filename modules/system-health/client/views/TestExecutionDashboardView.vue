<script setup>
import { ref, computed, onMounted } from 'vue'
import { ExternalLink, RefreshCw, AlertTriangle, Maximize2, Minimize2 } from 'lucide-vue-next'

// Try static files first (works in development), fall back to API (works in production)
const DASHBOARD_STATIC = '/test-dashboard/index.html'
const DASHBOARD_API = '/api/modules/system-health/quality/test-execution/html/index'

const dashboardUrl = ref('')
const iframeRef = ref(null)
const loading = ref(true)
const error = ref(null)
const isExpanded = ref(false)
const usingApi = ref(false)

async function loadDashboard() {
  loading.value = true
  error.value = null
  
  // Try static path first with single GET request
  // Check if response contains dashboard marker (not SPA fallback)
  try {
    const response = await fetch(DASHBOARD_STATIC, { credentials: 'include' })
    if (response.ok) {
      const text = await response.text()
      // Verify it's the actual dashboard, not SPA fallback
      if (text.includes('Test Execution Statistics') || text.includes('test-exec-heatmap')) {
        dashboardUrl.value = DASHBOARD_STATIC
        usingApi.value = false
        return
      }
    }
  } catch {
    // Static file not available, try API
  }
  
  // Try API endpoint - but validate it returns actual HTML, not an error JSON
  try {
    const apiResponse = await fetch(DASHBOARD_API, { credentials: 'include' })
    if (apiResponse.ok) {
      const text = await apiResponse.text()
      // Check if it's valid HTML (not a JSON error response)
      if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
        dashboardUrl.value = DASHBOARD_API
        usingApi.value = true
        return
      }
    }
    // API returned an error or non-HTML content
    throw new Error('HTML not available')
  } catch {
    // Both static and API failed - show error
    loading.value = false
    error.value = 'Dashboard HTML not available. An admin needs to upload the dashboard files, or check that the static files are deployed correctly.'
    dashboardUrl.value = ''
  }
}

onMounted(() => {
  loadDashboard()
})

function onIframeLoad() {
  loading.value = false
}

function onIframeError() {
  loading.value = false
  error.value = 'Failed to load the Test Execution Dashboard (Beta). Please ensure the dashboard data has been uploaded.'
}

function openInNewTab() {
  if (dashboardUrl.value) {
    window.open(dashboardUrl.value, '_blank')
  }
}

function refreshDashboard() {
  loading.value = true
  error.value = null
  loadDashboard().then(() => {
    if (iframeRef.value) {
      // Force reload by adding timestamp
      const baseUrl = dashboardUrl.value.split('?')[0]
      iframeRef.value.src = `${baseUrl}?_=${Date.now()}`
    }
  })
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
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Test Execution Dashboard <span class="text-sm text-amber-500 font-medium">(Beta)</span></h1>
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
          :disabled="!dashboardUrl"
          class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Open in new tab"
        >
          <ExternalLink class="h-4 w-4" />
        </button>
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
      v-if="dashboardUrl"
      class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm"
      :class="isExpanded ? 'mx-4 mb-4 flex-1 min-h-0' : ''"
    >
      <iframe
        ref="iframeRef"
        :src="dashboardUrl"
        title="RHOAI Test Execution Dashboard (Beta)"
        class="w-full border-0 block"
        :style="isExpanded ? 'height: 100%' : 'min-height: calc(100vh - 10rem)'"
        sandbox="allow-scripts allow-same-origin allow-top-navigation-by-user-activation allow-popups allow-popups-to-escape-sandbox"
        @load="onIframeLoad"
        @error="onIframeError"
        allow="clipboard-write"
      />
    </div>

    <!-- Helpful info when dashboard is not available -->
    <div
      v-if="!dashboardUrl && !loading && !error"
      class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-8 text-center"
      :class="isExpanded ? 'mx-4 mb-4' : ''"
    >
      <p class="text-gray-600 dark:text-gray-400">
        Dashboard is being loaded...
      </p>
    </div>
  </div>
</template>
