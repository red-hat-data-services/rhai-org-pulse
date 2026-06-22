<template>
  <div>
    <!-- Cold-start loading bar (no data yet, polling for first build) -->
    <div v-if="loading && !analysis"
         class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
      <div class="animate-pulse mb-2">Generating release analysis data...</div>
      <p class="text-xs">This may take a few minutes on first load.</p>
    </div>

    <!-- Chip bar (visible once analysis has data) -->
    <ReleaseChipBar v-if="allReleases.length" />

    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex -mb-px px-4" aria-label="Deliver sub-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>
    <div class="p-6">
      <component :is="activeComponent" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, provide, inject, watch, defineAsyncComponent } from 'vue'
import { useReleaseAnalysis } from '../deliver/composables/useReleaseAnalysis.js'
import { useReleaseFilter } from '../deliver/composables/useReleaseFilter.js'
import { useConformaExceptions } from '../deliver/composables/useConformaExceptions.js'
import ReleaseChipBar from '../deliver/components/ReleaseChipBar.vue'

const RiskDashboard = defineAsyncComponent(() => import('../deliver/views/MainView.vue'))
const ConformaInsights = defineAsyncComponent(() => import('../deliver/views/ConformaExceptionsView.vue'))
const PostReleaseDefects = defineAsyncComponent(() => import('../deliver/views/PostReleaseDefectsView.vue'))

const { loading, refreshing, error, analysis, refreshAnalysis } = useReleaseAnalysis()
const conformaState = useConformaExceptions()

const allReleases = computed(() => {
  const analysisReleases = analysis.value?.releases || []
  const seen = new Set(analysisReleases.map(r => r.releaseNumber))
  const conformaExtras = (conformaState.releases || [])
    .filter(r => r.version && !seen.has(r.version))
    .map(r => ({ releaseNumber: r.version }))
  return [...analysisReleases, ...conformaExtras]
})

const filter = useReleaseFilter(allReleases)

provide('releaseFilter', filter)
provide('analysisState', { loading, refreshing, error, analysis, refreshAnalysis })
provide('conformaState', conformaState)

const tabs = [
  { id: 'risk-dashboard', label: 'Risk Dashboard' },
  { id: 'conforma-insights', label: 'Conforma Insights' },
  { id: 'post-release-defects', label: 'Post-Release Defects' },
]

var moduleNav = inject('moduleNav', null)
var validTabIds = tabs.map(function(t) { return t.id })

function getTabFromParams() {
  var params = moduleNav && moduleNav.params ? moduleNav.params.value : {}
  var tab = params.tab
  if (tab && validTabIds.indexOf(tab) !== -1) return tab
  return 'risk-dashboard'
}

const activeTab = ref(getTabFromParams())

watch(activeTab, function(tab) {
  if (moduleNav && moduleNav.updateParams) {
    moduleNav.updateParams({ tab: tab }, { push: false })
  }
})

if (moduleNav && moduleNav.params) {
  watch(moduleNav.params, function() {
    var tab = getTabFromParams()
    if (tab !== activeTab.value) activeTab.value = tab
  })
}

const componentMap = {
  'risk-dashboard': RiskDashboard,
  'conforma-insights': ConformaInsights,
  'post-release-defects': PostReleaseDefects,
}

const activeComponent = computed(() => componentMap[activeTab.value])
</script>
