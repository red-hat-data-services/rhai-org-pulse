<script setup>
import { ref, onMounted, watch } from 'vue'
import { useTeams } from '@shared/client/composables/useTeams'
import { usePermissions } from '@shared/client/composables/usePermissions'

const { teams, demoToast, fetchTeams, assignMembersBulk, fetchUnassigned } = useTeams()
const { isAdmin, isManager, canEdit } = usePermissions()

const people = ref([])
const scope = ref('all')
const loading = ref(false)
const selectedUids = ref(new Set())
const targetTeamId = ref('')
const error = ref(null)
const demoInfo = ref(null)

watch(demoToast, (msg) => {
  if (msg) { demoInfo.value = msg; setTimeout(() => { demoInfo.value = null }, 3000) }
})

async function loadPeople() {
  loading.value = true
  try {
    people.value = await fetchUnassigned(scope.value)
  } catch {
    people.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadPeople()
  fetchTeams()
})

function toggleSelect(uid) {
  if (selectedUids.value.has(uid)) {
    selectedUids.value.delete(uid)
  } else {
    selectedUids.value.add(uid)
  }
  // Force reactivity
  selectedUids.value = new Set(selectedUids.value)
}

async function bulkAssign() {
  if (!targetTeamId.value || selectedUids.value.size === 0) return
  error.value = null
  try {
    await assignMembersBulk(targetTeamId.value, [...selectedUids.value])
    selectedUids.value = new Set()
    await loadPeople()
  } catch (e) {
    error.value = e.message || 'Failed to assign'
  }
}

function changeScope(newScope) {
  scope.value = newScope
  loadPeople()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium text-gray-900">Unassigned People</h3>
      <div class="flex items-center gap-2">
        <button
          v-if="isManager"
          class="text-sm px-2 py-1 rounded"
          :class="scope === 'direct' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'"
          @click="changeScope('direct')"
        >Direct</button>
        <button
          v-if="isManager"
          class="text-sm px-2 py-1 rounded"
          :class="scope === 'org' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'"
          @click="changeScope('org')"
        >Org</button>
        <button
          v-if="isAdmin"
          class="text-sm px-2 py-1 rounded"
          :class="scope === 'all' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'"
          @click="changeScope('all')"
        >All</button>
      </div>
    </div>

    <div v-if="demoInfo" class="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
      {{ demoInfo }}
    </div>

    <div v-if="error" class="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      {{ error }}
    </div>

    <!-- Bulk assign controls -->
    <div v-if="selectedUids.size > 0" class="flex items-center gap-3 p-3 bg-primary-50 rounded">
      <span class="text-sm text-primary-700">{{ selectedUids.size }} selected</span>
      <select
        v-model="targetTeamId"
        class="rounded border-gray-300 text-sm"
      >
        <option value="">Select team...</option>
        <option v-for="team in teams" :key="team.id" :value="team.id">
          {{ team.name }}
        </option>
      </select>
      <button
        class="px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50"
        :disabled="!targetTeamId"
        @click="bulkAssign"
      >
        Assign
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading...</div>
    <ul v-else class="divide-y divide-gray-200 border rounded">
      <li
        v-for="person in people"
        :key="person.uid"
        class="flex items-center gap-3 p-3 hover:bg-gray-50"
      >
        <input
          v-if="canEdit(person.uid)"
          type="checkbox"
          :checked="selectedUids.has(person.uid)"
          class="rounded border-gray-300 text-primary-600"
          @change="toggleSelect(person.uid)"
        >
        <div class="flex-1">
          <span class="text-sm font-medium text-gray-900">{{ person.name }}</span>
          <span class="text-xs text-gray-500 ml-2">{{ person.title }}</span>
        </div>
        <span class="text-xs text-gray-400">{{ person.uid }}</span>
      </li>
      <li v-if="people.length === 0" class="p-3 text-sm text-gray-500 text-center">
        No unassigned people
      </li>
    </ul>
  </div>
</template>
