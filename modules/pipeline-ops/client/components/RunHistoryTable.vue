<script setup>
import { computed } from 'vue'
import { ExternalLinkIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon, ClockIcon, LoaderIcon } from 'lucide-vue-next'

const props = defineProps({
  runs: { type: Array, default: () => [] }
})

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds) {
  if (seconds == null) return '—'
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`
}

function queueWait(run) {
  if (run.queuedSeconds) return run.queuedSeconds
  if (run.status === 'waiting_for_resource' && run.createdAt) {
    return Math.round((Date.now() - new Date(run.createdAt).getTime()) / 1000)
  }
  return null
}

function queueClass(seconds) {
  if (seconds == null) return ''
  if (seconds > 3600) return 'text-red-500'
  if (seconds > 600) return 'text-amber-500'
  return 'text-gray-500 dark:text-gray-400'
}

const statusIcon = {
  success: CheckCircleIcon,
  failed: XCircleIcon,
  waiting_for_resource: ClockIcon,
  running: LoaderIcon,
}

const statusColor = {
  success: 'text-emerald-500',
  failed: 'text-red-500',
  waiting_for_resource: 'text-amber-500',
  running: 'text-blue-500',
}

const displayRuns = computed(() => props.runs.slice(0, 50))
const hasQueueData = computed(() => props.runs.some(r => r.queuedSeconds || r.status === 'waiting_for_resource'))
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-xs">
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
          <th class="text-left py-2 pr-3 font-medium">Status</th>
          <th class="text-left py-2 pr-3 font-medium">Job</th>
          <th class="text-left py-2 pr-3 font-medium">Started</th>
          <th class="text-right py-2 pr-3 font-medium">Duration</th>
          <th v-if="hasQueueData" class="text-right py-2 pr-3 font-medium">Wait</th>
          <th class="text-left py-2 pr-3 font-medium">Ref</th>
          <th class="text-right py-2 font-medium">Link</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="run in displayRuns"
          :key="run.id"
          class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <td class="py-1.5 pr-3">
            <component
              :is="statusIcon[run.status] || MinusCircleIcon"
              :size="14"
              :class="[statusColor[run.status] || 'text-gray-400', run.status === 'running' ? 'animate-spin' : '']"
            />
          </td>
          <td class="py-1.5 pr-3 text-gray-700 dark:text-gray-300 font-medium">{{ run.job }}</td>
          <td class="py-1.5 pr-3 text-gray-500 dark:text-gray-400">
            {{ run.status === 'waiting_for_resource' ? formatDate(run.createdAt) : formatDate(run.startedAt) }}
            <span v-if="run.status === 'waiting_for_resource'" class="text-amber-500 ml-1">(queued)</span>
          </td>
          <td class="py-1.5 pr-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{{ formatDuration(run.durationSeconds) }}</td>
          <td v-if="hasQueueData" class="py-1.5 pr-3 text-right tabular-nums" :class="queueClass(queueWait(run))">
            {{ formatDuration(queueWait(run)) }}
          </td>
          <td class="py-1.5 pr-3 text-gray-400">
            <code class="text-[10px]">{{ run.ref }}</code>
          </td>
          <td class="py-1.5 text-right">
            <a
              v-if="run.webUrl"
              :href="run.webUrl"
              target="_blank"
              rel="noopener"
              class="text-gray-400 hover:text-primary-500"
            >
              <ExternalLinkIcon :size="12" />
            </a>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="displayRuns.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-4">No runs recorded yet.</p>
  </div>
</template>
