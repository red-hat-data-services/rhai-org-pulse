<script setup>
import { computed } from 'vue'
import { ExternalLink, AlertTriangle, RefreshCw } from 'lucide-vue-next'

const props = defineProps({
  issues: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  available: { type: Boolean, default: true },
  reason: { type: String, default: null },
  // Client-side load error (the call to our own API failed). Distinct from
  // `reason`, which describes the server-side snapshot state.
  error: { type: String, default: null },
  jqlUrl: { type: String, default: '' },
  lastSyncedAt: { type: String, default: null }
})

const hasIssues = computed(() => (props.issues || []).length > 0)

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s === 'new' || s === 'to do' || s === 'backlog') {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  }
  if (s === 'in progress') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  }
  if (s === 'review' || s === 'code review') {
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
  }
  if (s === 'resolved' || s === 'done' || s === 'closed') {
    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const unavailableMessage = computed(() => {
  // A client-side load failure takes precedence — the snapshot never reached us.
  if (props.error) {
    return 'Could not load blocker JIRAs. Please try refreshing the page.'
  }
  if (props.reason === 'missing-credentials') {
    return 'Jira credentials are not configured, so blocker JIRAs cannot be fetched.'
  }
  if (props.reason === 'fetch-error') {
    return 'Could not reach Jira on the last refresh. Showing the last known data if available.'
  }
  return 'Blocker JIRA data is not yet available. Please check back later.'
})
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
      <RefreshCw class="animate-spin w-5 h-5 mr-2" />
      Loading blocker JIRAs…
    </div>

    <template v-else>
      <!-- Unavailable (no creds / fetch error / no data) with no data to show -->
      <div
        v-if="!available && !hasIssues"
        class="text-center py-12"
      >
        <AlertTriangle class="mx-auto h-10 w-10 text-gray-400" />
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">{{ unavailableMessage }}</p>
      </div>

      <!-- Empty (available, but zero open blockers) -->
      <div
        v-else-if="!hasIssues"
        class="text-center py-12"
      >
        <p class="text-sm font-medium text-gray-900 dark:text-white">No open blocker JIRAs 🎉</p>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No auto-filed E2E blocker bugs are currently open.
        </p>
      </div>

      <!-- Issue table -->
      <div v-else class="-mx-4 sm:mx-0">
        <!-- Stale-data banner when a fetch failed but we kept last-known-good data -->
        <div
          v-if="!available"
          class="mb-3 flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle class="w-4 h-4 shrink-0" />
          {{ unavailableMessage }}
        </div>

        <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Key</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Summary</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Component</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Affects Version</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Assignee</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              <tr
                v-for="issue in issues"
                :key="issue.key"
                class="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <a
                    v-if="issue.url"
                    :href="issue.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                  >
                    {{ issue.key || '—' }}
                    <ExternalLink class="inline ml-1 h-3 w-3" />
                  </a>
                  <span v-else class="font-medium text-gray-900 dark:text-white">{{ issue.key || '—' }}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-md truncate" :title="issue.summary">
                  {{ issue.summary || '—' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {{ issue.component || '—' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {{ (issue.affectsVersions || []).join(', ') || '—' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="statusBadgeClass(issue.status)"
                  >
                    {{ issue.status }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {{ issue.assignee || 'Unassigned' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                  {{ formatDate(issue.created) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="lastSyncedAt" class="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Last synced {{ new Date(lastSyncedAt).toLocaleString() }}
        </div>
      </div>
    </template>
  </div>
</template>
