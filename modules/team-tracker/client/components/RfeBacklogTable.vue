<template>
  <div>
    <!-- Search -->
    <div class="relative mb-4">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search RFEs by key, summary, component, status..."
        class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none"
              @click="toggleSort(col.key)"
            >
              {{ col.label }}
              <span v-if="sortKey === col.key">{{ sortAsc ? '▲' : '▼' }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="issue in sortedIssues" :key="issue.key" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-3 whitespace-nowrap">
              <a
                :href="jiraIssueUrl(issue.key)"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:text-primary-800 dark:hover:text-primary-400 hover:underline font-medium"
              >
                {{ issue.key }}
              </a>
            </td>
            <td class="px-4 py-3 text-gray-800 dark:text-gray-200">{{ issue.summary }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="comp in issue.components"
                  :key="comp"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                >
                  {{ comp }}
                </span>
              </div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                :class="statusClass(issue.statusCategory)"
              >
                {{ issue.status }}
              </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{{ issue.priority }}</td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">{{ formatDate(issue.created) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="sortedIssues.length === 0 && searchQuery" class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      No RFEs match "{{ searchQuery }}"
    </div>
    <div v-else-if="issues.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      No open RFEs for this team.
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  issues: { type: Array, default: () => [] },
  rfeConfig: { type: Object, default: () => ({}) }
})

const columns = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'components', label: 'Components' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'created', label: 'Created' },
]

const PRIORITY_ORDER = { Blocker: 0, Critical: 1, Major: 2, Normal: 3, Minor: 4, Trivial: 5 }

const searchQuery = ref('')
const sortKey = ref('created')
const sortAsc = ref(false)

function toggleSort(column) {
  if (sortKey.value === column) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = column
    sortAsc.value = (column !== 'priority' && column !== 'created')
  }
}

const sortedIssues = computed(() => {
  let filtered = props.issues
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    filtered = filtered.filter(issue =>
      issue.key.toLowerCase().includes(q) ||
      issue.summary.toLowerCase().includes(q) ||
      issue.status.toLowerCase().includes(q) ||
      issue.priority.toLowerCase().includes(q) ||
      (issue.components || []).some(c => c.toLowerCase().includes(q))
    )
  }
  const dir = sortAsc.value ? 1 : -1
  return [...filtered].sort((a, b) => {
    switch (sortKey.value) {
      case 'key': return dir * a.key.localeCompare(b.key, undefined, { numeric: true })
      case 'summary': return dir * a.summary.localeCompare(b.summary)
      case 'components': return dir * (a.components || []).join(', ').localeCompare((b.components || []).join(', '))
      case 'status': return dir * a.status.localeCompare(b.status)
      case 'priority': return dir * ((PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))
      case 'created': return dir * a.created.localeCompare(b.created)
      default: return 0
    }
  })
})

function jiraIssueUrl(key) {
  const host = props.rfeConfig.jiraHost || 'https://redhat.atlassian.net'
  return `${host}/browse/${encodeURIComponent(key)}`
}

function statusClass(category) {
  if (category === 'Done') return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
  if (category === 'In Progress') return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString()
}
</script>
