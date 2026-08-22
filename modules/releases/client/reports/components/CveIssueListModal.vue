<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="$emit('close')"></div>
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-7xl max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <span v-if="dotColor" class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: dotColor }"></span>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{{ title }}</h3>
            <span class="text-sm text-gray-500 dark:text-gray-400 shrink-0">({{ issues.length }})</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <a
              v-if="jql"
              :href="jql"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="View these issues in Jira"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View in Jira
            </a>
            <button
              @click="$emit('close')"
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Table -->
        <div class="overflow-auto flex-1">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/90">
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Key</th>
                <th class="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Summary</th>
                <th class="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Component</th>
                <th class="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Target Version</th>
                <th class="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th class="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assignee</th>
                <th class="text-left py-2.5 px-4 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Due Date</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="issue in issues"
                :key="issue.key"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <td class="py-2 px-4">
                  <span class="inline-flex items-center gap-1.5">
                    <a
                      :href="jiraIssueUrl(issue.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >{{ issue.key }}</a>
                    <a
                      :href="jiraIssueUrl(issue.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                      title="Open in Jira"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </span>
                </td>
                <td class="py-2 px-4 text-gray-900 dark:text-gray-100">{{ issue.summary || '—' }}</td>
                <td class="py-2 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ issue.component || '—' }}</td>
                <td class="py-2 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ (issue.versions || []).join(', ') || '—' }}</td>
                <td class="py-2 px-4">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                    :class="statusBadgeClass(issue.status)"
                  >{{ issue.status }}</span>
                </td>
                <td class="py-2 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ issue.assignee || '—' }}</td>
                <td class="py-2 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ formatDueDate(issue.duedate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  issues: { type: Array, default: () => [] },
  jql: { type: String, default: '' },
  dotColor: { type: String, default: '' },
  jiraHost: { type: String, default: 'https://issues.redhat.com' }
})

defineEmits(['close'])

function jiraIssueUrl(key) {
  const host = props.jiraHost || 'https://issues.redhat.com'
  return `${host}/browse/${key}`
}

function statusBadgeClass(status) {
  const s = (status || '').toUpperCase()
  if (s === 'NEW') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  if (s === 'IN PROGRESS') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  if (s === 'REVIEW') return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
  if (s === 'RESOLVED') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (s === 'CLOSED') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function formatDueDate(duedate) {
  if (!duedate) return '—'
  return new Date(duedate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
