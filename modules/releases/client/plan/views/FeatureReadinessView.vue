<script setup>
import { ref, reactive, computed, onMounted, inject, watch, h } from 'vue'
import { useFeatureReadiness } from '../composables/useFeatureReadiness'
import { useReleases } from '../composables/useReleasePlanning'
import { useRefreshPolling } from '../composables/useRefreshPolling'
import { apiRequest } from '@shared/client/services/api'
import FeatureReadinessFilterBar from '../components/FeatureReadinessFilterBar.vue'
import FeatureReadinessRow from '../components/FeatureReadinessRow.vue'
import FeatureReadinessDrawer from '../components/FeatureReadinessDrawer.vue'
import {
  featureMatchesSharedFilters,
  exportFeatureReadinessCsv
} from '../utils/feature-readiness-export.js'
import {
  DEFAULT_FILTERS,
  saveFeaturesListFilters,
  restoreFeaturesListFilters
} from '../utils/features-list-filter-storage.js'
import {
  sortFeatures,
  nextSortState
} from '../utils/feature-readiness-sort.js'
import { toDrawerFeature } from '../utils/feature-readiness-drawer-model.js'

const nav = inject('moduleNav')
const jiraBaseUrl = 'https://issues.redhat.com/browse'

function navigateToFeature(key) {
  nav.navigateTo('feature-detail', { key, from: 'plan-features' })
}

const { pendingReview, ready, filterMeta, meta, loading, error, loadFeatureReadiness } = useFeatureReadiness()
const { releases, loadReleases } = useReleases()

const refreshing = ref(false)
const refreshStatus = ref('')

async function triggerHygieneRefresh() {
  refreshing.value = true
  refreshStatus.value = 'Starting hygiene refresh...'
  try {
    await apiRequest('/modules/releases/hygiene/refresh-all', { method: 'POST' })
  } catch {
    refreshStatus.value = 'Refresh failed'
    refreshing.value = false
  }
}

async function checkRefreshStatus() {
  var data = await apiRequest('/modules/releases/hygiene/refresh/status')
  if (data.running) {
    refreshStatus.value = (data.progress && data.progress.message) || 'Refreshing...'
  }
  return data
}

useRefreshPolling(refreshing, checkRefreshStatus, function() {
  refreshing.value = false
  refreshStatus.value = ''
  loadFeatureReadiness()
})

const selectedFeature = ref(null)
const drawerFeature = computed(function() {
  return toDrawerFeature(selectedFeature.value)
})
const selectedVersion = ref('')

const filters = ref(Object.assign({}, DEFAULT_FILTERS, {
  outcome: [],
  targetVersion: [],
  fixVersion: [],
  component: [],
  priority: [],
  team: [],
  product: [],
  fpdorItems: [],
  alignment: []
}))

function restorePersistedFilters() {
  var saved = restoreFeaturesListFilters()
  if (!saved) return
  filters.value = Object.assign({}, DEFAULT_FILTERS, saved.filters, {
    outcome: saved.filters.outcome.slice(),
    targetVersion: saved.filters.targetVersion.slice(),
    fixVersion: saved.filters.fixVersion.slice(),
    component: saved.filters.component.slice(),
    priority: saved.filters.priority.slice(),
    team: saved.filters.team.slice(),
    product: saved.filters.product.slice(),
    fpdorItems: saved.filters.fpdorItems.slice(),
    alignment: (saved.filters.alignment || []).slice()
  })
  selectedVersion.value = saved.selectedVersion
}

watch(
  [filters, selectedVersion],
  function() {
    saveFeaturesListFilters(filters.value, selectedVersion.value)
  },
  { deep: true }
)

onMounted(function() {
  restorePersistedFilters()
  loadFeatureReadiness()
  loadReleases()
})

function matchesFilters(feature) {
  return featureMatchesSharedFilters(feature, filters.value, selectedVersion.value, { applyReadiness: true })
}

/** Default matches prior score-desc order; arrow visible so columns look sortable. */
var sortState = reactive({ column: 'score', direction: 'desc' })

function toggleSort(column) {
  var next = nextSortState(sortState, column)
  sortState.column = next.column
  sortState.direction = next.direction
}

function sortIcon(column) {
  if (sortState.column !== column) return 'none'
  return sortState.direction
}

var SortArrow = {
  props: { direction: { type: String, default: 'none' } },
  setup: function(props) {
    return function() {
      if (props.direction === 'none') return null
      return h('svg', {
        class: [
          'w-3 h-3 inline-block transition-transform shrink-0',
          props.direction === 'desc' ? 'rotate-180' : ''
        ],
        fill: 'none',
        viewBox: '0 0 24 24',
        stroke: 'currentColor',
        'stroke-width': '2.5',
        'aria-hidden': 'true'
      }, [
        h('path', {
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          d: 'M5 15l7-7 7 7'
        })
      ])
    }
  }
}

const filteredFeatures = computed(function() {
  var all = pendingReview.value.concat(ready.value).filter(matchesFilters)
  return sortFeatures(all, sortState)
})

const readyCounts = computed(() => {
  var all = pendingReview.value.concat(ready.value).filter(function(f) {
    return featureMatchesSharedFilters(f, filters.value, selectedVersion.value, { applyReadiness: false })
  })
  var readyCount = 0
  var notReadyCount = 0
  for (var i = 0; i < all.length; i++) {
    if (all[i].confidence === 'not-ready') notReadyCount++
    else readyCount++
  }
  return { ready: readyCount, notReady: notReadyCount, total: all.length }
})

const releaseOptions = computed(() => {
  var opts = [{ version: '', label: 'All Releases' }]
  for (var i = 0; i < releases.value.length; i++) {
    opts.push({ version: releases.value[i].version, label: releases.value[i].version })
  }
  return opts
})

function exportCsv() {
  exportFeatureReadinessCsv(filteredFeatures.value)
}

const headers = [
  { id: 'h-num',        label: '#',               scope: 'col', sortKey: 'rank' },
  { id: 'h-score',      label: 'Score',           scope: 'col', sortKey: 'score', hasScoreTooltip: true },
  { id: 'h-readiness',  label: 'Readiness',       scope: 'col', sortKey: 'readiness', hasTooltip: true },
  { id: 'h-key',        label: 'Key',             scope: 'col', sortKey: 'key' },
  { id: 'h-title',      label: 'Title',           scope: 'col', sortKey: 'title' },
  { id: 'h-outcome',    label: 'Outcome',         scope: 'col', sortKey: 'outcome' },
  { id: 'h-target',     label: 'Target Version',  scope: 'col', sortKey: 'targetVersion', info: 'The release version that PM is targeting for this feature to be delivered in.' },
  { id: 'h-fixver',     label: 'Fix Version',     scope: 'col', sortKey: 'fixVersion', info: 'The release version that engineering has committed to delivering this feature in.' },
  { id: 'h-align',      label: 'TV/FV Align',     scope: 'col', sortKey: 'alignment', info: 'Same categories as Reports → TV vs FV Delta (worst across Target/Fix Versions on the issue). Early or as requested and green After requested count as aligned.' },
  { id: 'h-comp',       label: 'Components',      scope: 'col', sortKey: 'components' },
  { id: 'h-team',       label: 'Team',            scope: 'col', sortKey: 'team' },
  { id: 'h-rubric',     label: 'Rubric',          scope: 'col', sortKey: 'rubric' },
  { id: 'h-rec',        label: 'AI First Recommends',  scope: 'col', sortKey: 'recommendation', info: 'AI review verdict from the strat-creator (AI First) pipeline.' },
  { id: 'h-status',     label: 'Status',          scope: 'col', sortKey: 'status' },
  { id: 'h-priority',   label: 'Priority',        scope: 'col', sortKey: 'priority' },
  { id: 'h-attention',  label: '',                scope: 'col', sortKey: 'attention', ariaLabel: 'Needs attention' },
]

function formatSyncDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

</script>

<template>
  <div class="space-y-0 overflow-hidden">

    <!-- Release selector + summary bar -->
    <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-3">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Release:</label>
        <select
          v-model="selectedVersion"
          class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        >
          <option v-for="opt in releaseOptions" :key="opt.version" :value="opt.version">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>{{ readyCounts.total }} features</span>
        <span class="text-green-600 dark:text-green-400">{{ readyCounts.ready }} ready</span>
        <span class="text-red-600 dark:text-red-400">{{ readyCounts.notReady }} not ready</span>
        <button
          @click="triggerHygieneRefresh"
          :disabled="refreshing"
          class="ml-2 px-3 py-1 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :title="refreshing ? refreshStatus : 'Refresh hygiene data from Jira'"
        >{{ refreshing ? 'Refreshing...' : 'Refresh Hygiene' }}</button>
        <button
          type="button"
          @click="exportCsv"
          :disabled="filteredFeatures.length === 0"
          class="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Export current filtered view as CSV"
        >Export CSV</button>
      </div>
    </div>

    <!-- Filter bar -->
    <FeatureReadinessFilterBar
      :filterMeta="filterMeta"
      v-model="filters"
    />

    <!-- Error state -->
    <div
      v-if="error"
      role="alert"
      class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400"
    >
      {{ error }}
    </div>

    <!-- Unified table -->
    <div class="overflow-x-auto">
      <table role="table" class="w-full text-xs">
        <thead role="rowgroup" class="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
          <tr role="row">
            <th
              v-for="header in headers"
              :key="header.id"
              role="columnheader"
              :scope="header.scope"
              :aria-sort="header.sortKey && sortState.column === header.sortKey
                ? (sortState.direction === 'asc' ? 'ascending' : 'descending')
                : (header.sortKey ? 'none' : undefined)"
              :aria-label="header.ariaLabel || undefined"
              class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight"
              :class="header.sortKey ? 'cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200' : ''"
              @click="header.sortKey && toggleSort(header.sortKey)"
            >
              <span v-if="header.hasTooltip" class="inline-flex items-center gap-1 group relative">
                {{ header.label }}
                <SortArrow :direction="sortIcon(header.sortKey)" />
                <span
                  class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold leading-none cursor-help"
                  @click.stop
                >i</span>
                <div
                  class="absolute z-50 top-full mt-1 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs text-left font-normal normal-case tracking-normal hidden group-hover:block"
                  @click.stop
                >
                  <p class="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Readiness color</p>
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Ready</strong> — all applicable FPDoR items pass</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Soft</strong> — soft fails only</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Medium</strong> — medium severity fails</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>High</strong> — high severity fails</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Critical</strong> — critical severity fails</span>
                    </div>
                  </div>
                  <p class="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                    Color is fail severity triage — not commitment. Fix Version stays in its own column.
                  </p>
                  <p class="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                    DoR checklist:
                    <a
                      href="https://redhat.atlassian.net/wiki/spaces/RHAI/pages/442958832/Planning+Phase+-+Definition+of+Ready+Definition+of+Done"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline"
                    >Confluence</a>
                  </p>
                </div>
              </span>
              <span v-else-if="header.hasScoreTooltip" class="inline-flex items-center gap-1 group relative">
                {{ header.label }}
                <SortArrow :direction="sortIcon(header.sortKey)" />
                <span
                  class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold leading-none cursor-help"
                  @click.stop
                >i</span>
                <div
                  class="absolute z-50 top-full mt-1 left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs text-left font-normal normal-case tracking-normal hidden group-hover:block"
                  @click.stop
                >
                  <p class="font-semibold text-gray-700 dark:text-gray-200 mb-2">Score Rubric</p>
                  <div class="space-y-2 text-gray-600 dark:text-gray-300">
                    <div>
                      <p class="font-medium text-gray-700 dark:text-gray-200 mb-0.5">Priority Score Formula:</p>
                      <p class="font-mono text-[10px]">RICE (30w) + Big Rock (30w) + Target Version (25w) + Priority (15w)</p>
                    </div>
                    <div class="pt-1 border-t border-gray-100 dark:border-gray-700">
                      <p class="font-medium text-gray-700 dark:text-gray-200 mb-0.5">Scoring:</p>
                      <p class="font-mono text-[10px]">Min-max RICE &middot; Positional Big Rock &middot; GA-to-GA version &middot; Jira priority</p>
                    </div>
                  </div>
                </div>
              </span>
              <span v-else-if="header.info" class="inline-flex items-center gap-1 group relative">
                {{ header.label }}
                <SortArrow :direction="sortIcon(header.sortKey)" />
                <span
                  class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold leading-none cursor-help"
                  @click.stop
                >i</span>
                <span
                  class="absolute z-50 top-full mt-1 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2.5 text-xs text-left font-normal normal-case tracking-normal hidden group-hover:block"
                  @click.stop
                >
                  {{ header.info }}
                </span>
              </span>
              <span v-else class="inline-flex items-center gap-1">
                {{ header.label }}
                <SortArrow v-if="header.sortKey" :direction="sortIcon(header.sortKey)" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <!-- Loading skeleton -->
          <template v-if="loading && filteredFeatures.length === 0">
            <tr v-for="i in 5" :key="'skel-' + i" role="row" class="border-b border-gray-100 dark:border-gray-800">
              <td v-for="j in headers.length" :key="j" class="px-3 py-3">
                <div class="h-3 rounded animate-pulse bg-gray-200 dark:bg-gray-700" :class="j === 3 ? 'w-24' : 'w-16'"></div>
              </td>
            </tr>
          </template>

          <!-- Rows -->
          <FeatureReadinessRow
            v-for="feature in filteredFeatures"
            :key="feature.key"
            :feature="feature"
            :index="feature.rank"
            :jiraBaseUrl="jiraBaseUrl"
            @select="selectedFeature = $event"
            @navigate="navigateToFeature"
          />

          <!-- Empty state -->
          <tr v-if="!loading && filteredFeatures.length === 0" role="row">
            <td :colspan="headers.length" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              No features found
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer: last synced -->
    <div
      v-if="meta"
      class="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
    >
      Last synced: {{ formatSyncDate(meta.lastSyncedAt) }}
      <span class="ml-1 text-gray-300 dark:text-gray-600">(strat-pipeline runs every ~2h)</span>
    </div>

  </div>

  <FeatureReadinessDrawer
    :feature="drawerFeature"
    :jiraBaseUrl="jiraBaseUrl"
    @close="selectedFeature = null"
    @navigate="navigateToFeature"
  />
</template>
