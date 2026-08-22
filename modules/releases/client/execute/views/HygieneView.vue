<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import KanbanBoard from '../components/hygiene/KanbanBoard.vue'
import FeatureDrawer from '../components/hygiene/FeatureDrawer.vue'
import HygieneWelcomeModal from '../components/hygiene/HygieneWelcomeModal.vue'
import { useReleaseSelector } from '../../composables/useReleaseSelector.js'
import { useReportFilters } from '../../reports/composables/useReportFilters.js'
import ReportFilterModal from '../../reports/components/ReportFilterModal.vue'

const nav = inject('moduleNav')

// ── Release selector (shared composable) ──

const {
  modalOpen,
  selection,
  draft,
  parsedReleases,
  availableFamilies,
  draftVersions,
  draftPhases,
  isAllFamiliesDraft,
  hasSelection,
  canApply,
  fetchRegistry,
  restoreSelection,
  openModal,
  cancelModal,
  applyModal,
  toggleAllFamilies,
  toggleFamily,
  selectVersionDraft: selectVersion,
  togglePhase,
  selectedRegistryIdSet,
  PHASE_ORDER
} = useReleaseSelector({ storageKey: 'tt_cache:hygiene-status-selection' })

// Registry entries matching the current selection (single version × families × phases).
const selectedReleases = computed(() => {
  const ids = selectedRegistryIdSet()
  return parsedReleases.value.filter(r => ids.has(r.id))
})

// Compact label for the release-selector pill, e.g. "All families · 3.5 · EA2/GA".
const releaseLabel = computed(() => {
  if (!hasSelection.value) return 'Select release'
  const families = selection.families.size === availableFamilies.value.length
    ? 'All families'
    : [...selection.families].map(f => f.toUpperCase()).sort().join(', ')
  const phases = [...selection.phases]
    .sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
    .join('/')
  return `${families} · ${selection.version} · ${phases}`
})

// ── Data state ──

const hygieneFeatures = ref({})
const executionFeatures = ref([])
const fetchedAt = ref(null)
const loading = ref(false)
const error = ref(null)

async function loadData(releases) {
  if (!releases || releases.length === 0) {
    hygieneFeatures.value = {}
    executionFeatures.value = []
    fetchedAt.value = null
    return
  }
  loading.value = true
  error.value = null

  try {
    const mergedHygiene = {}
    let oldestFetchedAt = null
    const execByKey = {}

    await Promise.all(releases.map(async (rel) => {
      const version = rel.displayName
      const execVersion = (rel.fixVersions && rel.fixVersions.length > 0)
        ? rel.fixVersions[0]
        : version

      const [hygieneData, execData] = await Promise.all([
        apiRequest(`/modules/releases/hygiene/features?version=${encodeURIComponent(version)}`),
        apiRequest(`/modules/releases/execution/features?version=${encodeURIComponent(execVersion)}`)
      ])

      Object.assign(mergedHygiene, hygieneData.features || {})

      const fa = hygieneData.fetchedAt
      if (fa && (!oldestFetchedAt || new Date(fa) < new Date(oldestFetchedAt))) {
        oldestFetchedAt = fa
      }

      for (const f of (execData.features || [])) {
        execByKey[f.key] = f
      }
    }))

    hygieneFeatures.value = mergedHygiene
    fetchedAt.value = oldestFetchedAt
    executionFeatures.value = Object.values(execByKey)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const mergedFeatures = computed(() => {
  const execMap = {}
  for (const f of executionFeatures.value) {
    execMap[f.key] = f
  }

  const result = []
  const keys = Object.keys(hygieneFeatures.value)
  for (const key of keys) {
    const hf = hygieneFeatures.value[key]
    const ef = execMap[key]
    result.push({
      ...hf,
      status: hf.status || (ef && ef.status) || null,
      statusCategory: hf.statusCategory || (ef && ef.statusCategory) || null,
    })
  }
  return result
})

// Counts reflect the currently filtered feature set (bugs already excluded by
// the /features endpoint). Violations use each feature's stored `violations`
// array — the same source the kanban cards use for their per-card badge.
const filteredStats = computed(() => {
  let withViolations = 0
  let totalViolations = 0
  for (const f of filteredFeatures.value) {
    const count = Array.isArray(f.violations) ? f.violations.length : 0
    if (count > 0) withViolations++
    totalViolations += count
  }
  return {
    total: filteredFeatures.value.length,
    withViolations,
    totalViolations
  }
})

const isStale = computed(() => {
  if (!fetchedAt.value) return false
  const diff = Date.now() - new Date(fetchedAt.value).getTime()
  return diff > 24 * 60 * 60 * 1000
})

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

// Clicking a card opens a summary drawer; "View full details" then navigates.
const drawerFeature = ref(null)

function handleFeatureClick(feature) {
  drawerFeature.value = feature
}

function openFeatureDetails() {
  const feature = drawerFeature.value
  if (!feature) return
  drawerFeature.value = null
  // Selection is persisted to localStorage + URL params by the release selector,
  // so returning from the detail view restores the current release scope.
  nav.navigateTo('feature-detail', { key: feature.key, from: 'feature-status' })
}

const hasData = computed(() => {
  return fetchedAt.value !== null && Object.keys(hygieneFeatures.value).length > 0
})

// Refetch whenever the selected release scope changes.
watch(selectedReleases, (releases) => {
  loadData(releases)
}, { immediate: true })

onMounted(async () => {
  try {
    await fetchRegistry()
    restoreSelection()
  } catch (err) {
    error.value = err.message
  }
})

// ── Field filters (shared report filter composable) ──

const FILTER_FIELDS = [
  { key: 'team', label: 'Team' },
  { key: 'components', label: 'Component' },
  { key: 'labels', label: 'Label' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'issueType', label: 'Type' },
  { key: 'priority', label: 'Priority' }
]

const filters = useReportFilters({
  storageKeyPrefix: 'hygiene-status',
  filterFields: FILTER_FIELDS
})

const knownComponents = ref([])
const knownTeams = ref([])

async function fetchFieldOptions() {
  try {
    const [components, teams] = await Promise.all([
      apiRequest('/modules/team-tracker/field-options/component'), // eslint-disable-line org-pulse/no-cross-module-imports
      apiRequest('/modules/team-tracker/field-options/jiraTeam') // eslint-disable-line org-pulse/no-cross-module-imports
    ])
    knownComponents.value = components.values || []
    knownTeams.value = teams.values || []
  } catch {
    // Field options are non-fatal — fall back to values found in loaded features.
  }
}

onMounted(fetchFieldOptions)

// Dropdown option sets: curated master lists (component/team) unioned with
// values present in the currently loaded features.
const availableFilterValues = computed(() => {
  const result = {}
  for (const field of FILTER_FIELDS) {
    const values = new Set()
    if (field.key === 'components') {
      knownComponents.value.forEach(v => values.add(v))
    } else if (field.key === 'team') {
      knownTeams.value.forEach(v => values.add(v))
    }
    for (const f of mergedFeatures.value) {
      const val = f[field.key]
      if (Array.isArray(val)) {
        val.forEach(v => { if (v) values.add(v) })
      } else if (val) {
        values.add(val)
      }
    }
    result[field.key] = [...values].sort()
  }
  return result
})

const filteredFeatures = computed(() => filters.filterItems(mergedFeatures.value))

// ── Intro section ──

const welcomeModalRef = ref(null)
const hygieneRuleDetails = ref(null)
const isPlanningManager = ref(false)

async function loadRuleCategories() {
  try {
    const data = await apiRequest('/modules/releases/hygiene/config')
    isPlanningManager.value = true
    if (data && data.ruleDefinitions) {
      const rulesConfig = (data.config && data.config.rules) || {}
      const detailMap = {}
      for (const rule of data.ruleDefinitions) {
        const cat = rule.category || 'other'
        if (!detailMap[cat]) {
          detailMap[cat] = { label: rule.categoryLabel || cat, rules: [] }
        }
        const ruleOverride = rulesConfig[rule.id]
        const enabled = ruleOverride && typeof ruleOverride.enabled === 'boolean'
          ? ruleOverride.enabled
          : rule.defaultEnabled
        detailMap[cat].rules.push({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          enabled
        })
      }
      hygieneRuleDetails.value = detailMap
    }
  } catch {
    // Non-managers can't access config — fall back to static summary
    hygieneRuleDetails.value = null
    isPlanningManager.value = false
  }
}

onMounted(() => {
  loadRuleCategories()
})
</script>

<template>
  <div>
    <!-- Purpose + how-versions-are-matched explainer -->
    <div class="mb-3 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
      <span>Tracks hygiene-rule compliance for features in the selected release.</span>
      <span class="relative group inline-flex shrink-0">
        <button
          type="button"
          class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
          aria-label="How features are matched to a release"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          How releases are matched
        </button>
        <span
          class="pointer-events-none absolute left-0 top-full z-30 mt-1.5 hidden w-96 max-w-[90vw] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs font-normal leading-relaxed text-gray-600 dark:text-gray-300 shadow-lg group-hover:block group-focus-within:block"
        >
          A feature appears under a release based on its <strong class="text-gray-900 dark:text-gray-100">Fix Version</strong> — the release engineering has committed to deliver in. Until a Fix Version is set, its <strong class="text-gray-900 dark:text-gray-100">Target Version</strong> (the PM's requested release) is used instead. When both are set and point to different releases, the Fix Version wins and a hygiene violation flags the mismatch so the Target Version can be realigned.
        </span>
      </span>
    </div>

    <!-- Compact toolbar: release selector · filters · stats · rules -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 mb-6">
      <div class="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        <!-- Release + filters -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            @click="openModal"
            data-testid="hygiene-release-selector"
            class="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border transition-colors"
            :class="hasSelection
              ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-primary-300 dark:hover:border-primary-600'
              : 'border-primary-600 bg-primary-600 text-white hover:bg-primary-700'"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
            </svg>
            <span>{{ releaseLabel }}</span>
            <svg class="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <button
            v-if="hasSelection"
            @click="filters.openFilterModal()"
            data-testid="hygiene-filters-button"
            class="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
          >
            <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            <span>Filters</span>
            <span
              v-if="filters.activeFieldCount.value > 0"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
            >{{ filters.activeFieldCount.value }}</span>
          </button>

          <button
            v-if="filters.hasActiveFilters.value"
            @click="filters.clearAllFilters()"
            class="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >Clear</button>
        </div>

        <!-- Stats + refreshed + rules -->
        <div class="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
          <template v-if="hasData">
            <span class="flex items-center gap-1.5">
              <span class="text-gray-500 dark:text-gray-400">Features:</span>
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ filteredStats.total }}</span>
              <span v-if="filters.hasActiveFilters.value" class="text-xs text-gray-400 dark:text-gray-500">of {{ mergedFeatures.length }}</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="text-gray-500 dark:text-gray-400">With violations:</span>
              <span
                class="font-semibold"
                :class="filteredStats.withViolations > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
              >{{ filteredStats.withViolations }}</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span class="text-gray-500 dark:text-gray-400">Total violations:</span>
              <span
                class="font-semibold"
                :class="filteredStats.totalViolations > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'"
              >{{ filteredStats.totalViolations }}</span>
            </span>
            <span
              v-if="fetchedAt"
              class="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500"
              :title="'Last refreshed: ' + formatDate(fetchedAt)"
            >
              <span :class="{ 'text-orange-500 dark:text-orange-400 font-medium': isStale }">Refreshed {{ formatDate(fetchedAt) }}</span>
              <span
                v-if="isStale"
                class="inline-flex items-center gap-0.5 text-orange-500 dark:text-orange-400"
                title="Data is more than 24 hours old"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                Stale
              </span>
            </span>
          </template>
          <button
            @click="welcomeModalRef?.show()"
            data-testid="hygiene-rules-button"
            class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            Hygiene rules
          </button>
        </div>
      </div>

      <!-- Active filters (only when filtered): every value shown, grouped by
           field, each removable — so the full applied set is always visible. -->
      <div
        v-if="filters.hasActiveFilters.value"
        class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50 flex items-start gap-x-3 gap-y-1.5 flex-wrap text-[11px]"
      >
        <span class="text-gray-400 dark:text-gray-500 shrink-0 py-0.5">Filtered by:</span>
        <div
          v-for="(values, field) in filters.activeFilterDisplay.value"
          :key="field"
          class="flex items-center gap-1 flex-wrap"
        >
          <span class="text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">{{ filters.filterFieldLabel(field) }}</span>
          <span
            v-for="val in values"
            :key="val"
            class="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            {{ val }}
            <button
              type="button"
              @click="filters.toggleFilterValue(field, val)"
              :title="'Remove ' + filters.filterFieldLabel(field) + ' filter: ' + val"
              class="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
            >
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      </div>
    </div>

    <!-- No selection hint -->
    <div v-if="!hasSelection" class="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
      Select a release to view feature hygiene across the release lifecycle.
    </div>

    <!-- Error state -->
    <div v-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm mb-6">
      {{ error }}
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading feature data...
    </div>

    <!-- Empty state -->
    <div
      v-else-if="hasSelection && !hasData && !error"
      class="text-center py-12"
    >
      <p class="text-gray-500 dark:text-gray-400 mb-4">No hygiene data available for this release.</p>
      <p class="text-xs text-gray-400 dark:text-gray-500">Use the Manage page to trigger a hygiene data refresh.</p>
    </div>

    <!-- Kanban board -->
    <KanbanBoard
      v-else-if="!loading && hasData"
      :features="filteredFeatures"
      @feature-click="handleFeatureClick"
    />

    <!-- Release selector modal -->
    <Teleport to="body">
      <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="cancelModal"></div>
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
          @keydown.escape="cancelModal"
        >
          <!-- Modal header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Release</h3>
            <button
              @click="cancelModal"
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Product Family -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Product Family</label>
            <div class="flex flex-wrap gap-2">
              <button
                @click="toggleAllFamilies"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="isAllFamiliesDraft
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >All</button>
              <button
                v-for="f in availableFamilies"
                :key="f"
                @click="toggleFamily(f)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.families.has(f)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ f.toUpperCase() }}</button>
            </div>
          </div>

          <!-- Version -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Version</label>
            <div v-if="draftVersions.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="v in draftVersions"
                :key="v"
                @click="selectVersion(v)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.version === v
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ v }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a product family first.</p>
          </div>

          <!-- Phase -->
          <div class="mb-6">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Phase</label>
            <div v-if="draftPhases.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="p in draftPhases"
                :key="p"
                @click="togglePhase(p)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.phases.has(p)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ p }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a version first.</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="cancelModal"
              class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >Cancel</button>
            <button
              @click="applyModal"
              :disabled="!canApply"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >Apply</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Field filter modal -->
    <ReportFilterModal :filters="filters" :available-filter-values="availableFilterValues" />

    <!-- Feature summary drawer -->
    <FeatureDrawer
      :feature="drawerFeature"
      @close="drawerFeature = null"
      @view-details="openFeatureDetails"
    />

    <!-- Welcome modal (first visit) -->
    <HygieneWelcomeModal
      ref="welcomeModalRef"
      :rule-details="hygieneRuleDetails"
      :is-planning-manager="isPlanningManager"
      @navigate-manage="nav.navigateTo('registry', { tab: 'hygiene' })"
    />
  </div>
</template>
