<template>
  <div>
    <!-- Empty state: no boards with boardId -->
    <div v-if="allocationBoards.length === 0" class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
      <svg class="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        No Jira boards configured for allocation tracking. Add boards with Jira URLs in the team's board settings.
      </p>
    </div>

    <template v-else>
      <!-- Board selector (only if multiple boards) -->
      <div v-if="allocationBoards.length > 1" class="mb-4">
        <select
          v-model="selectedBoardId"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option v-for="board in allocationBoards" :key="board.boardId" :value="board.boardId">
            {{ board.name || `Board ${board.boardId}` }}
          </option>
        </select>
      </div>

      <!-- Loading state -->
      <div v-if="loadingSprints && sprints.length === 0" class="flex justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- No sprints -->
      <div v-else-if="sprints.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-400">
        No sprint data available for this board.
      </div>

      <!-- Sprint content -->
      <template v-else>
        <!-- Sprint selector row -->
        <div class="flex items-center gap-3 mb-4 flex-wrap">
          <SprintSelector
            :sprints="sprints"
            :selectedSprintId="selectedSprintId"
            @select-sprint="handleSelectSprint"
          />
          <SprintStatusBadge v-if="selectedSprint" :state="selectedSprint.state" />
          <span v-if="selectedSprint" class="text-sm text-gray-500 dark:text-gray-400">
            {{ formatDate(selectedSprint.startDate) }} – {{ formatDate(selectedSprint.endDate) }}
          </span>
        </div>

        <!-- Metric toggle -->
        <div class="flex items-center justify-end mb-4">
          <MetricToggle :modelValue="metricMode" @update:modelValue="handleMetricModeChange" />
        </div>

        <!-- Loading sprint issues -->
        <div v-if="loadingIssues" class="flex justify-center py-8">
          <svg class="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>

        <template v-else-if="sprintData">
          <!-- Allocation bar -->
          <div class="mb-4">
            <AllocationBar
              :buckets="sprintData.summary.buckets"
              :totalPoints="sprintData.summary.totalPoints"
              :totalCount="sprintData.summary.totalCount || 0"
              :metricMode="metricMode"
              class="h-8"
            />
          </div>

          <!-- Total summary -->
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <span class="font-semibold text-gray-900 dark:text-gray-100">{{ displayTotal }}</span> total {{ metricMode === 'counts' ? 'issues' : 'points' }}
          </div>

          <!-- Unestimated panel -->
          <div class="mb-4">
            <UnestimatedPanel :issues="unestimatedIssues" />
          </div>

          <!-- Bucket breakdown grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <BucketBreakdown
              v-for="bucket in BUCKET_CONFIGS"
              :key="bucket.key"
              :name="bucket.name"
              :bucketKey="bucket.key"
              :points="getBucketData(bucket.key).points"
              :count="getBucketData(bucket.key).count"
              :percentage="getBucketData(bucket.key).percentage"
              :targetPercentage="bucket.target"
              :completedPoints="getBucketData(bucket.key).completedPoints"
              :completedCount="getBucketData(bucket.key).completedCount"
              :color="bucket.color"
              :issues="sprintData.issues[bucket.key] || []"
              :metricMode="metricMode"
            />
          </div>

          <!-- Completion summary (only visible for closed sprints) -->
          <CompletionSummary
            :summary="sprintData.summary"
            :sprintState="selectedSprint.state"
            :metricMode="metricMode"
          />
        </template>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { getBoardSprints, getSprintIssues } from '../services/allocation-api'
import { useAllocationStrategy } from '../composables/useAllocationStrategy'
import SprintSelector from './allocation/SprintSelector.vue'
import SprintStatusBadge from './allocation/SprintStatusBadge.vue'
import AllocationBar from './allocation/AllocationBar.vue'
import BucketBreakdown from './allocation/BucketBreakdown.vue'
import MetricToggle from './allocation/MetricToggle.vue'
import UnestimatedPanel from './allocation/UnestimatedPanel.vue'
import CompletionSummary from './allocation/CompletionSummary.vue'

const props = defineProps({
  team: { type: Object, required: true },
  teamId: { type: String, default: null },
  teamDetail: { type: Object, default: null }
})

const { categories: strategyCategories } = useAllocationStrategy()

const BUCKET_CONFIGS = computed(() => [
  ...strategyCategories.value,
  { key: 'uncategorized', name: 'Uncategorized', target: 0, color: 'gray' }
])

const BUCKET_KEYS = computed(() => BUCKET_CONFIGS.value.map(b => b.key))

// --- State ---
const selectedBoardId = ref(null)
const sprints = ref([])
const selectedSprintId = ref(null)
const sprintData = ref(null)
const loadingSprints = ref(false)
const loadingIssues = ref(false)
const metricMode = ref('points')

// --- Computed ---
const allocationBoards = computed(() => {
  const boards = props.teamDetail?.boards || props.team?.metadata?.boards || []
  return boards.filter(b => b.boardId != null)
})

const selectedBoard = computed(() =>
  allocationBoards.value.find(b => b.boardId === selectedBoardId.value) || null
)

const selectedSprint = computed(() =>
  sprints.value.find(s => s.id === selectedSprintId.value) || null
)

const displayTotal = computed(() => {
  if (!sprintData.value) return 0
  if (metricMode.value === 'counts') return sprintData.value.summary.totalCount || 0
  return sprintData.value.summary.totalPoints || 0
})

const unestimatedIssues = computed(() => {
  if (!sprintData.value?.issues) return []
  return Object.values(sprintData.value.issues)
    .flat()
    .filter(issue => issue.storyPoints == null)
})

// --- Methods ---
function getBucketData(key) {
  const bucket = sprintData.value?.summary?.buckets?.[key]
  let percentage
  if (metricMode.value === 'counts') {
    const total = displayTotal.value
    const count = bucket?.count || 0
    percentage = total > 0 ? Math.round((count / total) * 100) : 0
  } else {
    percentage = bucket?.percentage || 0
  }
  return {
    points: bucket?.points || 0,
    count: bucket?.count || 0,
    percentage,
    completedPoints: bucket?.completedPoints || 0,
    completedCount: bucket?.completedCount || 0
  }
}

function transformSprintData(data) {
  const issuesByBucket = Object.fromEntries(BUCKET_KEYS.value.map(k => [k, []]))
  for (const issue of (data.issues || [])) {
    const bucket = issuesByBucket[issue.bucket]
    if (bucket) bucket.push(issue)
  }

  const summary = { ...data.summary }
  const totalPoints = summary.totalPoints || 0

  let completedPoints = 0
  if (summary.buckets) {
    summary.buckets = Object.fromEntries(
      Object.entries(summary.buckets).map(([key, bucket]) => {
        completedPoints += bucket.completedPoints || 0
        return [key, {
          ...bucket,
          count: bucket.count || bucket.issueCount || 0,
          completedCount: bucket.completedCount || 0,
          percentage: totalPoints > 0 ? Math.round((bucket.points / totalPoints) * 100) : 0
        }]
      })
    )
  }
  summary.completedPoints = completedPoints

  return {
    sprint: {
      id: data.sprintId,
      name: data.sprintName,
      state: data.sprintState,
      startDate: data.startDate,
      endDate: data.endDate
    },
    summary,
    issues: issuesByBucket
  }
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- Sprint selection persistence ---
function getSavedSprintId(boardId) {
  try {
    const saved = JSON.parse(localStorage.getItem('alloc_selectedSprints') || '{}')
    return saved[boardId] || null
  } catch {
    return null
  }
}

function saveSprintId(boardId, sprintId) {
  try {
    const saved = JSON.parse(localStorage.getItem('alloc_selectedSprints') || '{}')
    saved[boardId] = sprintId
    localStorage.setItem('alloc_selectedSprints', JSON.stringify(saved))
  } catch {
    // Ignore localStorage errors
  }
}

function pickDefaultSprint(sprintList) {
  const active = sprintList.find(s => s.state === 'active')
  if (active) return active.id
  const closed = sprintList
    .filter(s => s.state === 'closed')
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
  if (closed.length) return closed[0].id
  if (sprintList.length) return sprintList[0].id
  return null
}

// --- Data loading ---
async function loadSprints() {
  const board = selectedBoard.value
  if (!board) return

  loadingSprints.value = true
  try {
    const data = await getBoardSprints(board.boardId, board.sprintFilter)
    sprints.value = data.sprints || data || []

    // Restore saved sprint or pick default
    const savedId = getSavedSprintId(board.boardId)
    const restorable = savedId && sprints.value.some(s => s.id === savedId)
    selectedSprintId.value = restorable ? savedId : pickDefaultSprint(sprints.value)
  } catch (error) {
    console.error('Failed to load sprints:', error)
    sprints.value = []
  } finally {
    loadingSprints.value = false
  }
}

async function loadSprintIssues() {
  if (!selectedSprintId.value) {
    sprintData.value = null
    return
  }

  loadingIssues.value = true
  try {
    const data = await getSprintIssues(selectedSprintId.value)
    sprintData.value = transformSprintData(data)
  } catch (error) {
    console.error('Failed to load sprint issues:', error)
    sprintData.value = null
  } finally {
    loadingIssues.value = false
  }
}

function handleSelectSprint(sprintId) {
  selectedSprintId.value = sprintId
  if (selectedBoardId.value) {
    saveSprintId(selectedBoardId.value, sprintId)
  }
}

async function handleMetricModeChange(newMode) {
  metricMode.value = newMode
  if (props.teamId) {
    try {
      await apiRequest(`/modules/team-tracker/structure/teams/${props.teamId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocationMode: newMode })
      })
    } catch {
      // Non-critical — mode still changes locally
    }
  }
}

// --- Watchers ---
watch(selectedBoardId, () => {
  sprints.value = []
  sprintData.value = null
  selectedSprintId.value = null
  loadSprints()
})

watch(selectedSprintId, () => {
  loadSprintIssues()
})

// --- Lifecycle ---
onMounted(() => {
  // Set initial metric mode from team metadata
  const savedMode = props.team?.metadata?.allocationMode
  if (savedMode === 'points' || savedMode === 'counts') {
    metricMode.value = savedMode
  }

  // Auto-select first board
  if (allocationBoards.value.length > 0) {
    selectedBoardId.value = allocationBoards.value[0].boardId
  }
})
</script>
