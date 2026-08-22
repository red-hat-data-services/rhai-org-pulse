<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import ClickableCount from '../components/ClickableCount.vue'
import FeatureTable from '../components/FeatureTable.vue'
import { useReleasePicker } from '../composables/useReleasePicker'
import { useComponentBreakdown } from '../composables/useComponentBreakdown'
import { useComponentLeads } from '../composables/useComponentLeads'
import { useTvFvData } from '../composables/useTvFvData'
import { useReleaseFamily, getAlignmentTarget, buildNameRollup } from '../composables/useReleaseFamily'
import { mergeReleaseDetails } from '../composables/mergeReleaseDetails'
import { buildKeysJqlUrl } from '../composables/jiraKeysJql'
import { DEFAULT_SELECTED_VERSIONS } from '../composables/tvFvDeltaDefaults'

const FEATURE_COLS = [
  'key', 'summary', 'target_version', 'fix_versions',
  'status', 'color_status', 'product_manager', 'assignee', 'team', 'component',
]

/** Plain-English explanations for executive summary / component table headers */
const COLUMN_HELP = {
  release: 'Jira Target Version / Fix Version name for this product release.',
  total: 'All features that have this release on Target Version (TV) or Fix Version (FV). Cycle/milestone rollups count each issue once across products.',
  aligned_on_time: 'Early or as requested: Fix Version is the same milestone as Target Version, or an earlier one. Not a calendar on-schedule flag.',
  aligned_late: 'After requested (green): Fix Version is a later milestone than Target Version, and the committed version freeze has passed. Counts in Align %.',
  after_requested: 'After requested (yellow): Fix Version is a later milestone than Target Version, and the committed version freeze has not passed. Does not count in Align % yet.',
  tv_only: 'TV-only: Target Version is set for this release, but Fix Version is empty.',
  fv_only: 'FV-only: Fix Version is set for this release, but Target Version is empty.',
  misaligned: 'Different products: Target Version and Fix Version are different products, or the version names cannot be compared.',
  alignment_pct: 'Alignment % = (Early or as requested + green After requested) ÷ Total features.',
  target: 'Suggested alignment goal based on how many days remain until planning freeze.',
  ga_date: 'Release / GA date from Product Pages for this version.',
  days_to_ga: 'Days remaining until the Product Pages release / GA date.',
  planning_freeze: 'Planning freeze date from Product Pages. After requested turns green after the committed (Fix Version) freeze, not the requested freeze.',
  days_to_freeze: 'Days remaining until planning freeze.',
}

// ---------------------------------------------------------------------------
// Composables
// ---------------------------------------------------------------------------

// Data fetching needs allSelectedVersions from picker, but picker needs data from fetching.
// We initialise data first (useTvFvData creates the ref), then pass it to the picker.
const {
  data, loading, error, refreshing, selectedRelease,
  registryReleases, jiraVersions,
  fetchRegistry, fetchVersions, fetchData, triggerRefresh, cleanup,
} = useTvFvData()

const {
  pickerOpen, pickerRef,
  chosenVersionNames, versionSearch,
  availableVersions, filteredVersions, allSelectedVersions,
  formatDate, isInCurrentData,
  toggleVersion, removeVersion, handleClickOutside,
} = useReleasePicker(data, registryReleases, jiraVersions)

// Wrap triggerRefresh to pass the picker's allSelectedVersions
const doRefresh = () => triggerRefresh(allSelectedVersions)

/**
 * Selection scope:
 * - product: one release event chip (e.g. 3.6 EA1 RHOAI RELEASE)
 * - milestone: all products in a release event (e.g. 3.6 EA1 → RHOAI/RHAII/RHELAI)
 */
const selectedMilestoneKey = ref(null)

const activeReleaseNames = computed(() => {
  if (selectedMilestoneKey.value) {
    for (const cycle of chosenVersionsRollup.value) {
      for (const ms of cycle.milestones) {
        if (ms.key === selectedMilestoneKey.value) {
          return ms.names.filter(n => data.value?.releases?.[n])
        }
      }
    }
    return []
  }
  if (selectedRelease.value && data.value?.releases?.[selectedRelease.value]) {
    return [selectedRelease.value]
  }
  return []
})

const selectionLabel = computed(() => {
  if (selectedMilestoneKey.value) {
    for (const cycle of chosenVersionsRollup.value) {
      for (const ms of cycle.milestones) {
        if (ms.key === selectedMilestoneKey.value) {
          const n = activeReleaseNames.value.length
          return ms.label + (n ? ` — all products (${n})` : '')
        }
      }
    }
  }
  return selectedRelease.value || ''
})

function selectProductRelease(name) {
  if (!name || !isInCurrentData(name)) return
  selectedMilestoneKey.value = null
  selectedRelease.value = name
}

function selectMilestoneGroup(ms) {
  if (!ms) return
  // Selector rollup uses .names; executive summary rollup uses .rows[].release
  const names = ms.names
    || (ms.rows ? ms.rows.map(function (r) { return r.release }) : [])
  if (!names.length) return
  const available = names.filter(n => data.value?.releases?.[n])
  if (!available.length) return
  selectedMilestoneKey.value = ms.key
  selectedRelease.value = available[0]
}

function isProductSelected(name) {
  return !selectedMilestoneKey.value && name === selectedRelease.value
}

function isMilestoneSelected(msKey) {
  return selectedMilestoneKey.value === msKey
}

function isReleaseInActiveScope(name) {
  return activeReleaseNames.value.includes(name)
}

const releaseData = computed(() => {
  if (!data.value) return null
  return mergeReleaseDetails(data.value.releases, activeReleaseNames.value)
})

/** Section "View in Jira" links — exact keys shown in the table (works for all-products + late/misaligned) */
const sectionJiraLinks = computed(() => {
  const rd = releaseData.value
  if (!rd) return {}
  return {
    tv_only: buildKeysJqlUrl(rd.tv_only),
    fv_only: buildKeysJqlUrl(rd.fv_only),
    aligned_on_time: buildKeysJqlUrl(rd.aligned_on_time),
    aligned_late: buildKeysJqlUrl(rd.aligned_late),
    after_requested: buildKeysJqlUrl(rd.after_requested),
    misaligned: buildKeysJqlUrl(rd.misaligned),
  }
})

const filteredSummary = computed(() => {
  if (!data.value) return []
  const summary = data.value.executive_summary
  if (!chosenVersionNames.value.size) return summary

  // Start with data rows that match chosen versions
  const rows = summary.filter(row => chosenVersionNames.value.has(row.release))

  // Add placeholder rows for chosen versions not yet in data (pending refresh)
  const existingReleases = new Set(summary.map(r => r.release))
  for (const name of chosenVersionNames.value) {
    if (!existingReleases.has(name)) {
      rows.push({
        release: name, total: 0, aligned_on_time: 0, aligned_late: 0, after_requested: 0, tv_only: 0, fv_only: 0, misaligned: 0,
        alignment_pct: 0, _pending: true,
      })
    }
  }
  return rows
})

// ---------------------------------------------------------------------------
// Product filter + release family sorting
// ---------------------------------------------------------------------------

const {
  selectedFamily, availableFamilies,
  toggleSummarySort, summarySortIcon,
  summaryRollup,
} = useReleaseFamily(filteredSummary, data)

const SUMMARY_COL_COUNT = 13

/** Selected version chips grouped: cycle → milestone → products (numeric desc) */
const chosenVersionsRollup = computed(() => buildNameRollup(allSelectedVersions.value))

/** Add-release dropdown entries grouped the same way */
const dropdownVersionsRollup = computed(() => {
  const names = filteredVersions.value.map(v => v.name)
  return buildNameRollup(names)
})

function versionInfo(name) {
  return availableVersions.value.find(v => v.name === name) || { name, displayName: name, source: 'manual' }
}

/** Compute target alignment for a row based on days to planning freeze */
function targetForRow(row) {
  var d = daysToFreeze(row.planning_freeze)
  return getAlignmentTarget(d)
}

const { releaseComponentBreakdown } = useComponentBreakdown(data, releaseData)
const { leadsFor } = useComponentLeads()

/** Compute days until planning freeze from an ISO date string. Returns null if no date. */
function daysToFreeze(freezeDate) {
  if (!freezeDate) return null
  const diff = new Date(freezeDate + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  return Math.ceil(diff / 86400000)
}

/** Compute days until GA from an ISO date string. Returns null if no date. */
function daysToGa(gaDate) {
  if (!gaDate) return null
  const diff = new Date(gaDate + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  return Math.ceil(diff / 86400000)
}

// ---------------------------------------------------------------------------
// Auto-refresh when selection includes releases not yet in data
// ---------------------------------------------------------------------------

let refreshDebounce = null

watch(chosenVersionNames, (names) => {
  if (!names.size || !data.value) return
  const existing = new Set(data.value.metadata?.releases || [])
  const hasNew = [...names].some(n => !existing.has(n))
  if (!hasNew) return

  if (refreshDebounce) clearTimeout(refreshDebounce)
  refreshDebounce = setTimeout(() => doRefresh(), 800)
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  await Promise.all([fetchRegistry(), fetchVersions()])
  // Pre-populate with the default 3.5/3.6 product-family versions (users can add/remove after load)
  if (!chosenVersionNames.value.size) {
    chosenVersionNames.value = new Set(DEFAULT_SELECTED_VERSIONS)
  }
  await fetchData()
  // Prefer a default version that already has detail data in the cache
  if (data.value?.releases) {
    const firstWithDetail = DEFAULT_SELECTED_VERSIONS.find(v => data.value.releases[v])
    if (firstWithDetail) selectedRelease.value = firstWithDetail
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  if (refreshDebounce) clearTimeout(refreshDebounce)
  cleanup()
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-6">
    <!-- Header -->
    <div class="mb-6 flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
          TV vs FV Delta
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Target Version (PM intent) vs Fix Version (engineering commitment)
        </p>
      </div>
      <button
        @click="doRefresh"
        :disabled="refreshing"
        class="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
        :class="refreshing
          ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
      >
        {{ refreshing ? 'Refreshing...' : 'Refresh from Jira' }}
      </button>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400">{{ error }}</div>
    <div v-else-if="!data && refreshing" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p class="text-lg font-medium mb-2">Fetching data for the first time...</p>
      <p class="text-sm">The pipeline is running. This page will update automatically.</p>
    </div>

    <template v-else-if="data">
      <!-- Metadata -->
      <div class="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Data fetched: {{ new Date(data.metadata.data_timestamp).toLocaleString() }}
        &middot;
        Report generated: {{ new Date(data.metadata.generated_at).toLocaleString() }}
        &middot;
        <span class="italic">Counts reflect data at fetch time; live Jira may differ</span>
      </div>

      <!-- Release Family Filter -->
      <div class="flex items-center gap-1.5 mb-4 flex-wrap">
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
          :class="selectedFamily === 'all'
            ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="selectedFamily = 'all'"
        >All</button>
        <button
          v-for="fam in availableFamilies"
          :key="fam.key"
          class="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
          :class="selectedFamily === fam.key
            ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="selectedFamily = fam.key"
        >{{ fam.label }}</button>
      </div>

      <!-- Executive Summary -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Executive Summary</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.release" @click="toggleSummarySort('release')">
                  <span class="inline-flex items-center gap-1">Release<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('release') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('release') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.total" @click="toggleSummarySort('total')">
                  <span class="inline-flex items-center gap-1 justify-end">Total<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('total') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('total') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.aligned_on_time" @click="toggleSummarySort('aligned_on_time')">
                  <span class="inline-flex items-center gap-1 justify-end">Early or as requested<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('aligned_on_time') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('aligned_on_time') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.after_requested + ' ' + COLUMN_HELP.aligned_late" @click="toggleSummarySort('after_requested')">
                  <span class="inline-flex items-center gap-1 justify-end">After requested<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('after_requested') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('after_requested') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.tv_only" @click="toggleSummarySort('tv_only')">
                  <span class="inline-flex items-center gap-1 justify-end">TV-Only<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('tv_only') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('tv_only') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.fv_only" @click="toggleSummarySort('fv_only')">
                  <span class="inline-flex items-center gap-1 justify-end">FV-Only<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('fv_only') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('fv_only') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.misaligned" @click="toggleSummarySort('misaligned')">
                  <span class="inline-flex items-center gap-1 justify-end">Different products<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('misaligned') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('misaligned') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.alignment_pct" @click="toggleSummarySort('alignment_pct')">
                  <span class="inline-flex items-center gap-1 justify-end">Alignment %<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('alignment_pct') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('alignment_pct') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase" :title="COLUMN_HELP.target">
                  <span class="inline-flex items-center gap-1 justify-end">Align Target<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span></span>
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.ga_date" @click="toggleSummarySort('ga_date')">
                  <span class="inline-flex items-center gap-1">GA Date<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('ga_date') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('ga_date') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase" :title="COLUMN_HELP.days_to_ga">
                  <span class="inline-flex items-center gap-1 justify-end">Days to GA<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span></span>
                </th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors" :title="COLUMN_HELP.planning_freeze" @click="toggleSummarySort('planning_freeze')">
                  <span class="inline-flex items-center gap-1">Planning Freeze<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span><svg v-if="summarySortIcon('planning_freeze') !== 'none'" class="w-3 h-3 inline-block transition-transform" :class="{ 'rotate-180': summarySortIcon('planning_freeze') === 'desc' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg></span>
                </th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase" :title="COLUMN_HELP.days_to_freeze">
                  <span class="inline-flex items-center gap-1 justify-end">Days to Freeze<span class="normal-case text-[10px] text-gray-400" aria-hidden="true">ⓘ</span></span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <template v-for="cycle in summaryRollup" :key="cycle.key">
                <!-- Cycle rollup: e.g. 3.6 Release Cycle -->
                <tr class="bg-gray-100 dark:bg-gray-900/80">
                  <td class="px-4 py-2.5 text-xs font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
                    {{ cycle.label }}
                  </td>
                  <td class="px-4 py-2.5 text-right text-xs font-semibold text-gray-700 dark:text-gray-200">{{ cycle.totals.total }}</td>
                  <td class="px-4 py-2.5 text-right text-xs font-semibold text-green-700 dark:text-green-400">{{ cycle.totals.aligned_on_time }}</td>
                  <td class="px-4 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                    <span class="text-amber-600 dark:text-amber-400">{{ cycle.totals.after_requested || 0 }}</span>
                    <span class="text-gray-400 dark:text-gray-500 mx-0.5">/</span>
                    <span class="text-emerald-600 dark:text-emerald-400">{{ cycle.totals.aligned_late }}</span>
                  </td>
                  <td class="px-4 py-2.5 text-right text-xs font-semibold text-yellow-700 dark:text-yellow-400">{{ cycle.totals.tv_only }}</td>
                  <td class="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">{{ cycle.totals.fv_only }}</td>
                  <td class="px-4 py-2.5 text-right text-xs font-semibold text-red-700 dark:text-red-400">{{ cycle.totals.misaligned }}</td>
                  <td class="px-4 py-2.5 text-right text-xs font-semibold"
                    :class="{
                      'text-red-600 dark:text-red-400': cycle.totals.alignment_pct < 50,
                      'text-yellow-600 dark:text-yellow-400': cycle.totals.alignment_pct >= 50 && cycle.totals.alignment_pct < 75,
                      'text-green-600 dark:text-green-400': cycle.totals.alignment_pct >= 75,
                    }"
                  >{{ cycle.totals.alignment_pct }}%</td>
                  <td :colspan="SUMMARY_COL_COUNT - 8" class="px-4 py-2.5"></td>
                </tr>

                <template v-for="ms in cycle.milestones" :key="ms.key">
                  <!-- Milestone rollup: e.g. 3.6 GA Release — click to view all products -->
                  <tr
                    class="bg-gray-50 dark:bg-gray-800/70 cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/20"
                    :class="{ 'ring-1 ring-inset ring-blue-400/60 bg-blue-50/60 dark:bg-blue-900/25': isMilestoneSelected(ms.key) }"
                    @click="selectMilestoneGroup(ms)"
                  >
                    <td class="px-4 py-2 pl-8 text-xs font-medium text-gray-700 dark:text-gray-200">
                      {{ ms.label }}
                      <span class="ml-1 text-[10px] font-normal text-gray-400 dark:text-gray-500">(includes {{ ms.rows.length }})</span>
                      <span class="ml-1.5 text-[10px] font-normal text-blue-600 dark:text-blue-400">all products</span>
                    </td>
                    <td class="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">{{ ms.totals.total }}</td>
                    <td class="px-4 py-2 text-right text-xs font-medium text-green-700 dark:text-green-400">{{ ms.totals.aligned_on_time }}</td>
                    <td class="px-4 py-2 text-right text-xs font-medium whitespace-nowrap">
                      <span class="text-amber-600 dark:text-amber-400">{{ ms.totals.after_requested || 0 }}</span>
                      <span class="text-gray-400 dark:text-gray-500 mx-0.5">/</span>
                      <span class="text-emerald-600 dark:text-emerald-400">{{ ms.totals.aligned_late }}</span>
                    </td>
                    <td class="px-4 py-2 text-right text-xs font-medium text-yellow-700 dark:text-yellow-400">{{ ms.totals.tv_only }}</td>
                    <td class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">{{ ms.totals.fv_only }}</td>
                    <td class="px-4 py-2 text-right text-xs font-medium text-red-700 dark:text-red-400">{{ ms.totals.misaligned }}</td>
                    <td class="px-4 py-2 text-right text-xs font-medium"
                      :class="{
                        'text-red-600 dark:text-red-400': ms.totals.alignment_pct < 50,
                        'text-yellow-600 dark:text-yellow-400': ms.totals.alignment_pct >= 50 && ms.totals.alignment_pct < 75,
                        'text-green-600 dark:text-green-400': ms.totals.alignment_pct >= 75,
                      }"
                    >{{ ms.totals.alignment_pct }}%</td>
                    <td :colspan="SUMMARY_COL_COUNT - 8" class="px-4 py-2"></td>
                  </tr>

                  <!-- Product rows -->
                  <tr
                    v-for="row in ms.rows"
                    :key="row.release"
                    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    :class="{
                      'bg-blue-50/50 dark:bg-blue-900/10': isProductSelected(row.release),
                      'bg-blue-50/20 dark:bg-blue-900/5': isMilestoneSelected(ms.key) && isReleaseInActiveScope(row.release),
                    }"
                    @click="!row._pending ? selectProductRelease(row.release) : null"
                  >
                    <td class="px-4 py-2 pl-12 font-mono text-xs font-medium" :class="row._pending ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'">
                      {{ row.release }}
                      <span v-if="row._pending" class="ml-1 text-[10px] text-amber-500 dark:text-amber-400 italic">(refreshing data...)</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <template v-if="!row._pending">
                        <ClickableCount :count="row.total" :jql="row.total_jql" label="Total features" />
                      </template>
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <ClickableCount
                        v-if="!row._pending"
                        :count="row.aligned_on_time != null ? row.aligned_on_time : (row.aligned || 0)"
                        :jql="row.aligned_on_time_jql || row.aligned_jql"
                        color="green"
                        label="Aligned on time"
                      />
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <span v-if="!row._pending" class="text-xs font-medium whitespace-nowrap" :title="COLUMN_HELP.after_requested + ' ' + COLUMN_HELP.aligned_late">
                        <span class="text-amber-600 dark:text-amber-400">{{ row.after_requested || 0 }}</span>
                        <span class="text-gray-400 dark:text-gray-500 mx-0.5">/</span>
                        <span class="text-emerald-600 dark:text-emerald-400">{{ row.aligned_late || 0 }}</span>
                      </span>
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <ClickableCount v-if="!row._pending" :count="row.tv_only" :jql="row.tv_only_jql" color="yellow" label="TV-only" />
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <ClickableCount v-if="!row._pending" :count="row.fv_only" :jql="row.fv_only_jql" color="muted" label="FV-only" />
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <span v-if="!row._pending" class="text-xs font-medium text-orange-600 dark:text-orange-400">{{ row.misaligned != null ? row.misaligned : (row.mismatched || 0) }}</span>
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-right">
                      <span v-if="!row._pending"
                        class="font-semibold"
                        :class="{
                          'text-red-600 dark:text-red-400': row.alignment_pct < 50,
                          'text-yellow-600 dark:text-yellow-400': row.alignment_pct >= 50 && row.alignment_pct < 75,
                          'text-green-600 dark:text-green-400': row.alignment_pct >= 75,
                        }"
                      >
                        {{ row.alignment_pct }}%
                      </span>
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-right text-xs whitespace-nowrap">
                      <template v-if="!row._pending && targetForRow(row)">
                        <span
                          class="font-semibold"
                          :class="{
                            'text-red-600 dark:text-red-400': row.alignment_pct < targetForRow(row).target,
                            'text-green-600 dark:text-green-400': row.alignment_pct >= targetForRow(row).target,
                          }"
                          :title="'Target: ' + targetForRow(row).label + ' (based on ' + daysToFreeze(row.planning_freeze) + ' days to planning freeze)'"
                        >{{ targetForRow(row).label }}</span>
                      </template>
                      <span v-else class="text-gray-400">&mdash;</span>
                    </td>
                    <td class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {{ row.ga_date ? formatDate(row.ga_date) : '—' }}
                    </td>
                    <td class="px-4 py-2 text-right text-xs whitespace-nowrap"
                      :class="{
                        'text-gray-400': row._pending || daysToGa(row.ga_date) === null,
                        'text-green-600 dark:text-green-400': daysToGa(row.ga_date) !== null && daysToGa(row.ga_date) <= 0,
                        'text-red-600 dark:text-red-400': daysToGa(row.ga_date) > 0 && daysToGa(row.ga_date) <= 30,
                        'text-yellow-600 dark:text-yellow-400': daysToGa(row.ga_date) > 30 && daysToGa(row.ga_date) <= 60,
                        'text-gray-500 dark:text-gray-400': daysToGa(row.ga_date) > 60,
                      }"
                    >
                      <template v-if="daysToGa(row.ga_date) !== null">
                        {{ daysToGa(row.ga_date) > 0 ? daysToGa(row.ga_date) + 'd' : 'Released' }}
                      </template>
                      <template v-else>&mdash;</template>
                    </td>
                    <td class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {{ row.planning_freeze ? formatDate(row.planning_freeze) : '—' }}
                    </td>
                    <td class="px-4 py-2 text-right text-xs whitespace-nowrap"
                      :class="{
                        'text-gray-400': row._pending || daysToFreeze(row.planning_freeze) === null,
                        'text-green-600 dark:text-green-400': daysToFreeze(row.planning_freeze) !== null && daysToFreeze(row.planning_freeze) <= 0,
                        'text-red-600 dark:text-red-400': daysToFreeze(row.planning_freeze) > 0 && daysToFreeze(row.planning_freeze) <= 30,
                        'text-yellow-600 dark:text-yellow-400': daysToFreeze(row.planning_freeze) > 30 && daysToFreeze(row.planning_freeze) <= 60,
                        'text-gray-500 dark:text-gray-400': daysToFreeze(row.planning_freeze) > 60,
                      }"
                    >
                      <template v-if="daysToFreeze(row.planning_freeze) !== null">
                        {{ daysToFreeze(row.planning_freeze) > 0 ? daysToFreeze(row.planning_freeze) + 'd' : 'Frozen' }}
                      </template>
                      <template v-else>&mdash;</template>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Release selector — cycle → milestone → product (numeric desc) -->
      <div class="mb-6 space-y-4">
        <div
          v-for="cycle in chosenVersionsRollup"
          :key="'sel-' + cycle.key"
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden"
        >
          <div class="px-3 py-2 bg-gray-100 dark:bg-gray-900/80 text-xs font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wide">
            {{ cycle.label }}
          </div>
          <div
            v-for="ms in cycle.milestones"
            :key="'sel-' + ms.key"
            class="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700/80"
            :class="{ 'bg-blue-50/40 dark:bg-blue-900/15': isMilestoneSelected(ms.key) }"
          >
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                class="text-[11px] font-semibold"
                :class="isMilestoneSelected(ms.key)
                  ? 'text-blue-800 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-200'"
              >{{ ms.label }}</span>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border shadow-sm transition-colors"
                :class="isMilestoneSelected(ms.key)
                  ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500'
                  : 'bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30'"
                :aria-pressed="isMilestoneSelected(ms.key) ? 'true' : 'false'"
                :aria-label="ms.label + ' all products'"
                :title="'Select all products for ' + ms.label"
                @click="selectMilestoneGroup(ms)"
              >
                All products
                <span
                  class="inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px] font-bold"
                  :class="isMilestoneSelected(ms.key)
                    ? 'bg-blue-500/80 text-white'
                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'"
                >{{ ms.names.length }}</span>
              </button>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                v-for="name in ms.names"
                :key="name"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
                :class="isInCurrentData(name)
                  ? (isProductSelected(name)
                    ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500'
                    : (isMilestoneSelected(ms.key)
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'))
                  : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 border-dashed'"
                @click="selectProductRelease(name)"
              >
                {{ name }}
                <span
                  @click.stop="removeVersion(name)"
                  class="ml-0.5 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remove"
                >&times;</span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <!-- Add release dropdown -->
          <div class="relative" ref="pickerRef">
            <button
              @click.stop="pickerOpen = !pickerOpen"
              class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              + Add release
            </button>
            <div
              v-if="pickerOpen"
              class="absolute z-20 mt-1 left-0 w-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
              @click.stop
            >
              <div class="p-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  v-model="versionSearch"
                  type="text"
                  placeholder="Search versions..."
                  class="w-full px-2.5 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div class="max-h-80 overflow-y-auto">
                <template v-for="cycle in dropdownVersionsRollup" :key="'dd-' + cycle.key">
                  <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/60 sticky top-0">
                    {{ cycle.label }}
                  </div>
                  <template v-for="ms in cycle.milestones" :key="'dd-' + ms.key">
                    <div class="px-3 pt-2 pb-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                      {{ ms.label }}
                    </div>
                    <button
                      v-for="name in ms.names"
                      :key="name"
                      class="w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-2 transition-colors"
                      :class="{ 'bg-blue-50 dark:bg-blue-900/20': chosenVersionNames.has(name) }"
                      @click.stop="toggleVersion(name)"
                    >
                      <div class="min-w-0">
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ versionInfo(name).displayName || name }}</span>
                        <span v-if="versionInfo(name).codeFreeze" class="ml-2 text-xs text-gray-400">CF {{ formatDate(versionInfo(name).codeFreeze) }}</span>
                        <span v-else-if="versionInfo(name).releaseDate" class="ml-2 text-xs text-gray-400">{{ versionInfo(name).released ? 'Released' : 'Due' }} {{ formatDate(versionInfo(name).releaseDate) }}</span>
                      </div>
                      <span v-if="chosenVersionNames.has(name)" class="text-blue-500 flex-shrink-0">&#10003;</span>
                    </button>
                  </template>
                </template>
                <div v-if="!filteredVersions.length" class="px-3 py-4 text-center text-xs text-gray-400">
                  {{ availableVersions.length ? 'No matches' : 'No versions available' }}
                </div>
              </div>
            </div>
          </div>
          <!-- Refresh indicator -->
          <span
            v-if="refreshing"
            class="px-2.5 py-1.5 text-xs font-medium rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
          >
            Analyzing...
          </span>
        </div>
      </div>

      <!-- Category lists for selected release / milestone scope -->
      <div v-if="releaseData">
        <p
          v-if="selectionLabel"
          class="text-sm text-gray-600 dark:text-gray-300 mb-3"
        >
          Showing features for
          <span class="font-medium text-gray-900 dark:text-gray-100">{{ selectionLabel }}</span>
        </p>
        <!-- TV-Only -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/10 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2 min-w-0">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform shrink-0">&#9654;</span>
              <span class="text-sm font-semibold text-yellow-700 dark:text-yellow-400 truncate">
                TV-Only — Target Version set, no Fix Version ({{ releaseData.tv_only.length }})
              </span>
            </span>
            <a
              v-if="sectionJiraLinks.tv_only"
              :href="sectionJiraLinks.tv_only"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 whitespace-nowrap text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.tv_only"
            :columns="FEATURE_COLS"
            highlight-version-delta
          />
        </details>

        <!-- FV-Only -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2 min-w-0">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform shrink-0">&#9654;</span>
              <span class="text-sm font-semibold text-gray-600 dark:text-gray-400 truncate" :title="COLUMN_HELP.fv_only">
                FV-Only — Fix Version set, no Target Version ({{ releaseData.fv_only.length }})
              </span>
            </span>
            <a
              v-if="sectionJiraLinks.fv_only"
              :href="sectionJiraLinks.fv_only"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 whitespace-nowrap text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.fv_only"
            :columns="FEATURE_COLS"
            highlight-version-delta
          />
        </details>

        <!-- Aligned (on time) -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2 min-w-0">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform shrink-0">&#9654;</span>
              <span class="text-sm font-semibold text-green-700 dark:text-green-400 truncate" :title="COLUMN_HELP.aligned_on_time">
                Aligned — Early or as requested ({{ releaseData.aligned_on_time.length }})
              </span>
            </span>
            <a
              v-if="sectionJiraLinks.aligned_on_time"
              :href="sectionJiraLinks.aligned_on_time"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 whitespace-nowrap text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.aligned_on_time"
            :columns="FEATURE_COLS"
            highlight-version-delta
          />
        </details>

        <!-- After requested (yellow, before committed freeze) -->
        <details v-if="(releaseData.after_requested || []).length" class="group bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2 min-w-0">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform shrink-0">&#9654;</span>
              <span class="text-sm font-semibold text-amber-600 dark:text-amber-400 truncate" :title="COLUMN_HELP.after_requested">
                After requested — committed freeze not yet passed ({{ releaseData.after_requested.length }})
              </span>
            </span>
            <a
              v-if="sectionJiraLinks.after_requested"
              :href="sectionJiraLinks.after_requested"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 whitespace-nowrap text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.after_requested"
            :columns="FEATURE_COLS"
            highlight-version-delta
          />
        </details>

        <!-- After requested (green, after committed freeze) -->
        <details v-if="releaseData.aligned_late.length" class="group bg-white dark:bg-gray-800 rounded-lg border border-emerald-200 dark:border-emerald-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/10 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2 min-w-0">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform shrink-0">&#9654;</span>
              <span class="text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate" :title="COLUMN_HELP.aligned_late">
                After requested — committed freeze has passed ({{ releaseData.aligned_late.length }})
              </span>
            </span>
            <a
              v-if="sectionJiraLinks.aligned_late"
              :href="sectionJiraLinks.aligned_late"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 whitespace-nowrap text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.aligned_late"
            :columns="FEATURE_COLS"
          />
        </details>

        <!-- Different products -->
        <details v-if="releaseData.misaligned.length" class="group bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/10 flex items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2 min-w-0">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform shrink-0">&#9654;</span>
              <span class="text-sm font-semibold text-orange-700 dark:text-orange-400 truncate" :title="COLUMN_HELP.misaligned">
                Different products ({{ releaseData.misaligned.length }})
              </span>
            </span>
            <a
              v-if="sectionJiraLinks.misaligned"
              :href="sectionJiraLinks.misaligned"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 whitespace-nowrap text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.misaligned"
            :columns="FEATURE_COLS"
            highlight-version-delta
          />
        </details>
      </div>

      <!-- Component Breakdown (per-release) -->
      <details v-if="releaseComponentBreakdown.length" class="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
        <summary class="list-none px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center [&::-webkit-details-marker]:hidden">
          <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform mr-2">&#9654;</span>
          <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">Component Breakdown</span>
        </summary>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Component</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">PM</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ENG</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" :title="COLUMN_HELP.total">Total</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" :title="COLUMN_HELP.aligned_on_time">Early or as requested</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" :title="COLUMN_HELP.after_requested + ' ' + COLUMN_HELP.aligned_late">After requested</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" :title="COLUMN_HELP.tv_only">TV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" :title="COLUMN_HELP.fv_only">FV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" :title="COLUMN_HELP.misaligned">Different products</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase" :title="COLUMN_HELP.alignment_pct">Alignment %</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="comp in releaseComponentBreakdown"
                :key="comp.component"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ comp.component }}</td>
                <td class="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ leadsFor(comp.component)?.pmLead || '—' }}
                </td>
                <td class="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ leadsFor(comp.component)?.engLead || '—' }}
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="comp.total" :jql="comp.total_jql" label="Total features" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="comp.aligned_on_time" :jql="comp.aligned_on_time_jql" color="green" label="Early or as requested" />
                </td>
                <td class="px-4 py-2 text-right whitespace-nowrap">
                  <span class="text-xs font-medium text-amber-600 dark:text-amber-400">{{ comp.after_requested || 0 }}</span>
                  <span class="text-gray-400 dark:text-gray-500 mx-0.5">/</span>
                  <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400">{{ comp.aligned_late || 0 }}</span>
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="comp.tv_only" :jql="comp.tv_only_jql" color="yellow" label="TV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="comp.fv_only" :jql="comp.fv_only_jql" color="muted" label="FV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="comp.misaligned" :jql="comp.misaligned_jql" color="red" label="Different products" />
                </td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="font-semibold"
                    :class="{
                      'text-red-600 dark:text-red-400': comp.alignment_pct < 50,
                      'text-yellow-600 dark:text-yellow-400': comp.alignment_pct >= 50 && comp.alignment_pct < 75,
                      'text-green-600 dark:text-green-400': comp.alignment_pct >= 75,
                    }"
                  >
                    {{ comp.alignment_pct }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </div>
</template>
