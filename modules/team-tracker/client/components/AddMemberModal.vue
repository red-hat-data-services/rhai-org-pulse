<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Team Member</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-3">
        <div v-if="error" class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
          {{ error }}
        </div>

        <!-- Search input -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or UID..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <!-- Results list -->
        <ul class="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
          <li
            v-for="person in availablePeople"
            :key="person.uid"
            class="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <div>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ person.name }}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">{{ person.uid }}</span>
            </div>
            <button
              class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
              @click="handleAssign(person.uid)"
            >
              Add
            </button>
          </li>
          <li v-if="availablePeople.length === 0" class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            {{ searchQuery ? `No matching people for "${searchQuery}"` : 'All people are already assigned' }}
          </li>
        </ul>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
        <button
          @click="$emit('close')"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useTeams } from '@shared/client/composables/useTeams'

const props = defineProps({
  teamId: { type: String, required: true },
  memberUids: { type: Set, required: true },
  allPeople: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'updated'])

const { assignMember } = useTeams()

const searchQuery = ref('')
const searchInput = ref(null)
const error = ref(null)
const addedUids = ref(new Set())

onMounted(async () => {
  await nextTick()
  searchInput.value?.focus()
})

const availablePeople = computed(() => {
  return props.allPeople
    .filter(p => !props.memberUids.has(p.uid) && !addedUids.value.has(p.uid))
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
    addedUids.value = new Set([...addedUids.value, uid])
    emit('updated')
  } catch (e) {
    error.value = e.message || 'Failed to assign member'
  }
}
</script>
