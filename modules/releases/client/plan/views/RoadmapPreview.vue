<script setup>
import { onMounted } from 'vue'
import { useFeatureScheduling } from '../composables/useFeatureScheduling'
import { roadmapCellColor } from '../ai-planner/core.js'

// Stage 1c preview -- native Vue rebuild of the AI Planner iframe's Roadmap tab
// (renderRoadmapTimeline(), public/ai-first-scheduler/index.html lines 3287-3353).
// Not wired into any nav item; reachable only via #/releases/roadmap-preview for
// local QA. See AI-PLANNER-HANDOFF.md and the Nov 3 2026 migration plan.
//
// Known gap (inherited from aggregateRoadmapGrid(), not introduced here): the live
// ~22-outcome list (GET /ai-planner/outcomes) isn't wired up, so this always groups
// by the BIG_ROCKS fallback names, and Status isn't populated on API rows, so every
// in-grid feature shows as "not started".

const { scheduledRows, roadmapRows, roadmapDrilldown, showRoadmapDrilldown, clearRoadmapDrilldown, loading, error, loadFeatures } = useFeatureScheduling()

onMounted(loadFeatures)

const PHASES = ['EA1', 'EA2', 'GA']

function cellStats(cell) {
  if (!cell.c) return null
  return {
    avg: Math.round(cell.s / cell.c),
    notStarted: cell.c - cell.done - cell.wip
  }
}

function isActiveDrilldown(name, phase) {
  return !!roadmapDrilldown.value && roadmapDrilldown.value.name === name && roadmapDrilldown.value.phase === phase
}
</script>

<template>
  <div class="space-y-0 overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Roadmap (preview)
        <span class="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">{{ scheduledRows.length }} features loaded</span>
      </div>
    </div>

    <div v-if="error" role="alert" class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <div class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
      Outcome x Release Phase — shows only outcomes with at least one feature. Count + avg AI delivery confidence per cell. Click a cell with features to see them.
    </div>

    <div class="overflow-x-auto px-4 pb-4">
      <table role="table" class="w-full text-xs border-collapse">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="text-left px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase">Outcome</th>
            <th class="text-center px-2 py-2 font-semibold text-blue-700 dark:text-blue-300 uppercase">EA1</th>
            <th class="text-center px-2 py-2 font-semibold text-indigo-700 dark:text-indigo-300 uppercase">EA2</th>
            <th class="text-center px-2 py-2 font-semibold text-green-700 dark:text-green-300 uppercase">GA</th>
            <th class="text-center px-2 py-2 font-semibold text-red-700 dark:text-red-300 uppercase">Not Planned</th>
          </tr>
        </thead>
        <tbody v-if="!loading && roadmapRows.length">
          <tr v-for="row in roadmapRows" :key="row.name" class="border-b border-gray-100 dark:border-gray-800">
            <td class="px-2 py-2 font-semibold whitespace-nowrap text-gray-800 dark:text-gray-100">{{ row.displayName }}</td>
            <td
              v-for="phase in PHASES"
              :key="phase"
              class="text-center px-2 py-2"
              :class="[row.phases[phase].c ? 'cursor-pointer' : '', isActiveDrilldown(row.name, phase) ? 'ring-2 ring-inset ring-primary-500' : '']"
              :style="{ background: roadmapCellColor(row.phases[phase].c, row.phases[phase].c ? row.phases[phase].s / row.phases[phase].c : 0) }"
              @click="row.phases[phase].c && showRoadmapDrilldown(row.name, phase)"
            >
              <template v-if="row.phases[phase].c">
                <div class="font-bold">{{ row.phases[phase].c }}</div>
                <div class="text-gray-600 dark:text-gray-300">{{ cellStats(row.phases[phase]).avg }}% avg</div>
                <div class="text-[9px] text-gray-500 dark:text-gray-400">
                  ✅{{ row.phases[phase].done }} 🔄{{ row.phases[phase].wip }} ○{{ cellStats(row.phases[phase]).notStarted }}
                </div>
              </template>
              <span v-else class="text-gray-300 dark:text-gray-600">—</span>
            </td>
            <td
              class="text-center px-2 py-2"
              :class="[row.phases.No.c ? 'cursor-pointer' : '', isActiveDrilldown(row.name, 'No') ? 'ring-2 ring-inset ring-primary-500' : '']"
              :style="{ background: row.phases.No.c ? '#ffebee' : '#fafafa' }"
              @click="row.phases.No.c && showRoadmapDrilldown(row.name, 'No')"
            >
              <template v-if="row.phases.No.c">
                <div class="font-bold">{{ row.phases.No.c }}</div>
                <div class="text-gray-600 dark:text-gray-300">{{ cellStats(row.phases.No).avg }}% avg</div>
                <div class="text-[9px] text-gray-500 dark:text-gray-400">
                  ✅{{ row.phases.No.done }} 🔄{{ row.phases.No.wip }} ○{{ cellStats(row.phases.No).notStarted }}
                </div>
              </template>
              <span v-else class="text-gray-300 dark:text-gray-600">—</span>
            </td>
          </tr>
        </tbody>
        <tbody v-else-if="!loading">
          <tr><td colspan="5" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No outcomes with in-scope features</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="roadmapDrilldown" class="mx-4 mb-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs font-semibold text-gray-700 dark:text-gray-200">
          {{ roadmapDrilldown.name }} · {{ roadmapDrilldown.phase }} · {{ roadmapDrilldown.feats.length }} feature{{ roadmapDrilldown.feats.length !== 1 ? 's' : '' }}
        </div>
        <button type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="clearRoadmapDrilldown">✕</button>
      </div>
      <div v-for="f in roadmapDrilldown.feats" :key="f.key" class="flex items-baseline gap-2 py-1 border-b border-gray-50 dark:border-gray-800 text-xs">
        <a :href="'https://redhat.atlassian.net/browse/' + f.key" target="_blank" rel="noopener noreferrer" class="font-mono text-primary-600 dark:text-blue-400 hover:underline whitespace-nowrap">{{ f.key }}</a>
        <span class="flex-1 text-gray-700 dark:text-gray-300 truncate">{{ f.title }}</span>
        <span class="font-semibold text-gray-500 dark:text-gray-400">{{ f.conf }}%</span>
      </div>
    </div>
  </div>
</template>
