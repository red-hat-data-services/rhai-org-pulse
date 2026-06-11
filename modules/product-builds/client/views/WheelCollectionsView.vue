<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { useWheelBrowse, useWheelPackageSearch, useWheelFilters } from '../composables/useWheelCollections'
import { formatDate, envBadgeClass, archBadgeClass, getCommitUrl } from '../utils/formatting'
import { apiRequest, getApiBase } from '@shared/client/services/api'
import { impersonatingUid } from '@shared/client/state/impersonation'

const nav = inject('moduleNav')

const activeTab = ref('browse-all')

// --- Browse All tab ---
const browse = useWheelBrowse()
const searchInput = ref('')
let searchTimeout = null

function onSearchInput(value) {
  searchInput.value = value
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => browse.search(value), 500)
}

function clearSearch() {
  searchInput.value = ''
  clearTimeout(searchTimeout)
  browse.search('')
}

function getSortIndicator(column) {
  if (browse.sortColumn.value !== column) return '▲'
  return browse.sortDirection.value === 'asc' ? '▲' : '▼'
}

function getSortIndicatorClass(column) {
  return browse.sortColumn.value === column ? 'text-primary-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'
}

const parsedBuildSequences = computed(() => {
  const map = {}
  for (const [key, json] of Object.entries(browse.buildSequences.value)) {
    if (!json) continue
    try {
      const entries = JSON.parse(json)
      if (!Array.isArray(entries)) continue
      const newBuilds = [], prebuilt = [], skipped = []
      for (const e of entries) {
        if (e.skipped) skipped.push(e)
        else if (e.prebuilt) prebuilt.push(e)
        else newBuilds.push(e)
      }
      map[key] = { total: entries.length, newBuilds, prebuilt, skipped }
    } catch { /* skip */ }
  }
  return map
})

const openPopover = ref(null)

function togglePopover(key) {
  openPopover.value = openPopover.value === key ? null : key
}

function closePopover() {
  openPopover.value = null
}

// --- Container hover popover ---
const containerCache = reactive({})
const containerHover = ref(null)
let containerHoverTimer = null

async function onContainerMouseEnter(artifactKey) {
  containerHover.value = artifactKey
  if (!containerCache[artifactKey]) {
    containerCache[artifactKey] = { loading: true, data: null, error: null }
    try {
      const data = await apiRequest(`/modules/product-builds/artifacts/${encodeURIComponent(artifactKey)}/containers`)
      containerCache[artifactKey] = { loading: false, data: Array.isArray(data) ? data : [], error: null }
    } catch {
      containerCache[artifactKey] = { loading: false, data: null, error: 'Failed to load' }
    }
  }
}

function onContainerMouseLeave() {
  clearTimeout(containerHoverTimer)
  containerHoverTimer = setTimeout(() => { containerHover.value = null }, 200)
}

function onContainerPopoverEnter() {
  clearTimeout(containerHoverTimer)
}

function onContainerPopoverLeave() {
  containerHover.value = null
}

function downloadBuildSequence(key) {
  const json = browse.buildSequences.value[key]
  if (!json) return
  const safeName = (key || 'build-sequence').replace(/[^a-zA-Z0-9\-_+.]/g, '_').substring(0, 100)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}-build-sequence.json`
  a.click()
  URL.revokeObjectURL(url)
}

function formatCommit(commit) {
  if (!commit) return ''
  return commit.substring(0, 8)
}

// --- Search by Package tab ---
const pkgSearch = useWheelPackageSearch()
const filters = useWheelFilters()
const packageName = ref('')
const selectedProduct = ref('all')
const selectedSeries = ref('all')
const selectedVariant = ref('all')
let filtersInitialized = false

const currentFilters = computed(() => ({
  product_key: selectedProduct.value,
  series: selectedSeries.value,
  variant: selectedVariant.value
}))

function handlePackageSearch() {
  pkgSearch.search(packageName.value, currentFilters.value)
}

function handleSearchNextPage() {
  pkgSearch.nextPage(packageName.value, currentFilters.value)
}

function handleSearchPreviousPage() {
  pkgSearch.previousPage(packageName.value, currentFilters.value)
}

watch(selectedProduct, (val) => {
  selectedSeries.value = 'all'
  filters.loadSeries(val)
})

watch([selectedProduct, selectedSeries, selectedVariant], () => {
  if (packageName.value.trim() && pkgSearch.results.value !== null) {
    handlePackageSearch()
  }
})

watch(activeTab, (tab) => {
  if (tab === 'search-package' && !filtersInitialized) {
    filtersInitialized = true
    filters.loadFilters()
  }
})

// --- Artifacts tab ---
const ITEMS_PER_PAGE = 10
const AVAILABLE_ARCHS = ['aarch64', 'ppc64le', 's390x', 'x86_64']
const AVAILABLE_ACCELS = ['cpu', 'cuda', 'gaudi', 'neuron', 'rocm', 'spyre', 'tpu']
const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]
const GROUP_BY_OPTIONS = [
  { value: 'accelerator', label: 'Accelerator' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'all', label: 'All' },
]

const artifactsGroupBy = ref('accelerator')
const artifactsArchFilter = ref('')
const artifactsAccelFilter = ref('')
const artifactsDateFilter = ref('')
const artifactsData = ref(null)
const artifactsLoading = ref(false)
const artifactsError = ref(null)
const artifactsOffset = ref(0)
const artifactsPage = ref(1)
const artifactsHasNext = ref(false)
const artifactsTotalPages = ref(null)
const artifactsTotalApprox = ref(false)
const expandedGroups = ref(new Set())
let artifactsInitialized = false

const artifactsIsGrouped = computed(() => artifactsGroupBy.value !== 'all')
const showArtifactsArchFilter = computed(() => artifactsGroupBy.value !== 'architecture')
const showArtifactsAccelFilter = computed(() => artifactsGroupBy.value !== 'accelerator')
const artifactsHasActiveFilters = computed(() =>
  (showArtifactsArchFilter.value && artifactsArchFilter.value) ||
  artifactsDateFilter.value ||
  (showArtifactsAccelFilter.value && artifactsAccelFilter.value)
)

async function loadArtifactsData() {
  const params = { type: 'wheels-collections', limit: ITEMS_PER_PAGE }
  if (artifactsIsGrouped.value) {
    params.group_by = artifactsGroupBy.value
  } else {
    params.offset = artifactsOffset.value
    params.limit = ITEMS_PER_PAGE + 1
  }
  if (artifactsArchFilter.value && showArtifactsArchFilter.value) params.architectures = artifactsArchFilter.value
  if (artifactsAccelFilter.value && showArtifactsAccelFilter.value) params.accelerator = artifactsAccelFilter.value
  if (artifactsDateFilter.value) params.date_range = artifactsDateFilter.value

  try {
    artifactsLoading.value = true
    artifactsError.value = null
    const qs = new URLSearchParams(params).toString()

    if (artifactsIsGrouped.value) {
      const data = await apiRequest(`/modules/product-builds/artifacts?${qs}`)
      artifactsData.value = data
      if (data?.groups) {
        expandedGroups.value = new Set(Object.keys(data.groups))
      }
    } else {
      const fetchHeaders = {}
      if (impersonatingUid.value) fetchHeaders['X-Impersonate-Uid'] = impersonatingUid.value
      const response = await fetch(`${getApiBase()}/modules/product-builds/artifacts?${qs}`, { headers: fetchHeaders })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      const items = Array.isArray(data) ? data : []
      artifactsHasNext.value = items.length > ITEMS_PER_PAGE
      artifactsData.value = items.slice(0, ITEMS_PER_PAGE)

      const totalCount = response.headers.get('X-Total-Count')
      if (totalCount) {
        artifactsTotalApprox.value = totalCount.includes('+')
        const count = parseInt(totalCount.replace('+', ''))
        artifactsTotalPages.value = Math.ceil(count / ITEMS_PER_PAGE)
      } else {
        artifactsTotalPages.value = null
        artifactsTotalApprox.value = false
      }
    }
  } catch (err) {
    artifactsError.value = err.message || 'Failed to load artifacts'
  } finally {
    artifactsLoading.value = false
  }
}

function resetArtifactsPagination() {
  artifactsOffset.value = 0
  artifactsPage.value = 1
  artifactsHasNext.value = false
  artifactsTotalPages.value = null
  artifactsTotalApprox.value = false
}

function artifactsNextPage() {
  artifactsOffset.value += ITEMS_PER_PAGE
  artifactsPage.value++
  loadArtifactsData()
}

function artifactsPreviousPage() {
  artifactsOffset.value = Math.max(0, artifactsOffset.value - ITEMS_PER_PAGE)
  artifactsPage.value = Math.max(1, artifactsPage.value - 1)
  loadArtifactsData()
}

function handleViewAll(groupKey, groupedBy) {
  artifactsGroupBy.value = 'all'
  if (groupedBy === 'accelerator') artifactsAccelFilter.value = groupKey
  else if (groupedBy === 'architecture') artifactsArchFilter.value = groupKey
  resetArtifactsPagination()
}

function clearArtifactFilters() {
  artifactsArchFilter.value = ''
  artifactsAccelFilter.value = ''
  artifactsDateFilter.value = ''
  artifactsGroupBy.value = 'accelerator'
  resetArtifactsPagination()
}

function toggleArtifactGroup(key) {
  const next = new Set(expandedGroups.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedGroups.value = next
}

function getDropName(artifact) {
  const dropKey = artifact.drop_keys?.[0]
  if (!dropKey) return null
  const productKey = artifact.product_key || 'rhai'
  return dropKey.replace(`${productKey}-`, '')
}

function navigateToDropFromArtifact(artifact) {
  const dropKey = artifact.drop_keys?.[0]
  if (!dropKey) return
  nav.navigateTo('drop-detail', { key: dropKey, product: artifact.product_key || 'rhai' })
}

watch([artifactsGroupBy, artifactsArchFilter, artifactsAccelFilter, artifactsDateFilter], () => {
  resetArtifactsPagination()
  loadArtifactsData()
})

function navigateToArtifact(artifactKey, productKey) {
  nav.navigateTo('artifact-detail', { key: artifactKey, product: productKey || 'rhai' })
}

watch(activeTab, (tab) => {
  if (tab === 'artifacts' && !artifactsInitialized) {
    artifactsInitialized = true
    loadArtifactsData()
  }
})

onMounted(() => {
  browse.load()
})

onUnmounted(() => { clearTimeout(searchTimeout); clearTimeout(containerHoverTimer) })
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Wheel Collections</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Browse wheel collection releases or search for specific packages across releases
      </p>
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex gap-4">
        <button
          v-for="tab in [
            { key: 'browse-all', label: 'Browse All' },
            { key: 'search-package', label: 'Search by Package' },
            { key: 'artifacts', label: 'Artifacts' },
          ]"
          :key="tab.key"
          @click="activeTab = tab.key"
          class="py-2 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.key
            ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
        >{{ tab.label }}</button>
      </nav>
    </div>

    <!-- ==================== Browse All Tab ==================== -->
    <div v-if="activeTab === 'browse-all'" class="space-y-4">
      <!-- Search bar -->
      <div class="flex items-center gap-3">
        <div class="relative" style="width: 400px">
          <input
            type="text"
            :value="searchInput"
            @input="onSearchInput($event.target.value)"
            placeholder="Search by key, variant, or commit"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 pr-8"
          />
          <button
            v-if="searchInput"
            @click="clearSearch"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >&times;</button>
        </div>
        <span v-if="browse.loading.value" class="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>

      <!-- Table -->
      <div v-if="browse.error.value" class="text-sm text-red-600 dark:text-red-400">{{ browse.error.value }}</div>
      <div v-else-if="!browse.loading.value && browse.artifacts.value.length === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        {{ browse.searchValue.value ? 'No wheel collections match your search.' : 'No wheel collections found.' }}
      </div>
      <template v-if="browse.artifacts.value.length > 0">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th
                  @click="browse.toggleSort('key')"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                  style="width: 30%"
                >Key <span :class="getSortIndicatorClass('key')" class="ml-1">{{ getSortIndicator('key') }}</span></th>
                <th
                  @click="browse.toggleSort('variant')"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                  style="width: 12%"
                >Variant <span :class="getSortIndicatorClass('variant')" class="ml-1">{{ getSortIndicator('variant') }}</span></th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 10%">Architectures</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 14%">Packages</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 10%">Used In</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 8%">Commit</th>
                <th
                  @click="browse.toggleSort('created_at')"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none"
                  style="width: 16%"
                >Created <span :class="getSortIndicatorClass('created_at')" class="ml-1">{{ getSortIndicator('created_at') }}</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="art in browse.artifacts.value"
                :key="art.key"
                @click="navigateToArtifact(art.key)"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400 break-all font-mono">
                  <span @click.stop="navigateToArtifact(art.key)" class="hover:underline cursor-pointer">{{ art.key }}</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ art.variant || '—' }}</td>
                <td class="px-4 py-3">
                  <div class="flex gap-1 flex-wrap">
                    <span
                      v-for="arch in (art.archs || [])"
                      :key="arch"
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      :class="archBadgeClass(arch)"
                    >{{ arch }}</span>
                    <span v-if="!art.archs?.length" class="text-sm text-gray-400 dark:text-gray-500">—</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm" @click.stop>
                  <template v-if="parsedBuildSequences[art.key]">
                    <div class="relative inline-flex items-center gap-1">
                      <button
                        @click="togglePopover(art.key)"
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer transition-colors"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        {{ parsedBuildSequences[art.key].total }} packages
                      </button>
                      <button
                        @click="downloadBuildSequence(art.key)"
                        class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Download build sequence as JSON"
                      >
                        <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                      <!-- Popover -->
                      <div
                        v-if="openPopover === art.key"
                        class="absolute left-0 top-full mt-1 z-50 w-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
                      >
                        <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                          <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">Build Sequence Summary</span>
                          <button @click="closePopover" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
                        </div>
                        <div class="px-3 py-2 max-h-80 overflow-y-auto space-y-3">
                          <div v-if="parsedBuildSequences[art.key].newBuilds.length">
                            <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">New Builds ({{ parsedBuildSequences[art.key].newBuilds.length }})</div>
                            <div class="flex flex-wrap gap-1">
                              <span v-for="e in parsedBuildSequences[art.key].newBuilds" :key="e.name" class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{{ e.name }}=={{ e.version }}</span>
                            </div>
                          </div>
                          <div v-if="parsedBuildSequences[art.key].prebuilt.length">
                            <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Pre-built ({{ parsedBuildSequences[art.key].prebuilt.length }})</div>
                            <div class="flex flex-wrap gap-1">
                              <span v-for="e in parsedBuildSequences[art.key].prebuilt" :key="e.name" class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{{ e.name }}=={{ e.version }}</span>
                            </div>
                          </div>
                          <div v-if="parsedBuildSequences[art.key].skipped.length">
                            <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Skipped ({{ parsedBuildSequences[art.key].skipped.length }})</div>
                            <div class="flex flex-wrap gap-1">
                              <span v-for="e in parsedBuildSequences[art.key].skipped" :key="e.name" class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{{ e.name }}=={{ e.version }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                  <template v-else-if="browse.buildSequencesLoading.value">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                      <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Loading…
                    </span>
                  </template>
                  <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                </td>
                <td class="px-4 py-3 text-sm" @click.stop>
                  <div v-if="art.container_count > 0" class="relative inline-block">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default"
                      @mouseenter="onContainerMouseEnter(art.key)"
                      @mouseleave="onContainerMouseLeave"
                    >{{ art.container_count }} container{{ art.container_count !== 1 ? 's' : '' }}</span>
                    <!-- Container popover -->
                    <div
                      v-if="containerHover === art.key"
                      class="absolute left-0 top-full mt-1 z-50 w-96 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
                      @mouseenter="onContainerPopoverEnter"
                      @mouseleave="onContainerPopoverLeave"
                    >
                      <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">Container{{ art.container_count !== 1 ? 's' : '' }}</span>
                      </div>
                      <div class="px-3 py-2 max-h-60 overflow-y-auto">
                        <div v-if="containerCache[art.key]?.loading" class="text-sm text-gray-500 dark:text-gray-400">Loading containers…</div>
                        <div v-else-if="containerCache[art.key]?.error" class="text-sm text-red-600 dark:text-red-400">Failed to load containers</div>
                        <ul v-else-if="containerCache[art.key]?.data?.length" class="list-disc pl-5 space-y-1">
                          <li v-for="c in containerCache[art.key].data.slice(0, 10)" :key="c.key" class="text-xs">
                            <span class="font-mono text-gray-800 dark:text-gray-200 break-all">{{ c.key }}</span>
                            <span v-if="c.variant" class="text-gray-500 dark:text-gray-400 ml-1">({{ c.variant }})</span>
                          </li>
                        </ul>
                        <div v-else class="text-sm text-gray-500 dark:text-gray-400">No containers found</div>
                        <div v-if="containerCache[art.key]?.data?.length > 10" class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 italic">
                          Showing first 10 of {{ art.container_count }} containers
                        </div>
                      </div>
                    </div>
                  </div>
                  <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                </td>
                <td class="px-4 py-3 text-sm font-mono" @click.stop>
                  <a
                    v-if="art.commit && getCommitUrl(art)"
                    :href="getCommitUrl(art)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-blue-400 hover:underline"
                  >{{ formatCommit(art.commit) }}</a>
                  <span v-else-if="art.commit" class="text-gray-600 dark:text-gray-300">{{ formatCommit(art.commit) }}</span>
                  <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(art.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Showing {{ browse.artifacts.value.length }} wheel collections{{ browse.pageNumber.value > 1 ? ` (page ${browse.pageNumber.value})` : '' }}</span>
          <div v-if="browse.hasPrevious.value || browse.hasNext.value" class="flex items-center gap-2">
            <button
              :disabled="!browse.hasPrevious.value"
              @click="browse.previousPage()"
              class="px-3 py-1 rounded border text-sm font-medium transition-colors"
              :class="browse.hasPrevious.value
                ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'"
            >Previous</button>
            <span>Page {{ browse.pageNumber.value }}</span>
            <button
              :disabled="!browse.hasNext.value"
              @click="browse.nextPage()"
              class="px-3 py-1 rounded border text-sm font-medium transition-colors"
              :class="browse.hasNext.value
                ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'"
            >Next</button>
          </div>
        </div>
      </template>
    </div>

    <!-- ==================== Search by Package Tab ==================== -->
    <div v-if="activeTab === 'search-package'" class="space-y-4">
      <!-- Search form -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <form @submit.prevent="handlePackageSearch" class="flex gap-4 items-end flex-wrap">
          <div class="flex-1" style="min-width: 250px">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Package Name <span class="text-red-500">*</span></label>
            <input
              v-model="packageName"
              type="text"
              placeholder="e.g., vllm, transformers, numpy"
              class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              @keydown.enter.prevent="handlePackageSearch"
            />
          </div>

          <div style="min-width: 180px">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product</label>
            <select
              v-model="selectedProduct"
              class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Products</option>
              <option v-for="p in filters.products.value" :key="p.key" :value="p.key">{{ p.short_name || p.key }}</option>
            </select>
          </div>

          <div style="min-width: 150px">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Series</label>
            <select
              v-model="selectedSeries"
              :disabled="selectedProduct === 'all' || filters.series.value.length === 0"
              class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              :title="selectedProduct === 'all' ? 'Select a specific product to filter by series' : 'Filter by version series'"
            >
              <option value="all">All Series</option>
              <option v-for="s in filters.series.value" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div style="min-width: 150px">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variant</label>
            <select
              v-model="selectedVariant"
              class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Variants</option>
              <option v-for="v in filters.variants.value" :key="v" :value="v">{{ v }}</option>
            </select>
          </div>

          <button
            type="submit"
            :disabled="!packageName.trim() || pkgSearch.loading.value"
            class="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="pkgSearch.loading.value" class="inline-flex items-center gap-2">
              <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              Searching...
            </span>
            <span v-else>Search</span>
          </button>
        </form>
      </div>

      <!-- Search error -->
      <div v-if="pkgSearch.error.value" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
        {{ pkgSearch.error.value }}
      </div>

      <!-- Search results -->
      <template v-if="pkgSearch.results.value !== null && !pkgSearch.loading.value">
        <div v-if="pkgSearch.results.value.length === 0" class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-700 dark:text-blue-400">
          No releases found containing package "{{ packageName }}"
        </div>

        <template v-else>
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Showing {{ pkgSearch.results.value.length }} release{{ pkgSearch.results.value.length !== 1 ? 's' : '' }} containing "{{ packageName }}"
            {{ pkgSearch.pageNumber.value > 1 ? ` — Page ${pkgSearch.pageNumber.value}` : '' }}
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 40%">Collection</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 20%">Variant</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 20%">Package Version</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style="width: 20%">Created</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="result in pkgSearch.results.value"
                  :key="result.artifact_key"
                  @click="navigateToArtifact(result.artifact_key)"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400 break-all font-mono">
                    <span @click.stop="navigateToArtifact(result.artifact_key)" class="hover:underline cursor-pointer">{{ result.artifact_key }}</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ result.variant || '—' }}</td>
                  <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{{ result.package_version }}</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(result.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Search pagination -->
          <div v-if="pkgSearch.hasPrevious.value || pkgSearch.hasMore.value" class="flex items-center justify-end gap-2 text-sm">
            <button
              :disabled="!pkgSearch.hasPrevious.value"
              @click="handleSearchPreviousPage"
              class="px-3 py-1 rounded border text-sm font-medium transition-colors"
              :class="pkgSearch.hasPrevious.value
                ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'"
            >Previous</button>
            <span class="text-gray-500 dark:text-gray-400">Page {{ pkgSearch.pageNumber.value }}</span>
            <button
              :disabled="!pkgSearch.hasMore.value"
              @click="handleSearchNextPage"
              class="px-3 py-1 rounded border text-sm font-medium transition-colors"
              :class="pkgSearch.hasMore.value
                ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'"
            >Next</button>
          </div>
        </template>
      </template>
    </div>

    <!-- ==================== Artifacts Tab ==================== -->
    <div v-if="activeTab === 'artifacts'" class="space-y-4">
      <!-- Filter bar -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
        <div class="flex flex-wrap gap-4 items-end">
          <!-- Group By -->
          <div style="min-width: 140px">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Group By</label>
            <select v-model="artifactsGroupBy" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option v-for="opt in GROUP_BY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <!-- Architecture -->
          <div v-if="showArtifactsArchFilter" style="min-width: 150px">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Architecture</label>
            <select v-model="artifactsArchFilter" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">All</option>
              <option v-for="arch in AVAILABLE_ARCHS" :key="arch" :value="arch">{{ arch }}</option>
            </select>
          </div>

          <!-- Accelerator -->
          <div v-if="showArtifactsAccelFilter" style="min-width: 150px">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Accelerator</label>
            <select v-model="artifactsAccelFilter" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">All</option>
              <option v-for="accel in AVAILABLE_ACCELS" :key="accel" :value="accel">{{ accel }}</option>
            </select>
          </div>

          <!-- Date Range -->
          <div style="min-width: 150px">
            <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Date Range</label>
            <select v-model="artifactsDateFilter" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <option value="">All time</option>
              <option v-for="d in DATE_RANGE_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </div>

          <!-- Clear all -->
          <button
            v-if="artifactsHasActiveFilters"
            @click="clearArtifactFilters"
            class="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
          >Clear all filters</button>
        </div>
      </div>

      <!-- Loading / Error -->
      <div v-if="artifactsLoading && !artifactsData" class="text-sm text-gray-500 dark:text-gray-400">Loading artifacts…</div>
      <div v-if="artifactsError" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">{{ artifactsError }}</div>

      <!-- Grouped mode -->
      <template v-if="artifactsIsGrouped && artifactsData?.groups && !artifactsError">
        <div v-if="Object.keys(artifactsData.groups).length === 0 && !artifactsLoading" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No artifacts match the current filters.
        </div>
        <div v-for="groupKey in Object.keys(artifactsData.groups)" :key="groupKey" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div
            @click="toggleArtifactGroup(groupKey)"
            class="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 cursor-pointer select-none"
          >
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform" :class="{ 'rotate-90': expandedGroups.has(groupKey) }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              :class="artifactsData.grouped_by === 'architecture' ? archBadgeClass(groupKey) : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'"
            >{{ groupKey }}</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{{ artifactsData.groups[groupKey].count }}</span>
          </div>
          <template v-if="expandedGroups.has(groupKey)">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900/30">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th v-if="artifactsData.groups[groupKey].artifacts.some(a => a.series)" class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Series</th>
                    <th v-if="artifactsData.groups[groupKey].artifacts.some(a => a.environments?.length)" class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Environment</th>
                    <th v-if="artifactsData.grouped_by !== 'architecture'" class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Architectures</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commit</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Drop</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  <tr
                    v-for="art in artifactsData.groups[groupKey].artifacts"
                    :key="art.key"
                    @click="navigateToArtifact(art.key, art.product_key)"
                    class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400 break-all font-mono">
                      <span @click.stop="navigateToArtifact(art.key, art.product_key)" class="hover:underline cursor-pointer">{{ art.key }}</span>
                    </td>
                    <td v-if="artifactsData.groups[groupKey].artifacts.some(a => a.series)" class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ art.series || '—' }}</td>
                    <td v-if="artifactsData.groups[groupKey].artifacts.some(a => a.environments?.length)" class="px-4 py-3" @click.stop>
                      <div class="flex gap-1 flex-wrap">
                        <span v-for="env in (art.environments || [])" :key="env" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="envBadgeClass(env)">{{ env }}</span>
                        <span v-if="!art.environments?.length" class="text-sm text-gray-400 dark:text-gray-500">—</span>
                      </div>
                    </td>
                    <td v-if="artifactsData.grouped_by !== 'architecture'" class="px-4 py-3" @click.stop>
                      <div class="flex gap-1 flex-wrap">
                        <span v-for="arch in (art.archs || [])" :key="arch" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="archBadgeClass(arch)">{{ arch }}</span>
                        <span v-if="!art.archs?.length" class="text-sm text-gray-400 dark:text-gray-500">—</span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-sm font-mono" @click.stop>
                      <a v-if="art.commit && getCommitUrl(art)" :href="getCommitUrl(art)" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline">{{ formatCommit(art.commit) }}</a>
                      <span v-else-if="art.commit" class="text-gray-600 dark:text-gray-300">{{ formatCommit(art.commit) }}</span>
                      <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(art.created_at) }}</td>
                    <td class="px-4 py-3 text-sm" @click.stop>
                      <span v-if="getDropName(art)" @click="navigateToDropFromArtifact(art)" class="text-primary-600 dark:text-blue-400 hover:underline cursor-pointer">{{ getDropName(art) }}</span>
                      <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="artifactsData.groups[groupKey].count > artifactsData.groups[groupKey].artifacts.length" class="py-3 text-center border-t border-gray-200 dark:border-gray-700">
              <button @click="handleViewAll(groupKey, artifactsData.grouped_by)" class="text-sm font-medium text-primary-600 dark:text-blue-400 hover:underline">
                View all {{ artifactsData.groups[groupKey].count }} artifacts
              </button>
            </div>
          </template>
        </div>
      </template>

      <!-- Ungrouped mode -->
      <template v-if="!artifactsIsGrouped && Array.isArray(artifactsData) && !artifactsError">
        <div v-if="artifactsData.length === 0 && !artifactsLoading" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          No artifacts match the current filters.
        </div>
        <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th v-if="artifactsData.some(a => a.series)" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Series</th>
                <th v-if="artifactsData.some(a => a.environments?.length)" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Environment</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Architectures</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commit</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Drop</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="art in artifactsData"
                :key="art.key"
                @click="navigateToArtifact(art.key, art.product_key)"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400 break-all font-mono">
                  <span @click.stop="navigateToArtifact(art.key, art.product_key)" class="hover:underline cursor-pointer">{{ art.key }}</span>
                </td>
                <td v-if="artifactsData.some(a => a.series)" class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ art.series || '—' }}</td>
                <td v-if="artifactsData.some(a => a.environments?.length)" class="px-4 py-3" @click.stop>
                  <div class="flex gap-1 flex-wrap">
                    <span v-for="env in (art.environments || [])" :key="env" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="envBadgeClass(env)">{{ env }}</span>
                    <span v-if="!art.environments?.length" class="text-sm text-gray-400 dark:text-gray-500">—</span>
                  </div>
                </td>
                <td class="px-4 py-3" @click.stop>
                  <div class="flex gap-1 flex-wrap">
                    <span v-for="arch in (art.archs || [])" :key="arch" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="archBadgeClass(arch)">{{ arch }}</span>
                    <span v-if="!art.archs?.length" class="text-sm text-gray-400 dark:text-gray-500">—</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm font-mono" @click.stop>
                  <a v-if="art.commit && getCommitUrl(art)" :href="getCommitUrl(art)" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline">{{ formatCommit(art.commit) }}</a>
                  <span v-else-if="art.commit" class="text-gray-600 dark:text-gray-300">{{ formatCommit(art.commit) }}</span>
                  <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(art.created_at) }}</td>
                <td class="px-4 py-3 text-sm" @click.stop>
                  <span v-if="getDropName(art)" @click="navigateToDropFromArtifact(art)" class="text-primary-600 dark:text-blue-400 hover:underline cursor-pointer">{{ getDropName(art) }}</span>
                  <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="artifactsPage > 1 || artifactsHasNext" class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>Page {{ artifactsPage }}<template v-if="artifactsTotalPages"> of {{ artifactsTotalPages }}{{ artifactsTotalApprox ? '+' : '' }}</template></span>
          <div class="flex items-center gap-2">
            <button
              :disabled="artifactsPage <= 1"
              @click="artifactsPreviousPage"
              class="px-3 py-1 rounded border text-sm font-medium transition-colors"
              :class="artifactsPage > 1
                ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'"
            >Previous</button>
            <button
              :disabled="!artifactsHasNext"
              @click="artifactsNextPage"
              class="px-3 py-1 rounded border text-sm font-medium transition-colors"
              :class="artifactsHasNext
                ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'"
            >Next</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
