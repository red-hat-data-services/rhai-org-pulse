<script setup>
import { ref, onMounted, onUnmounted, inject, computed, watch } from 'vue'
import { useScroll } from '@vueuse/core'
import { useProduct, useDrops, useSeries } from '../composables/useDrops'
import { useArtifacts } from '../composables/useArtifacts'
import { formatDate, envBadgeClass } from '../utils/formatting'

const PRODUCT_CONFIGS = {
  'rhaiis':            { key: 'rhaiis',        artifactType: 'containers' },
  'rhel-ai':           { key: 'rhel-ai',       artifactType: 'containers' },
  'base-images':       { key: 'base-images',   artifactType: 'containers' },
  'builder-images':    { key: 'builder-images', artifactType: 'containers' },
  'wheel-collections': { key: 'rhai',          artifactType: 'wheels-collections', label: 'Wheel Collections' },
}
function getConfigFromHash() {
  const hash = window.location.hash || ''
  const viewId = hash.replace('#/', '').split('?')[0].split('/')[1] || ''
  return PRODUCT_CONFIGS[viewId] || PRODUCT_CONFIGS['rhaiis']
}

const nav = inject('moduleNav')
const { product, loading: productLoading, error: productError, loadProduct } = useProduct()
const { drops, loading: dropsLoading, error: dropsError, loadDrops } = useDrops()
const { series, loadSeries } = useSeries()
const { artifacts, hasMore: artifactsHasMore, loading: artifactsLoading, error: artifactsError, loadArtifacts, reset: resetArtifacts } = useArtifacts()
const ARTIFACT_PAGE_SIZE = 50
const artifactOffset = ref(0)

const activeTab = ref('series')
const selectedSeries = ref('')
const productConfig = ref(getConfigFromHash())
const productKey = computed(() => productConfig.value.key)
const artifactTypeFilter = computed(() => productConfig.value.artifactType)

async function load() {
  activeTab.value = 'series'
  selectedSeries.value = ''
  resetArtifacts()
  artifactOffset.value = 0
  const filters = { limit: 1000, artifact_type: artifactTypeFilter.value }
  await Promise.all([
    loadProduct(productKey.value),
    loadDrops(productKey.value, filters),
    loadSeries(productKey.value)
  ])
}

function onHashChange() {
  const newConfig = getConfigFromHash()
  if (newConfig && newConfig.key !== productKey.value) {
    productConfig.value = newConfig
  }
}

onMounted(() => {
  load()
  window.addEventListener('hashchange', onHashChange)
})
onUnmounted(() => window.removeEventListener('hashchange', onHashChange))

watch(productConfig, () => load())

watch(selectedSeries, (val) => {
  const filters = { series: val || undefined, limit: 1000, artifact_type: artifactTypeFilter.value }
  loadDrops(productKey.value, filters)
})

function loadArtifactsPage({ append = false } = {}) {
  return loadArtifacts({
    product_key: productKey.value,
    type: artifactTypeFilter.value,
    limit: ARTIFACT_PAGE_SIZE,
    offset: artifactOffset.value
  }, { append })
}

async function loadMoreArtifacts() {
  if (artifactsLoading.value || !artifactsHasMore.value) return
  artifactOffset.value += ARTIFACT_PAGE_SIZE
  await loadArtifactsPage({ append: true })
}

const { arrivedState } = useScroll(window, { offset: { bottom: 200 } })

watch(() => arrivedState.bottom, (arrived) => {
  if (arrived && activeTab.value === 'artifacts') loadMoreArtifacts()
})

watch(activeTab, (tab) => {
  if (tab === 'artifacts' && artifacts.value.length === 0) {
    loadArtifactsPage()
  }
})

const hasSeriesTimeline = computed(() => productConfig.value.artifactType === 'containers')

function navigateToSeries(seriesName) {
  if (!hasSeriesTimeline.value) return
  nav.navigateTo('series-detail', { series: seriesName, product: productKey.value })
}

function navigateToDrop(dropKey) {
  nav.navigateTo('drop-detail', { key: dropKey, product: productKey.value })
}

function navigateToArtifact(artifactKey) {
  nav.navigateTo('artifact-detail', { key: artifactKey, product: productKey.value })
}

const groupedDrops = computed(() => {
  const seriesOrder = Object.fromEntries(series.value.map((s, i) => [s, i]))
  const map = new Map()
  for (const drop of drops.value) {
    const s = drop.product_version || 'Unknown'
    if (!map.has(s)) map.set(s, [])
    map.get(s).push(drop)
  }
  for (const [, list] of map) {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }
  const groups = Array.from(map, ([s, drops]) => ({ series: s, drops }))
  groups.sort((a, b) => {
    const ai = seriesOrder[a.series] ?? Infinity
    const bi = seriesOrder[b.series] ?? Infinity
    return ai - bi
  })
  return groups
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">
        {{ productConfig.label || product?.product_name || product?.short_name || productKey }}
      </h1>
      <p v-if="product" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Overview of {{ product.short_name || productKey }} product series and their available drops
      </p>
    </div>

    <!-- Loading / Error -->
    <div v-if="productLoading && !product" class="text-sm text-gray-500 dark:text-gray-400">Loading product…</div>
    <div v-if="productError" class="text-sm text-red-600 dark:text-red-400">{{ productError }}</div>

    <template v-if="product">
      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="flex gap-4">
          <button
            v-for="tab in ['series', 'artifacts']"
            :key="tab"
            @click="activeTab = tab"
            class="py-2 text-sm font-medium border-b-2 transition-colors"
            :class="activeTab === tab
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >{{ tab.charAt(0).toUpperCase() + tab.slice(1) }}</button>
        </nav>
      </div>

      <!-- Series tab -->
      <div v-if="activeTab === 'series'" class="space-y-4">
        <!-- Series filter -->
        <div class="flex items-center justify-end">
          <select
            v-if="series.length > 0"
            v-model="selectedSeries"
            class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All series</option>
            <option v-for="s in series" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <div v-if="dropsLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading drops…</div>
        <div v-else-if="dropsError" class="text-sm text-red-600 dark:text-red-400">{{ dropsError }}</div>
        <div v-else-if="drops.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No drops found.</div>

        <!-- All series: grouped tables with series name as header -->
        <template v-if="!selectedSeries">
          <div v-for="group in groupedDrops" :key="group.series" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div
              class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 transition-colors"
              :class="hasSeriesTimeline ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''"
              @click="navigateToSeries(group.series)"
            >
              <h3
                class="text-sm font-semibold"
                :class="hasSeriesTimeline ? 'text-primary-600 dark:text-blue-400 hover:underline' : 'text-gray-900 dark:text-gray-100'"
              >{{ group.series }}</h3>
            </div>
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900/30">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[35%]">Drop</th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Branch</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[25%]">Environment</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%]">Date</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="drop in group.drops"
                  :key="drop.key"
                  @click="navigateToDrop(drop.key)"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400">{{ drop.name }}</td>
                  <td class="px-4 py-3 text-center">
                    <span
                      v-if="drop.git_branch"
                      class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-700"
                      :title="'Tag was cut from the \'' + drop.git_branch + '\' branch'"
                    >{{ drop.git_branch }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <span
                        v-for="env in (drop.environments || [])"
                        :key="env"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="envBadgeClass(env)"
                      >{{ env }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(drop.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Single series selected: flat table, no series column -->
        <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[35%]">Drop</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Branch</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[25%]">Environment</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%]">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="drop in drops"
                :key="drop.key"
                @click="navigateToDrop(drop.key)"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              >
                <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400">{{ drop.name }}</td>
                <td class="px-4 py-3 text-center">
                  <span
                    v-if="drop.git_branch"
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-700"
                    :title="'Tag was cut from the \'' + drop.git_branch + '\' branch'"
                  >{{ drop.git_branch }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex gap-1">
                    <span
                      v-for="env in (drop.environments || [])"
                      :key="env"
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      :class="envBadgeClass(env)"
                    >{{ env }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(drop.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Artifacts tab -->
      <div v-if="activeTab === 'artifacts'">
        <div v-if="artifactsLoading && artifacts.length === 0" class="text-sm text-gray-500 dark:text-gray-400">Loading artifacts…</div>
        <div v-else-if="artifactsError && artifacts.length === 0" class="text-sm text-red-600 dark:text-red-400">{{ artifactsError }}</div>
        <div v-else-if="!artifactsLoading && artifacts.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No artifacts found.</div>
        <template v-if="artifacts.length > 0">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Key</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Variant</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Architectures</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Environments</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="art in artifacts"
                  :key="art.key"
                  @click="navigateToArtifact(art.key)"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <td class="px-4 py-3 text-sm font-medium text-primary-600 dark:text-blue-400 max-w-xs truncate">{{ art.key }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ art.variant || '—' }}</td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ (art.archs || []).join(', ') || '—' }}</td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      <span
                        v-for="env in (art.environments || [])"
                        :key="env"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="envBadgeClass(env)"
                      >{{ env }}</span>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="artifactsLoading">
                <tr>
                  <td colspan="4" class="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                    <span class="inline-flex items-center gap-2">
                      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Loading more…
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div v-if="!artifactsHasMore && !artifactsLoading" class="text-center py-2">
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ artifacts.length }} artifacts loaded</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
