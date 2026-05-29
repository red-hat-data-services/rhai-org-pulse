<script setup>
import { computed, onMounted, watch, inject } from 'vue'
import {
  ArrowLeftIcon, ExternalLinkIcon, ClockIcon, UserIcon,
  AlertCircleIcon
} from 'lucide-vue-next'
import { usePipelineDetail } from '../composables/usePipelines.js'
import RunCharts from '../components/RunCharts.vue'
import RunHistoryTable from '../components/RunHistoryTable.vue'
import QueuePanel from '../components/QueuePanel.vue'

const moduleNav = inject('moduleNav')
const slug = computed(() => moduleNav.params.value?.slug || '')
const { pipeline, loading, error, load } = usePipelineDetail()

function goBack() {
  moduleNav.navigateTo('status')
}

const statusColor = computed(() => {
  const s = pipeline.value?.health?.healthStatus
  if (s === 'green') return 'bg-emerald-400'
  if (s === 'yellow') return 'bg-amber-400'
  if (s === 'red') return 'bg-red-500'
  return 'bg-gray-400'
})

const statusLabel = computed(() => {
  const s = pipeline.value?.health?.healthStatus
  if (s === 'green') return 'Healthy'
  if (s === 'yellow') return 'Warning'
  if (s === 'red') return 'Critical'
  return 'No data'
})

const scheduleLabel = computed(() => {
  const mins = pipeline.value?.schedule?.expectedIntervalMinutes
  if (!mins) return 'Unknown'
  if (mins < 60) return `every ${mins}m`
  if (mins === 60) return 'every hour'
  if (mins < 1440) return `every ${mins / 60}h`
  if (mins === 1440) return 'daily'
  return `every ${Math.round(mins / 1440)}d`
})

onMounted(() => {
  if (slug.value) load(slug.value)
})

watch(slug, (val) => {
  if (val) load(val)
})
</script>

<template>
  <div>
    <!-- Back nav -->
    <button
      class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 mb-4"
      @click="goBack"
    >
      <ArrowLeftIcon :size="14" />
      Back to Status Board
    </button>

    <!-- Loading -->
    <div v-if="loading && !pipeline" class="animate-pulse space-y-4">
      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
      <div class="h-4 bg-gray-100 dark:bg-gray-700 rounded w-96" />
      <div class="h-48 bg-gray-100 dark:bg-gray-700 rounded-xl" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <AlertCircleIcon :size="24" class="text-red-500 mx-auto mb-2" />
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading pipeline</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
      <button class="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium" @click="load(slug)">Retry</button>
    </div>

    <!-- Content -->
    <template v-else-if="pipeline">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span :class="['w-3 h-3 rounded-full', statusColor]" />
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ pipeline.name }}</h2>
              <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {{ statusLabel }}
              </span>
            </div>
            <p v-if="pipeline.description" class="text-sm text-gray-500 dark:text-gray-400 mb-3">{{ pipeline.description }}</p>
            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1"><ClockIcon :size="12" /> {{ scheduleLabel }}</span>
              <span v-if="pipeline.owner" class="flex items-center gap-1"><UserIcon :size="12" /> {{ pipeline.owner }}</span>
              <span class="flex items-center gap-1">{{ pipeline.repo?.platform === 'github' ? 'GitHub' : 'GitLab' }}</span>
            </div>
          </div>
          <a
            v-if="pipeline.repo?.url"
            :href="pipeline.repo.url"
            target="_blank"
            rel="noopener"
            class="text-gray-400 hover:text-primary-500"
          >
            <ExternalLinkIcon :size="16" />
          </a>
        </div>
      </div>

      <!-- Runner queue -->
      <QueuePanel
        :queue="pipeline.health?.queue"
        :avgQueuedSeconds="pipeline.health?.avgQueuedSeconds"
        :maxQueuedSeconds="pipeline.health?.maxQueuedSeconds"
        :runs="pipeline.runs || []"
        class="mb-6"
      />

      <!-- Trend charts -->
      <RunCharts v-if="pipeline.runs?.length" :runs="pipeline.runs" class="mb-6" />

      <!-- Run history table -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent Runs</h3>
        <RunHistoryTable :runs="pipeline.runs || []" />
      </div>

    </template>
  </div>
</template>
