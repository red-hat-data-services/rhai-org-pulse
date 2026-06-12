<template>
  <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table class="min-w-full text-sm">
      <thead>
        <tr class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <th v-for="col in columns" :key="col.key" class="text-left px-3 py-2 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
            <div class="space-y-1">
              <button class="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100" @click="toggleSort(col.key)">
                {{ col.label }}
                <span v-if="sortKey === col.key" class="text-xs">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
              <select
                v-if="col.filterable"
                v-model="columnFilters[col.key]"
                class="block w-full text-xs font-normal bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-1 text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400"
              >
                <option value="">All</option>
                <option v-for="opt in filterOptions[col.key]" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!sortedIssues.length">
          <td :colspan="columns.length" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No issues match the current filters</td>
        </tr>
        <tr
          v-for="issue in sortedIssues"
          :key="issue.key"
          class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <td class="px-3 py-2 whitespace-nowrap">
            <a :href="issue.url" target="_blank" rel="noopener" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">{{ issue.key }}</a>
          </td>
          <td class="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ issue.issueType }}</td>
          <td class="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-md truncate" :title="issue.summary">{{ issue.summary }}</td>
          <td class="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ issue.assignee }}</td>
          <td class="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ issue.reporter }}</td>
          <td class="px-3 py-2 whitespace-nowrap">
            <span class="inline-flex items-center gap-1">
              <span :class="priorityDot(issue.priority)" class="w-2.5 h-2.5 rounded-full inline-block" />
              {{ issue.priority }}
            </span>
          </td>
          <td class="px-3 py-2 whitespace-nowrap">
            <span
              class="inline-block px-2 py-0.5 text-xs font-medium rounded-full"
              :class="statusClasses(issue.statusCategory)"
            >{{ issue.status }}</span>
          </td>
          <td class="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ issue.resolution }}</td>
          <td class="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(issue.created) }}</td>
          <td class="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(issue.updated) }}</td>
          <td class="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ issue.dueDate ? formatDate(issue.dueDate) : 'None' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

var props = defineProps({
  issues: { type: Array, default: function() { return [] } }
})

var columns = [
  { key: 'key', label: 'Key', filterable: false },
  { key: 'issueType', label: 'Type', filterable: true },
  { key: 'summary', label: 'Summary', filterable: false },
  { key: 'assignee', label: 'Assignee', filterable: true },
  { key: 'reporter', label: 'Reporter', filterable: true },
  { key: 'priority', label: 'Priority', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'resolution', label: 'Resolution', filterable: true },
  { key: 'created', label: 'Created', filterable: false },
  { key: 'updated', label: 'Updated', filterable: false },
  { key: 'dueDate', label: 'Due date', filterable: false }
]

var columnFilters = ref({
  issueType: '',
  assignee: '',
  reporter: '',
  priority: '',
  status: '',
  resolution: ''
})

var sortKey = ref('created')
var sortDir = ref('desc')

var filterOptions = computed(function() {
  var opts = {}
  var filterableKeys = ['issueType', 'assignee', 'reporter', 'priority', 'status', 'resolution']
  for (var ki = 0; ki < filterableKeys.length; ki++) {
    var key = filterableKeys[ki]
    var seen = {}
    var values = []
    for (var i = 0; i < props.issues.length; i++) {
      var val = props.issues[i][key] || ''
      if (val && !seen[val]) {
        seen[val] = true
        values.push(val)
      }
    }
    values.sort()
    opts[key] = values
  }
  return opts
})

var filteredIssues = computed(function() {
  return props.issues.filter(function(issue) {
    var keys = Object.keys(columnFilters.value)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      var filterVal = columnFilters.value[key]
      if (filterVal && issue[key] !== filterVal) return false
    }
    return true
  })
})

var sortedIssues = computed(function() {
  var arr = filteredIssues.value.slice()
  var key = sortKey.value
  var dir = sortDir.value === 'asc' ? 1 : -1

  arr.sort(function(a, b) {
    var aVal = a[key] || ''
    var bVal = b[key] || ''
    if (aVal < bVal) return -1 * dir
    if (aVal > bVal) return 1 * dir
    return 0
  })
  return arr
})

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'created' || key === 'updated' ? 'desc' : 'asc'
  }
}

function priorityDot(priority) {
  var p = (priority || '').toLowerCase()
  if (p === 'blocker' || p === 'critical') return 'bg-red-500'
  if (p === 'major') return 'bg-orange-400'
  if (p === 'normal' || p === 'minor') return 'bg-yellow-400'
  if (p === 'trivial') return 'bg-green-400'
  if (p === 'undefined') return 'bg-gray-300 dark:bg-gray-500'
  return 'bg-gray-300 dark:bg-gray-500'
}

function statusClasses(category) {
  var c = (category || '').toLowerCase()
  if (c === 'done') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (c === 'in progress') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function formatDate(iso) {
  if (!iso) return ''
  var d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
