<script setup>
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { extractProduct } from '../../deliver/composables/release-utils.js'
import KanbanBoard from '../components/hygiene/KanbanBoard.vue'
import HygieneWelcomeModal from '../components/hygiene/HygieneWelcomeModal.vue'
import HygieneSelect from '../components/hygiene/HygieneSelect.vue'
import { useHygieneFilters } from '../composables/useHygieneFilters.js'

const nav = inject('moduleNav')

// ── Version / product state ──

const allVersions = ref([])
const registryReleases = ref([])
const selectedProducts = ref([])
const selectedVersions = ref([])
const loading = ref(false)
const error = ref(null)

const products = computed(() => {
  const set = new Set()
  for (const v of allVersions.value) {
    const p = extractProduct(v)
    if (p) set.add(p)
  }
  return [...set].sort()
})

const visibleVersions = computed(() => {
  if (selectedProducts.value.length === 0) return allVersions.value
  return allVersions.value.filter(v => selectedProducts.value.includes(extractProduct(v)))
})

watch(selectedProducts, () => {
  if (selectedVersions.value.length > 0) {
    const still = selectedVersions.value.filter(v => visibleVersions.value.includes(v))
    if (still.length !== selectedVersions.value.length) {
      selectedVersions.value = still.length > 0 ? still : visibleVersions.value.slice(0, 1)
    }
  }
})

// ── Data state ──

const hygieneFeatures = ref({})
const executionFeatures = ref([])
const summary = ref(null)
const fetchedAt = ref(null)

async function loadVersions() {
  try {
    const data = await apiRequest('/modules/releases/registry')
    const releases = (data.releases || []).filter(r => r.state !== 'archived')
    registryReleases.value = releases
    allVersions.value = releases.map(r => r.displayName).sort()

    // Restore filters from URL params (e.g. returning from feature detail)
    const params = nav.params.value || {}
    if (params.product) {
      selectedProducts.value = [params.product]
    }
    if (params.version && allVersions.value.includes(params.version)) {
      selectedVersions.value = [params.version]
    } else if (allVersions.value.length > 0 && selectedVersions.value.length === 0) {
      selectedVersions.value = [allVersions.value[0]]
    }
  } catch {
    allVersions.value = []
  }
}

async function loadData(versions) {
  if (!versions || versions.length === 0) return
  loading.value = true
  error.value = null

  try {
    const mergedHygiene = {}
    let oldestFetchedAt = null
    let mergedSummary = null
    const execByKey = {}

    await Promise.all(versions.map(async (version) => {
      const rel = registryReleases.value.find(r => r.displayName === version)
      const execVersion = (rel && rel.fixVersions && rel.fixVersions.length > 0)
        ? rel.fixVersions[0]
        : version

      const [hygieneData, summaryData, execData] = await Promise.all([
        apiRequest(`/modules/releases/hygiene/features?version=${encodeURIComponent(version)}`),
        apiRequest(`/modules/releases/hygiene/summary?version=${encodeURIComponent(version)}`),
        apiRequest(`/modules/releases/execution/features?version=${encodeURIComponent(execVersion)}`)
      ])

      Object.assign(mergedHygiene, hygieneData.features || {})

      const fa = hygieneData.fetchedAt
      if (fa && (!oldestFetchedAt || new Date(fa) < new Date(oldestFetchedAt))) {
        oldestFetchedAt = fa
      }

      if (summaryData) {
        if (!mergedSummary) {
          mergedSummary = {
            totalFeatures: summaryData.totalFeatures || 0,
            featuresWithViolations: summaryData.featuresWithViolations || 0,
            violationsByRule: { ...(summaryData.violationsByRule || {}) }
          }
        } else {
          mergedSummary.totalFeatures += summaryData.totalFeatures || 0
          mergedSummary.featuresWithViolations += summaryData.featuresWithViolations || 0
          for (const [k, v] of Object.entries(summaryData.violationsByRule || {})) {
            mergedSummary.violationsByRule[k] = (mergedSummary.violationsByRule[k] || 0) + v
          }
        }
      }

      for (const f of (execData.features || [])) {
        execByKey[f.key] = f
      }
    }))

    hygieneFeatures.value = mergedHygiene
    fetchedAt.value = oldestFetchedAt
    summary.value = mergedSummary
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

const totalViolations = computed(() => {
  if (!summary.value) return 0
  const byRule = summary.value.violationsByRule || {}
  let count = 0
  for (const key of Object.keys(byRule)) {
    count += byRule[key]
  }
  return count
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

function handleFeatureClick(feature) {
  const params = { key: feature.key, from: 'feature-status' }
  if (selectedVersions.value.length === 1) params.version = selectedVersions.value[0]
  if (selectedProducts.value.length === 1) params.product = selectedProducts.value[0]
  nav.navigateTo('feature-detail', params)
}

const hasData = computed(() => {
  return fetchedAt.value !== null && Object.keys(hygieneFeatures.value).length > 0
})

watch(selectedVersions, (v) => {
  if (v.length > 0) loadData(v)
})

onMounted(() => {
  loadVersions()
})

// ── Intro section ──

const welcomeModalRef = ref(null)
const hygieneRuleDetails = ref(null)
const isReleaseManager = ref(false)

async function loadRuleCategories() {
  try {
    const data = await apiRequest('/modules/releases/hygiene/config')
    isReleaseManager.value = true
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
    isReleaseManager.value = false
  }
}

onMounted(() => {
  loadRuleCategories()
})

// ── Filters ──

const {
  selectedTeams,
  selectedComponents,
  availableTeams,
  availableComponents,
  filteredFeatures,
  isFiltered,
  savedSets,
  clearFilters,
  saveCurrentSet,
  loadSet,
  deleteSet,
  setMatchCount
} = useHygieneFilters(mergedFeatures)

const showSaveInput = ref(false)
const saveFilterName = ref('')
const saveError = ref('')
const savedMenuOpen = ref(false)
const savedMenuRef = ref(null)

function handleSavedMenuClickOutside(e) {
  if (savedMenuRef.value && !savedMenuRef.value.contains(e.target)) {
    savedMenuOpen.value = false
    showSaveInput.value = false
    saveError.value = ''
  }
}

onMounted(() => document.addEventListener('mousedown', handleSavedMenuClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleSavedMenuClickOutside))

function handleSaveSet() {
  if (!saveFilterName.value.trim()) return
  const ok = saveCurrentSet(saveFilterName.value)
  if (!ok) {
    saveError.value = 'Name already exists or maximum 10 sets reached.'
    return
  }
  saveFilterName.value = ''
  showSaveInput.value = false
  saveError.value = ''
}

const productOptions = computed(() =>
  products.value.map(p => ({ value: p, label: p.toUpperCase() }))
)

const versionOptions = computed(() =>
  visibleVersions.value.map(v => ({ value: v, label: v }))
)
</script>

<template>
  <div>
    <!-- Filter bar -->
    <div class="flex items-center gap-3 flex-wrap mb-4">
      <HygieneSelect
        :modelValue="selectedProducts"
        :options="productOptions"
        placeholder="All Products"
        @update:modelValue="v => selectedProducts = v"
      />
      <HygieneSelect
        :modelValue="selectedVersions"
        :options="versionOptions"
        placeholder="All Versions"
        @update:modelValue="v => selectedVersions = v"
      />
      <HygieneSelect
        v-if="availableTeams.length > 0"
        :modelValue="selectedTeams"
        :options="availableTeams"
        placeholder="All Teams"
        @update:modelValue="v => selectedTeams = v"
      />
      <HygieneSelect
        v-if="availableComponents.length > 0"
        :modelValue="selectedComponents"
        :options="availableComponents"
        placeholder="All Components"
        @update:modelValue="v => selectedComponents = v"
      />

      <!-- Saved filter sets menu -->
      <div v-if="savedSets.length > 0 || isFiltered" class="relative" ref="savedMenuRef">
        <button
          @click="savedMenuOpen = !savedMenuOpen"
          type="button"
          class="h-8 text-xs border rounded-md px-2.5 py-1 flex items-center gap-1.5 transition-colors"
          :class="savedMenuOpen
            ? 'border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
          </svg>
          <span>Saved</span>
          <span v-if="savedSets.length > 0" class="text-[10px] px-1 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ savedSets.length }}</span>
        </button>

        <div
          v-if="savedMenuOpen"
          class="absolute z-30 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
        >
          <!-- Save current -->
          <div v-if="isFiltered" class="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <div v-if="!showSaveInput" class="flex">
              <button
                @click="showSaveInput = true"
                type="button"
                class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >Save current filters</button>
            </div>
            <div v-else class="flex items-center gap-1">
              <input
                v-model="saveFilterName"
                placeholder="Name"
                class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex-1 min-w-0"
                @keyup.enter="handleSaveSet"
              />
              <button
                @click="handleSaveSet"
                type="button"
                class="text-xs px-2 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 shrink-0"
              >Save</button>
            </div>
            <span v-if="saveError" class="text-[10px] text-red-500 dark:text-red-400">{{ saveError }}</span>
          </div>

          <!-- Saved sets list -->
          <button
            v-for="set in savedSets"
            :key="set.name"
            @click="loadSet(set); savedMenuOpen = false"
            type="button"
            class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between gap-2"
          >
            <span class="truncate">{{ set.name }}</span>
            <span class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="setMatchCount(set) === 0"
                class="text-[10px] text-orange-500 dark:text-orange-400"
              >0</span>
              <button
                @click.stop="deleteSet(set.name)"
                class="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                title="Delete"
              >&times;</button>
            </span>
          </button>

          <div v-if="savedSets.length === 0 && !isFiltered" class="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
            No saved filter sets
          </div>
        </div>
      </div>

      <!-- Clear filters -->
      <button
        v-if="isFiltered"
        @click="clearFilters"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
      >Clear filters</button>
    </div>

    <!-- Intro section -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 mb-6 text-sm text-gray-600 dark:text-gray-300 flex items-center justify-between">
      <span>This board tracks hygiene rule compliance for features in the selected release.</span>
      <button
        @click="welcomeModalRef?.show()"
        class="text-xs text-primary-600 dark:text-primary-400 hover:underline ml-2 whitespace-nowrap"
      >Learn more</button>
    </div>

    <!-- Summary bar -->
    <div
      v-if="summary && hasData"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3 flex flex-wrap items-center gap-6 text-sm mb-6"
    >
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">Features:</span>
        <span class="font-semibold text-gray-900 dark:text-gray-100">{{ summary.totalFeatures }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">With violations:</span>
        <span
          class="font-semibold"
          :class="summary.featuresWithViolations > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'"
        >{{ summary.featuresWithViolations }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">Total violations:</span>
        <span
          class="font-semibold"
          :class="totalViolations > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'"
        >{{ totalViolations }}</span>
      </div>
      <div v-if="isFiltered" class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">Showing</span>
        <span class="font-semibold text-primary-600 dark:text-primary-400">{{ filteredFeatures.length }} of {{ mergedFeatures.length }}</span>
        <span class="text-gray-500 dark:text-gray-400">features</span>
      </div>
      <div class="ml-auto flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <span :class="{ 'text-orange-500 dark:text-orange-400 font-medium': isStale }">
          Last refreshed: {{ formatDate(fetchedAt) }}
        </span>
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
      </div>
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
      v-else-if="!hasData && !error"
      class="text-center py-12"
    >
      <p class="text-gray-500 dark:text-gray-400 mb-4">No hygiene data available for this version.</p>
      <p class="text-xs text-gray-400 dark:text-gray-500">Use the Manage page to trigger a hygiene data refresh.</p>
    </div>

    <!-- Kanban board -->
    <KanbanBoard
      v-else-if="!loading"
      :features="filteredFeatures"
      @feature-click="handleFeatureClick"
    />

    <!-- Welcome modal (first visit) -->
    <HygieneWelcomeModal
      ref="welcomeModalRef"
      :rule-details="hygieneRuleDetails"
      :is-release-manager="isReleaseManager"
      @navigate-manage="nav.navigateTo('registry', { tab: 'hygiene' })"
    />
  </div>
</template>
