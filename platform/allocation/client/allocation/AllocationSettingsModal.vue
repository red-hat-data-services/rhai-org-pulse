<template>
  <div
    class="fixed inset-0 bg-gray-900/10 dark:bg-black/20 flex items-center justify-center z-50"
    data-testid="allocation-settings-modal"
    @click.self="close"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl ring-1 ring-black/10 dark:ring-white/10 w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Allocation settings</h2>
        <button
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          :disabled="saving"
          aria-label="Close"
          @click="close"
        >
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-5 overflow-y-auto">
        <!-- Calculation basis -->
        <div>
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Calculate allocation by</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Sets how this team's work is weighted across categories — everywhere allocation is
            summarized, including the org report.
          </p>

          <p
            v-if="isFirstTime"
            data-testid="allocation-settings-firsttime"
            class="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 mb-3"
          >
            This team hasn't been configured yet. Pick a basis so it's counted correctly in org reports.
          </p>

          <div class="space-y-2">
            <label class="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md border"
              :class="selectedMode === 'points' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'">
              <input type="radio" value="points" v-model="selectedMode" class="mt-0.5 text-primary-600 focus:ring-primary-500" />
              <span>
                <span class="font-medium text-gray-900 dark:text-gray-100">Story Points</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">Weight by estimate — a 5-point issue counts more than a 1-point one. Unestimated issues are excluded.</span>
              </span>
            </label>
            <label class="flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md border"
              :class="selectedMode === 'counts' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'">
              <input type="radio" value="counts" v-model="selectedMode" class="mt-0.5 text-primary-600 focus:ring-primary-500" />
              <span>
                <span class="font-medium text-gray-900 dark:text-gray-100">Issue Count</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400">Weight every issue equally, regardless of estimate.</span>
              </span>
            </label>
          </div>
        </div>

        <!-- Sprint filter (per selected board) -->
        <div v-if="board && board.boardId" class="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sprint filter<span v-if="board.name" class="font-normal text-gray-500 dark:text-gray-400"> — {{ board.name }}</span>
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Some Jira boards surface other teams' sprints. Enter text that this team's sprint names
            contain to include only those. Leave blank to include all sprints.
          </p>

          <template v-if="isKanban">
            <p class="text-sm text-gray-500 dark:text-gray-400 italic">
              This is a Kanban board — it has no sprints, so filtering doesn't apply.
            </p>
          </template>

          <template v-else>
            <input
              v-model="sprintFilter"
              type="text"
              maxlength="200"
              placeholder="e.g. AI Hub"
              aria-label="Sprint name filter"
              data-testid="sprint-filter-input"
              class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />

            <!-- Preview -->
            <div class="mt-3">
              <div v-if="loadingSprints" class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Loading sprints from Jira…
              </div>

              <p v-else-if="sprintsError" class="text-sm text-red-600 dark:text-red-400">{{ sprintsError }}</p>

              <p v-else-if="allSprints.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                No sprints found on this board.
              </p>

              <template v-else>
                <p class="text-xs text-gray-600 dark:text-gray-400 mb-1" data-testid="sprint-preview-count">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ includedCount }}</span>
                  of {{ allSprints.length }} sprints included
                </p>
                <ul class="max-h-44 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700" data-testid="sprint-preview-list">
                  <li
                    v-for="s in allSprints"
                    :key="s.id"
                    class="flex items-center gap-2 px-3 py-1.5 text-sm"
                    :class="isIncluded(s) ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'"
                  >
                    <svg v-if="isIncluded(s)" class="h-3.5 w-3.5 flex-shrink-0 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <svg v-else class="h-3.5 w-3.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span class="truncate" :class="{ 'line-through': !isIncluded(s) }">{{ s.name }}</span>
                    <span class="ml-auto flex-shrink-0 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ s.state }}</span>
                  </li>
                </ul>
              </template>
            </div>
          </template>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
          Saving re-runs this team's allocation so the change takes effect right away.
        </p>

        <p v-if="error" class="text-sm text-red-600 dark:text-red-400" data-testid="allocation-settings-error">{{ error }}</p>
        <p v-else-if="saving && progressMessage" class="text-sm text-gray-500 dark:text-gray-400" data-testid="allocation-settings-progress">{{ progressMessage }}</p>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          :disabled="saving"
          @click="close"
        >
          Cancel
        </button>
        <button
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="saving || !hasChanges"
          data-testid="allocation-settings-save"
          @click="save"
        >
          <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  updateTeamAllocationSettings,
  updateTeamBoards,
  getBoardAllSprints,
  sprintMatchesFilter
} from '../services/allocation-api'
import { useAllocationRefresh } from '../composables/useAllocationRefresh'

const props = defineProps({
  teamId: { type: String, required: true },
  // null/absent means the team has never been configured — the modal then
  // requires an explicit choice before Save enables.
  currentMode: { type: String, default: null },
  // The board whose sprint filter is being configured (selected board).
  board: { type: Object, default: null },
  // Full boards array — needed to reconstruct the payload for the boards PATCH.
  boards: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'saved'])

// --- Basis ---
const isFirstTime = computed(() => props.currentMode !== 'points' && props.currentMode !== 'counts')
const selectedMode = ref(isFirstTime.value ? null : props.currentMode)
const basisChanged = computed(() =>
  (selectedMode.value === 'points' || selectedMode.value === 'counts') && selectedMode.value !== props.currentMode
)

// --- Sprint filter ---
const originalFilter = computed(() => (props.board?.sprintFilter || '').trim())
const sprintFilter = ref(originalFilter.value)
const filterChanged = computed(() => sprintFilter.value.trim() !== originalFilter.value)
const allSprints = ref([])
const loadingSprints = ref(false)
const sprintsError = ref('')
const isKanban = ref(false)

const includedCount = computed(() => allSprints.value.filter(isIncluded).length)

function isIncluded(sprint) {
  return sprintMatchesFilter(sprint.name, sprintFilter.value)
}

async function loadSprints() {
  if (!props.board?.boardId) return
  loadingSprints.value = true
  sprintsError.value = ''
  try {
    const data = await getBoardAllSprints(props.board.boardId)
    isKanban.value = data.boardType === 'kanban'
    allSprints.value = data.sprints || []
  } catch {
    sprintsError.value = 'Could not load sprints from Jira. You can still save a filter.'
  } finally {
    loadingSprints.value = false
  }
}

// --- Save ---
const saving = ref(false)
const error = ref('')
const hasChanges = computed(() => basisChanged.value || filterChanged.value)

const { message: progressMessage, triggerRefresh } = useAllocationRefresh()

function close() {
  if (saving.value) return
  emit('close')
}

async function save() {
  if (!hasChanges.value) return
  saving.value = true
  error.value = ''
  try {
    if (basisChanged.value) {
      await updateTeamAllocationSettings(props.teamId, selectedMode.value)
    }
    if (filterChanged.value) {
      const trimmed = sprintFilter.value.trim()
      const updatedBoards = props.boards.map(b =>
        b.boardId === props.board.boardId ? { ...b, sprintFilter: trimmed } : b
      )
      await updateTeamBoards(props.teamId, updatedBoards)
    }
    // Re-run this team's allocation so summaries + filtered sprints update.
    await triggerRefresh({ teamId: props.teamId })
    emit('saved', {
      allocationMode: basisChanged.value ? selectedMode.value : props.currentMode,
      sprintFilter: sprintFilter.value.trim()
    })
  } catch (e) {
    error.value = e?.status === 403
      ? "You don't have permission to change this team's settings."
      : 'Could not save settings. Please try again.'
  } finally {
    saving.value = false
  }
}

onMounted(loadSprints)
</script>
