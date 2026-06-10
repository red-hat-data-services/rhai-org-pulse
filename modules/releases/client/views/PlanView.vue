<template>
  <div>
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex -mb-px px-4" aria-label="Plan sub-tabs">
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
      <DashboardView v-if="activeTab === 'outcomes'" />
      <FeatureReadinessView v-else-if="activeTab === 'feature-readiness'" />
      <PmHubView v-else-if="activeTab === 'pm-hub'" />
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue'
import DashboardView from '../plan/views/DashboardView.vue'
import FeatureReadinessView from '../plan/views/FeatureReadinessView.vue'
import PmHubView from '../plan/views/PmHubView.vue'

const tabs = [
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'feature-readiness', label: 'Features List (1-n)' },
  { id: 'pm-hub', label: 'PM Hub' },
]

var moduleNav = inject('moduleNav', null)
var validTabIds = tabs.map(function(t) { return t.id })

function getTabFromParams() {
  var params = moduleNav && moduleNav.params ? moduleNav.params.value : {}
  var tab = params.tab
  if (tab && validTabIds.indexOf(tab) !== -1) return tab
  return 'outcomes'
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
</script>
