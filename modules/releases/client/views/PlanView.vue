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
      <HealthDashboardView v-else-if="activeTab === 'health'" />
      <FeatureReadinessView v-else-if="activeTab === 'feature-readiness'" />
      <PmHubView v-else-if="activeTab === 'pm-hub'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DashboardView from '../plan/views/DashboardView.vue'
import HealthDashboardView from '../plan/views/HealthDashboardView.vue'
import FeatureReadinessView from '../plan/views/FeatureReadinessView.vue'
import PmHubView from '../plan/views/PmHubView.vue'

const tabs = [
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'health', label: 'Health' },
  { id: 'feature-readiness', label: 'Feature Readiness (Prioritized)' },
  { id: 'pm-hub', label: 'PM Hub' },
]

const activeTab = ref('outcomes')
</script>
