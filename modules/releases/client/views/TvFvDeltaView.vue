<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import ClickableCount from '../components/ClickableCount.vue'
import FeatureTable from '../components/FeatureTable.vue'
import { useReleasePicker } from '../composables/useReleasePicker'
import { useComponentBreakdown } from '../composables/useComponentBreakdown'
import { useTvFvData } from '../composables/useTvFvData'

const FEATURE_COLS = ['key', 'summary', 'status', 'target_version', 'fix_versions', 'color_status', 'product_manager', 'assignee', 'team', 'component']

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
  chosenReleases, pickerOpen, pickerRef,
  chosenVersionNames, versionSearch,
  availableVersions, filteredVersions, allSelectedVersions,
  chosenVersionsDisplay,
  autoSelectReleases, formatDate, isInCurrentData,
  toggleVersion, removeVersion, handleClickOutside,
} = useReleasePicker(data, registryReleases, jiraVersions)

// Wrap triggerRefresh to pass the picker's allSelectedVersions
const doRefresh = () => triggerRefresh(allSelectedVersions)

const releaseData = computed(() => {
  if (!data.value || !selectedRelease.value) return null
  return data.value.releases[selectedRelease.value]
})

const releaseSummary = computed(() => {
  if (!data.value) return null
  return data.value.executive_summary.find(s => s.release === selectedRelease.value)
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
        release: name, total: 0, aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0,
        alignment_pct: 0, _pending: true,
      })
    }
  }
  return rows
})

const { releaseComponentBreakdown } = useComponentBreakdown(data, releaseData)

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
  // Seed picker from registry auto-selection
  if (!chosenReleases.value.length && registryReleases.value.length) {
    const auto = autoSelectReleases(registryReleases.value)
    chosenReleases.value = auto
    const names = new Set()
    for (const rel of auto) {
      for (const fv of (rel.fixVersions || [])) names.add(fv)
    }
    if (names.size) chosenVersionNames.value = names
  }
  await fetchData()
  // If registry was empty and we have cached data, seed from cached releases
  if (!chosenVersionNames.value.size && data.value?.metadata?.releases?.length) {
    chosenVersionNames.value = new Set(data.value.metadata.releases)
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

      <!-- Executive Summary -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Executive Summary</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/50">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Release</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aligned</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">TV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">FV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mismatched</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Alignment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="row in filteredSummary"
                :key="row.release"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                :class="{ 'bg-blue-50/50 dark:bg-blue-900/10': row.release === selectedRelease }"
                @click="!row._pending ? selectedRelease = row.release : null"
              >
                <td class="px-4 py-2 font-mono text-xs font-medium" :class="row._pending ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'">
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
                  <ClickableCount v-if="!row._pending" :count="row.aligned" :jql="row.aligned_jql" color="green" label="Aligned" />
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
                  <ClickableCount v-if="!row._pending" :count="row.mismatched" :jql="row.mismatched_jql" color="red" label="Mismatched" />
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
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Release selector -->
      <div class="flex items-center gap-2 mb-6 flex-wrap">
        <button
          v-for="v in chosenVersionsDisplay"
          :key="v.name"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
          :class="isInCurrentData(v.name)
            ? (v.name === selectedRelease
              ? 'bg-blue-600 text-white border-blue-600 dark:border-blue-500'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700')
            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 border-dashed'"
          @click="isInCurrentData(v.name) ? selectedRelease = v.name : null"
        >
          {{ v.name }}
          <span
            @click.stop="removeVersion(v.name)"
            class="ml-0.5 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
            title="Remove"
          >&times;</span>
        </button>
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
            class="absolute z-20 mt-1 left-0 w-80 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
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
            <div class="max-h-64 overflow-y-auto">
              <button
                v-for="v in filteredVersions"
                :key="v.name"
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-2 transition-colors"
                :class="{ 'bg-blue-50 dark:bg-blue-900/20': chosenVersionNames.has(v.name) }"
                @click.stop="toggleVersion(v.name)"
              >
                <div class="min-w-0">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ v.displayName }}</span>
                  <span v-if="v.codeFreeze" class="ml-2 text-xs text-gray-400">CF {{ formatDate(v.codeFreeze) }}</span>
                  <span v-else-if="v.releaseDate" class="ml-2 text-xs text-gray-400">{{ v.released ? 'Released' : 'Due' }} {{ formatDate(v.releaseDate) }}</span>
                </div>
                <span v-if="chosenVersionNames.has(v.name)" class="text-blue-500 flex-shrink-0">&#10003;</span>
              </button>
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

      <!-- Category lists for selected release -->
      <div v-if="releaseData">
        <!-- TV-Only -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-900/10 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                TV-Only — PM targeted, no ENG commitment ({{ releaseData.tv_only.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.tv_only_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.tv_only"
            :columns="FEATURE_COLS"
          />
        </details>

        <!-- FV-Only -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-gray-600 dark:text-gray-400">
                FV-Only — ENG committed, not PM-planned ({{ releaseData.fv_only.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.fv_only_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.fv_only"
            :columns="FEATURE_COLS"
          />
        </details>

        <!-- Mismatched -->
        <details v-if="releaseData.mismatched.length" class="group bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-red-700 dark:text-red-400">
                Mismatched — TV and FV disagree ({{ releaseData.mismatched.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.mismatched_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.mismatched"
            :columns="FEATURE_COLS"
          />
        </details>

        <!-- Aligned -->
        <details class="group bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 overflow-hidden mb-4">
          <summary class="list-none px-4 py-3 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/10 flex items-center justify-between [&::-webkit-details-marker]:hidden">
            <span class="flex items-center gap-2">
              <span class="text-xs text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
              <span class="text-sm font-semibold text-green-700 dark:text-green-400">
                Aligned — TV == FV ({{ releaseData.aligned.length }})
              </span>
            </span>
            <a
              v-if="releaseSummary"
              :href="releaseSummary.aligned_jql"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              @click.stop
            >
              View in Jira &rarr;
            </a>
          </summary>
          <FeatureTable
            :features="releaseData.aligned"
            :columns="FEATURE_COLS"
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
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Aligned</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">TV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">FV-Only</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mismatched</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Alignment</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="comp in releaseComponentBreakdown"
                :key="comp.component"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{{ comp.component }}</td>
                <td class="px-4 py-2 text-right text-gray-700 dark:text-gray-300">{{ comp.total }}</td>
                <td class="px-4 py-2 text-right text-green-600 dark:text-green-400">{{ comp.aligned }}</td>
                <td class="px-4 py-2 text-right text-yellow-600 dark:text-yellow-400">{{ comp.tv_only }}</td>
                <td class="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{{ comp.fv_only }}</td>
                <td class="px-4 py-2 text-right text-red-600 dark:text-red-400">{{ comp.mismatched }}</td>
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
