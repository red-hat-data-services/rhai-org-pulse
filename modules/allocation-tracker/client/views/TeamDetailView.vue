<template>
  <TeamDetail
    :board="selectedTeam"
    :sprints="teamSprints"
    :selectedSprint="selectedSprint"
    :sprintData="teamSprintData"
    :isLoading="isTeamDetailLoading"
    :metricMode="metricMode"
    @select-sprint="handleSelectSprint"
    @back="onBack"
    @update:metricMode="metricMode = $event"
  />
</template>

<script setup>
import { onMounted } from 'vue'
import { useModuleLink } from '@shared/client'
import TeamDetail from '../components/TeamDetail.vue'
import { useAllocationData } from '../composables/useAllocationData.js'

const { navigateTo } = useModuleLink()
const {
  selectedProject,
  selectedTeam,
  teamSprints,
  selectedSprint,
  teamSprintData,
  isTeamDetailLoading,
  metricMode,
  handleSelectTeam,
  handleSelectSprint
} = useAllocationData()

// Read params from URL
const hash = window.location.hash
const params = new URLSearchParams(hash.split('?')[1] || '')
const boardId = params.get('boardId')

onMounted(async () => {
  // If no team loaded, load from URL params
  if (!selectedTeam.value && boardId) {
    await handleSelectTeam({ id: boardId, name: boardId })
  }
})

function onBack() {
  if (selectedProject.value) {
    navigateTo('allocation-tracker', 'project', { key: selectedProject.value.key })
  } else {
    navigateTo('allocation-tracker', 'dashboard')
  }
}
</script>
