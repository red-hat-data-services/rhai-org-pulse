<template>
  <div>
    <div v-if="configError" class="container mx-auto px-6 py-12">
      <div class="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg mx-auto text-center">
        <p class="text-red-800" data-testid="config-error">{{ configError }}</p>
        <button
          @click="loadInitialData"
          class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>

    <div v-else class="relative">
      <OrgDashboard
        :orgName="orgName"
        :orgSummary="orgSummary"
        :projects="projects"
        :projectSummaries="projectSummaries"
        :metricMode="metricMode"
        @select-project="onSelectProject"
        @update:metricMode="metricMode = $event"
      />
      <LoadingOverlay v-if="isLoading" />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useModuleLink } from '@shared/client'
import OrgDashboard from '../components/OrgDashboard.vue'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import { useAllocationData } from '../composables/useAllocationData.js'

const { navigateTo } = useModuleLink()
const {
  orgName,
  orgSummary,
  projects,
  projectSummaries,
  configError,
  metricMode,
  isLoading,
  loadInitialData,
  handleSelectProject
} = useAllocationData()

onMounted(() => {
  loadInitialData()
})

function onSelectProject(project) {
  handleSelectProject(project)
  navigateTo('allocation-tracker', 'project', { key: project.key })
}
</script>
