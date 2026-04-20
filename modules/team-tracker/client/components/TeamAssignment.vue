<script setup>
import { ref, computed, watch } from 'vue'
import { useTeams } from '@shared/client/composables/useTeams'
import { usePermissions } from '@shared/client/composables/usePermissions'

const props = defineProps({
  teamId: { type: String, required: true },
  teamName: { type: String, required: true },
  members: { type: Array, default: () => [] },
  allPeople: { type: Array, default: () => [] }
})

const emit = defineEmits(['updated'])

const { demoToast, assignMember, unassignMember } = useTeams()
const { canEdit } = usePermissions()

const searchQuery = ref('')
const error = ref(null)
const demoInfo = ref(null)

watch(demoToast, (msg) => {
  if (msg) { demoInfo.value = msg; setTimeout(() => { demoInfo.value = null }, 3000) }
})

const memberUids = computed(() => new Set(props.members.map(m => m.uid)))

const availablePeople = computed(() => {
  return props.allPeople
    .filter(p => !memberUids.value.has(p.uid))
    .filter(p => {
      if (!searchQuery.value) return true
      const q = searchQuery.value.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.uid.toLowerCase().includes(q)
    })
    .slice(0, 20)
})

async function handleAssign(uid) {
  error.value = null
  try {
    await assignMember(props.teamId, uid)
    emit('updated')
  } catch (e) {
    error.value = e.message || 'Failed to assign'
  }
}

async function handleUnassign(uid) {
  error.value = null
  try {
    await unassignMember(props.teamId, uid)
    emit('updated')
  } catch (e) {
    error.value = e.message || 'Failed to unassign'
  }
}
</script>

<template>
  <div class="space-y-4">
    <h4 class="text-sm font-medium text-gray-700">Team: {{ teamName }}</h4>

    <div v-if="demoInfo" class="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
      {{ demoInfo }}
    </div>
    <div v-if="error" class="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
      {{ error }}
    </div>

    <!-- Current members -->
    <div>
      <h5 class="text-xs font-medium text-gray-500 uppercase mb-2">Members ({{ members.length }})</h5>
      <ul class="divide-y divide-gray-100">
        <li v-for="member in members" :key="member.uid" class="flex items-center justify-between py-2">
          <span class="text-sm text-gray-900">{{ member.name }}</span>
          <button
            v-if="canEdit(member.uid)"
            class="text-xs text-red-500 hover:text-red-700"
            @click="handleUnassign(member.uid)"
          >
            Remove
          </button>
        </li>
      </ul>
    </div>

    <!-- Add member -->
    <div>
      <h5 class="text-xs font-medium text-gray-500 uppercase mb-2">Add member</h5>
      <input
        v-model="searchQuery"
        type="text"
        class="block w-full rounded border-gray-300 shadow-sm text-sm mb-2"
        placeholder="Search by name or UID..."
      >
      <ul class="max-h-48 overflow-y-auto divide-y divide-gray-100 border rounded">
        <li
          v-for="person in availablePeople"
          :key="person.uid"
          class="flex items-center justify-between p-2 hover:bg-gray-50"
        >
          <div>
            <span class="text-sm text-gray-900">{{ person.name }}</span>
            <span class="text-xs text-gray-500 ml-1">{{ person.uid }}</span>
          </div>
          <button
            v-if="canEdit(person.uid)"
            class="text-xs text-primary-600 hover:text-primary-800"
            @click="handleAssign(person.uid)"
          >
            Add
          </button>
        </li>
        <li v-if="availablePeople.length === 0" class="p-2 text-sm text-gray-500 text-center">
          {{ searchQuery ? 'No matching people' : 'All people assigned' }}
        </li>
      </ul>
    </div>
  </div>
</template>
