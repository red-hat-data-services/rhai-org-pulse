<script setup>
import { computed } from 'vue'
import StatusInfoPopover from './StatusInfoPopover.vue'

var props = defineProps({
  features: { type: Array, default: () => [] },
  colspan: { type: Number, default: 7 },
  loading: { type: Boolean, default: false },
  rockName: { type: String, default: '' },
  releasePhaseMode: { type: String, default: 'unknown' }
})

var isPlanningMode = computed(function() {
  return props.releasePhaseMode === 'planning'
})

var DOT_CLASS = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500'
}

var PLANNING_STATUS_LABELS = {
  'not-ready': 'Not Ready',
  'in-planning': 'In Planning',
  'ready-for-execution': 'Ready'
}

var PLANNING_STATUS_CLASSES = {
  'not-ready': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  'in-planning': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'ready-for-execution': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
}

function truncate(text, max) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '...' : text
}

var RELEASE_TYPE_STYLES = {
  DP: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  TP: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  GA: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
}

function releaseTypeBadgeClass(rt) {
  return RELEASE_TYPE_STYLES[rt] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

function completionBarColor(pct) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

</script>

<template>
  <td :colspan="colspan" class="p-0 border border-gray-300 dark:border-gray-600 border-t-2 border-t-primary-200 dark:border-t-primary-700 bg-gray-50 dark:bg-gray-900/40">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-6 gap-2 text-gray-500 dark:text-gray-400 text-xs">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading feature health...
    </div>

    <!-- Empty / error state -->
    <div v-else-if="!features || features.length === 0" class="py-6 text-center text-gray-500 dark:text-gray-400 text-xs">
      No feature health data available
    </div>

    <!-- Feature detail table -->
    <div v-else class="p-3 max-h-80 overflow-y-auto" role="region" :aria-label="'Feature health details for ' + rockName">
      <table class="w-full text-xs">
        <thead>
          <tr>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Feature</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Summary</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">
              Status
              <StatusInfoPopover />
            </th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Owner</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Release Type</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Target</th>
            <th class="px-2 py-1 text-left text-gray-600 dark:text-gray-400 font-semibold">Fix Version</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="f in features"
            :key="f.key"
            class="odd:bg-white dark:odd:bg-gray-800/30 even:bg-gray-50 dark:even:bg-gray-900/20"
          >
            <td class="px-2 py-1.5">
              <span class="inline-flex items-center gap-1.5">
                <span
                  class="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  :class="DOT_CLASS[f.level] || DOT_CLASS.green"
                  role="img"
                  :aria-label="'Risk level: ' + f.level"
                ></span>
                <a
                  v-if="f.jiraUrl"
                  :href="f.jiraUrl"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-600 dark:text-blue-400 font-mono hover:underline"
                  @click.stop
                >{{ f.key }}</a>
                <span v-else class="font-mono text-gray-700 dark:text-gray-300">{{ f.key }}</span>
              </span>
              <span v-if="f.override" class="ml-1 text-[9px] text-amber-600 dark:text-amber-400" title="Risk level manually overridden">M</span>
              <span v-if="f.bigRock && f.bigRock.includes(', ')" class="ml-1 text-[9px] text-indigo-600 dark:text-indigo-400" :title="'Shared across: ' + f.bigRock">S</span>
            </td>
            <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[250px]">
              <span :title="f.summary">{{ truncate(f.summary, 60) }}</span>
            </td>
            <td class="px-2 py-1.5">
              <!-- Planning mode: existing badge -->
              <template v-if="isPlanningMode">
                <span
                  v-if="f.planningStatus"
                  class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                  :class="PLANNING_STATUS_CLASSES[f.planningStatus] || ''"
                >{{ PLANNING_STATUS_LABELS[f.planningStatus] || f.planningStatus }}</span>
                <span v-if="f.planningChecks" class="ml-1 text-[10px] text-gray-500 dark:text-gray-400">
                  {{ f.planningChecks.passedCount }}/{{ f.planningChecks.totalCount }}
                </span>
              </template>
              <!-- Execution mode: completion bar -->
              <template v-else>
                <div class="inline-flex items-center gap-1.5">
                  <div class="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div class="h-full rounded-full" :style="{ width: f.completionPct + '%' }" :class="completionBarColor(f.completionPct)" />
                  </div>
                  <span class="text-[10px] font-semibold">{{ f.completionPct }}%</span>
                </div>
              </template>
            </td>
            <td class="px-2 py-1.5 text-gray-600 dark:text-gray-400">
              {{ f.deliveryOwner || '-' }}
            </td>
            <td class="px-2 py-1.5">
              <span
                v-if="f.releaseType && ['DP', 'TP', 'GA'].includes(f.releaseType)"
                class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                :class="releaseTypeBadgeClass(f.releaseType)"
              >{{ f.releaseType }}</span>
              <span v-else class="text-gray-400 text-[10px]">--</span>
            </td>
            <td class="px-2 py-1.5">
              <span v-if="f.targetRelease" class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                {{ f.targetRelease }}
              </span>
              <span v-else class="text-gray-400 text-[10px]">--</span>
            </td>
            <td class="px-2 py-1.5">
              <div v-if="f.fixVersions" class="flex flex-wrap gap-0.5">
                <span
                  v-for="fv in f.fixVersions.split(', ').filter(Boolean)"
                  :key="fv"
                  class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                >{{ fv }}</span>
              </div>
              <span v-else class="inline-flex items-center gap-0.5 text-amber-500 dark:text-amber-400 text-[10px]">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                --
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </td>
</template>
