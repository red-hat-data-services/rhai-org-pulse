<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { extractProduct } from '../../deliver/composables/release-utils.js'
import KanbanBoard from '../components/hygiene/KanbanBoard.vue'

const nav = inject('moduleNav')

// ── Version / product state ──

const allVersions = ref([])
const selectedProduct = ref(null)
const selectedVersion = ref('')
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
  if (!selectedProduct.value) return allVersions.value
  return allVersions.value.filter(v => extractProduct(v) === selectedProduct.value)
})

function selectProduct(product) {
  if (selectedProduct.value === product) {
    selectedProduct.value = null
  } else {
    selectedProduct.value = product
  }
  // If current version is no longer visible, select first visible
  if (selectedVersion.value && !visibleVersions.value.includes(selectedVersion.value)) {
    selectedVersion.value = visibleVersions.value[0] || ''
  }
}

function clearProduct() {
  selectedProduct.value = null
}

function selectVersion(version) {
  selectedVersion.value = version
}

// ── Data state ──

const hygieneFeatures = ref({})
const executionFeatures = ref([])
const summary = ref(null)
const fetchedAt = ref(null)

async function loadVersions() {
  try {
    const data = await apiRequest('/modules/releases/execution/versions')
    allVersions.value = data.versions || []

    // Restore filters from URL params (e.g. returning from feature detail)
    const params = nav.params.value || {}
    if (params.product) {
      selectedProduct.value = params.product
    }
    if (params.version && allVersions.value.includes(params.version)) {
      selectedVersion.value = params.version
    } else if (allVersions.value.length > 0 && !selectedVersion.value) {
      selectedVersion.value = allVersions.value[0]
    }
  } catch {
    allVersions.value = []
  }
}

async function loadData(version) {
  if (!version) return
  loading.value = true
  error.value = null

  try {
    const [hygieneData, summaryData, execData] = await Promise.all([
      apiRequest(`/modules/releases/hygiene/features?version=${encodeURIComponent(version)}`),
      apiRequest(`/modules/releases/hygiene/summary?version=${encodeURIComponent(version)}`),
      apiRequest(`/modules/releases/execution/features?version=${encodeURIComponent(version)}`)
    ])

    hygieneFeatures.value = hygieneData.features || {}
    fetchedAt.value = hygieneData.fetchedAt || null
    summary.value = summaryData
    executionFeatures.value = execData.features || []
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
  if (selectedVersion.value) params.version = selectedVersion.value
  if (selectedProduct.value) params.product = selectedProduct.value
  nav.navigateTo('feature-detail', params)
}

const hasData = computed(() => {
  return fetchedAt.value !== null && Object.keys(hygieneFeatures.value).length > 0
})

watch(selectedVersion, (v) => {
  if (v) loadData(v)
})

onMounted(() => {
  loadVersions()
})

const activeChipClass = 'px-2.5 py-1 text-xs font-medium rounded-full border ' +
  'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 ' +
  'border-primary-300 dark:border-primary-600'

const inactiveChipClass = 'px-2.5 py-1 text-xs font-medium rounded-full border ' +
  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ' +
  'border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
</script>

<template>
  <div>
    <!-- Product / Version chip bar -->
    <div class="space-y-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 mb-6">
      <!-- Product row -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 shrink-0">
          Product
        </span>
        <div class="flex flex-wrap gap-1.5">
          <button
            @click="clearProduct()"
            :class="!selectedProduct ? activeChipClass : inactiveChipClass"
          >All</button>
          <button
            v-for="product in products"
            :key="product"
            @click="selectProduct(product)"
            :class="selectedProduct === product ? activeChipClass : inactiveChipClass"
          >{{ product.toUpperCase() }}</button>
        </div>
      </div>
      <!-- Version row -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 w-16 shrink-0">
          Version
        </span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="version in visibleVersions"
            :key="version"
            @click="selectVersion(version)"
            :class="selectedVersion === version ? activeChipClass : inactiveChipClass"
          >{{ version }}</button>
        </div>
      </div>
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
      :features="mergedFeatures"
      @feature-click="handleFeatureClick"
    />
  </div>
</template>
