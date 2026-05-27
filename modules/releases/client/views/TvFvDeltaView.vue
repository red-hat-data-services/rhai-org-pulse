<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { apiRequest } from '@shared/client'
import ClickableCount from '../components/ClickableCount.vue'
import FeatureTable from '../components/FeatureTable.vue'

const data = ref(null)
const loading = ref(true)
const error = ref(null)
const refreshing = ref(false)

const selectedRelease = ref('')

// Release picker state
const registryReleases = ref([])
const chosenReleases = ref([])
const pickerOpen = ref(false)

// Track timers for cleanup
let pipelinePollTimeout = null
let refreshPollInterval = null
const pickerRef = ref(null)

// Close dropdown when clicking outside
function handleClickOutside(e) {
  if (pickerRef.value && !pickerRef.value.contains(e.target)) {
    pickerOpen.value = false
  }
}

// Auto-trigger refresh (watcher registered after definitions below)
let refreshDebounce = null
let initialLoadDone = false

const FEATURE_COLS = ['key', 'summary', 'status', 'target_version', 'fix_versions', 'color_status', 'product_manager', 'assignee', 'team', 'component']

// ---------------------------------------------------------------------------
// Release picker logic
// ---------------------------------------------------------------------------

/** Pick the next N releases whose code freeze is in the future (or most recent if all past) */
function autoSelectReleases(releases, count = 3) {
  const now = Date.now()
  const withDates = releases
    .filter(r => r.state === 'active' && r.fixVersions?.length)
    .map(r => ({
      ...r,
      freezeTs: r.milestones?.codeFreeze ? new Date(r.milestones.codeFreeze).getTime() : null,
      gaTs: r.milestones?.ga ? new Date(r.milestones.ga).getTime() : null,
    }))

  // Upcoming: code freeze in the future, sorted soonest-first
  const upcoming = withDates
    .filter(r => r.freezeTs && r.freezeTs > now)
    .sort((a, b) => a.freezeTs - b.freezeTs)

  if (upcoming.length >= count) return upcoming.slice(0, count)

  // Fill remaining with most recent past releases (newest first)
  const past = withDates
    .filter(r => !r.freezeTs || r.freezeTs <= now)
    .sort((a, b) => (b.freezeTs || 0) - (a.freezeTs || 0))

  return [...upcoming, ...past].slice(0, count)
}

/** Whether chosen releases differ from what's currently cached */
const selectionDirty = computed(() => {
  if (!data.value?.metadata?.releases) return allSelectedVersions.value.length > 0
  const cached = [...data.value.metadata.releases].sort()
  const chosen = [...allSelectedVersions.value].sort()
  if (cached.length !== chosen.length) return true
  return cached.some((v, i) => v !== chosen[i])
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Whether a version is present in the currently loaded data */
function isInCurrentData(name) {
  return data.value?.metadata?.releases?.includes(name) ?? false
}

// Jira versions (dropdown source when registry is sparse)
const jiraVersions = ref([])
const chosenVersionNames = ref(new Set())
const versionSearch = ref('')

/** All available versions for the dropdown — registry releases + Jira versions, deduplicated */
const availableVersions = computed(() => {
  const seen = new Set()
  const result = []

  // Registry releases first (richer metadata)
  for (const rel of registryReleases.value) {
    for (const fv of (rel.fixVersions || [])) {
      if (!seen.has(fv)) {
        seen.add(fv)
        result.push({
          name: fv,
          displayName: rel.displayName,
          codeFreeze: rel.milestones?.codeFreeze || null,
          source: 'registry',
        })
      }
    }
  }

  // Then Jira versions
  for (const v of jiraVersions.value) {
    if (!seen.has(v.name)) {
      seen.add(v.name)
      result.push({
        name: v.name,
        displayName: v.name,
        codeFreeze: null,
        releaseDate: v.releaseDate,
        released: v.released,
        source: 'jira',
      })
    }
  }

  return result
})

/** Filtered versions for the dropdown search */
const filteredVersions = computed(() => {
  const q = versionSearch.value.toLowerCase().trim()
  if (!q) return availableVersions.value
  return availableVersions.value.filter(v => v.name.toLowerCase().includes(q) || v.displayName.toLowerCase().includes(q))
})

/** The version name strings that are currently selected */
const allSelectedVersions = computed(() => [...chosenVersionNames.value])

// Auto-trigger refresh when selection changes (after initial load)
watch(allSelectedVersions, () => {
  if (!initialLoadDone) return
  if (!selectionDirty.value) return
  if (refreshDebounce) clearTimeout(refreshDebounce)
  refreshDebounce = setTimeout(() => {
    triggerRefresh()
  }, 800)
})

function toggleVersion(name) {
  const s = new Set(chosenVersionNames.value)
  if (s.has(name)) {
    s.delete(name)
  } else {
    s.add(name)
  }
  chosenVersionNames.value = s
}

function removeVersion(name) {
  const s = new Set(chosenVersionNames.value)
  s.delete(name)
  chosenVersionNames.value = s
  // Also remove from registry picks if present
  chosenReleases.value = chosenReleases.value.filter(r => !(r.fixVersions || []).includes(name) || (r.fixVersions || []).some(fv => fv !== name && s.has(fv)))
}

/** Enrich chosen version names with display info */
const chosenVersionsDisplay = computed(() => {
  return allSelectedVersions.value.map(name => {
    const info = availableVersions.value.find(v => v.name === name)
    return info || { name, displayName: name, source: 'manual' }
  })
})

// ---------------------------------------------------------------------------
// Component breakdown
// ---------------------------------------------------------------------------

const releaseComponentBreakdown = computed(() => {
  if (!releaseData.value || !data.value) return []

  const allFeatures = [
    ...releaseData.value.aligned.map(f => ({ ...f, category: 'aligned' })),
    ...releaseData.value.tv_only.map(f => ({ ...f, category: 'tv_only' })),
    ...releaseData.value.fv_only.map(f => ({ ...f, category: 'fv_only' })),
    ...releaseData.value.mismatched.map(f => ({ ...f, category: 'mismatched' })),
  ]

  const compMap = {}
  for (const feat of allFeatures) {
    const comps = feat.component ? feat.component.split(', ').map(c => c.trim()).filter(Boolean) : []
    for (const comp of comps) {
      if (!compMap[comp]) compMap[comp] = { component: comp, total: 0, aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0, keys: new Set() }
      if (!compMap[comp].keys.has(feat.key)) {
        compMap[comp].keys.add(feat.key)
        compMap[comp].total++
        compMap[comp][feat.category]++
      }
    }
  }

  const allComponentNames = data.value.metadata?.all_components || []

  let compList
  if (allComponentNames.length > 0) {
    compList = allComponentNames.map(compName => {
      const c = compMap[compName]
      return c
        ? { component: compName, total: c.total, aligned: c.aligned, tv_only: c.tv_only, fv_only: c.fv_only, mismatched: c.mismatched, alignment_pct: c.total ? Math.round(1000 * c.aligned / c.total) / 10 : 0 }
        : { component: compName, total: 0, aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0, alignment_pct: 0 }
    })
  } else {
    compList = Object.values(compMap).map(c => ({
      component: c.component, total: c.total, aligned: c.aligned, tv_only: c.tv_only, fv_only: c.fv_only, mismatched: c.mismatched,
      alignment_pct: c.total ? Math.round(1000 * c.aligned / c.total) / 10 : 0,
    }))
  }

  return compList.sort((a, b) => b.total - a.total || a.component.localeCompare(b.component))
})

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchRegistry() {
  try {
    const result = await apiRequest('/modules/releases/registry')
    registryReleases.value = (result.releases || []).filter(r => r.state === 'active')
    if (!chosenReleases.value.length) {
      const auto = autoSelectReleases(registryReleases.value)
      chosenReleases.value = auto
      // Seed chosenVersionNames from auto-selected registry releases
      const names = new Set()
      for (const rel of auto) {
        for (const fv of (rel.fixVersions || [])) names.add(fv)
      }
      if (names.size) chosenVersionNames.value = names
    }
  } catch {
    // Registry not available — fall back to whatever the server provides
  }
}

async function fetchVersions() {
  try {
    const result = await apiRequest('/modules/releases/tv-fv-delta/versions')
    jiraVersions.value = result.versions || []
  } catch {
    // Versions endpoint not available — dropdown will use registry only
  }
}

async function fetchData() {
  try {
    const result = await apiRequest('/modules/releases/tv-fv-delta')
    if (result._noCache) {
      refreshing.value = true
      pipelinePollTimeout = setTimeout(fetchData, 5000)
      return
    }
    data.value = result
    refreshing.value = !!result._refreshing
    if (result.metadata?.releases?.length && !selectedRelease.value) {
      selectedRelease.value = result.metadata.releases[0]
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function triggerRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    const body = allSelectedVersions.value.length
      ? { releases: allSelectedVersions.value }
      : {}
    await apiRequest('/modules/releases/tv-fv-delta/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (refreshPollInterval) clearInterval(refreshPollInterval)
    refreshPollInterval = setInterval(async () => {
      try {
        const status = await apiRequest('/modules/releases/tv-fv-delta/refresh/status')
        if (!status.running) {
          clearInterval(refreshPollInterval)
          refreshPollInterval = null
          refreshing.value = false
          selectedRelease.value = ''
          await fetchData()
        }
      } catch {
        clearInterval(refreshPollInterval)
        refreshPollInterval = null
        refreshing.value = false
      }
    }, 3000)
  } catch (e) {
    refreshing.value = false
    error.value = e.message
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  await Promise.all([fetchRegistry(), fetchVersions()])
  await fetchData()
  // If registry was empty and we have cached data, seed from cached releases
  if (!chosenVersionNames.value.size && data.value?.metadata?.releases?.length) {
    chosenVersionNames.value = new Set(data.value.metadata.releases)
  }
  // Enable auto-refresh watcher now that initial state is settled
  await nextTick()
  initialLoadDone = true
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  if (refreshDebounce) clearTimeout(refreshDebounce)
  if (pipelinePollTimeout) clearTimeout(pipelinePollTimeout)
  if (refreshPollInterval) clearInterval(refreshPollInterval)
})

const releaseData = computed(() => {
  if (!data.value || !selectedRelease.value) return null
  return data.value.releases[selectedRelease.value]
})

const releaseSummary = computed(() => {
  if (!data.value) return null
  return data.value.executive_summary.find(s => s.release === selectedRelease.value)
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
        @click="triggerRefresh"
        :disabled="refreshing"
        class="px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
        :class="refreshing
          ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
      >
        {{ refreshing ? 'Refreshing...' : 'Refresh from Jira' }}
      </button>
    </div>

    <!-- Release Picker -->
    <div class="mb-6">
      <div class="flex items-center gap-3 flex-wrap">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Releases:</span>
        <!-- Selected version chips -->
        <span
          v-for="v in chosenVersionsDisplay"
          :key="v.name"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border"
          :class="isInCurrentData(v.name)
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700 border-dashed'"
        >
          {{ v.displayName }}
          <span v-if="v.codeFreeze" class="text-blue-400 dark:text-blue-500">
            CF {{ formatDate(v.codeFreeze) }}
          </span>
          <button
            @click="removeVersion(v.name)"
            class="ml-0.5 opacity-40 hover:opacity-100 transition-opacity"
            title="Remove"
          >&times;</button>
        </span>
        <!-- Dropdown trigger -->
        <div class="relative" ref="pickerRef">
          <button
            @click.stop="pickerOpen = !pickerOpen"
            class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            + Add release
          </button>
          <!-- Dropdown panel -->
          <div
            v-if="pickerOpen"
            class="absolute z-20 mt-1 left-0 w-80 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
            @click.stop
          >
            <!-- Search -->
            <div class="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                v-model="versionSearch"
                type="text"
                placeholder="Search versions..."
                class="w-full px-2.5 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <!-- Version list -->
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
          class="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
        >
          Analyzing...
        </span>
      </div>
    </div>

    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading...</div>
    <div v-else-if="error" class="text-red-600 dark:text-red-400">{{ error }}</div>

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
                v-for="row in data.executive_summary"
                :key="row.release"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                :class="{ 'bg-blue-50/50 dark:bg-blue-900/10': row.release === selectedRelease }"
                @click="selectedRelease = row.release"
              >
                <td class="px-4 py-2 font-mono text-xs font-medium text-gray-900 dark:text-gray-100">
                  {{ row.release }}
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.total" :jql="row.total_jql" label="Total features" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.aligned" :jql="row.aligned_jql" color="green" label="Aligned" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.tv_only" :jql="row.tv_only_jql" color="yellow" label="TV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount :count="row.fv_only" :jql="row.fv_only_jql" color="muted" label="FV-only" />
                </td>
                <td class="px-4 py-2 text-right">
                  <ClickableCount
                    :count="row.mismatched"
                    :jql="row.mismatched_jql"
                    color="red"
                    label="Mismatched"
                  />
                </td>
                <td class="px-4 py-2 text-right">
                  <span
                    class="font-semibold"
                    :class="{
                      'text-red-600 dark:text-red-400': row.alignment_pct < 50,
                      'text-yellow-600 dark:text-yellow-400': row.alignment_pct >= 50 && row.alignment_pct < 75,
                      'text-green-600 dark:text-green-400': row.alignment_pct >= 75,
                    }"
                  >
                    {{ row.alignment_pct }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Release tabs -->
      <div class="flex gap-2 mb-6">
        <button
          v-for="rel in data.metadata.releases"
          :key="rel"
          class="px-3 py-1.5 text-sm rounded-md transition-colors"
          :class="rel === selectedRelease
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
          @click="selectedRelease = rel"
        >
          {{ rel }}
        </button>
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
