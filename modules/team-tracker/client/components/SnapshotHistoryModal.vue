<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h2>
        <button @click="$emit('close')" class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="snapshots.length === 0" class="text-center py-12 px-6">
        <p class="text-gray-500 dark:text-gray-400">No snapshot history available yet. Snapshots are generated every 30 days starting Jan 1, 2026.</p>
      </div>

      <!-- Table -->
      <div v-else class="overflow-auto flex-1 px-6">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white dark:bg-gray-800">
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Period</th>
              <th class="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Issues Resolved</th>
              <th class="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Story Points</th>
              <th class="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">In Progress</th>
              <th class="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Avg Cycle Time</th>
              <th class="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">GitHub</th>
              <th class="text-right py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">GitLab</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(snapshot, idx) in displaySnapshots"
              :key="snapshot.periodStart"
              class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td class="py-2 px-2 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {{ formatPeriod(snapshot.periodStart, snapshot.periodEnd) }}
              </td>
              <td class="py-2 px-2 text-right whitespace-nowrap">
                <span class="text-gray-700 dark:text-gray-300">{{ metrics(snapshot).resolvedCount }}</span>
                <TrendArrow :current="metrics(snapshot).resolvedCount" :previous="prevMetrics(idx)?.resolvedCount" />
              </td>
              <td class="py-2 px-2 text-right whitespace-nowrap">
                <span class="text-gray-700 dark:text-gray-300">{{ metrics(snapshot).resolvedPoints }}</span>
                <TrendArrow :current="metrics(snapshot).resolvedPoints" :previous="prevMetrics(idx)?.resolvedPoints" />
              </td>
              <td class="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{{ metrics(snapshot).inProgressCount }}</td>
              <td class="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                {{ metrics(snapshot).avgCycleTimeDays != null ? metrics(snapshot).avgCycleTimeDays + 'd' : '--' }}
              </td>
              <td class="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                <template v-if="mode === 'person' && metrics(snapshot).hasGithub === false">
                  <span class="text-gray-400 dark:text-gray-500 text-xs italic">No GitHub username</span>
                </template>
                <template v-else>{{ metrics(snapshot).githubContributions }}</template>
              </td>
              <td class="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                <template v-if="mode === 'person' && metrics(snapshot).hasGitlab === false">
                  <span class="text-gray-400 dark:text-gray-500 text-xs italic">No GitLab username</span>
                </template>
                <template v-else>{{ metrics(snapshot).gitlabContributions }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div v-if="snapshots.length > 0" class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
        {{ snapshots.length }} snapshot{{ snapshots.length !== 1 ? 's' : '' }}
        | 30-day periods starting Jan 1, 2026
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TrendArrow from './TrendArrow.vue'

const props = defineProps({
  title: { type: String, default: 'Metric History' },
  snapshots: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  mode: { type: String, default: 'team' } // 'team' or 'person'
})

defineEmits(['close'])

// Reverse so most recent is first
const displaySnapshots = computed(() => [...props.snapshots].reverse())

function metrics(snapshot) {
  if (props.mode === 'person') {
    return snapshot.metrics || {}
  }
  return snapshot.team || {}
}

function prevMetrics(displayIdx) {
  const prev = displaySnapshots.value[displayIdx + 1]
  if (!prev) return null
  return metrics(prev)
}

function formatPeriod(start, end) {
  const s = new Date(start + 'T00:00:00Z')
  const e = new Date(end + 'T00:00:00Z')
  const opts = { month: 'short', day: 'numeric' }
  const startStr = s.toLocaleDateString('en-US', opts)
  const endStr = e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${startStr} - ${endStr}`
}
</script>
