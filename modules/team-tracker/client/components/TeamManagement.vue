<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useTeams } from '@shared/client/composables/useTeams'
import { useRoster } from '@shared/client/composables/useRoster'
import { Search, X } from 'lucide-vue-next'
import OrgSelector from './OrgSelector.vue'

const nav = inject('moduleNav')

const { teams, loading, demoToast, fetchTeams, createTeam, renameTeam, deleteTeam } = useTeams()
const { orgs, reloadRoster } = useRoster()

const filterOrg = ref(null)
const searchQuery = ref('')
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

const selectorOrgs = computed(() => {
  return orgs.value.map(o => ({ name: o.displayName || o.key }))
})

const showOrgBadge = computed(() => filterOrg.value === null)

const orgDisplayMap = computed(() => {
  const map = {}
  for (const o of orgKeys.value) map[o.key] = o.displayName
  return map
})

const filteredTeams = computed(() => {
  let list = filterOrg.value
    ? teams.value.filter(t => (orgDisplayMap.value[t.orgKey] || t.orgKey) === filterOrg.value)
    : teams.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (orgDisplayMap.value[t.orgKey] || t.orgKey).toLowerCase().includes(q)
    )
  }
  return [...list].sort((a, b) => a.name.localeCompare(b.name))
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
    reloadRoster()
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
    reloadRoster()
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
    reloadRoster()
  } catch (e) {
    error.value = e.message || 'Failed to delete team'
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Team Management</h3>
      <button
        class="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
        @click="openCreateModal"
      >
        Create Team
      </button>
    </div>

    <OrgSelector
      v-if="selectorOrgs.length > 1"
      :orgs="selectorOrgs"
      :model-value="filterOrg"
      @select="filterOrg = $event"
    />

    <div v-if="demoInfo" class="p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
      {{ demoInfo }}
    </div>
    <div v-if="error && !showCreateModal" class="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      {{ error }}
    </div>

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search teams..."
        class="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
      <button
        v-if="searchQuery"
        @click="searchQuery = ''"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Team list -->
    <div v-if="loading" class="text-sm text-gray-500">Loading teams...</div>
    <div v-else-if="searchQuery && filteredTeams.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      No teams match "{{ searchQuery }}"
    </div>
    <div v-else-if="filteredTeams.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
      No teams {{ filterOrg ? 'in this org' : 'created yet' }}
    </div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
            <th v-if="showOrgBadge" class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Org</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="team in filteredTeams" :key="team.id" :class="['hover:bg-gray-50 dark:hover:bg-gray-700/50', editingTeamId === team.id ? 'bg-blue-50 dark:bg-blue-900/20' : '']">
            <td class="px-4 py-3 text-sm whitespace-nowrap">
              <div v-if="editingTeamId === team.id" class="flex items-center gap-2">
                <input
                  v-model="editName"
                  class="block flex-1 rounded border-gray-300 dark:border-gray-600 shadow-sm text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  @keyup.enter="saveEdit(team.id)"
                  @keyup.escape="editingTeamId = null"
                >
                <button class="px-2.5 py-1 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors" @click="saveEdit(team.id)">Save</button>
                <button class="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" @click="editingTeamId = null">Cancel</button>
              </div>
              <a
                v-else
                class="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-800 hover:underline cursor-pointer"
                @click="nav.navigateTo('team-detail', { teamKey: `${team.orgKey}::${team.name}` })"
              >{{ team.name }}</a>
            </td>
            <td v-if="showOrgBadge" class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ orgDisplayMap[team.orgKey] || team.orgKey }}
            </td>
            <td class="px-4 py-3 text-sm text-right whitespace-nowrap">
              <div v-if="editingTeamId !== team.id" class="flex items-center justify-end gap-2">
                <button class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" @click="startEdit(team)">Rename</button>
                <button class="text-sm text-red-500 hover:text-red-700" @click="handleDelete(team.id)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

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
