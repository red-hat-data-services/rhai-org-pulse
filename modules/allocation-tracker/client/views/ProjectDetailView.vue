<template>
  <div>
    <ProjectDetail
      :project="selectedProject || { name: 'Loading...', key: projectKey }"
      :projectSummary="selectedProjectSummary"
      :boards="boards"
      :boardSprintData="boardSprintData"
      :isLoading="isLoading"
      :filters="filters"
      :activeFilterId="activeFilterId"
      :activeFilter="activeFilter"
      :metricMode="metricMode"
      @back="onBack"
      @select-team="onSelectTeam"
      @select-filter="setActiveFilter"
      @create-filter="openCreateFilter"
      @edit-filter="openEditFilter"
      @delete-filter="handleDeleteFilter"
      @update:metricMode="metricMode = $event"
    />

    <FilterEditorModal
      v-if="showFilterEditor"
      :boards="boards"
      :filter="editingFilter"
      @save="handleSaveFilter"
      @cancel="showFilterEditor = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useModuleLink } from '@shared/client'
import ProjectDetail from '../components/ProjectDetail.vue'
import FilterEditorModal from '../components/FilterEditor.vue'
import { useAllocationData } from '../composables/useAllocationData.js'
import { useSavedFilters } from '../composables/useSavedFilters.js'

const { navigateTo } = useModuleLink()
const {
  selectedProject,
  selectedProjectSummary,
  boards,
  boardSprintData,
  metricMode,
  isLoading,
  projects,
  handleSelectProject
} = useAllocationData()

const { filters, activeFilterId, activeFilter, createFilter, updateFilter, deleteFilter, setActiveFilter } = useSavedFilters()

// Read project key from URL params
const hash = window.location.hash
const params = new URLSearchParams(hash.split('?')[1] || '')
const projectKey = params.get('key') || 'RHOAIENG'

const showFilterEditor = ref(false)
const editingFilter = ref(null)

onMounted(async () => {
  // If no project loaded yet, load it from URL param
  if (!selectedProject.value || selectedProject.value.key !== projectKey) {
    const project = projects.value.find(p => p.key === projectKey) || { key: projectKey, name: projectKey }
    await handleSelectProject(project)
  }
})

function onBack() {
  navigateTo('allocation-tracker', 'dashboard')
}

function onSelectTeam(board) {
  navigateTo('allocation-tracker', 'team', { boardId: board.id, project: selectedProject.value?.key })
}

function openCreateFilter() {
  editingFilter.value = null
  showFilterEditor.value = true
}

function openEditFilter(id) {
  editingFilter.value = filters.value.find(f => f.id === id) || null
  showFilterEditor.value = true
}

function handleSaveFilter({ name, boardIds }) {
  if (editingFilter.value) {
    updateFilter(editingFilter.value.id, { name, boardIds })
  } else {
    createFilter({ name, boardIds })
  }
  showFilterEditor.value = false
  editingFilter.value = null
}

function handleDeleteFilter(id) {
  deleteFilter(id)
}
</script>
