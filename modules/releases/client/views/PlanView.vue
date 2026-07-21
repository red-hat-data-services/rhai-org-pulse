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
      <DraftPlansView v-else-if="activeTab === 'draft-plans' && canViewDraftPlans" />
      <BuFeedbackView v-else-if="activeTab === 'bu-feedback'" />
      <PmHubView v-else-if="activeTab === 'pm-hub'" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import DashboardView from '../plan/views/DashboardView.vue'
import FeatureReadinessView from '../plan/views/FeatureReadinessView.vue'
import DraftPlansView from '../plan/views/DraftPlansView.vue'
import BuFeedbackView from '../plan/views/BuFeedbackView.vue'
import PmHubView from '../plan/views/PmHubView.vue'

var ALL_TABS = [
  { id: 'outcomes', label: 'Big Rocks' },
  { id: 'pm-hub', label: 'PM Hub' },
  { id: 'feature-readiness', label: 'Features List (1-n)' },
  { id: 'draft-plans', label: 'Draft Plans' },
  { id: 'bu-feedback', label: 'Field and BU Feedback' },
]

var canViewDraftPlans = ref(false)

var tabs = computed(function() {
  return ALL_TABS.filter(function(tab) {
    if (tab.id === 'draft-plans') return canViewDraftPlans.value
    return true
  })
})

var moduleNav = inject('moduleNav', null)

function validTabIds() {
  return tabs.value.map(function(t) { return t.id })
}

function getTabFromParams() {
  var params = moduleNav && moduleNav.params ? moduleNav.params.value : {}
  var tab = params.tab
  var ids = validTabIds()
  if (tab && ids.indexOf(tab) !== -1) return tab
  return 'outcomes'
}

const activeTab = ref('outcomes')

function syncActiveTab() {
  var tab = getTabFromParams()
  // Deep-link to draft-plans while gated → fall back until access resolves or deny.
  if (tab === 'draft-plans' && !canViewDraftPlans.value) {
    activeTab.value = 'outcomes'
    return
  }
  activeTab.value = tab
}

watch(activeTab, function(tab) {
  if (moduleNav && moduleNav.updateParams) {
    moduleNav.updateParams({ tab: tab }, { push: false })
  }
})

if (moduleNav && moduleNav.params) {
  watch(moduleNav.params, function() {
    var tab = getTabFromParams()
    if (tab === 'draft-plans' && !canViewDraftPlans.value) {
      if (activeTab.value !== 'outcomes') activeTab.value = 'outcomes'
      return
    }
    if (tab !== activeTab.value) activeTab.value = tab
  })
}

watch(canViewDraftPlans, function() {
  syncActiveTab()
})

onMounted(async function() {
  try {
    var res = await apiRequest('/modules/releases/draft-plans/access')
    canViewDraftPlans.value = !!(res && res.canViewDraftPlans)
  } catch {
    canViewDraftPlans.value = false
  }
  syncActiveTab()
})
</script>
