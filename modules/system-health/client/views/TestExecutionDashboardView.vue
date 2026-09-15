<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ExternalLink, RefreshCw, AlertTriangle, Maximize2, Minimize2 } from 'lucide-vue-next'

const S3_DASHBOARD_BASE = 'https://test-reports-dashboard.s3.amazonaws.com/dashboard'

const dashboardUrl = ref('')
const iframeRef = ref(null)
const loading = ref(true)
const error = ref(null)
const isExpanded = ref(false)

// Filters
const activeView = ref('heatmap')
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

  const page = activeView.value === 'heatmap' ? 'index.html' : 'component.html'
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

  dashboardUrl.value = `${S3_DASHBOARD_BASE}/${page}?${params.toString()}`
}

watch([activeView, version, release, fromDate, toDate], () => {
  buildUrl()
})

function onIframeLoad() {
  loading.value = false
}

function onIframeError() {
  loading.value = false
  error.value = 'Failed to load the Test Execution Dashboard. The S3 endpoint may be unreachable.'
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
        <!-- View toggle -->
        <div class="inline-flex rounded-md border border-gray-300 dark:border-gray-600 p-0.5" role="group">
          <button
            type="button"
            @click="activeView = 'heatmap'"
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              activeView === 'heatmap'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
          >
            Heatmap Overview
          </button>
          <button
            type="button"
            @click="activeView = 'component'"
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              activeView === 'component'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            ]"
          >
            Component Detail
          </button>
        </div>

        <div class="h-6 border-l border-gray-300 dark:border-gray-600"></div>

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

    <!-- Dashboard source info -->
    <div
      class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 text-xs text-blue-700 dark:text-blue-300"
      :class="isExpanded ? 'mx-4 shrink-0' : ''"
    >
      <span class="font-medium">Source:</span>
      S3 static dashboard generated by
      <a
        href="https://gitlab.cee.redhat.com/aloganat/test-reports-dashboard/-/pipeline_schedules"
        target="_blank"
        rel="noopener"
        class="underline hover:text-blue-900 dark:hover:text-blue-100"
      >
        GitLab CI pipeline
      </a>
      · Data refreshed on each pipeline run (scheduled or on-demand)
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
        :style="isExpanded ? 'height: 100%' : 'min-height: calc(100vh - 18rem)'"
        @load="onIframeLoad"
        @error="onIframeError"
        allow="clipboard-write"
      />
    </div>
  </div>
</template>
