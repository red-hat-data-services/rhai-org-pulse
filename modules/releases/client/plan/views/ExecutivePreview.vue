<script setup>
import { onMounted, computed } from 'vue'
import { useFeatureScheduling } from '../composables/useFeatureScheduling'
import PlacementSummaryCards from '../components/PlacementSummaryCards.vue'
import { bigRockStatusLabel } from '../ai-planner/core.js'
import { BIG_ROCKS } from '../ai-planner/constants.js'

// Stage 1c preview -- native Vue rebuild of the AI Planner iframe's Executive tab
// (renderExecView(), public/ai-first-scheduler/index.html lines 4363-4466).
// Not wired into any nav item; reachable only via #/releases/executive-preview
// for local QA. See AI-PLANNER-HANDOFF.md and the Nov 3 2026 migration plan.
//
// Per Nov 10 guidance: production (PR #1877, not yet merged) is dropping the
// Roadmap tab -- it duplicated this tab's outcomes table -- and relocating
// Roadmap's EA1/EA2/GA/No summary cards + release selector into Executive. This
// view folds that relocation in directly rather than porting Roadmap separately
// (RoadmapPreview.vue from earlier in stage 1c is kept but is no longer the
// target shape; see PR #1877 for the source of truth once it merges).
//
// All of the numbers below (confidence, outcomes coverage, in-plan counts,
// work mix) are computed from `displayRows` -- i.e. they honor the shared
// filter bar/release selector, matching index.html's own Nov 3 fix (lines
// 4364-4366: "previously this always summarized every feature regardless of
// filters"). The release <select> here reads/writes the same `filters.rel` the
// Feature Scheduling preview uses, since both views share one composable
// instance -- picking a release on either page narrows both.
//
// NOT ported: the "CVE load by owner" table (renderCveReserve(), index.html
// lines 4327-4361) -- it needs `cveReserve` plumbed through from the API
// response, which this composable doesn't fetch yet. The static "Quality
// Capacity Model" box (hardcoded 20%/5%/75%) is kept since it's plain text.

const {
  scheduledRows,
  displayRows,
  filters,
  filterMeta,
  filteredPlacementCounts,
  deliveryConfidenceSummary,
  workMix,
  outcomesStats,
  loading,
  error,
  loadFeatures
} = useFeatureScheduling()

onMounted(loadFeatures)

function updateRelease(event) {
  filters.value = { ...filters.value, rel: event.target.value }
}

const confColor = computed(() => {
  const avg = deliveryConfidenceSummary.value.avgConf
  return avg >= 70 ? '#4ade80' : avg >= 50 ? '#fbbf24' : '#f87171'
})

const WORK_MIX_LABELS = { features: 'New Features', bugs: 'Bugs / CVEs / Tech Debt', research: 'Research / Spikes' }
const WORK_MIX_COLORS = { features: '#60a5fa', bugs: '#f87171', research: '#4ade80' }

const outcomeRows = computed(() => BIG_ROCKS.map(br => {
  const stats = outcomesStats.value.stats[br.name] || { inPlan: 0, total: 0, avgConf: 0 }
  return {
    name: br.name,
    pillar: br.pillar,
    priority: br.priority,
    inPlan: stats.inPlan,
    total: stats.total,
    avgConf: stats.avgConf,
    status: bigRockStatusLabel(stats.inPlan, stats.avgConf)
  }
}).sort((a, b) => a.priority - b.priority))

function statusClass(status) {
  switch (status) {
    case 'Confident': return 'text-green-700 dark:text-green-300'
    case 'Lagging': return 'text-amber-700 dark:text-amber-300'
    case 'At Risk': return 'text-red-700 dark:text-red-300'
    default: return 'text-gray-400 dark:text-gray-500'
  }
}
</script>

<template>
  <div class="space-y-0 overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Executive (preview)
        <span class="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">{{ scheduledRows.length }} features loaded</span>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-xs font-medium text-gray-600 dark:text-gray-400">Release</label>
        <select
          :value="filters.rel"
          @change="updateRelease"
          class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100"
        >
          <option value="">All releases</option>
          <option v-for="v in filterMeta.versions" :key="v" :value="v">{{ v }}</option>
        </select>
      </div>
    </div>

    <div v-if="error" role="alert" class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <div class="p-4 space-y-4" v-if="displayRows.length">
      <PlacementSummaryCards :counts="filteredPlacementCounts" />

      <!-- Dark delivery-summary banner -->
      <div class="rounded-lg p-5 text-white" style="background: linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)">
        <div class="text-xs font-bold tracking-widest mb-4" style="color:#7ec8e3">EXECUTIVE DELIVERY SUMMARY</div>
        <div class="grid grid-cols-4 gap-4">
          <div class="rounded-md px-4 py-3 text-center" style="background: rgba(255,255,255,.07)">
            <div class="text-2xl font-extrabold" :style="{ color: confColor }">{{ deliveryConfidenceSummary.avgConf }}%</div>
            <div class="text-[11px] font-bold my-0.5" :style="{ color: confColor }">{{ deliveryConfidenceSummary.confLabel }}</div>
            <div class="text-[10px] text-gray-400">Delivery Confidence</div>
          </div>
          <div class="rounded-md px-4 py-3 text-center" style="background: rgba(255,255,255,.07)">
            <div class="text-2xl font-extrabold" style="color:#7ec8e3">{{ outcomesStats.coveredOutcomes }}<span class="text-sm text-gray-400">/{{ outcomeRows.length }}</span></div>
            <div class="text-[11px] font-bold my-0.5" :class="outcomesStats.gappedOutcomes > 0 ? 'text-amber-400' : ''" :style="outcomesStats.gappedOutcomes > 0 ? '' : 'color:#7ec8e3'">
              {{ outcomesStats.gappedOutcomes > 0 ? outcomesStats.gappedOutcomes + ' gapped' : 'All covered' }}
            </div>
            <div class="text-[10px] text-gray-400">Outcomes</div>
          </div>
          <div class="rounded-md px-4 py-3 text-center" style="background: rgba(255,255,255,.07)">
            <div class="text-2xl font-extrabold">{{ deliveryConfidenceSummary.totalInPlan }}<span class="text-sm text-gray-400">/{{ deliveryConfidenceSummary.total }}</span></div>
            <div class="text-[11px] font-bold my-0.5 text-gray-400">{{ deliveryConfidenceSummary.total - deliveryConfidenceSummary.totalInPlan }} below cut</div>
            <div class="text-[10px] text-gray-400">Features In Plan</div>
          </div>
          <div class="rounded-md px-4 py-3 text-center" style="background: rgba(255,100,50,.12); border: 1px solid rgba(255,120,60,.3)">
            <div class="text-2xl font-extrabold" style="color:#ff8a65">25%</div>
            <div class="text-[11px] font-bold my-0.5" style="color:#ff8a65">CVE 20% + Embargoed 5%</div>
            <div class="text-[10px] text-gray-400">Quality Reserve</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-2">Quality Capacity Model</div>
          <div class="text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
            <div class="flex justify-between border-b border-gray-50 dark:border-gray-800 py-1"><span>CVE reserve (daily scans -&gt; blocker Jira)</span><span class="font-bold text-red-600">-20%</span></div>
            <div class="flex justify-between border-b border-gray-50 dark:border-gray-800 py-1"><span>Embargoed security issues (invisible until lifted)</span><span class="font-bold text-orange-600">-5%</span></div>
            <div class="flex justify-between border-t-2 border-gray-200 dark:border-gray-700 pt-1.5"><span class="font-bold">Net available capacity</span><span class="font-extrabold text-green-700 dark:text-green-400 text-sm">75%</span></div>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 mb-2">Work Mix (In-Plan)</div>
          <div v-for="item in workMix" :key="item.key" class="mb-2">
            <div class="flex justify-between text-[10px] mb-0.5">
              <span class="font-semibold" :style="{ color: WORK_MIX_COLORS[item.key] }">{{ WORK_MIX_LABELS[item.key] }}</span>
              <span class="text-gray-500 dark:text-gray-400">{{ item.count }} &middot; {{ item.pct }}% <span :class="item.onTarget ? 'text-green-600' : 'text-red-600'">(target {{ item.target }}%)</span></span>
            </div>
            <div class="h-2 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div class="h-full rounded opacity-75" :style="{ width: Math.min(item.pct, 100) + '%', background: WORK_MIX_COLORS[item.key] }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Outcomes table -- read-only summary (ranking/editing now lives in the
           separate "Prioritized Outcomes" view at #/releases/plan?tab=jira-plan) -->
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div class="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200 px-4 py-2 border-b border-gray-200 dark:border-gray-700">Outcomes</div>
        <table class="w-full text-xs">
          <thead class="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th class="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase">Outcome</th>
              <th class="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase">Pillar</th>
              <th class="text-center px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase">In Plan</th>
              <th class="text-center px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase">Avg Confidence</th>
              <th class="text-left px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in outcomeRows" :key="row.name" class="border-b border-gray-50 dark:border-gray-800">
              <td class="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{{ row.name }}</td>
              <td class="px-3 py-2 text-gray-500 dark:text-gray-400">{{ row.pillar }}</td>
              <td class="px-3 py-2 text-center">{{ row.inPlan }}/{{ row.total }}</td>
              <td class="px-3 py-2 text-center">{{ row.inPlan ? row.avgConf + '%' : '—' }}</td>
              <td class="px-3 py-2 font-medium" :class="statusClass(row.status)">{{ row.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else-if="!loading" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No features loaded</div>
  </div>
</template>
