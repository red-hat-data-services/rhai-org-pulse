<script setup>
import { ref, computed, reactive, onMounted, watch, inject } from 'vue'
import { useSearch, useSearchFilters, SEARCH_LIMIT } from '../composables/useSearch'
import { formatDate, envBadgeClass, getCommitUrl } from '../utils/formatting'

const nav = inject('moduleNav')
const { results, loading, error, search } = useSearch()
const { artifactTypes, environments, architectures, accelerators, loadFilterOptions } = useSearchFilters()

const ARTIFACT_TYPE_LABELS = {
  'base-images': 'Base Images',
  'cloud-containers': 'Cloud Containers',
  'cloud-disk-images': 'Cloud Disk Images',
  'containers': 'Containers',
  'disk-image-containers': 'Disk Image Containers',
  'disk-images': 'Disk Images',
  'instructlab': 'InstructLab',
  'models': 'Models',
  'model-cars': 'Model Cars',
  'unknown': 'Unknown',
  'wheels-collections': 'Wheels Collections'
}

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' }
]

const ITEMS_PER_PAGE = 10

const queryInput = ref('')
const filters = reactive({
  types: '',
  products: '',
  envs: '',
  archs: '',
  date: '',
  accel: ''
})

const dropsPage = ref(1)
const artifactSectionPages = reactive({})

function paginate(items, page) {
  const start = (page - 1) * ITEMS_PER_PAGE
  return items.slice(start, start + ITEMS_PER_PAGE)
}

const paginatedDrops = computed(() => results.value?.drops ? paginate(results.value.drops, dropsPage.value) : [])

function artifactPage(artifactType) {
  return artifactSectionPages[artifactType] || 1
}

function paginatedArtifacts(artifactType, artifacts) {
  return paginate(artifacts, artifactPage(artifactType))
}

function setArtifactPage(artifactType, page) {
  artifactSectionPages[artifactType] = page
}

const hasActiveFilters = computed(() =>
  !!(filters.types || filters.products || filters.envs || filters.archs || filters.date || filters.accel)
)

// The API's total_results is computed before its own per-type limit is applied to the
// response body, so it can report more than what's actually returned and pageable here.
// Count what we actually got instead, so the header always matches what you can page through.
const shownCount = computed(() => {
  if (!results.value) return 0
  const artifactCount = Object.values(results.value.artifacts || {}).reduce((sum, arr) => sum + arr.length, 0)
  return (results.value.drops?.length || 0) + artifactCount
})
const isTruncated = computed(() => shownCount.value >= SEARCH_LIMIT)

function syncFromParams() {
  const p = nav.params.value || {}
  queryInput.value = p.q || ''
  filters.types = p.types || ''
  filters.products = p.products || ''
  filters.envs = p.envs || ''
  filters.archs = p.archs || ''
  filters.date = p.date || ''
  filters.accel = p.accel || ''
}

function runSearch() {
  dropsPage.value = 1
  Object.keys(artifactSectionPages).forEach((key) => delete artifactSectionPages[key])
  search(queryInput.value.trim(), { ...filters })
}

function submitSearch() {
  nav.updateParams({
    q: queryInput.value.trim() || undefined,
    types: filters.types || undefined,
    products: filters.products || undefined,
    envs: filters.envs || undefined,
    archs: filters.archs || undefined,
    date: filters.date || undefined,
    accel: filters.accel || undefined
  }, { push: true })
  runSearch()
}

function onFilterChange() {
  nav.updateParams({
    types: filters.types || undefined,
    products: filters.products || undefined,
    envs: filters.envs || undefined,
    archs: filters.archs || undefined,
    date: filters.date || undefined,
    accel: filters.accel || undefined
  }, { push: false })
  runSearch()
}

function clearFilters() {
  filters.types = ''
  filters.products = ''
  filters.envs = ''
  filters.archs = ''
  filters.date = ''
  filters.accel = ''
  onFilterChange()
}

function goToDrop(drop) {
  nav.navigateTo('drop-detail', { key: drop.key, product: drop.product_key })
}

function goToArtifact(artifact) {
  nav.navigateTo('artifact-detail', { key: artifact.key, product: artifact.product_key })
}

watch(() => nav.params.value?.q, (val) => {
  if ((val || '') !== queryInput.value) {
    syncFromParams()
    runSearch()
  }
})

onMounted(() => {
  syncFromParams()
  loadFilterOptions()
  if (queryInput.value) runSearch()
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Search</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">Search across products, drops, and artifacts.</p>
    </div>

    <!-- Search input -->
    <div class="flex gap-2">
      <input
        v-model="queryInput"
        type="text"
        placeholder="Search by key, name, commit, or alternative name..."
        class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        @keyup.enter="submitSearch"
      />
      <button
        @click="submitSearch"
        class="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
      >Search</button>
    </div>

    <!-- Filters -->
    <div v-if="queryInput" class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
      <div class="flex flex-wrap gap-4 items-end">
        <div style="min-width: 160px">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Type</label>
          <select v-model="filters.types" @change="onFilterChange" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option value="">All</option>
            <option value="drops">Drops</option>
            <option v-for="t in artifactTypes" :key="t" :value="t">{{ ARTIFACT_TYPE_LABELS[t] || t }}</option>
          </select>
        </div>

        <div style="min-width: 150px">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Product</label>
          <select v-model="filters.products" @change="onFilterChange" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option value="">All</option>
            <option value="rhaiis">RHAIIS</option>
            <option value="rhel-ai">RHEL AI</option>
            <option value="base-images">Base Images</option>
            <option value="builder-images">Builder Images</option>
          </select>
        </div>

        <div v-if="environments.length" style="min-width: 150px">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Environment</label>
          <select v-model="filters.envs" @change="onFilterChange" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option value="">All</option>
            <option v-for="e in environments" :key="e" :value="e">{{ e }}</option>
          </select>
        </div>

        <div v-if="architectures.length" style="min-width: 150px">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Architecture</label>
          <select v-model="filters.archs" @change="onFilterChange" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option value="">All</option>
            <option v-for="a in architectures" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>

        <div style="min-width: 150px">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Date Range</label>
          <select v-model="filters.date" @change="onFilterChange" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option value="">All time</option>
            <option v-for="d in DATE_RANGES" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </div>

        <div v-if="accelerators.length" style="min-width: 150px">
          <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Accelerator</label>
          <select v-model="filters.accel" @change="onFilterChange" class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <option value="">All</option>
            <option v-for="a in accelerators" :key="a" :value="a">{{ a.toUpperCase() }}</option>
          </select>
        </div>

        <button
          v-if="hasActiveFilters"
          @click="clearFilters"
          class="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
        >Clear all filters</button>
      </div>
    </div>

    <!-- Empty query state -->
    <div v-if="!queryInput" class="text-sm text-gray-500 dark:text-gray-400 text-center py-12">
      Enter a search query above to find drops and artifacts.
    </div>

    <!-- Loading -->
    <div v-else-if="loading && !results" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Searching…</div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">{{ error }}</div>

    <template v-else-if="results">
      <p class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <span v-if="isTruncated">Showing the first {{ SEARCH_LIMIT }} results for "{{ results.query }}" — narrow your search or add filters to see more precise results</span>
        <span v-else>Found {{ shownCount }} result{{ shownCount !== 1 ? 's' : '' }} for "{{ results.query }}"</span>
        <span v-if="loading" class="text-xs text-gray-400 dark:text-gray-500">Searching…</span>
      </p>

      <div v-if="shownCount === 0" class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No drops or artifacts match your search query. Try a different search term or adjust your filters.
      </div>

      <!-- Drops -->
      <div
        v-if="results.drops && results.drops.length"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-opacity"
        :class="{ 'opacity-60 pointer-events-none': loading }"
      >
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">
          Drops ({{ results.drops.length }})
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
              <tr
                v-for="drop in paginatedDrops"
                :key="drop.key"
                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                @click="goToDrop(drop)"
              >
                <td class="px-4 py-2 text-sm text-primary-600 dark:text-blue-400">{{ drop.key }}</td>
                <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{{ drop.name }}</td>
                <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{{ drop.product_key }}</td>
                <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(drop.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="results.drops.length > ITEMS_PER_PAGE" class="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-sm">
          <button
            :disabled="dropsPage <= 1"
            @click="dropsPage--"
            class="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >Previous</button>
          <span class="text-gray-500 dark:text-gray-400">Page {{ dropsPage }} of {{ Math.ceil(results.drops.length / ITEMS_PER_PAGE) }}</span>
          <button
            :disabled="dropsPage >= Math.ceil(results.drops.length / ITEMS_PER_PAGE)"
            @click="dropsPage++"
            class="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >Next</button>
        </div>
      </div>

      <!-- Artifacts, grouped by type -->
      <div
        v-for="(artifacts, artifactType) in results.artifacts"
        :key="artifactType"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-opacity"
        :class="{ 'opacity-60 pointer-events-none': loading }"
      >
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">
          {{ ARTIFACT_TYPE_LABELS[artifactType] || artifactType }} ({{ artifacts.length }})
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Commit</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variant</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Environments</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
              <tr
                v-for="artifact in paginatedArtifacts(artifactType, artifacts)"
                :key="artifact.key"
                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                @click="goToArtifact(artifact)"
              >
                <td class="px-4 py-2 text-sm text-primary-600 dark:text-blue-400 max-w-md break-all">{{ artifact.key }}</td>
                <td class="px-4 py-2 text-sm">
                  <a
                    v-if="getCommitUrl(artifact)"
                    :href="getCommitUrl(artifact)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-blue-400 hover:underline"
                    @click.stop
                  ><code>{{ (artifact.commit || '').substring(0, 8) }}</code></a>
                  <code v-else>{{ (artifact.commit || 'N/A').substring(0, 8) }}</code>
                </td>
                <td class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{{ artifact.variant }}</td>
                <td class="px-4 py-2 text-sm">
                  <span
                    v-for="env in artifact.environments"
                    :key="env"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-1"
                    :class="envBadgeClass(env)"
                  >{{ env }}</span>
                </td>
                <td class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(artifact.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="artifacts.length > ITEMS_PER_PAGE" class="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-sm">
          <button
            :disabled="artifactPage(artifactType) <= 1"
            @click="setArtifactPage(artifactType, artifactPage(artifactType) - 1)"
            class="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >Previous</button>
          <span class="text-gray-500 dark:text-gray-400">Page {{ artifactPage(artifactType) }} of {{ Math.ceil(artifacts.length / ITEMS_PER_PAGE) }}</span>
          <button
            :disabled="artifactPage(artifactType) >= Math.ceil(artifacts.length / ITEMS_PER_PAGE)"
            @click="setArtifactPage(artifactType, artifactPage(artifactType) + 1)"
            class="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >Next</button>
        </div>
      </div>
    </template>
  </div>
</template>
