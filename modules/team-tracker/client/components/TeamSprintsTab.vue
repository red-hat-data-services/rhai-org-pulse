<template>
  <div>
    <!-- Board selector for multiple boards -->
    <div v-if="boards.length > 1" class="mb-4">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Board:</label>
      <select
        v-model="selectedBoardIndex"
        class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option v-for="(board, i) in boards" :key="i" :value="i">
          {{ board.name || fallbackBoardLabel(board.url, i) }}
        </option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
      <p class="text-red-700 dark:text-red-400 text-sm">{{ error }}</p>
    </div>

    <!-- Sprint content -->
    <template v-else-if="sprints.length > 0 || trendData.length > 0">
      <!-- Sub-tab bar: Team Overview / Sprint Detail -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-6">
          <button
            @click="viewMode = 'overview'"
            class="pb-3 text-sm font-medium border-b-2 transition-colors"
            :class="viewMode === 'overview'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            Team Overview
          </button>
          <button
            @click="viewMode = 'sprint-detail'"
            class="pb-3 text-sm font-medium border-b-2 transition-colors"
            :class="viewMode === 'sprint-detail'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            Sprint Detail
          </button>
        </nav>
      </div>

      <!-- Sprint selector + status (sprint-detail mode) -->
      <div v-if="viewMode === 'sprint-detail'" class="flex items-center gap-3 mb-4">
        <SprintSelector
          v-if="sprints.length > 0"
          :sprints="sprints"
          :selectedSprintId="selectedSprint?.id"
          @select-sprint="selectSprint"
        />
        <SprintStatusBadge v-if="selectedSprint" :state="selectedSprint.state" />
        <span v-if="selectedSprint" class="text-sm text-gray-500 dark:text-gray-400">
          {{ formatDateRange(selectedSprint.startDate, selectedSprint.endDate) }}
        </span>
      </div>

      <!-- Loading sprint detail -->
      <div v-if="viewMode === 'sprint-detail' && sprintLoading && !sprintData" class="flex justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Team Overview mode -->
      <TeamOverview
        v-if="viewMode === 'overview'"
        :board="currentBoard"
        :trendData="trendData"
        :sprints="sprints"
        @select-sprint="selectSprint"
      />

      <!-- Sprint Detail mode -->
      <SprintDetailView
        v-else-if="viewMode === 'sprint-detail' && sprintData"
        :sprintData="sprintData"
        :trendData="trendData"
        :trendLabels="trendLabels"
        @drill-down="openDrillDown"
        @assignee-drill-down="openAssigneeDrillDown"
      />
    </template>

    <!-- No data -->
    <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p>No sprint data available. Try refreshing from Jira.</p>
    </div>

    <!-- Issue drill-down modal -->
    <IssueList
      v-if="drillDownVisible"
      :title="drillDownTitle"
      :issues="drillDownIssues"
      @close="drillDownVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import TeamOverview from './TeamOverview.vue'
import SprintDetailView from './SprintDetail.vue'
import SprintSelector from './SprintSelector.vue'
import SprintStatusBadge from './SprintStatusBadge.vue'
import IssueList from './IssueList.vue'
import { apiRequest } from '@shared/client/services/api'
import { formatDate } from '../utils/metrics'

const props = defineProps({
  boards: { type: Array, required: true }
})

const selectedBoardIndex = ref(0)
const loading = ref(true)
const error = ref(null)
const sprints = ref([])
const trendData = ref([])
const viewMode = ref('overview')
const sprintData = ref(null)
const sprintLoading = ref(false)
const selectedSprintId = ref(null)

const drillDownVisible = ref(false)
const drillDownTitle = ref('')
const drillDownIssues = ref([])

const currentBoard = computed(() => props.boards[selectedBoardIndex.value] || null)

const currentBoardId = computed(() => {
  const board = currentBoard.value
  if (!board?.url) return null
  const match = board.url.match(/\/boards\/(\d+)/)
  return match ? match[1] : null
})

const selectedSprint = computed(() => {
  if (!selectedSprintId.value) return null
  return sprints.value.find(s => s.id === selectedSprintId.value) || null
})

const trendLabels = computed(() => {
  return trendData.value.map(d => {
    const name = d.sprintName || ''
    const match = name.match(/Sprint\s*(\d+)/i)
    return match ? `S${match[1]}` : name.slice(0, 15)
  })
})

async function loadBoardData() {
  const boardId = currentBoardId.value
  if (!boardId) {
    loading.value = false
    error.value = 'Could not extract board ID from URL'
    return
  }

  loading.value = true
  error.value = null
  sprints.value = []
  trendData.value = []
  sprintData.value = null
  selectedSprintId.value = null

  try {
    const [sprintsRes, trendRes] = await Promise.all([
      apiRequest(`/modules/team-tracker/boards/${encodeURIComponent(boardId)}/sprints`),
      apiRequest(`/modules/team-tracker/boards/${encodeURIComponent(boardId)}/trend`)
    ])
    sprints.value = sprintsRes.sprints || []
    trendData.value = trendRes.sprints || []

    // Auto-select most recent sprint for sprint-detail view
    if (sprints.value.length > 0) {
      selectedSprintId.value = sprints.value[sprints.value.length - 1].id
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function selectSprint(sprintId) {
  viewMode.value = 'sprint-detail'
  selectedSprintId.value = sprintId
  await loadSprintDetail(sprintId)
}

async function loadSprintDetail(sprintId) {
  sprintLoading.value = true
  try {
    sprintData.value = await apiRequest(`/modules/team-tracker/sprints/${encodeURIComponent(sprintId)}`)
  } catch (err) {
    console.error('Failed to load sprint detail:', err)
    sprintData.value = null
  } finally {
    sprintLoading.value = false
  }
}

// Load sprint detail when switching to sprint-detail mode
watch(viewMode, (mode) => {
  if (mode === 'sprint-detail' && selectedSprintId.value && !sprintData.value) {
    loadSprintDetail(selectedSprintId.value)
  }
})

// Reload board data when board selection changes
watch(selectedBoardIndex, () => {
  loadBoardData()
})

// Initial load
loadBoardData()

function formatDateRange(start, end) {
  if (!start || !end) return ''
  return `${formatDate(start)} - ${formatDate(end)}`
}

function fallbackBoardLabel(url, index) {
  try {
    const u = new URL(url)
    return `Board ${index + 1} — ${u.hostname}`
  } catch {
    return `Board ${index + 1}`
  }
}

function openDrillDown(category) {
  if (!sprintData.value) return

  const categoryMap = {
    committed: { title: 'Committed Issues', data: sprintData.value.committed },
    delivered: { title: 'Delivered Issues', data: sprintData.value.delivered },
    addedMidSprint: { title: 'Added Mid-Sprint', data: sprintData.value.addedMidSprint },
    removed: { title: 'Removed Issues', data: sprintData.value.removed },
    incomplete: { title: 'Incomplete Issues', data: sprintData.value.incomplete }
  }

  const entry = categoryMap[category]
  if (!entry) return

  drillDownTitle.value = entry.title
  drillDownIssues.value = entry.data.issues || []
  drillDownVisible.value = true
}

function openAssigneeDrillDown(assigneeName) {
  if (!sprintData.value?.byAssignee?.[assigneeName]) return

  drillDownTitle.value = `Issues: ${assigneeName}`
  drillDownIssues.value = sprintData.value.byAssignee[assigneeName].issues || []
  drillDownVisible.value = true
}
</script>
