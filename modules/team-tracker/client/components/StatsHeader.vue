<script setup>
import { computed } from 'vue'

const props = defineProps({
  stats: { type: Object, default: null },
  syncStatus: { type: Object, default: null }
})

const githubPct = computed(() => {
  if (!props.stats || !props.stats.coverage) return 0
  const c = props.stats.coverage.github
  return c.total > 0 ? Math.round((c.hasId / c.total) * 100) : 0
})

const gitlabPct = computed(() => {
  if (!props.stats || !props.stats.coverage) return 0
  const c = props.stats.coverage.gitlab
  return c.total > 0 ? Math.round((c.hasId / c.total) * 100) : 0
})

const lastSynced = computed(() => {
  if (!props.syncStatus || !props.syncStatus.lastResult) return null
  const d = props.syncStatus.lastResult.completedAt
  if (!d) return null
  const diff = Date.now() - new Date(d).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
  return Math.floor(diff / 86400000) + 'd ago'
})
</script>

<template>
  <div v-if="stats" class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.active }}</div>
      <div class="text-xs text-gray-500 dark:text-gray-400">Active People</div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ stats.total }}</div>
      <div class="text-xs text-gray-500 dark:text-gray-400">Total (incl. inactive)</div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="text-2xl font-bold" :class="githubPct >= 80 ? 'text-green-600 dark:text-green-400' : githubPct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'">
        {{ githubPct }}%
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">GitHub Coverage</div>
      <div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div class="h-1.5 rounded-full transition-all" :class="githubPct >= 80 ? 'bg-green-500' : githubPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'" :style="{ width: githubPct + '%' }"></div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="text-2xl font-bold" :class="gitlabPct >= 80 ? 'text-green-600 dark:text-green-400' : gitlabPct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'">
        {{ gitlabPct }}%
      </div>
      <div class="text-xs text-gray-500 dark:text-gray-400">GitLab Coverage</div>
      <div class="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div class="h-1.5 rounded-full transition-all" :class="gitlabPct >= 80 ? 'bg-green-500' : gitlabPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'" :style="{ width: gitlabPct + '%' }"></div>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
      <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ lastSynced || 'Never' }}</div>
      <div class="text-xs text-gray-500 dark:text-gray-400">Last Synced</div>
      <div v-if="syncStatus && syncStatus.running" class="mt-1 text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1">
        <span class="inline-block h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>
        Syncing...
      </div>
    </div>
  </div>
</template>
