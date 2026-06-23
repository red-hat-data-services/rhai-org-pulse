<script setup>
import { onMounted, inject } from 'vue'
import { ShieldCheckIcon } from 'lucide-vue-next'
import { useDisconnectedReadiness } from '../composables/useDisconnectedReadiness.js'
import ReadinessSummaryCards from '../components/ReadinessSummaryCards.vue'
import ReadinessTable from '../components/ReadinessTable.vue'

const nav = inject('moduleNav')
const {
  summary, loading, error,
  readyCount, notReadyCount, totalRepos, readinessPercent,
  loadSummary, formatRelativeTime
} = useDisconnectedReadiness()

onMounted(() => { loadSummary() })

function viewRepoDetail(repoKey) {
  nav.navigateTo('disconnected-repo-detail', { repo: repoKey })
}

</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Disconnected environment readiness for tracked ODH repositories.
    </p>

    <ReadinessSummaryCards
      v-if="!loading"
      :totalRepos="totalRepos"
      :readyCount="readyCount"
      :notReadyCount="notReadyCount"
      :readinessPercent="readinessPercent"
    />

    <div v-if="loading" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5">
        <div class="animate-pulse">
          <div class="flex items-center gap-3 mb-3">
            <div class="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            <div class="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div class="h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div class="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    </div>

    <div v-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">{{ error }}</div>

    <ReadinessTable
      v-if="!loading && summary && summary.repos?.length"
      :repos="summary.repos"
      @select-repo="viewRepoDetail"
    />

    <div v-if="loading" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div class="animate-pulse h-7 w-56 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="i in 5" :key="i" class="px-4 py-3 animate-pulse flex items-center gap-4">
          <div class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded" />
          <div class="ml-auto h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && (!summary || !summary.repos?.length)" class="text-center py-12">
      <ShieldCheckIcon class="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <p class="text-gray-500 dark:text-gray-400">No disconnected readiness data available yet.</p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Data is pushed from the disconnected readiness scanner pipeline.</p>
    </div>

    <p v-if="summary?.lastSyncedAt" class="text-xs text-gray-400 dark:text-gray-500 text-right">
      Last updated: {{ formatRelativeTime(summary.lastSyncedAt) }}
    </p>
  </div>
</template>
