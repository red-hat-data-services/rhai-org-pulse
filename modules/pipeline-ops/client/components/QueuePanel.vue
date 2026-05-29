<script setup>
import { computed } from 'vue'
import { ClockIcon, AlertTriangleIcon, ServerIcon } from 'lucide-vue-next'

const props = defineProps({
  queue: { type: Object, default: null },
  avgQueuedSeconds: { type: Number, default: null },
  maxQueuedSeconds: { type: Number, default: null },
  runs: { type: Array, default: () => [] }
})

function formatDuration(seconds) {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`
}

const waitingSince = computed(() => {
  if (!props.queue?.oldestWaitingSince) return null
  const diff = Date.now() - new Date(props.queue.oldestWaitingSince).getTime()
  return formatDuration(Math.round(diff / 1000))
})

const severityClass = computed(() => {
  const w = props.queue?.waiting || 0
  if (w >= 6) return 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
  if (w >= 1) return 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
  return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
})

const dotClass = computed(() => {
  const w = props.queue?.waiting || 0
  if (w >= 6) return 'bg-red-500'
  if (w >= 1) return 'bg-amber-400'
  return 'bg-emerald-400'
})

const hasData = computed(() =>
  (props.queue?.waiting > 0) || props.avgQueuedSeconds != null
)
</script>

<template>
  <div v-if="hasData" :class="['border rounded-xl p-5', severityClass]">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
      <ServerIcon :size="14" />
      Runner Queue
    </h3>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Waiting now -->
      <div v-if="queue?.waiting > 0">
        <div class="flex items-center gap-1.5 mb-1">
          <span :class="['w-2 h-2 rounded-full animate-pulse', dotClass]" />
          <span class="text-xs text-gray-500 dark:text-gray-400">Waiting now</span>
        </div>
        <div class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ queue.waiting }}</div>
        <div v-if="queue.runnerTags?.length" class="mt-1 flex flex-wrap gap-1">
          <span
            v-for="tag in queue.runnerTags"
            :key="tag"
            class="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
          >{{ tag }}</span>
        </div>
      </div>

      <!-- Longest wait -->
      <div v-if="waitingSince">
        <div class="flex items-center gap-1.5 mb-1">
          <AlertTriangleIcon :size="12" class="text-amber-500" />
          <span class="text-xs text-gray-500 dark:text-gray-400">Longest wait</span>
        </div>
        <div class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ waitingSince }}</div>
      </div>

      <!-- Avg queue time (completed jobs) -->
      <div v-if="avgQueuedSeconds != null">
        <div class="flex items-center gap-1.5 mb-1">
          <ClockIcon :size="12" class="text-gray-400" />
          <span class="text-xs text-gray-500 dark:text-gray-400">Avg wait</span>
        </div>
        <div class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ formatDuration(avgQueuedSeconds) }}</div>
      </div>

      <!-- Max queue time (completed jobs) -->
      <div v-if="maxQueuedSeconds != null">
        <div class="flex items-center gap-1.5 mb-1">
          <ClockIcon :size="12" class="text-gray-400" />
          <span class="text-xs text-gray-500 dark:text-gray-400">Max wait</span>
        </div>
        <div class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ formatDuration(maxQueuedSeconds) }}</div>
      </div>
    </div>
  </div>
</template>
