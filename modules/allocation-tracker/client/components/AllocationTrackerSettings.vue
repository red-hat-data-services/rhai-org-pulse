<template>
  <div class="space-y-6">
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">Allocation Tracker Settings</h2>
      </div>

      <!-- Tab bar -->
      <div class="flex border-b border-gray-200 mb-6">
        <button
          data-testid="settings-tab"
          @click="activeTab = 'projects'"
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'projects'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          Projects
        </button>
        <button
          data-testid="settings-tab"
          @click="activeTab = 'boards'"
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'boards'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          Boards
        </button>
        <button
          data-testid="settings-tab"
          @click="activeTab = 'classification'"
          :class="[
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'classification'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          ]"
        >
          Classification
        </button>
      </div>

      <!-- Projects tab -->
      <div v-if="activeTab === 'projects'" data-testid="projects-tab-content">
        <p class="text-sm text-gray-500 mb-4">
          Projects map to Jira project keys. Each project's scrum boards are discovered automatically.
          The pillar is used to group projects on the org dashboard.
        </p>

        <div v-if="localProjects.length > 0" class="flex items-center gap-3 px-3 pb-2 border-b border-gray-200">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide w-28">Key</span>
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Name</span>
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Pillar</span>
          <span class="w-24"></span>
        </div>

        <div class="divide-y divide-gray-200">
          <div
            v-for="(project, index) in localProjects"
            :key="project.key"
            class="flex items-center justify-between py-3 px-3"
          >
            <div v-if="editingIndex === index" data-testid="edit-project-form" class="flex items-center gap-3 flex-1">
              <span class="text-sm font-mono text-gray-500 w-28">{{ project.key }}</span>
              <label class="flex-1">
                <span class="sr-only">Name</span>
                <input v-model="editName" placeholder="Project name" class="text-sm border border-gray-300 rounded-md px-2 py-1 w-full" />
              </label>
              <label class="flex-1">
                <span class="sr-only">Pillar</span>
                <input v-model="editPillar" placeholder="Pillar / group" class="text-sm border border-gray-300 rounded-md px-2 py-1 w-full" />
              </label>
              <button data-testid="confirm-edit-project" @click="confirmEdit(index)" class="text-sm text-primary-600 hover:text-primary-800 font-medium">OK</button>
              <button @click="cancelEdit" class="text-sm text-gray-500 hover:text-gray-700 font-medium">Cancel</button>
            </div>

            <div v-else class="flex items-center gap-3 flex-1">
              <span class="text-sm font-mono text-gray-500 w-28">{{ project.key }}</span>
              <span class="font-medium text-gray-900 flex-1">{{ project.name }}</span>
              <span class="text-sm text-gray-500 flex-1">{{ project.pillar }}</span>
            </div>

            <div v-if="editingIndex !== index" class="flex items-center gap-2 w-24 justify-end">
              <button data-testid="edit-project-btn" @click="startEdit(index)" class="text-sm text-primary-600 hover:text-primary-800 font-medium">Edit</button>
              <button data-testid="delete-project-btn" @click="deleteProject(index)" class="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
            </div>
          </div>
        </div>

        <div v-if="showAddForm" data-testid="new-project-form" class="border-t border-gray-200 pt-3 px-3">
          <div class="flex items-end gap-3">
            <label class="w-28">
              <span class="block text-xs font-medium text-gray-600 mb-1">Jira Project Key</span>
              <input v-model="newKey" placeholder="e.g. RHOAIENG" class="text-sm border border-gray-300 rounded-md px-2 py-1 w-full font-mono" />
            </label>
            <label class="flex-1">
              <span class="block text-xs font-medium text-gray-600 mb-1">Display Name</span>
              <input v-model="newName" placeholder="e.g. OpenShift AI Engineering" class="text-sm border border-gray-300 rounded-md px-2 py-1 w-full" />
            </label>
            <label class="flex-1">
              <span class="block text-xs font-medium text-gray-600 mb-1">Pillar</span>
              <input v-model="newPillar" placeholder="e.g. OpenShift AI" class="text-sm border border-gray-300 rounded-md px-2 py-1 w-full" />
            </label>
            <button data-testid="confirm-add-project" @click="confirmAdd" class="text-sm text-primary-600 hover:text-primary-800 font-medium py-1">Add</button>
            <button @click="showAddForm = false; newKey = ''; newName = ''; newPillar = ''" class="text-sm text-gray-500 hover:text-gray-700 font-medium py-1">Cancel</button>
          </div>
        </div>

        <div class="flex items-center gap-3 mt-4">
          <button data-testid="add-project-btn" @click="showAddForm = true" class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors">Add Project</button>
          <button @click="handleSaveProjects" :disabled="isSaving" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>

      <!-- Boards tab -->
      <div v-if="activeTab === 'boards'" data-testid="boards-tab-content">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <select
              v-if="localProjects.length > 1"
              v-model="selectedProjectKey"
              class="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option v-for="project in localProjects" :key="project.key" :value="project.key">
                {{ project.name }}
              </option>
            </select>
            <button @click="handleDiscover" :disabled="isDiscovering" class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {{ isDiscovering ? 'Discovering...' : 'Discover Boards' }}
            </button>
            <button @click="handleSave" :disabled="isSaving" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
            <span v-if="saveValidationError" class="text-xs text-red-600">
              All sub-team entries require a name.
            </span>
          </div>
        </div>

        <div v-if="teams.length === 0" class="text-center py-12 text-gray-500">
          <p class="text-lg">No boards found.</p>
          <p>Click "Discover Boards" to fetch the board list from Jira.</p>
        </div>

        <div v-else class="divide-y divide-gray-200">
          <div
            v-for="group in groupedBoards"
            :key="group.boardId"
            data-testid="board-group"
            :class="[
              'py-3 px-3 rounded-md hover:bg-primary-50 even:bg-gray-50 transition-colors',
              group.stale ? 'opacity-60' : ''
            ]"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-gray-900">{{ group.displayName || group.boardName }}</span>
                  <span class="ml-2 text-sm text-gray-500">ID: {{ group.boardId }}</span>
                  <span v-if="group.boardType === 'kanban'" data-testid="kanban-badge" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Kanban</span>
                  <span v-if="group.stale" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Inactive</span>
                </div>
                <p v-if="group.stale" class="text-xs text-gray-400 mt-0.5">
                  {{ group.lastSprintEndDate ? `Last sprint ended ${formatRelativeDate(group.lastSprintEndDate)}` : 'No sprints found' }}
                </p>
              </div>
              <div class="flex items-center gap-4">
                <template v-if="!group.hasSubTeams">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Calculate by:</span>
                    <select :value="group.entries[0].calculationMode" @change="updateCalculationMode(group.entries[0]._index, $event.target.value)" class="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-300" data-testid="calculation-mode-select">
                      <option value="points">Story Points</option>
                      <option value="counts">Issue Counts</option>
                    </select>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" :checked="group.entries[0].enabled" @change="toggleTeam(group.entries[0]._index)" class="sr-only peer" />
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </template>
                <button data-testid="add-sub-team-btn" @click="addSubTeam(group.boardId, group.boardName)" class="text-xs text-primary-600 hover:text-primary-800 font-medium whitespace-nowrap">+ Sub-Team</button>
              </div>
            </div>

            <div v-if="group.hasSubTeams" class="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
              <div v-for="entry in group.entries" :key="entry._index" data-testid="sub-team-row" class="flex items-center justify-between py-1.5">
                <div class="flex items-center gap-3 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Name:</span>
                    <input :value="entry.displayName" @input="teams[entry._index].displayName = $event.target.value" placeholder="Sub-team name" data-testid="sub-team-name-input" :class="['text-xs border rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-primary-300', !entry.displayName?.trim() && saveValidationFailed ? 'border-red-400' : 'border-gray-300']" />
                  </div>
                  <div v-if="group.boardType !== 'kanban'" class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Filter:</span>
                    <input :value="entry.sprintFilter" @input="teams[entry._index].sprintFilter = $event.target.value" placeholder="Sprint name filter" data-testid="sprint-filter-input" class="text-xs border border-gray-300 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-primary-300" />
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500">Calculate by:</span>
                    <select :value="entry.calculationMode" @change="updateCalculationMode(entry._index, $event.target.value)" class="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-300" data-testid="calculation-mode-select">
                      <option value="points">Story Points</option>
                      <option value="counts">Issue Counts</option>
                    </select>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <button data-testid="remove-sub-team-btn" @click="deleteSubTeam(entry._index)" class="text-xs text-red-600 hover:text-red-800 font-medium">Remove</button>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" :checked="entry.enabled" @change="toggleTeam(entry._index)" class="sr-only peer" />
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Classification tab -->
      <div v-if="activeTab === 'classification'" data-testid="classification-tab-content">
        <p class="text-sm text-gray-500 mb-6">
          Auto-classify Jira issues into 40/40/20 allocation buckets (Tech Debt & Quality, New Features, Learning & Enablement) by setting the Activity Type field.
        </p>

        <!-- Test Classification Card -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">Test Classification</h3>
          <p class="text-xs text-gray-500 mb-3">
            Classify a single issue to test the classification logic. Dry run mode won't write to Jira.
          </p>

          <div class="flex items-end gap-3">
            <label class="flex-1">
              <span class="block text-xs font-medium text-gray-600 mb-1">Jira Issue Key</span>
              <input
                v-model="testIssueKey"
                placeholder="e.g., AIPCC-15430"
                class="text-sm border border-gray-300 rounded-md px-3 py-2 w-full font-mono focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </label>
            <button
              @click="handleTestClassify(true)"
              :disabled="!testIssueKey?.trim() || isClassifying"
              class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isClassifying ? 'Testing...' : 'Test (Dry Run)' }}
            </button>
            <button
              @click="handleTestClassify(false)"
              :disabled="!testIssueKey?.trim() || isClassifying"
              class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ isClassifying ? 'Classifying...' : 'Classify & Write' }}
            </button>
          </div>

          <!-- Test Result -->
          <div v-if="testResult" class="mt-4 p-3 rounded-md border" :class="testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'">
            <div v-if="testResult.success" class="text-sm">
              <p class="font-medium text-green-900">
                {{ testResult.skipped ? '⚠️ Skipped' : testResult.written ? '✅ Classified & Written' : '✅ Classification Result' }}
              </p>
              <div class="mt-2 space-y-1 text-xs text-green-800">
                <div v-if="testResult.reason"><span class="font-semibold">Reason:</span> {{ testResult.reason }}</div>
                <div v-if="testResult.classification">
                  <span class="font-semibold">Category:</span> {{ testResult.classification.category || 'None' }}
                  <span class="ml-3 font-semibold">Confidence:</span> {{ (testResult.classification.confidence * 100).toFixed(0) }}%
                  <span class="ml-3 font-semibold">Method:</span> {{ testResult.classification.method }}
                </div>
                <div v-if="testResult.classification?.reason" class="italic">{{ testResult.classification.reason }}</div>
              </div>
            </div>
            <div v-else class="text-sm">
              <p class="font-medium text-red-900">❌ Error</p>
              <p class="mt-1 text-xs text-red-800">{{ testResult.message }}</p>
            </div>
          </div>
        </div>

        <!-- Configuration Notice -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p class="text-sm text-blue-900">
            <span class="font-semibold">Current Configuration:</span>
            Projects: AIPCC | Confidence Threshold: 0.85 | Issue Types: Story, Bug, Spike, Task, Epic
          </p>
          <p class="text-xs text-blue-700 mt-1">
            Classification is rule-based using keyword matching. Jira automation webhook (not yet deployed) will trigger real-time classification on issue creation/update.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getTeams, saveTeams, saveProjects, discoverBoards, getProjects, classifyIssue } from '../services/api.js'

const emit = defineEmits(['saved'])

// Load projects from API on mount (settings panel is standalone)
const loadedOrgName = ref('')
const localProjects = ref([])
const originalProjectKeys = ref(new Set())

const activeTab = ref('projects')
const showAddForm = ref(false)
const newKey = ref('')
const newName = ref('')
const newPillar = ref('')
const editingIndex = ref(-1)
const editName = ref('')
const editPillar = ref('')

const teams = ref([])
const isSaving = ref(false)
const isDiscovering = ref(false)
const selectedProjectKey = ref('')
const saveValidationFailed = ref(false)
const saveValidationError = ref('')

onMounted(async () => {
  try {
    const orgConfig = await getProjects()
    loadedOrgName.value = orgConfig.orgName || ''
    localProjects.value = (orgConfig.projects || []).map(p => ({ ...p }))
    originalProjectKeys.value = new Set(localProjects.value.map(p => p.key))
    selectedProjectKey.value = localProjects.value.length > 0 ? localProjects.value[0].key : 'RHOAIENG'
    loadTeams()
  } catch (error) {
    console.error('Failed to load projects:', error)
  }
})

watch(selectedProjectKey, () => {
  loadTeams()
})

function generateTeamId(boardId, sprintFilter) {
  if (!sprintFilter?.trim()) return String(boardId)
  const normalized = sprintFilter.trim().toLowerCase().replace(/\s+/g, '-')
  return `${boardId}_${normalized}`
}

const groupedBoards = computed(() => {
  const groups = new Map()
  teams.value.forEach((t, i) => {
    const entry = { ...t, _index: i }
    if (!groups.has(t.boardId)) {
      groups.set(t.boardId, {
        boardId: t.boardId,
        boardName: t.boardName,
        displayName: t.displayName || t.boardName,
        stale: t.stale,
        lastSprintEndDate: t.lastSprintEndDate,
        boardType: t.boardType || 'scrum',
        entries: []
      })
    }
    groups.get(t.boardId).entries.push(entry)
  })

  const result = [...groups.values()].map(g => ({
    ...g,
    hasSubTeams: g.entries.length > 1 || g.entries.some(e => e.sprintFilter?.trim())
  }))

  result.sort((a, b) => {
    if (a.stale && !b.stale) return 1
    if (!a.stale && b.stale) return -1
    return 0
  })

  return result
})

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
  const diffYears = Math.floor(diffMonths / 12)
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`
}

function startEdit(index) {
  editingIndex.value = index
  editName.value = localProjects.value[index].name
  editPillar.value = localProjects.value[index].pillar
}

function confirmEdit(index) {
  if (!editName.value.trim() || !editPillar.value.trim()) return
  localProjects.value[index].name = editName.value.trim()
  localProjects.value[index].pillar = editPillar.value.trim()
  editingIndex.value = -1
}

function cancelEdit() {
  editingIndex.value = -1
}

function confirmAdd() {
  if (!newKey.value.trim() || !newName.value.trim() || !newPillar.value.trim()) return
  localProjects.value.push({ key: newKey.value.trim(), name: newName.value.trim(), pillar: newPillar.value.trim() })
  showAddForm.value = false
  newKey.value = ''
  newName.value = ''
  newPillar.value = ''
}

function deleteProject(index) {
  if (!window.confirm(`Delete project "${localProjects.value[index].name}"?`)) return
  localProjects.value.splice(index, 1)
}

async function handleSaveProjects() {
  isSaving.value = true
  try {
    await saveProjects({ orgName: loadedOrgName.value, projects: localProjects.value })
    const newProjects = localProjects.value.filter(p => !originalProjectKeys.value.has(p.key))
    for (const project of newProjects) {
      await discoverBoards(project.key)
    }
    originalProjectKeys.value = new Set(localProjects.value.map(p => p.key))
    emit('saved')
  } catch (error) {
    console.error('Failed to save projects:', error)
    window.alert('Failed to save projects. Please try again.')
  } finally {
    isSaving.value = false
  }
}

async function loadTeams() {
  try {
    const data = await getTeams(selectedProjectKey.value)
    teams.value = (data.teams || []).map(t => ({
      ...t,
      calculationMode: t.calculationMode || 'points',
      sprintFilter: t.sprintFilter || ''
    }))
  } catch (error) {
    console.error('Failed to load teams:', error)
    teams.value = []
  }
}

function toggleTeam(index) {
  if (teams.value[index]) teams.value[index].enabled = !teams.value[index].enabled
}

function updateCalculationMode(index, mode) {
  if (teams.value[index]) teams.value[index].calculationMode = mode
}

function addSubTeam(boardId, boardName) {
  let lastIndex = -1
  teams.value.forEach((t, i) => { if (t.boardId === boardId) lastIndex = i })
  const newEntry = { boardId, boardName, displayName: boardName?.replace(/^RHOAIENG\s*[-–]\s*/, '') || '', enabled: true, sprintFilter: '', calculationMode: 'points' }
  if (lastIndex >= 0) teams.value.splice(lastIndex + 1, 0, newEntry)
  else teams.value.push(newEntry)
}

function deleteSubTeam(index) {
  teams.value.splice(index, 1)
}

async function handleSave() {
  saveValidationFailed.value = false
  saveValidationError.value = ''

  const byBoard = new Map()
  for (const t of teams.value) {
    const list = byBoard.get(t.boardId) || []
    list.push(t)
    byBoard.set(t.boardId, list)
  }
  for (const entries of byBoard.values()) {
    const isSubTeam = entries.length > 1 || entries.some(e => e.sprintFilter?.trim())
    if (isSubTeam && entries.some(e => !e.displayName?.trim())) {
      saveValidationFailed.value = true
      saveValidationError.value = 'All sub-team entries require a name.'
      return
    }
  }

  isSaving.value = true
  try {
    const teamsWithIds = teams.value.map(t => ({ ...t, teamId: generateTeamId(t.boardId, t.sprintFilter) }))
    await saveTeams(teamsWithIds, selectedProjectKey.value)
    emit('saved')
  } catch (error) {
    console.error('Failed to save teams:', error)
  } finally {
    isSaving.value = false
  }
}

async function handleDiscover() {
  isDiscovering.value = true
  try {
    await discoverBoards(selectedProjectKey.value)
    await loadTeams()
  } catch (error) {
    console.error('Failed to discover boards:', error)
  } finally {
    isDiscovering.value = false
  }
}

// Classification tab state
const testIssueKey = ref('')
const isClassifying = ref(false)
const testResult = ref(null)

async function handleTestClassify(dryRun) {
  if (!testIssueKey.value?.trim()) return

  isClassifying.value = true
  testResult.value = null

  try {
    const result = await classifyIssue(testIssueKey.value.trim(), dryRun)
    testResult.value = { success: true, ...result }
  } catch (error) {
    console.error('Classification error:', error)
    testResult.value = {
      success: false,
      message: error.message || 'Failed to classify issue'
    }
  } finally {
    isClassifying.value = false
  }
}
</script>
