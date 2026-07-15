<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Jira Taxonomy</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Browse Jira classification systems</p>

    <!-- Info card -->
    <div
      v-if="project && !loading"
      class="mb-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
    >
      <svg class="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>
        This list is sourced from the
        <a :href="`https://redhat.atlassian.net/projects/${project}/components`" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 dark:text-primary-400 hover:underline">{{ project }}</a>
        Jira project's component registry.
        <template v-if="fetchedAt">Last synced {{ formatDate(fetchedAt) }}.</template>
        Components are synced automatically from Jira.
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error && !components.length" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
      <p class="text-red-700 dark:text-red-400 text-sm">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Component Browser -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Components</h3>
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ filteredComponents.length }} component{{ filteredComponents.length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name, description, or lead..."
              class="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-80"
            />
            <svg class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th
                  @click="toggleSort('name')"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none"
                >
                  Name {{ sortColumn === 'name' ? (sortAsc ? '\u25B2' : '\u25BC') : '' }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th
                  @click="toggleSort('lead')"
                  class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none"
                >
                  Lead {{ sortColumn === 'lead' ? (sortAsc ? '\u25B2' : '\u25BC') : '' }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Assignee Type
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="comp in filteredComponents"
                :key="comp.name"
                class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {{ comp.name }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-md truncate" :title="comp.description">
                  {{ comp.description || '\u2014' }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  {{ comp.lead ? comp.lead.displayName : '\u2014' }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {{ formatAssigneeType(comp.assigneeType) }}
                </td>
              </tr>
              <tr v-if="filteredComponents.length === 0">
                <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {{ searchQuery ? 'No components match your search.' : 'No components found.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

// Component browser state
const loading = ref(false)
const error = ref(null)
const components = ref([])
const project = ref('')
const fetchedAt = ref(null)
const searchQuery = ref('')
const sortColumn = ref('name')
const sortAsc = ref(true)

const filteredComponents = computed(() => {
  let result = components.value
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    result = result.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q) || (c.lead?.displayName || '').toLowerCase().includes(q)
    )
  }

  const col = sortColumn.value
  const asc = sortAsc.value
  return [...result].sort((a, b) => {
    let aVal, bVal
    if (col === 'lead') {
      aVal = a.lead ? a.lead.displayName.toLowerCase() : ''
      bVal = b.lead ? b.lead.displayName.toLowerCase() : ''
    } else {
      aVal = (a[col] || '').toLowerCase()
      bVal = (b[col] || '').toLowerCase()
    }
    if (aVal < bVal) return asc ? -1 : 1
    if (aVal > bVal) return asc ? 1 : -1
    return 0
  })
})

function toggleSort(col) {
  if (sortColumn.value === col) {
    sortAsc.value = !sortAsc.value
  } else {
    sortColumn.value = col
    sortAsc.value = true
  }
}

function formatAssigneeType(type) {
  if (!type) return '\u2014'
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function fetchComponents() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/team-tracker/jira-components')
    components.value = data.components || []
    project.value = data.project || ''
    fetchedAt.value = data.fetchedAt || null
  } catch (err) {
    error.value = err.message || 'Failed to load components'
  } finally {
    loading.value = false
  }
}

onMounted(fetchComponents)
</script>
