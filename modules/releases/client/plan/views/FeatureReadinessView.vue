<script setup>
import { ref, computed, onMounted, inject } from 'vue'
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

onMounted(function() {
  loadFeatureReadiness()
  loadReleases()
})

const selectedFeature = ref(null)
const selectedVersion = ref('')

const filters = ref({
  outcome: [],
  targetVersion: [],
  fixVersion: [],
  component: [],
  priority: [],
  team: [],
  product: [],
  fpdorItems: [],
  readiness: null
})

function matchesFilters(feature) {
  return featureMatchesSharedFilters(feature, filters.value, selectedVersion.value, { applyReadiness: true })
}

const filteredFeatures = computed(() => {
  var all = pendingReview.value.concat(ready.value)
  return all.filter(matchesFilters).sort(function(a, b) {
    if (b.effectivePriorityScore !== a.effectivePriorityScore) {
      return b.effectivePriorityScore - a.effectivePriorityScore
    }
    return b.rubricTotal - a.rubricTotal
  })
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
  { id: 'h-num',        label: '#',               scope: 'col' },
  { id: 'h-score',      label: 'Score',           scope: 'col', hasScoreTooltip: true },
  { id: 'h-readiness',  label: 'Readiness',       scope: 'col', hasTooltip: true },
  { id: 'h-key',        label: 'Key',             scope: 'col' },
  { id: 'h-title',      label: 'Title',           scope: 'col' },
  { id: 'h-outcome',    label: 'Outcome',         scope: 'col' },
  { id: 'h-target',     label: 'Target Version',  scope: 'col', info: 'The release version that PM is targeting for this feature to be delivered in.' },
  { id: 'h-fixver',     label: 'Fix Version',     scope: 'col', info: 'The release version that engineering has committed to delivering this feature in.' },
  { id: 'h-comp',       label: 'Components',      scope: 'col' },
  { id: 'h-team',       label: 'Team',            scope: 'col' },
  { id: 'h-rubric',     label: 'Rubric',          scope: 'col' },
  { id: 'h-rec',        label: 'Recommendation',  scope: 'col' },
  { id: 'h-status',     label: 'Status',          scope: 'col' },
  { id: 'h-priority',   label: 'Priority',        scope: 'col' },
  { id: 'h-attention',  label: '',                scope: 'col' },
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
              class="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight"
            >
              <span v-if="header.hasTooltip" class="inline-flex items-center gap-1 group relative">
                {{ header.label }}
                <span
                  class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold leading-none cursor-help"
                >i</span>
                <div
                  class="absolute z-50 top-full mt-1 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs text-left font-normal normal-case tracking-normal hidden group-hover:block"
                >
                  <p class="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Confidence Legend</p>
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Committed</strong> — fix version assigned</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Ready</strong> — passes gates, not yet committed</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
                      <span class="text-gray-600 dark:text-gray-300"><strong>Not Ready</strong> — does not pass readiness gates</span>
                    </div>
                  </div>
                </div>
              </span>
              <span v-else-if="header.hasScoreTooltip" class="inline-flex items-center gap-1 group relative">
                {{ header.label }}
                <span
                  class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold leading-none cursor-help"
                >i</span>
                <div
                  class="absolute z-50 top-full mt-1 left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs text-left font-normal normal-case tracking-normal hidden group-hover:block"
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
                <span
                  class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 text-[9px] font-bold leading-none cursor-help"
                >i</span>
                <span class="absolute z-50 top-full mt-1 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2.5 text-xs text-left font-normal normal-case tracking-normal hidden group-hover:block">
                  {{ header.info }}
                </span>
              </span>
              <span v-else>{{ header.label }}</span>
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
    :feature="selectedFeature"
    :jiraBaseUrl="jiraBaseUrl"
    @close="selectedFeature = null"
    @navigate="navigateToFeature"
  />
</template>
