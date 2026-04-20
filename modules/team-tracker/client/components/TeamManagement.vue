<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTeams } from '@shared/client/composables/useTeams'
import { useRoster } from '@shared/client/composables/useRoster'

const { teams, loading, demoToast, fetchTeams, createTeam, renameTeam, deleteTeam } = useTeams()
const { orgs } = useRoster()

const showCreateModal = ref(false)
const newTeamName = ref('')
const newTeamOrg = ref('')
const editingTeamId = ref(null)
const editName = ref('')
const error = ref(null)
const demoInfo = ref(null)

watch(demoToast, (msg) => {
  if (msg) { demoInfo.value = msg; setTimeout(() => { demoInfo.value = null }, 3000) }
})

onMounted(() => fetchTeams())

const orgKeys = computed(() => {
  return orgs.value.map(o => ({ key: o.key, displayName: o.displayName }))
})

watch(orgKeys, (keys) => {
  if (keys.length > 0 && !newTeamOrg.value) {
    newTeamOrg.value = keys[0].key
  }
}, { immediate: true })

function openCreateModal() {
  newTeamName.value = ''
  if (orgKeys.value.length > 0) newTeamOrg.value = orgKeys.value[0].key
  error.value = null
  showCreateModal.value = true
}

async function handleCreate() {
  if (!newTeamName.value.trim()) return
  error.value = null
  try {
    await createTeam(newTeamName.value.trim(), newTeamOrg.value)
    showCreateModal.value = false
    newTeamName.value = ''
  } catch (e) {
    error.value = e.message || 'Failed to create team'
  }
}

function startEdit(team) {
  editingTeamId.value = team.id
  editName.value = team.name
}

async function saveEdit(teamId) {
  if (!editName.value.trim()) return
  error.value = null
  try {
    await renameTeam(teamId, editName.value.trim())
    editingTeamId.value = null
  } catch (e) {
    error.value = e.message || 'Failed to rename team'
  }
}

async function handleDelete(teamId) {
  if (!confirm('Delete this team? Members will become unassigned.')) return
  error.value = null
  try {
    await deleteTeam(teamId)
  } catch (e) {
    error.value = e.message || 'Failed to delete team'
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900">Team Management</h3>
      <button
        class="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
        @click="openCreateModal"
      >
        Create Team
      </button>
    </div>

    <div v-if="demoInfo" class="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
      {{ demoInfo }}
    </div>
    <div v-if="error && !showCreateModal" class="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      {{ error }}
    </div>

    <!-- Team list -->
    <div v-if="loading" class="text-sm text-gray-500">Loading teams...</div>
    <ul v-else class="divide-y divide-gray-200 border rounded">
      <li v-for="team in teams" :key="team.id" class="flex items-center justify-between p-3">
        <div v-if="editingTeamId === team.id" class="flex items-center gap-2 flex-1">
          <input
            v-model="editName"
            class="block flex-1 rounded border-gray-300 shadow-sm text-sm"
            @keyup.enter="saveEdit(team.id)"
            @keyup.escape="editingTeamId = null"
          >
          <button class="text-sm text-primary-600 hover:text-primary-800" @click="saveEdit(team.id)">Save</button>
          <button class="text-sm text-gray-500 hover:text-gray-700" @click="editingTeamId = null">Cancel</button>
        </div>
        <div v-else class="flex items-center gap-2 flex-1">
          <span class="font-medium text-gray-900">{{ team.name }}</span>
          <span class="text-xs text-gray-500">{{ team.orgKey }}</span>
        </div>
        <div v-if="editingTeamId !== team.id" class="flex items-center gap-2">
          <button class="text-sm text-gray-500 hover:text-gray-700" @click="startEdit(team)">Rename</button>
          <button class="text-sm text-red-500 hover:text-red-700" @click="handleDelete(team.id)">Delete</button>
        </div>
      </li>
      <li v-if="teams.length === 0" class="p-3 text-sm text-gray-500 text-center">
        No teams created yet
      </li>
    </ul>

    <!-- Create Team Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreateModal = false">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create Team</h3>
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {{ error }}
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team name</label>
            <input
              v-model="newTeamName"
              type="text"
              class="block w-full rounded border-gray-300 shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Platform"
              @keyup.enter="handleCreate"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Org</label>
            <select
              v-model="newTeamOrg"
              class="block w-full rounded border-gray-300 shadow-sm text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option v-for="org in orgKeys" :key="org.key" :value="org.key">
                {{ org.displayName }}
              </option>
            </select>
          </div>
        </div>
        <div class="mt-6 flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            @click="showCreateModal = false"
          >Cancel</button>
          <button
            class="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50"
            :disabled="!newTeamName.trim() || !newTeamOrg"
            @click="handleCreate"
          >Create</button>
        </div>
      </div>
    </div>
  </div>
</template>
