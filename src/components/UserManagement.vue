<template>
  <div class="max-w-3xl">
    <!-- Add role form -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Assign Role</h3>
      <form @submit.prevent="handleAssign" class="flex gap-3 items-end">
        <div class="flex-1">
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Email</label>
          <input
            v-model="newEmail"
            type="email"
            placeholder="user@redhat.com"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div class="w-44">
          <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Role</label>
          <select
            v-model="selectedRole"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="admin">Admin</option>
            <option value="team-admin">Team Admin</option>
          </select>
        </div>
        <button
          type="submit"
          :disabled="!canAssign"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Assign
        </button>
      </form>
      <p v-if="assignError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ assignError }}</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-gray-400">
      Loading users...
    </div>

    <!-- User table -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role(s)</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assigned By</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="entry in sortedEntries" :key="entry.email">
            <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
              {{ entry.email }}
              <span
                v-if="entry.email === currentUserEmail"
                class="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300"
              >You</span>
            </td>
            <td class="px-4 py-3">
              <span
                v-for="role in entry.roles"
                :key="role"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-1"
                :class="role === 'admin'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'"
              >{{ role === 'admin' ? 'Admin' : 'Team Admin' }}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ entry.assignedBy }}</td>
            <td class="px-4 py-3 text-right">
              <button
                v-for="role in entry.roles"
                :key="role"
                @click="confirmRevoke(entry.email, role)"
                class="ml-1 text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                :title="`Remove ${role} role`"
              >
                Remove {{ role === 'admin' ? 'Admin' : 'Team Admin' }}
              </button>
            </td>
          </tr>
          <tr v-if="sortedEntries.length === 0">
            <td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              No users with roles.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Confirmation modal -->
    <div
      v-if="revokeTarget"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="revokeTarget = null"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4" @click.stop>
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Remove Role</h3>
        </div>
        <div class="px-6 py-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <template v-if="revokeTarget.email === currentUserEmail">
              Are you sure you want to remove your own <span class="font-medium text-gray-900 dark:text-gray-100">{{ revokeTarget.role }}</span> role? You may lose access to this page.
            </template>
            <template v-else>
              Remove <span class="font-medium text-gray-900 dark:text-gray-100">{{ revokeTarget.role }}</span> role from <span class="font-medium text-gray-900 dark:text-gray-100">{{ revokeTarget.email }}</span>?
            </template>
          </p>
        </div>
        <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            @click="revokeTarget = null"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            @click="handleRevoke"
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
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from '@shared/client/composables/useAuth'

const emit = defineEmits(['toast'])

const { user } = useAuth()

const assignments = ref({})
const loading = ref(true)
const newEmail = ref('')
const selectedRole = ref('admin')
const assignError = ref(null)
const revokeTarget = ref(null)

const currentUserEmail = computed(() => user.value?.email?.toLowerCase() || '')

const canAssign = computed(() => {
  const val = newEmail.value.trim().toLowerCase()
  return val.includes('@') && val.indexOf('@') > 0 && val.indexOf('@') < val.length - 1
})

const sortedEntries = computed(() => {
  const entries = Object.entries(assignments.value).map(([email, data]) => ({
    email,
    roles: data.roles || [],
    assignedBy: data.assignedBy || '',
    assignedAt: data.assignedAt || ''
  }))
  entries.sort((a, b) => a.email.localeCompare(b.email))
  const cur = currentUserEmail.value
  if (cur) {
    const idx = entries.findIndex(e => e.email === cur)
    if (idx > 0) {
      const [self] = entries.splice(idx, 1)
      entries.unshift(self)
    }
  }
  return entries
})

async function fetchRoles() {
  loading.value = true
  try {
    const data = await apiRequest('/roles')
    assignments.value = data.assignments || {}
  } catch {
    // Server not available
  } finally {
    loading.value = false
  }
}

onMounted(fetchRoles)

async function handleAssign() {
  if (!canAssign.value) return
  assignError.value = null
  const email = newEmail.value.trim().toLowerCase()
  try {
    await apiRequest('/roles/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: selectedRole.value })
    })
    newEmail.value = ''
    emit('toast', { message: `Assigned ${selectedRole.value} role to ${email}`, type: 'success' })
    await fetchRoles()
  } catch (err) {
    assignError.value = err.message
  }
}

function confirmRevoke(email, role) {
  revokeTarget.value = { email, role }
}

async function handleRevoke() {
  const { email, role } = revokeTarget.value
  revokeTarget.value = null
  try {
    await apiRequest('/roles/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    })
    emit('toast', { message: `Removed ${role} role from ${email}`, type: 'success' })
    await fetchRoles()
  } catch (err) {
    emit('toast', { message: `Failed to remove role: ${err.message}`, type: 'error' })
  }
}
</script>
