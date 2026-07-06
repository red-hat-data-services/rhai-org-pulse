<template>
  <div>
    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading exceptions...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12 text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <template v-else>
      <!-- Header with filters + add button -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div class="flex flex-wrap items-center gap-3">
          <select
            v-model="filterType"
            class="h-8 text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All types</option>
            <option value="person">People</option>
            <option value="team">Teams</option>
          </select>

          <div class="relative">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search..."
              class="pl-8 pr-3 h-8 text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-48"
            />
          </div>
        </div>

        <button
          @click="showAddModal = true"
          class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
        >
          Add Exception
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="filteredExceptions.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
        <p class="text-lg font-medium mb-1">No exceptions</p>
        <p class="text-sm">{{ exceptions.length > 0 ? 'No exceptions match your filters.' : 'Create an exception to exclude a field from completeness checks.' }}</p>
      </div>

      <!-- Exceptions table -->
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Field</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Reason</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created By</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="ex in filteredExceptions"
              :key="ex.id"
              class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td class="px-4 py-3 text-sm whitespace-nowrap">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="ex.entityType === 'person'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'"
                >
                  {{ ex.entityType === 'person' ? 'Person' : 'Team' }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {{ resolveEntityName(ex) }}
                <span
                  v-if="ex.entityType === 'team' && resolveOrgName(ex)"
                  class="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                >{{ resolveOrgName(ex) }}</span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {{ resolveFieldLabel(ex) }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" :title="ex.reason">
                {{ ex.reason }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ ex.createdBy }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(ex.createdAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  @click="confirmDelete(ex)"
                  class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                  :disabled="deleting === ex.id"
                >
                  {{ deleting === ex.id ? 'Removing...' : 'Remove' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Add Exception Modal -->
    <AddExceptionModal
      v-if="showAddModal"
      :people="allPeople"
      :teams="allTeams"
      :org-keys="orgKeys"
      :field-definitions="fieldDefinitions"
      @close="showAddModal = false"
      @created="handleCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useFieldCompleteness } from '../composables/useFieldCompleteness'
import AddExceptionModal from './AddExceptionModal.vue'

const { people, teams, fieldDefinitions, orgKeys, load: loadCompleteness } = useFieldCompleteness()

const exceptions = ref([])
const loading = ref(false)
const error = ref(null)
const showAddModal = ref(false)
const deleting = ref(null)

const filterType = ref('')
const searchQuery = ref('')

// Expose people and teams for the modal
const allPeople = computed(() =>
  people.value.map(p => ({ uid: p.uid, name: p.name }))
)
const allTeams = computed(() =>
  teams.value.map(t => ({ id: t.id, name: t.name, orgKey: t.orgKey }))
)

// Resolve entity name from loaded completeness data
function resolveEntityName(ex) {
  if (ex.entityType === 'person') {
    const person = people.value.find(p => p.uid === ex.entityId)
    return person?.name || ex.entityId
  } else {
    const team = teams.value.find(t => t.id === ex.entityId)
    return team?.name || ex.entityId
  }
}

// Resolve org display name for a team exception
function resolveOrgName(ex) {
  if (ex.entityType !== 'team') return null
  const team = teams.value.find(t => t.id === ex.entityId)
  if (!team?.orgKey) return null
  const org = orgKeys.value.find(o => o.key === team.orgKey)
  return org?.displayName || team.orgKey
}

// Resolve field label from field definitions
function resolveFieldLabel(ex) {
  if (ex.fieldId === '__boards__') return 'Boards'
  const scope = ex.entityType === 'person' ? 'person' : 'team'
  const field = (fieldDefinitions.value[scope] || []).find(f => f.id === ex.fieldId)
  return field?.label || ex.fieldId
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString()
}

const filteredExceptions = computed(() => {
  let result = exceptions.value
  if (filterType.value) {
    result = result.filter(e => e.entityType === filterType.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter(e => {
      const name = resolveEntityName(e).toLowerCase()
      const field = resolveFieldLabel(e).toLowerCase()
      return name.includes(q) || field.includes(q) || e.reason?.toLowerCase().includes(q)
    })
  }
  return result
})

async function loadExceptions() {
  loading.value = true
  error.value = null
  try {
    await loadCompleteness()
    const data = await apiRequest('/modules/team-tracker/field-exceptions')
    exceptions.value = data.exceptions || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function handleCreated() {
  await loadExceptions()
}

async function confirmDelete(ex) {
  const name = resolveEntityName(ex)
  const field = resolveFieldLabel(ex)
  if (!confirm(`Remove exception for ${ex.entityType} "${name}" on field "${field}"?`)) return

  deleting.value = ex.id
  try {
    await apiRequest(`/modules/team-tracker/field-exceptions/${ex.id}`, { method: 'DELETE' })
    exceptions.value = exceptions.value.filter(e => e.id !== ex.id)
  } catch (err) {
    error.value = err.message
  } finally {
    deleting.value = null
  }
}

onMounted(loadExceptions)
</script>
