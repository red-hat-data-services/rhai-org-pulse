<template>
  <div>
    <!-- Unconfigured banner: a manager must choose story points vs issue count.
         Until then the team is flagged as unconfigured in org reports. -->
    <div
      v-if="teamId && settingsLoaded && !isConfigured"
      data-testid="allocation-unconfigured-banner"
      class="mb-4 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4"
    >
      <div class="flex items-start gap-3">
        <svg class="h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-400 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-100">Allocation reporting isn't configured for this team</h3>
          <p class="text-sm text-amber-800 dark:text-amber-200 mt-0.5">
            Choose whether this team's allocation is measured by <span class="font-medium">story points</span> or
            <span class="font-medium">issue count</span>. Until it's set, the team is flagged as unconfigured in org reports<template v-if="!canEditSettings"> — ask a team manager or admin to set it</template>.
          </p>
          <button
            v-if="canEditSettings"
            type="button"
            data-testid="allocation-unconfigured-cta"
            class="mt-2 inline-flex items-center px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
            @click="showSettingsModal = true"
          >
            Choose a basis
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state: strategy is configured but this team has no allocation boards.
         The tab is intentionally shown (not hidden) so managers get actionable
         guidance on how to enable allocation tracking for their team. -->
    <AllocationRefreshPanel
      v-if="allocationBoards.length === 0"
      title="Allocation tracking isn't set up for this team yet"
      :description="`Add a Jira board (with its board URL) to this team using “Edit boards” above, then refresh to pull how work is allocated across ${strategyName || 'your categories'}.`"
      button-label="Refresh after adding a board"
      :can-refresh="!!teamId"
      :refreshing="refreshing"
      :message="refreshMessage"
      hint="Add a board to this team to start tracking allocation."
      @refresh="handleRefresh"
    />

    <template v-else>
      <!-- Board selector + sprint-filter indicator -->
      <div v-if="selectedBoard" class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <select
          v-if="allocationBoards.length > 1"
          v-model="selectedBoardId"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option v-for="board in allocationBoards" :key="board.boardId" :value="board.boardId">
            {{ board.name || `Board ${board.boardId}` }}
          </option>
        </select>

        <!-- Sprint filter is configured per board; surface it right by the board
             toggle so misconfigured boards (foreign sprints) are easy to fix. -->
        <div class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400" data-testid="sprint-filter-indicator">
          <svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L14 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 018 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <span>Sprints:
            <span class="font-medium text-gray-700 dark:text-gray-300">{{ effectiveSprintFilter ? `names containing “${effectiveSprintFilter}”` : 'all sprints' }}</span>
          </span>
          <button
            v-if="canEditSettings"
            type="button"
            data-testid="sprint-filter-edit"
            class="font-medium text-primary-600 dark:text-primary-400 hover:underline focus:outline-none focus:underline"
            @click="showSettingsModal = true"
          >
            Edit
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loadingSprints && sprints.length === 0" class="flex justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Never synced: no data file exists for this board yet -->
      <AllocationRefreshPanel
        v-else-if="sprints.length === 0 && !boardSynced"
        title="This board hasn't been synced yet"
        description="Allocation data is pulled from Jira on a schedule, and this board hasn't been included in a sync yet. Refresh now to fetch its sprints and classify the work."
        button-label="Refresh this team's data"
        :can-refresh="!!teamId"
        :refreshing="refreshing"
        :message="refreshMessage"
        hint="Ask an admin to run an allocation refresh to populate this board."
        @refresh="handleRefresh"
      />

      <!-- Synced but empty: Jira returned no sprints for this board -->
      <AllocationRefreshPanel
        v-else-if="sprints.length === 0"
        title="No sprints found for this board"
        description="This board is synced, but Jira returned no active or recent sprints. Kanban boards only show work resolved in the last two weeks. If this looks wrong, refreshing will re-check Jira."
        button-label="Refresh this team's data"
        :can-refresh="!!teamId"
        :refreshing="refreshing"
        :message="refreshMessage"
        :last-updated="boardLastUpdated"
        @refresh="handleRefresh"
      />

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

        <!-- Last synced + refresh, and metric toggle -->
        <div class="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span v-if="boardLastUpdated">Last synced {{ formatDateTime(boardLastUpdated) }}</span>
            <button
              v-if="teamId"
              type="button"
              data-testid="allocation-inline-refresh"
              :disabled="refreshing"
              class="inline-flex items-center gap-1 font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:underline"
              @click="handleRefresh"
            >
              <svg
                class="h-3.5 w-3.5"
                :class="{ 'animate-spin': refreshing }"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {{ refreshing ? 'Refreshing…' : 'Refresh' }}
            </button>
            <span v-if="refreshing && refreshMessage" class="text-gray-400 dark:text-gray-500">· {{ refreshMessage }}</span>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div class="flex items-center gap-2">
              <MetricToggle :modelValue="metricMode" @update:modelValue="handleMetricModeChange" />
              <button
                v-if="canEditSettings"
                type="button"
                data-testid="allocation-settings-button"
                title="Allocation settings"
                aria-label="Allocation settings"
                class="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                @click="showSettingsModal = true"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            <!-- View-override callout: the toggle is a view control, not the team's saved default.
                 Sits directly under the toggle so the distinction is obvious. -->
            <div
              v-if="isConfigured && metricMode !== teamAllocationMode"
              data-testid="allocation-view-note"
              class="flex items-start gap-1.5 max-w-xs rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200 shadow-sm"
            >
              <svg class="h-4 w-4 flex-shrink-0 mt-px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>
                Viewing by <span class="font-semibold">{{ metricLabel(metricMode) }}</span> — not this team's
                default (<span class="font-semibold">{{ metricLabel(teamAllocationMode) }}</span>).<template v-if="canEditSettings">
                  <button type="button" class="ml-1 font-semibold underline hover:no-underline focus:outline-none" @click="showSettingsModal = true">Change default</button></template>
              </span>
            </div>
          </div>
        </div>

        <!-- Loading sprint issues -->
        <div v-if="loadingIssues" class="flex justify-center py-8">
          <svg class="animate-spin h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>

        <template v-else-if="sprintData">
          <!-- Board type explainer (helps managers understand how the % is derived) -->
          <div class="mb-4">
            <BoardTypeInfo :boardType="boardType" />
          </div>

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

    <!-- Settings modal -->
    <AllocationSettingsModal
      v-if="showSettingsModal"
      :teamId="teamId"
      :currentMode="teamAllocationMode"
      :board="settingsBoard"
      :boards="rawBoards"
      @close="showSettingsModal = false"
      @saved="handleSettingsSaved"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { getBoardSprints, getSprintIssues, getTeamAllocationSettings } from './services/allocation-api'
import { useAllocationStrategy } from './composables/useAllocationStrategy'
import SprintSelector from './allocation/SprintSelector.vue'
import SprintStatusBadge from './allocation/SprintStatusBadge.vue'
import AllocationBar from './allocation/AllocationBar.vue'
import BucketBreakdown from './allocation/BucketBreakdown.vue'
import MetricToggle from './allocation/MetricToggle.vue'
import UnestimatedPanel from './allocation/UnestimatedPanel.vue'
import CompletionSummary from './allocation/CompletionSummary.vue'
import BoardTypeInfo from './allocation/BoardTypeInfo.vue'
import AllocationRefreshPanel from './allocation/AllocationRefreshPanel.vue'
import AllocationSettingsModal from './allocation/AllocationSettingsModal.vue'
import { useAllocationRefresh } from './composables/useAllocationRefresh'

const props = defineProps({
  team: { type: Object, required: true },
  teamId: { type: String, default: null },
  teamDetail: { type: Object, default: null }
})

const { categories: strategyCategories, name: strategyName } = useAllocationStrategy()

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
// Whether the selected board has ever been synced from Jira, and when.
// Distinguishes "never synced" from "synced but no sprints" in the empty state.
const boardSynced = ref(true)
const boardLastUpdated = ref(null)

// The team's persisted allocation basis (default view + server aggregation).
// null until a manager configures it. The MetricToggle is a per-view override.
const teamAllocationMode = ref(
  props.team?.metadata?.allocationMode === 'counts' || props.team?.metadata?.allocationMode === 'points'
    ? props.team.metadata.allocationMode
    : null
)
const canEditSettings = ref(false)
const showSettingsModal = ref(false)
const settingsLoaded = ref(false)
// Local override of the selected board's sprint filter after a save, so the
// indicator + modal reflect the new value without waiting for the parent to
// re-fetch teamDetail. Reset when the selected board changes.
const sprintFilterOverride = ref(null)

const isConfigured = computed(() =>
  teamAllocationMode.value === 'points' || teamAllocationMode.value === 'counts'
)

const { refreshing, message: refreshMessage, triggerRefresh } = useAllocationRefresh()

// --- Computed ---
const allocationBoards = computed(() => {
  const boards = props.teamDetail?.boards || props.team?.metadata?.boards || []
  return boards.filter(b => b.boardId != null)
})

const selectedBoard = computed(() =>
  allocationBoards.value.find(b => b.boardId === selectedBoardId.value) || null
)

// Full, unfiltered boards list (incl. non-board URLs) — passed to the settings
// modal so it can reconstruct the boards PATCH payload without dropping entries.
const rawBoards = computed(() => props.teamDetail?.boards || props.team?.metadata?.boards || [])

const effectiveSprintFilter = computed(() =>
  sprintFilterOverride.value != null ? sprintFilterOverride.value : (selectedBoard.value?.sprintFilter || '')
)

// The board handed to the settings modal, carrying the effective (possibly
// just-saved) sprint filter.
const settingsBoard = computed(() =>
  selectedBoard.value ? { ...selectedBoard.value, sprintFilter: effectiveSprintFilter.value } : null
)

const selectedSprint = computed(() =>
  sprints.value.find(s => s.id === selectedSprintId.value) || null
)

// Board type is derived from the sprint id: kanban boards produce a single
// synthetic sprint with a `kanban-<boardId>` id (see server orchestration),
// whereas scrum boards use numeric Jira sprint ids.
const boardType = computed(() => {
  const id = selectedSprint.value?.id ?? sprintData.value?.sprint?.id
  return id != null && String(id).startsWith('kanban-') ? 'kanban' : 'scrum'
})

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

function formatDateTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
    sprints.value = Array.isArray(data) ? data : (data.sprints || [])
    // `synced: false` means the board has no data file yet (never refreshed).
    boardSynced.value = Array.isArray(data) ? true : data.synced !== false
    boardLastUpdated.value = (data && !Array.isArray(data) && data.lastUpdated) || null

    // Restore saved sprint or pick default
    const savedId = getSavedSprintId(board.boardId)
    const restorable = savedId && sprints.value.some(s => s.id === savedId)
    selectedSprintId.value = restorable ? savedId : pickDefaultSprint(sprints.value)
  } catch (error) {
    console.error('Failed to load sprints:', error)
    sprints.value = []
    // Treat a load failure as "synced" so we don't wrongly claim it was never
    // synced; the generic empty state + refresh still applies.
    boardSynced.value = true
    boardLastUpdated.value = null
  } finally {
    loadingSprints.value = false
  }
}

async function handleRefresh() {
  if (!props.teamId) return
  await triggerRefresh({ teamId: props.teamId, onComplete: loadSprints })
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

function metricLabel(mode) {
  return mode === 'counts' ? 'Issue Count' : 'Story Points'
}

// The toggle is a per-view override only; it never changes the team's saved
// default (that's done via the settings modal). The template surfaces a note
// when the current view differs from the team default.
function handleMetricModeChange(newMode) {
  metricMode.value = newMode
}

async function loadSettings() {
  if (!props.teamId) return
  try {
    const { allocationMode, configured, canEdit } = await getTeamAllocationSettings(props.teamId)
    teamAllocationMode.value = configured ? allocationMode : null
    canEditSettings.value = !!canEdit
    // View defaults to the configured basis, or story points as a fallback.
    metricMode.value = teamAllocationMode.value || 'points'
  } catch {
    // Non-fatal — keep the seed from team metadata; settings button stays hidden.
  } finally {
    settingsLoaded.value = true
  }
}

function handleSettingsSaved({ allocationMode, sprintFilter } = {}) {
  if (allocationMode === 'points' || allocationMode === 'counts') {
    teamAllocationMode.value = allocationMode
    metricMode.value = allocationMode
  }
  // Track the new sprint filter locally so the indicator + modal reflect it
  // without waiting for the parent to re-fetch teamDetail.
  if (sprintFilter !== undefined) sprintFilterOverride.value = sprintFilter
  showSettingsModal.value = false
  // The modal already re-ran this team's allocation; reload sprint data so the
  // "last synced" stamp and re-filtered sprints reflect the refresh.
  loadSprints()
}

// --- Watchers ---
// NOTE: the selectedBoardId watcher is registered BEFORE the immediate
// allocationBoards watcher below so that when the latter selects a board during
// setup, this watcher is already active and triggers the initial load.
watch(selectedBoardId, () => {
  sprints.value = []
  sprintData.value = null
  selectedSprintId.value = null
  boardSynced.value = true
  boardLastUpdated.value = null
  sprintFilterOverride.value = null
  loadSprints()
})

watch(selectedSprintId, () => {
  loadSprintIssues()
})

// Auto-select the first board whenever the board list becomes available.
// `teamDetail` can arrive asynchronously after mount, so this must react to
// allocationBoards changing rather than only running once in onMounted —
// otherwise no board is ever selected and sprint data never loads.
watch(allocationBoards, (boards) => {
  if (!boards.length) return
  const stillValid = selectedBoardId.value != null && boards.some(b => b.boardId === selectedBoardId.value)
  if (!stillValid) selectedBoardId.value = boards[0].boardId
}, { immediate: true })

// --- Lifecycle ---
onMounted(() => {
  // Seed from team metadata immediately (avoids a flash of the wrong default)…
  const savedMode = props.team?.metadata?.allocationMode
  if (savedMode === 'points' || savedMode === 'counts') {
    teamAllocationMode.value = savedMode
    metricMode.value = savedMode
  }
  // …then fetch the authoritative setting + edit permission.
  loadSettings()
})
</script>
