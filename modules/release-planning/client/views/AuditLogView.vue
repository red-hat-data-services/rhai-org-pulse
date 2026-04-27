<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue'
import { useAuditLog } from '../composables/useAuditLog'
import { useReleases } from '../composables/useReleasePlanning'

const moduleNav = inject('moduleNav')
const { entries, total, loading, error, loadAuditLog } = useAuditLog()
const { releases, loadReleases } = useReleases()

const selectedVersion = ref('')
const selectedAction = ref('')
const currentPage = ref(1)
const pageSize = 25

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'create_rock', label: 'Created Big Rock' },
  { value: 'update_rock', label: 'Updated Big Rock' },
  { value: 'delete_rock', label: 'Deleted Big Rock' },
  { value: 'reorder_rocks', label: 'Reordered Big Rocks' },
  { value: 'create_release', label: 'Created release' },
  { value: 'clone_release', label: 'Cloned release' },
  { value: 'delete_release', label: 'Deleted release' },
  { value: 'import_doc', label: 'Doc import' },
  { value: 'add_pm', label: 'Added PM' },
  { value: 'remove_pm', label: 'Removed PM' },
  { value: 'seed', label: 'Seeded data' },
  { value: 'committed_list_change', label: 'Committed list change' }
]

const ACTION_COLORS = {
  create_rock: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  update_rock: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  delete_rock: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  reorder_rocks: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',
  create_release: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  clone_release: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400',
  delete_release: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  import_doc: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  add_pm: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  remove_pm: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  seed: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
  committed_list_change: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
}

function actionColor(action) {
  return ACTION_COLORS[action] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

function actionLabel(action) {
  const opt = ACTION_OPTIONS.find(function(o) { return o.value === action })
  return opt ? opt.label : action
}

function shortUser(email) {
  if (!email) return 'System'
  const at = email.indexOf('@')
  return at > 0 ? email.substring(0, at) : email
}

function formatTimestamp(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const totalPages = computed(function() {
  return Math.max(1, Math.ceil(total.value / pageSize))
})

function goBack() {
  if (moduleNav) moduleNav.goBack()
}

function fetchPage() {
  const opts = {
    limit: pageSize,
    offset: (currentPage.value - 1) * pageSize
  }
  if (selectedVersion.value) opts.version = selectedVersion.value
  if (selectedAction.value) opts.action = selectedAction.value
  loadAuditLog(opts)
}

watch([selectedVersion, selectedAction], function() {
  currentPage.value = 1
  fetchPage()
})

watch(currentPage, fetchPage)

onMounted(async function() {
  await loadReleases()
  const params = moduleNav ? moduleNav.params : {}
  if (params && params.version) {
    selectedVersion.value = params.version
  } else {
    fetchPage()
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <button
        @click="goBack"
        aria-label="Go back"
        class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Track all changes to release planning data</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <select
        v-model="selectedVersion"
        aria-label="Filter by release"
        class="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
      >
        <option value="">All releases</option>
        <option v-for="r in releases" :key="r.version" :value="r.version">{{ r.version }}</option>
      </select>
      <select
        v-model="selectedAction"
        aria-label="Filter by action"
        class="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
      >
        <option v-for="opt in ACTION_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <span class="text-xs text-gray-400 dark:text-gray-500">
        {{ total }} entr{{ total === 1 ? 'y' : 'ies' }}
      </span>
    </div>

    <!-- Error -->
    <div v-if="error" role="alert" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-gray-400 text-sm">Loading audit log...</div>

    <!-- Table -->
    <div v-else-if="entries.length > 0" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <table class="w-full text-xs">
        <caption class="sr-only">Audit log entries</caption>
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <th scope="col" class="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Time</th>
            <th scope="col" class="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Action</th>
            <th scope="col" class="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Description</th>
            <th scope="col" class="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">Release</th>
            <th scope="col" class="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400">User</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in entries"
            :key="entry.id"
            class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30"
          >
            <td class="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatTimestamp(entry.timestamp) }}
            </td>
            <td class="px-4 py-2">
              <span
                class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                :class="actionColor(entry.action)"
              >{{ actionLabel(entry.action) }}</span>
            </td>
            <td class="px-4 py-2 text-gray-700 dark:text-gray-300">
              {{ entry.summary }}
            </td>
            <td class="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ entry.version || '—' }}
            </td>
            <td class="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ shortUser(entry.user) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-8 text-gray-400 text-sm">No audit log entries found.</div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between">
      <span class="text-xs text-gray-400">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      <div class="flex items-center gap-1">
        <button
          @click="currentPage = Math.max(1, currentPage - 1)"
          :disabled="currentPage <= 1"
          class="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >Previous</button>
        <button
          @click="currentPage = Math.min(totalPages, currentPage + 1)"
          :disabled="currentPage >= totalPages"
          class="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >Next</button>
      </div>
    </div>
  </div>
</template>
