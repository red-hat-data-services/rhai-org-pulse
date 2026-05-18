<template>
  <div>
    <ReleaseSelector />
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
import { ref, computed, defineAsyncComponent } from 'vue'
import ReleaseSelector from '../components/ReleaseSelector.vue'

const RiskDashboard = defineAsyncComponent(() => import('../deliver/views/MainView.vue'))
const ComponentBreakdown = defineAsyncComponent(() => import('../deliver/views/ProjectBreakdownView.vue'))
const ConformaInsights = defineAsyncComponent(() => import('../deliver/views/ConformaExceptionsView.vue'))

const tabs = [
  { id: 'risk-dashboard', label: 'Risk Dashboard' },
  { id: 'component-breakdown', label: 'Component Breakdown' },
  { id: 'conforma-insights', label: 'Conforma Insights' },
]

const activeTab = ref('risk-dashboard')

const componentMap = {
  'risk-dashboard': RiskDashboard,
  'component-breakdown': ComponentBreakdown,
  'conforma-insights': ConformaInsights,
}

const activeComponent = computed(() => componentMap[activeTab.value])
</script>
