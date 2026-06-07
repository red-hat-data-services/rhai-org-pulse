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
import { ref, computed, provide, defineAsyncComponent } from 'vue'
import { useReleaseAnalysis } from '../deliver/composables/useReleaseAnalysis.js'
import { useReleaseFilter } from '../deliver/composables/useReleaseFilter.js'
import ReleaseChipBar from '../deliver/components/ReleaseChipBar.vue'

const RiskDashboard = defineAsyncComponent(() => import('../deliver/views/MainView.vue'))
const ConformaInsights = defineAsyncComponent(() => import('../deliver/views/ConformaExceptionsView.vue'))
const PostReleaseDefects = defineAsyncComponent(() => import('../deliver/views/PostReleaseDefectsView.vue'))

const { loading, refreshing, error, analysis, refreshAnalysis } = useReleaseAnalysis()

const allReleases = computed(() => analysis.value?.releases || [])

const filter = useReleaseFilter(allReleases)

provide('releaseFilter', filter)
provide('analysisState', { loading, refreshing, error, analysis, refreshAnalysis })

const tabs = [
  { id: 'risk-dashboard', label: 'Risk Dashboard' },
  { id: 'conforma-insights', label: 'Conforma Insights' },
  { id: 'post-release-defects', label: 'Post-Release Defects' },
]

const activeTab = ref('risk-dashboard')

const componentMap = {
  'risk-dashboard': RiskDashboard,
  'conforma-insights': ConformaInsights,
  'post-release-defects': PostReleaseDefects,
}

const activeComponent = computed(() => componentMap[activeTab.value])
</script>
