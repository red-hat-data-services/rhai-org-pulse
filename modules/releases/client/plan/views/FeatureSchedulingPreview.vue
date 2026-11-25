<script setup>
import { onMounted } from 'vue'
import { useFeatureScheduling } from '../composables/useFeatureScheduling'
import FeatureSchedulingFilterBar from '../components/FeatureSchedulingFilterBar.vue'
import FeatureSchedulingRow from '../components/FeatureSchedulingRow.vue'
import { buildFeatureSchedulingCsv } from '../ai-planner/core.js'

// Native Vue rebuild of the AI Planner iframe's Feature Scheduling tab
// (public/ai-first-scheduler/index.html). As of the Nov 11 2026 cutover, this
// is the real Feature Scheduling sub-tab rendered by AIPlanner.vue -- the
// iframe is no longer used for this tab. See AI-PLANNER-HANDOFF.md and the
// Nov 3 2026 migration plan.

const {
  displayRows,
  loading,
  error,
  lastSyncedAt,
  dataSource,
  filters,
  filterMeta,
  sortCol,
  sortAsc,
  setSort,
  resetFilters,
  pmReviewStatus,
  urgentFilterKeys,
  applyUrgentFilter,
  clearUrgentFilter,
  loadFeatures
} = useFeatureScheduling()

onMounted(loadFeatures)

function sortIndicator(col) {
  if (sortCol.value !== col) return ''
  return sortAsc.value ? '▲' : '▼'
}

// Nov 24 2026: Approval checkboxes removed (not in local/iframe version)

// index.html's doExport() (PR #1877) -- exports the currently filtered/sorted
// rows (window._lastFilteredRows there, displayRows here), not the full dataset.
function exportCsv() {
  const csv = buildFeatureSchedulingCsv(displayRows.value)
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: 'feature-scheduling-export.csv'
  })
  a.click()
}

// index.html's scrollToFirstUnchecked() (line 3604-3609), ported 1:1 as a DOM
// method since this is view-layer behavior, not pure calculation logic.
function scrollToFirstUnchecked() {
  const inputs = document.querySelectorAll('#feature-scheduling-tbody input[data-approval-pm]')
  for (const input of inputs) {
    if (!input.checked) {
      input.closest('tr')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
  }
}

// Horizontal table scroll navigation (Nov 24 2026)
function scrollTableLeft() {
  const wrap = document.querySelector('#feature-scheduling-wrap')
  if (wrap) wrap.scrollLeft -= 200
}

function scrollTableRight() {
  const wrap = document.querySelector('#feature-scheduling-wrap')
  if (wrap) wrap.scrollLeft += 200
}

const headers = [
  // Nov 24 2026: Reordered to match iframe (public/ai-first-scheduler/index.html)
  // Columns: # (rank), FPDoR, Risk, Confidence, Priority, OC#, Feature Key, Title, Outcome, Target Version, Fix Version, Components, Size, Team
  { id: 'h-fpdor', label: 'FPDOR', sortKey: 'FPDoR' },
  { id: 'h-risk', label: 'Risk' },
  { id: 'h-conf', label: 'Confidence', sortKey: '_conf' },
  { id: 'h-pri', label: 'Priority', sortKey: 'Priority' },
  { id: 'h-oc', label: 'OC#', sortKey: 'OutcomeNumber' },
  { id: 'h-key', label: 'Feature Key', sortKey: 'Key' },
  { id: 'h-title', label: 'Title', sortKey: 'Title' },
  { id: 'h-outcome', label: 'Outcome' },
  { id: 'h-tv', label: 'Target Version' },
  { id: 'h-fv', label: 'Fix Version' },
  { id: 'h-comp', label: 'Components' },
  { id: 'h-team', label: 'Team' }
]
</script>

<template>
  <div class="space-y-0 overflow-hidden">

    <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Feature Scheduling
        <span class="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
          {{ displayRows.length }} shown{{ dataSource !== 'live' ? ' (' + dataSource + ' data)' : '' }}
        </span>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="lastSyncedAt" class="text-xs text-gray-400 dark:text-gray-500">
          Last synced: {{ new Date(lastSyncedAt).toLocaleString() }}
        </span>
        <button
          type="button"
          @click="exportCsv"
          title="Export the currently filtered/sorted features to CSV, including FPDoR readiness details"
          class="px-2 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >⬇ Export CSV</button>
      </div>
    </div>

    <!-- Placement summary cards removed Nov 24 2026 (use column order from iframe instead) -->
    <!-- <PlacementSummaryCards :counts="placementCounts" :recommendedCount="recommendedCount" /> -->

    <!-- PM banner: needs-review + urgent filter + scroll-to-next-unchecked -->
    <div v-if="filters.pm" class="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800 text-xs">
      <div class="text-amber-800 dark:text-amber-200">
        <span v-if="pmReviewStatus.needReviewCount > 0">{{ pmReviewStatus.needReviewCount }} still need a PM rec</span>
        <span v-else class="text-green-700 dark:text-green-400 font-medium">✓ All reviewed for this PM</span>
        <span v-if="urgentFilterKeys && urgentFilterKeys.length" class="ml-2 text-purple-700 dark:text-purple-300 font-medium">
          Filtering to urgent features
          <button type="button" class="underline ml-1" @click="clearUrgentFilter">clear</button>
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="pmReviewStatus.urgentCount > 0"
          type="button"
          @click="applyUrgentFilter"
          class="px-2 py-1 rounded border border-orange-400 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-semibold"
        >⚠ {{ pmReviewStatus.urgentCount }} urgent</button>
        <button type="button" @click="scrollToFirstUnchecked" class="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
          ↓ Next unchecked
        </button>
      </div>
    </div>

    <FeatureSchedulingFilterBar
      :filterMeta="filterMeta"
      v-model="filters"
      @clear="resetFilters"
    />

    <div v-if="error" role="alert" class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Horizontal scroll navigation (Nov 24 2026) - sticky so it stays visible while scrolling -->
    <div class="sticky top-0 flex items-center justify-center gap-2 py-2 px-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 z-40">
      <button
        type="button"
        @click="scrollTableLeft"
        title="Scroll table left"
        class="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >← scroll</button>
      <span class="text-xs text-gray-400 dark:text-gray-500">scroll table left / right</span>
      <button
        type="button"
        @click="scrollTableRight"
        title="Scroll table right"
        class="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      >scroll →</button>
    </div>

    <div class="overflow-x-auto" id="feature-scheduling-wrap">
      <table role="table" class="w-full text-xs">
        <thead role="rowgroup" class="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <tr role="row">
            <th class="px-2 py-2.5 w-8"></th>
            <th
              v-for="header in headers"
              :key="header.id"
              role="columnheader"
              class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
              :class="header.sortKey ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''"
              @click="header.sortKey && setSort(header.sortKey)"
            >
              {{ header.label }} <span v-if="header.sortKey">{{ sortIndicator(header.sortKey) }}</span>
            </th>
          </tr>
        </thead>
        <tbody id="feature-scheduling-tbody" role="rowgroup">
          <template v-if="loading && !displayRows.length">
            <tr v-for="i in 5" :key="'skel-' + i">
              <td :colspan="headers.length + 1" class="px-3 py-3">
                <div class="h-3 rounded animate-pulse bg-gray-200 dark:bg-gray-700 w-full"></div>
              </td>
            </tr>
          </template>

          <template v-for="(feature, idx) in displayRows" :key="feature['Key']">
            <!-- Nov 24 2026: Risk divider row (between good/bad risk items) -->
            <tr v-if="idx > 0 && displayRows[idx - 1]._riskLevel !== feature._riskLevel && feature._riskLevel === 'HIGH'"
              class="bg-red-50 dark:bg-red-900/20 border-b-2 border-red-200 dark:border-red-800">
              <td :colspan="headers.length + 1" class="px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-300">
                ▼ Items below this line pose significant capacity, dependency, or historical release risks
              </td>
            </tr>
            <FeatureSchedulingRow
              :feature="feature"
              :index="idx + 1"
            />
          </template>

          <tr v-if="!loading && !displayRows.length">
            <td :colspan="headers.length + 1" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No features found
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
