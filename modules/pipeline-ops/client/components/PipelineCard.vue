<script setup>
import { computed } from 'vue'
import { ExternalLinkIcon, ClockIcon, UserIcon, GitBranchIcon } from 'lucide-vue-next'

const props = defineProps({
  pipeline: { type: Object, required: true }
})

defineEmits(['click'])

const statusColor = computed(() => {
  const s = props.pipeline.health?.healthStatus
  if (s === 'green') return 'bg-emerald-400'
  if (s === 'yellow') return 'bg-amber-400'
  if (s === 'red') return 'bg-red-500'
  return 'bg-gray-400'
})

const statusLabel = computed(() => {
  const s = props.pipeline.health?.healthStatus
  if (s === 'green') return 'Healthy'
  if (s === 'yellow') return 'Warning'
  if (s === 'red') return 'Critical'
  return 'No data'
})

const scheduleLabel = computed(() => {
  const mins = props.pipeline.schedule?.expectedIntervalMinutes
  if (!mins) return 'Unknown'
  if (mins < 60) return `every ${mins}m`
  if (mins === 60) return 'every hour'
  if (mins < 1440) return `every ${mins / 60}h`
  if (mins === 1440) return 'daily'
  return `every ${Math.round(mins / 1440)}d`
})

const platformLabel = computed(() => {
  return props.pipeline.repo?.platform === 'github' ? 'GitHub' : 'GitLab'
})

const skillSummary = computed(() => {
  const repos = props.pipeline.skillRepos || []
  if (repos.length === 0) return null
  return repos.map(r => {
    const name = r.repo.split('/').pop()
    return r.branch ? `${name} (${r.branch})` : name
  }).join(', ')
})

const lastRunAgo = computed(() => {
  const at = props.pipeline.health?.lastRunAt
  if (!at) return null
  const diff = Date.now() - new Date(at).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
})

const lastRunStatus = computed(() => {
  const h = props.pipeline.health
  if (!h?.lastRunAt) return null
  if (h.failureStreak > 0) return `${h.failureStreak} consecutive failures`
  return 'last run succeeded'
})
</script>

<template>
  <button
    class="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all cursor-pointer"
    @click="$emit('click', pipeline)"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2.5">
        <span :class="['w-2.5 h-2.5 rounded-full flex-shrink-0', statusColor]" :title="statusLabel" />
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{{ pipeline.name }}</h3>
      </div>
      <a
        v-if="pipeline.repo?.url"
        :href="pipeline.repo.url"
        target="_blank"
        rel="noopener"
        class="text-gray-400 hover:text-primary-500 flex-shrink-0"
        @click.stop
      >
        <ExternalLinkIcon :size="14" />
      </a>
    </div>

    <div class="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
      <div class="flex items-center gap-1.5">
        <ClockIcon :size="12" />
        <span>{{ scheduleLabel }}</span>
        <span class="text-gray-300 dark:text-gray-600 mx-0.5">|</span>
        <span>{{ platformLabel }}</span>
      </div>

      <div v-if="pipeline.owner" class="flex items-center gap-1.5">
        <UserIcon :size="12" />
        <span>{{ pipeline.owner }}</span>
      </div>

      <div v-if="skillSummary" class="flex items-center gap-1.5">
        <GitBranchIcon :size="12" />
        <span class="truncate">{{ skillSummary }}</span>
      </div>
    </div>

    <div v-if="pipeline.health?.lastRunAt" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-500 dark:text-gray-400">
          Last run: <span class="font-medium text-gray-700 dark:text-gray-300">{{ lastRunAgo }}</span>
          <span class="text-gray-400 dark:text-gray-500"> — {{ lastRunStatus }}</span>
        </span>
      </div>
      <div v-if="pipeline.health?.successRate != null" class="flex items-center gap-2 text-xs">
        <span class="text-gray-500 dark:text-gray-400">Success rate:</span>
        <div class="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full"
            :class="pipeline.health.successRate >= 80 ? 'bg-emerald-400' : pipeline.health.successRate >= 50 ? 'bg-amber-400' : 'bg-red-400'"
            :style="{ width: pipeline.health.successRate + '%' }"
          />
        </div>
        <span class="font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{{ pipeline.health.successRate }}%</span>
      </div>
      <div v-if="pipeline.health?.queue?.waiting > 0" class="flex items-center gap-1.5 text-xs mt-1">
        <span class="w-2 h-2 rounded-full animate-pulse" :class="pipeline.health.queue.waiting >= 6 ? 'bg-red-500' : 'bg-amber-400'" />
        <span :class="pipeline.health.queue.waiting >= 6 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'">
          {{ pipeline.health.queue.waiting }} queued
        </span>
        <span v-if="pipeline.health.queue.runnerTags?.length" class="text-gray-400 dark:text-gray-500 truncate">
          ({{ pipeline.health.queue.runnerTags.join(', ') }})
        </span>
      </div>
    </div>
  </button>
</template>
