<template>
  <div class="max-w-2xl">
    <!-- Add user form -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <form @submit.prevent="handleAdd" class="flex gap-3">
        <input
          v-model="newEmail"
          type="email"
          placeholder="user@redhat.com"
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
        <button
          type="submit"
          :disabled="!canAdd"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add Admin
        </button>
      </form>
      <p v-if="addError" class="mt-2 text-sm text-red-600">{{ addError }}</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-gray-400">
      Loading admins...
    </div>

    <!-- User list -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
      <div
        v-for="email in sortedEmails"
        :key="email"
        class="px-4 py-3 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-900 dark:text-gray-100">{{ email }}</span>
          <span
            v-if="email === currentUserEmail"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800"
          >
            You
          </span>
        </div>
        <button
          v-if="email !== currentUserEmail"
          @click="confirmRemove(email)"
          class="p-1 text-gray-400 hover:text-red-600 transition-colors"
          title="Remove admin"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div v-if="sortedEmails.length === 0" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        No admins configured.
      </div>
    </div>

    <!-- Confirmation modal -->
    <div
      v-if="emailToRemove"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="emailToRemove = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4" @click.stop>
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Remove Admin</h3>
        </div>
        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to remove <span class="font-medium text-gray-900 dark:text-gray-100">{{ emailToRemove }}</span> from the admin list?
          </p>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            @click="emailToRemove = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            @click="handleRemove"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAllowlist } from '@shared/client/composables/useAllowlist'
import { useAuth } from '@shared/client/composables/useAuth'

const emit = defineEmits(['toast'])

const { emails, loading, fetchAllowlist, addUser, removeUser } = useAllowlist()
const { user } = useAuth()

const newEmail = ref('')
const addError = ref(null)
const emailToRemove = ref(null)

const currentUserEmail = computed(() => user.value?.email?.toLowerCase() || '')

const canAdd = computed(() => {
  const val = newEmail.value.trim().toLowerCase()
  return val.includes('@') && val.indexOf('@') > 0 && val.indexOf('@') < val.length - 1
})

const sortedEmails = computed(() => {
  const sorted = [...emails.value].sort((a, b) => a.localeCompare(b))
  const cur = currentUserEmail.value
  if (cur && sorted.includes(cur)) {
    return [cur, ...sorted.filter(e => e !== cur)]
  }
  return sorted
})

onMounted(() => {
  fetchAllowlist()
})

async function handleAdd() {
  if (!canAdd.value) return
  addError.value = null
  const email = newEmail.value.trim().toLowerCase()
  try {
    await addUser(email)
    newEmail.value = ''
    emit('toast', { message: `Added ${email}`, type: 'success' })
  } catch (err) {
    addError.value = err.message
  }
}

function confirmRemove(email) {
  emailToRemove.value = email
}

async function handleRemove() {
  const email = emailToRemove.value
  emailToRemove.value = null
  try {
    await removeUser(email)
    emit('toast', { message: `Removed ${email}`, type: 'success' })
  } catch (err) {
    emit('toast', { message: `Failed to remove: ${err.message}`, type: 'error' })
  }
}
</script>
