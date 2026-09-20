<script setup>
import { ref, computed, onMounted, watch, inject, nextTick } from 'vue'
import { apiRequest, getApiBase } from '@shared/client/services/api.js'
import { useReportFilters } from '../../reports/composables/useReportFilters.js'
import { useExecuteWorkspace } from '../composables/useExecuteWorkspace.js'
import { signalIdForFeature, liveExecuteFeatures } from '../helpers/signal-groups.js'
import {
  STORAGE_KEY as PICKER_STORAGE_KEY,
  listTrackingVersions,
  productsForVersion,
  buildReleaseSpecs,
  parseProductsFromParams,
  reconcileSelection
} from '../helpers/tracking-picker.js'
import ReportFilterModal from '../../reports/components/ReportFilterModal.vue'
import KanbanBoard from '../components/hygiene/KanbanBoard.vue'
import FeatureDrawer from '../components/hygiene/FeatureDrawer.vue'
import HygieneWelcomeModal from '../components/hygiene/HygieneWelcomeModal.vue'
import FeatureTrackingTable from '../components/FeatureTrackingTable.vue'
import FeatureTrackingSettingsPanel from '../components/FeatureTrackingSettingsPanel.vue'
import FeatureSignalsBoard from '../components/FeatureSignalsBoard.vue'
import HygieneSelect from '../components/hygiene/HygieneSelect.vue'
import HygieneAnalyticsPanel from '../components/hygiene/HygieneAnalyticsPanel.vue'

const props = defineProps({
  viewMode: { type: String, default: 'table' }
})

const emit = defineEmits(['update:viewMode'])

const nav = inject('moduleNav')

const VIEW_MODES = [
  { id: 'table', label: 'Table' },
  { id: 'board', label: 'Kanban' },
  { id: 'signals', label: 'Signals' }
]

const SIGNAL_OPTIONS = [
  { value: 'blocked', label: 'Blocked' },
  { value: 'red-other', label: 'Needs Attention' },
  { value: 'at-risk', label: 'At Risk' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'on-track', label: 'On Track' },
  { value: 'complete', label: 'Complete' }
]

const {
  loading,
  error,
  features,
  groups,
  planningFreezeDate,
  fetchedAt,
  loadWorkspace
} = useExecuteWorkspace()

const selectedVersion = ref('')
const selectedProducts = ref([])
const refreshing = ref(false)
const settingsOpen = ref(false)
const hygieneCollapsed = ref(true)
const trackingConfig = ref({ releases: {} })

const freezeDatesByVersion = ref({})
const trackingVersions = computed(() => listTrackingVersions(trackingConfig.value, freezeDatesByVersion.value))
const availableProducts = computed(() => productsForVersion(trackingConfig.value, selectedVersion.value))
const hasSelection = computed(() => !!selectedVersion.value && trackingVersions.value.indexOf(selectedVersion.value) >= 0)

const CHIP_ACTIVE = 'border-primary-600 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
const CHIP_IDLE = 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-300'
const tableRef = ref(null)
const searchQuery = ref('')
const selectedSignals = ref([])
const activeCardFilter = ref(null)
const drawerFeature = ref(null)

const FILTER_FIELDS = [
  { key: 'team', label: 'Team' },
  { key: 'components', label: 'Component' },
  { key: 'labels', label: 'Label' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'issueType', label: 'Type' },
  { key: 'priority', label: 'Priority' }
]

const filters = useReportFilters({
  storageKeyPrefix: 'execute-workspace',
  filterFields: FILTER_FIELDS
})

const knownComponents = ref([])
const knownTeams = ref([])

const portfolioVersion = computed(() => selectedVersion.value || '')

const freezeStatus = computed(() => {
  if (!planningFreezeDate.value) return 'unknown'
  const today = new Date().toISOString().split('T')[0]
  return today >= planningFreezeDate.value ? 'past' : 'future'
})

const kpi = computed(() => {
  const all = features.value || []
  let live = 0
  let added = 0
  let dropped = 0
  let blocked = 0
  let withViolations = 0
  let totalViolations = 0
  let done = 0
  let inProgress = 0
  let todo = 0
    let completionSum = 0
    let completionCount = 0
    for (let i = 0; i < all.length; i++) {
      const f = all[i]
      if (f.scopeChange === 'dropped') dropped++
      else live++
      if (f.scopeChange === 'added') added++
      if (f.isBlocked && f.scopeChange !== 'dropped') blocked++
      const vCount = Array.isArray(f.violations) ? f.violations.length : 0
      if (vCount > 0) withViolations++
      totalViolations += vCount
      if (f.statusCategory === 'Done') done++
      else if (f.statusCategory === 'In Progress') inProgress++
      else todo++
      if (typeof f.completionPct === 'number') {
        completionSum += f.completionPct
        completionCount++
      }
    }
    return {
      features: live,
      added,
      dropped,
      blocked,
      withViolations,
      totalViolations,
      done,
      inProgress,
      todo,
      avgCompletion: completionCount > 0 ? Math.round(completionSum / completionCount) : 0
    }
})

const fieldFilteredFeatures = computed(() => filters.filterItems(features.value || []))

const overlayFilteredFeatures = computed(() => {
  let list = fieldFilteredFeatures.value
  const q = (searchQuery.value || '').trim().toLowerCase()
  if (q) {
    list = list.filter(f =>
      (f.key && f.key.toLowerCase().includes(q)) ||
      (f.summary && f.summary.toLowerCase().includes(q))
    )
  }
  if (activeCardFilter.value === 'added') {
    list = list.filter(f => f.scopeChange === 'added')
  } else if (activeCardFilter.value === 'dropped') {
    list = list.filter(f => f.scopeChange === 'dropped')
  } else if (activeCardFilter.value === 'blocked') {
    list = list.filter(f => f.isBlocked && f.scopeChange !== 'dropped')
  } else if (activeCardFilter.value === 'violations') {
    list = list.filter(f => Array.isArray(f.violations) && f.violations.length > 0)
  }
  if (selectedSignals.value.length > 0) {
    const allowed = {}
    for (let i = 0; i < selectedSignals.value.length; i++) {
      allowed[selectedSignals.value[i]] = true
    }
    list = list.filter(f => allowed[signalIdForFeature(f)])
  }
  return list
})

const liveOverlayFeatures = computed(() => liveExecuteFeatures(overlayFilteredFeatures.value))

const filteredKeySet = computed(() => {
  const set = {}
  const list = overlayFilteredFeatures.value
  for (let i = 0; i < list.length; i++) set[list[i].key] = true
  return set
})

const filteredGroups = computed(() => {
  const keys = filteredKeySet.value
  return (groups.value || []).map(g => {
    const feats = (g.features || []).filter(f => keys[f.key])
    return {
      ...g,
      features: feats,
      featureCount: feats.filter(f => f.scopeChange !== 'dropped').length
    }
  }).filter(g => g.features.length > 0)
})

const filteredFeatureCount = computed(() => {
  return overlayFilteredFeatures.value.filter(f => f.scopeChange !== 'dropped').length
})

const isFiltered = computed(() => {
  return !!(
    searchQuery.value ||
    filters.hasActiveFilters.value ||
    activeCardFilter.value ||
    selectedSignals.value.length > 0
  )
})

const isStale = computed(() => {
  if (!fetchedAt.value) return false
  return Date.now() - new Date(fetchedAt.value).getTime() > 24 * 60 * 60 * 1000
})

const hasData = computed(() => (features.value || []).length > 0)

const availableFilterValues = computed(() => {
  const result = {}
  for (const field of FILTER_FIELDS) {
    const values = new Set()
    if (field.key === 'components') knownComponents.value.forEach(v => values.add(v))
    if (field.key === 'team') knownTeams.value.forEach(v => values.add(v))
    for (const f of features.value || []) {
      const val = f[field.key]
      if (Array.isArray(val)) val.forEach(v => { if (v) values.add(v) })
      else if (val) values.add(val)
    }
    result[field.key] = [...values].sort()
  }
  return result
})

const signalFilterLabel = computed(() => {
  if (selectedSignals.value.length === 0) return 'All states'
  if (selectedSignals.value.length === 1) {
    const opt = SIGNAL_OPTIONS.find(o => o.value === selectedSignals.value[0])
    return opt ? opt.label : selectedSignals.value[0]
  }
  return selectedSignals.value.length + ' states'
})

const isAllProducts = computed(() => {
  const available = availableProducts.value
  if (available.length === 0) return true
  if (selectedProducts.value.length === 0) return true
  return selectedProducts.value.length === available.length
})

const productDropdownOptions = computed(() =>
  availableProducts.value.map(function (p) {
    return { value: p.family, label: p.family.toUpperCase() }
  })
)

const productDropdownValue = computed(() =>
  isAllProducts.value ? [] : selectedProducts.value.slice()
)

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

function setViewMode(id) {
  emit('update:viewMode', id)
}

function toggleSignal(id) {
  const idx = selectedSignals.value.indexOf(id)
  if (idx >= 0) selectedSignals.value.splice(idx, 1)
  else selectedSignals.value.push(id)
}

function setCardFilter(type) {
  if (type === null || activeCardFilter.value === type) {
    activeCardFilter.value = null
  } else {
    activeCardFilter.value = type
  }
}

function handleCardClick(type) {
  const counts = {
    added: kpi.value.added,
    dropped: kpi.value.dropped,
    blocked: kpi.value.blocked,
    violations: kpi.value.withViolations
  }
  if (counts[type] === 0) return
  setCardFilter(type)
  if (activeCardFilter.value === type && tableRef.value) {
    nextTick(() => tableRef.value.expandAll())
  }
}

function clearAllFilters() {
  searchQuery.value = ''
  selectedSignals.value = []
  activeCardFilter.value = null
  filters.clearAllFilters()
}

function currentSpecs() {
  return buildReleaseSpecs(trackingConfig.value, {
    version: selectedVersion.value,
    products: selectedProducts.value
  }, freezeDatesByVersion.value)
}

function persistSelection() {
  const data = {
    version: selectedVersion.value,
    products: selectedProducts.value.slice()
  }
  try {
    localStorage.setItem(PICKER_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota / private-mode failures
  }
  if (nav && nav.updateParams) {
    nav.updateParams({
      version: selectedVersion.value || undefined,
      products: selectedProducts.value.join(',') || undefined,
      families: undefined,
      phases: undefined
    })
  }
}

function applySelection(next) {
  selectedVersion.value = next.version
  selectedProducts.value = next.products.slice()
}

function restoreSelection() {
  const params = (nav && nav.params && nav.params.value) || {}
  let stored = {}
  try {
    const raw = localStorage.getItem(PICKER_STORAGE_KEY)
    if (raw) stored = JSON.parse(raw) || {}
  } catch {
    stored = {}
  }
  if (params.version) stored.version = params.version
  if (params.products || params.families) {
    stored.products = parseProductsFromParams(params.products, params.families)
  }
  applySelection(reconcileSelection(trackingConfig.value, stored, freezeDatesByVersion.value))
}

async function reload(opts) {
  await loadWorkspace(currentSpecs(), opts)
}

function selectVersion(version) {
  selectedVersion.value = version
  selectedProducts.value = productsForVersion(trackingConfig.value, version).map(function (p) {
    return p.family
  })
  persistSelection()
  reload()
}

function onProductsChange(value) {
  const available = availableProducts.value.map(function (p) { return p.family })
  const next = Array.isArray(value) ? value.slice() : []
  if (next.length === 0 || next.length === available.length) {
    selectedProducts.value = available.slice()
  } else {
    selectedProducts.value = next
  }
  persistSelection()
  reload()
}

async function fetchFieldOptions() {
  try {
    const [components, teams] = await Promise.all([
      apiRequest('/modules/team-tracker/field-options/component'), // eslint-disable-line org-pulse/no-cross-module-imports
      apiRequest('/modules/team-tracker/field-options/jiraTeam') // eslint-disable-line org-pulse/no-cross-module-imports
    ])
    knownComponents.value = components.values || []
    knownTeams.value = teams.values || []
  } catch {
    // Field options are non-fatal
  }
}

async function fetchTrackingConfig() {
  try {
    const response = await fetch(getApiBase() + '/modules/releases/execution/tracking/config')
    if (response.ok) trackingConfig.value = await response.json()
  } catch (e) { void e }
}

async function fetchFreezeDates() {
  try {
    const data = await apiRequest('/modules/releases/execution/tracking/versions')
    const map = {}
    const rows = (data && data.versions) || []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row && row.version) map[row.version] = row.planningFreezeDate || null
    }
    freezeDatesByVersion.value = map
  } catch {
    freezeDatesByVersion.value = {}
  }
}

onMounted(async () => {
  await Promise.all([fetchTrackingConfig(), fetchFreezeDates()])
  restoreSelection()
  persistSelection()
  await reload()
})

onMounted(fetchFieldOptions)

// Deep-link support (RHOAIENG-82037): react to an in-place ?version= change so a
// deep-link into the already-mounted workspace re-selects the pill without a
// remount. onMounted handles the fresh-mount case via restoreSelection(); this
// covers hash-only navigation. Guarded on value + validity so selectVersion's
// param writeback cannot feed back into an update loop.
if (nav && nav.params) {
  watch(
    () => nav.params.value && nav.params.value.version,
    (version) => {
      if (
        version &&
        version !== selectedVersion.value &&
        trackingVersions.value.indexOf(version) >= 0
      ) {
        // A deep-link (e.g. from the Schedule timeline) may pin specific
        // product(s) alongside the version; honour them instead of defaulting
        // to all products. reconcileSelection drops any invalid product.
        const productsParam = nav.params.value && nav.params.value.products
        if (productsParam) {
          applySelection(reconcileSelection(
            trackingConfig.value,
            { version: version, products: parseProductsFromParams(productsParam, null) },
            freezeDatesByVersion.value
          ))
          persistSelection()
          reload()
        } else {
          selectVersion(version)
        }
      }
    }
  )
}

async function handleRefresh() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await reload({ refreshTracking: true })
  } finally {
    refreshing.value = false
  }
}

async function onSettingsSaved(newConfig) {
  trackingConfig.value = newConfig
  settingsOpen.value = false
  await fetchFreezeDates()
  applySelection(reconcileSelection(newConfig, {
    version: selectedVersion.value,
    products: selectedProducts.value
  }, freezeDatesByVersion.value))
  persistSelection()
  await reload({ refreshTracking: true })
}

function handleFeatureClick(feature) {
  drawerFeature.value = feature
}

function openFeatureDetails() {
  const feature = drawerFeature.value
  if (!feature) return
  drawerFeature.value = null
  const params = {
    key: feature.key,
    from: 'execute',
    view: props.viewMode
  }
  if (selectedVersion.value) params.version = selectedVersion.value
  if (selectedProducts.value.length) params.products = selectedProducts.value.join(',')
  nav.navigateTo('feature-detail', params)
}

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
        if (!detailMap[cat]) detailMap[cat] = { label: rule.categoryLabel || cat, rules: [] }
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
    hygieneRuleDetails.value = null
    isPlanningManager.value = false
  }
}

onMounted(loadRuleCategories)
</script>

<template>
  <div>
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Feature Execution</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track committed features, delivery progress, and hygiene-rule compliance for the selected release.
          <span class="relative group inline-flex shrink-0 ml-1">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
              aria-label="How features are matched to a release"
            >
              How releases are matched
            </button>
            <span class="pointer-events-none absolute left-0 top-full z-30 mt-1.5 hidden w-96 max-w-[90vw] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs font-normal leading-relaxed text-gray-600 dark:text-gray-300 shadow-lg group-hover:block group-focus-within:block">
              A feature appears under a release based on its <strong class="text-gray-900 dark:text-gray-100">Fix Version</strong> — the release engineering has committed to deliver in. Until a Fix Version is set, its <strong class="text-gray-900 dark:text-gray-100">Target Version</strong> (the PM's requested release) is used instead.
            </span>
          </span>
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <div
          class="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5"
          data-testid="execute-view-toggle"
          role="tablist"
          aria-label="Execute view mode"
        >
          <button
            v-for="mode in VIEW_MODES"
            :key="mode.id"
            role="tab"
            :aria-selected="viewMode === mode.id"
            :data-testid="'execute-view-' + mode.id"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            :class="viewMode === mode.id
              ? 'bg-orange-500 dark:bg-orange-600 text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            @click="setViewMode(mode.id)"
          >{{ mode.label }}</button>
        </div>
        <button
          class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          title="Configure releases and freeze dates"
          @click="settingsOpen = true"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          class="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 rounded-md hover:from-primary-700 hover:to-primary-800 disabled:opacity-50"
          :disabled="refreshing || !hasSelection"
          @click="handleRefresh"
        >{{ refreshing ? 'Refreshing...' : 'Refresh' }}</button>
      </div>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 mb-4">
      <div class="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <div
            data-testid="hygiene-release-selector"
            class="flex items-center gap-1.5 flex-wrap"
            role="group"
            aria-label="Release versions"
          >
            <button
              v-for="version in trackingVersions"
              :key="version"
              type="button"
              :data-testid="'execute-version-' + version"
              class="h-8 px-3 rounded-md text-xs font-medium border transition-colors"
              :class="selectedVersion === version ? CHIP_ACTIVE : CHIP_IDLE"
              @click="selectVersion(version)"
            >{{ version }}</button>
          </div>
          <HygieneSelect
            v-if="availableProducts.length > 0"
            data-testid="execute-product-dropdown"
            :model-value="productDropdownValue"
            :options="productDropdownOptions"
            placeholder="All products"
            mode="multi"
            @update:model-value="onProductsChange"
          />
          <button
            v-if="hasSelection"
            data-testid="hygiene-filters-button"
            class="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-primary-300"
            @click="filters.openFilterModal()"
          >
            <span>Filters</span>
            <span
              v-if="filters.activeFieldCount.value > 0"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
            >{{ filters.activeFieldCount.value }}</span>
          </button>
          <input
            v-if="hasSelection"
            v-model="searchQuery"
            data-testid="execute-search"
            type="text"
            placeholder="Search features..."
            class="h-8 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-primary-500"
          />
          <div v-if="hasSelection" class="relative">
            <details class="group">
              <summary class="list-none h-8 px-3 rounded-md text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer inline-flex items-center gap-1.5">
                {{ signalFilterLabel }}
              </summary>
              <div class="absolute z-20 mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1">
                <label
                  v-for="opt in SIGNAL_OPTIONS"
                  :key="opt.value"
                  class="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    :checked="selectedSignals.includes(opt.value)"
                    class="rounded border-gray-300 text-primary-600"
                    @change="toggleSignal(opt.value)"
                  />
                  <span>{{ opt.label }}</span>
                </label>
              </div>
            </details>
          </div>
          <button
            v-if="isFiltered"
            class="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600"
            @click="clearAllFilters"
          >Clear</button>
        </div>
        <div class="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
          <span v-if="fetchedAt" class="text-xs text-gray-400 dark:text-gray-500" :title="'Last refreshed: ' + formatDateTime(fetchedAt)">
            <span :class="{ 'text-orange-500 font-medium': isStale }">Refreshed {{ formatDateTime(fetchedAt) }}</span>
            <span v-if="isStale" class="ml-1 text-orange-500">Stale</span>
          </span>
          <button
            data-testid="hygiene-rules-button"
            class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
            @click="welcomeModalRef?.show()"
          >Hygiene rules</button>
        </div>
      </div>
    </div>

    <div
      v-if="hasSelection && viewMode !== 'signals'"
      data-testid="execute-kpi-cards"
      class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-4"
    >
      <button
        type="button"
        class="text-left relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3 cursor-pointer"
        :class="!activeCardFilter ? 'border-indigo-400 ring-2 ring-indigo-200 dark:ring-indigo-800' : 'border-gray-200 dark:border-gray-700'"
        @click="setCardFilter(null)"
      >
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Features</div>
        <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ kpi.features }}</div>
      </button>
      <div class="relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Planning Freeze</div>
        <div class="text-sm font-bold mt-1" :class="freezeStatus === 'past' ? 'text-orange-600' : freezeStatus === 'future' ? 'text-emerald-600' : 'text-gray-400'">
          {{ planningFreezeDate ? formatDate(planningFreezeDate) : 'Not set' }}
        </div>
      </div>
      <button
        type="button"
        class="text-left relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3"
        :class="activeCardFilter === 'added' ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-700'"
        :disabled="kpi.added === 0"
        @click="handleCardClick('added')"
      >
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Late Added</div>
        <div class="text-2xl font-bold" :class="kpi.added > 0 ? 'text-blue-600' : 'text-gray-900 dark:text-gray-100'">{{ kpi.added }}</div>
      </button>
      <button
        type="button"
        class="text-left relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3"
        :class="activeCardFilter === 'dropped' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200 dark:border-gray-700'"
        :disabled="kpi.dropped === 0"
        @click="handleCardClick('dropped')"
      >
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Dropped</div>
        <div class="text-2xl font-bold" :class="kpi.dropped > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'">{{ kpi.dropped }}</div>
      </button>
      <button
        type="button"
        class="text-left relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3"
        :class="activeCardFilter === 'blocked' ? 'border-red-400 ring-2 ring-red-200' : 'border-gray-200 dark:border-gray-700'"
        :disabled="kpi.blocked === 0"
        @click="handleCardClick('blocked')"
      >
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Blocked</div>
        <div class="text-2xl font-bold" :class="kpi.blocked > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'">{{ kpi.blocked }}</div>
      </button>
      <button
        type="button"
        class="text-left relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border px-4 py-3"
        :class="activeCardFilter === 'violations' ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'"
        :disabled="kpi.withViolations === 0"
        @click="handleCardClick('violations')"
      >
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">With violations</div>
        <div class="text-2xl font-bold" :class="kpi.withViolations > 0 ? 'text-red-600' : 'text-green-600'">{{ kpi.withViolations }}</div>
        <div class="text-[10px] text-gray-400">{{ kpi.totalViolations }} total · {{ kpi.avgCompletion }}% avg · {{ kpi.done }} done · {{ kpi.inProgress }} active</div>
      </button>
    </div>

    <HygieneAnalyticsPanel
      v-if="hasSelection && viewMode !== 'signals'"
      :features="liveOverlayFeatures"
      v-model:collapsed="hygieneCollapsed"
    />

    <div v-if="!hasSelection" class="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
      Open settings (gear) to add a release.
    </div>

    <div v-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm mb-6">
      {{ error }}
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading feature data...
    </div>

    <template v-else-if="hasSelection && !error">
      <div v-if="!hasData" class="text-center py-12 text-gray-500 dark:text-gray-400">
        No feature data available for this release.
      </div>

      <FeatureTrackingTable
        v-else-if="viewMode === 'table'"
        ref="tableRef"
        :groups="filteredGroups"
        :portfolioVersion="portfolioVersion"
        :featureFreezeDate="planningFreezeDate"
        :totalUniqueFeatures="kpi.features"
        :filteredFeatureCount="isFiltered ? filteredFeatureCount : null"
        @feature-click="handleFeatureClick"
      />

      <KanbanBoard
        v-else-if="viewMode === 'board'"
        :features="liveOverlayFeatures"
        @feature-click="handleFeatureClick"
      />

      <FeatureSignalsBoard
        v-else-if="viewMode === 'signals'"
        :features="liveOverlayFeatures"
        :selected-signals="[]"
        @select="handleFeatureClick"
      />
    </template>

    <ReportFilterModal :filters="filters" :available-filter-values="availableFilterValues" />

    <FeatureDrawer
      :feature="drawerFeature"
      @close="drawerFeature = null"
      @view-details="openFeatureDetails"
    />

    <HygieneWelcomeModal
      ref="welcomeModalRef"
      :rule-details="hygieneRuleDetails"
      :is-planning-manager="isPlanningManager"
      @navigate-manage="nav.navigateTo('registry', { tab: 'hygiene' })"
    />

    <FeatureTrackingSettingsPanel
      :open="settingsOpen"
      :config="trackingConfig"
      @close="settingsOpen = false"
      @saved="onSettingsSaved"
    />
  </div>
</template>
