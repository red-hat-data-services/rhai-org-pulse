<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200"
    :class="{ 'cursor-pointer': clickable }"
    @click="$emit('click')"
  >
    <!-- Row 1: Name + active contributors -->
    <div class="flex items-start justify-between mb-4">
      <div class="min-w-0">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{{ name }}</h3>
        <a
          :href="`https://github.com/${githubOrg}/${githubRepo}`"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 mt-0.5"
          @click.stop
        >
          {{ githubOrg }}/{{ githubRepo }}
          <ExternalLinkIcon :size="12" />
        </a>
      </div>
      <div v-if="activeContributors > 0" class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">
        <UsersIcon :size="14" />
        <span>{{ activeContributors }}</span>
      </div>
    </div>

    <!-- Row 2: Team contributions + team share -->
    <div class="flex items-baseline gap-2 mb-3">
      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {{ teamTotal.toLocaleString() }}
      </span>
      <span class="text-sm text-gray-500 dark:text-gray-400">Team Contributions</span>
    </div>

    <div class="mb-4">
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="text-gray-500 dark:text-gray-400">Team's share</span>
        <span class="font-medium text-gray-700 dark:text-gray-300">{{ teamPercent.toFixed(1) }}%</span>
      </div>
      <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
        <div
          class="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
          :style="{ width: Math.min(teamPercent, 100) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Row 3: Contribution type breakdown -->
    <div class="grid grid-cols-4 gap-2">
      <div v-for="t in types" :key="t.key" class="text-center">
        <div class="inline-flex items-center justify-center w-7 h-7 rounded-md mb-1" :class="t.bg">
          <component :is="t.icon" :size="14" :class="t.color" />
        </div>
        <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{{ t.value }}</p>
        <p class="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{{ t.label }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  ExternalLink as ExternalLinkIcon,
  Users as UsersIcon,
  GitCommit as GitCommitIcon,
  GitPullRequest as GitPullRequestIcon,
  MessageSquare as MessageSquareIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-vue-next'

defineEmits(['click'])

const props = defineProps({
  name: { type: String, default: '' },
  githubOrg: { type: String, default: '' },
  githubRepo: { type: String, default: '' },
  contributions: { type: Object, default: () => ({}) },
  activeContributors: { type: Number, default: 0 },
  clickable: { type: Boolean, default: false },
})

const teamTotal = computed(() => props.contributions?.all?.team || 0)
const teamPercent = computed(() => props.contributions?.all?.teamPercent || 0)

const types = computed(() => [
  { key: 'commits', label: 'Commits', icon: GitCommitIcon, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', value: props.contributions?.commits?.team || 0 },
  { key: 'prs', label: 'PRs', icon: GitPullRequestIcon, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', value: props.contributions?.pullRequests?.team || 0 },
  { key: 'reviews', label: 'Reviews', icon: MessageSquareIcon, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', value: props.contributions?.reviews?.team || 0 },
  { key: 'issues', label: 'Issues', icon: AlertCircleIcon, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', value: props.contributions?.issues?.team || 0 },
])
</script>
