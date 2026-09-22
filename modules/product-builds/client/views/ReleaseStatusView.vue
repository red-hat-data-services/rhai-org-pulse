<script setup>
import { onMounted } from 'vue'
import { useReleaseStatus } from '../composables/useReleaseStatus'

const { data, loading, error, load } = useReleaseStatus()

onMounted(load)

const LIFECYCLE_STATES = {
  planned: 'planned',
  'not started': 'planned',
  ready: 'ready',
  triggered: 'triggered',
  'in progress': 'triggered',
  released: 'released',
  completed: 'released',
  failed: 'failed',
  skip: 'skipped',
  skipped: 'skipped',
}

const LIFECYCLE_PRECEDENCE = ['planned', 'triggered', 'ready', 'failed', 'released', 'skip']

const STATUS_CLASSES = {
  planned: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  ready: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  triggered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  released: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
  failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  skipped: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700/40 dark:text-gray-300 dark:border-gray-600',
  unknown: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600',
}

const STATUS_DOT_CLASSES = {
  planned: 'bg-amber-500',
  ready: 'bg-blue-500',
  triggered: 'bg-emerald-500',
  released: 'bg-green-300',
  failed: 'bg-red-500',
  skipped: 'bg-gray-400',
  unknown: 'bg-gray-400',
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
}

function lifecycleState(labels) {
  const normalizedLabels = new Set((labels || []).map(normalize))
  for (const label of LIFECYCLE_PRECEDENCE) {
    const state = normalizedLabels.has(label) && LIFECYCLE_STATES[label]
    if (state) return state
  }
  return null
}

function jiraState(status) {
  const name = normalize(status?.name)
  if (['planned', 'not started', 'to do', 'open', 'new'].includes(name)) return 'planned'
  if (name === 'ready') return 'ready'
  if (['triggered', 'in progress'].includes(name)) return 'triggered'
  if (['released', 'completed', 'done', 'closed'].includes(name)) return 'released'
  if (name.includes('fail')) return 'failed'
  if (name.includes('skip')) return 'skipped'

  return {
    new: 'planned',
    indeterminate: 'triggered',
    done: 'released',
  }[normalize(status?.category)] || 'unknown'
}

function statusState(item) {
  return lifecycleState(item?.labels) || jiraState(item?.status)
}

function statusClass(item) {
  return STATUS_CLASSES[statusState(item)]
}

function statusDotClass(item) {
  return STATUS_DOT_CLASSES[statusState(item)]
}

function isCompleted(item) {
  return statusState(item) === 'released'
}

function statusLabel(item) {
  return item.status?.name || 'Unknown'
}

function visibleLabels(labels = []) {
  return labels.filter(label => normalize(label) !== 'release automation')
}

function jiraUrl(key) {
  return `https://redhat.atlassian.net/browse/${key}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release status</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Ongoing release epics and readiness cards from Jira
      </p>
      <div aria-label="Status legend" class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-500"></span>Planned / not started</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-blue-500"></span>Ready</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>Triggered / in progress</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-green-300"></span>Released / completed</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-red-500"></span>Failed</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-gray-400"></span>Skipped</span>
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
        <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else-if="!data || data.total === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
      No ongoing release epics found.
    </div>

    <div v-else class="space-y-6">
      <section
        v-for="group in data.groups"
        :key="group.key"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ group.label }}</h2>
        </div>

        <div v-if="group.epics.length === 0" class="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
          No ongoing releases.
        </div>

        <div v-for="epic in group.epics" :key="epic.key" class="border-b last:border-b-0 border-gray-200 p-4 sm:p-5 dark:border-gray-700">
          <div :data-tree-root="epic.key" :data-status-state="statusState(epic)" class="relative rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/80 p-4 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-900/50">
            <span :class="statusDotClass(epic)" class="absolute -left-1.5 top-5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-gray-800"></span>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <a :href="jiraUrl(epic.key)" target="_blank" rel="noopener" class="font-semibold text-primary-600 dark:text-blue-400 hover:underline">
                    {{ epic.key }}
                  </a>
                  <span class="text-gray-900 dark:text-gray-100">{{ epic.summary }}</span>
                </div>
                <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span v-if="epic.details.version">Version {{ epic.details.version }}</span>
                  <span v-if="epic.details.target">Target: {{ epic.details.target }}</span>
                  <span>Updated {{ formatDate(epic.updated) }}</span>
                </div>
              </div>
              <span :data-status-badge="epic.key" class="inline-flex shrink-0 items-center self-start rounded-full border px-2.5 py-1 text-xs font-semibold" :class="statusClass(epic)" :data-status-category="epic.status.category">
                {{ statusLabel(epic) }}
              </span>
            </div>
            <div v-if="visibleLabels(epic.labels).length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="label in visibleLabels(epic.labels)" :key="label" class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {{ label }}
              </span>
            </div>
          </div>

          <div v-if="epic.children.length === 0" class="ml-3 mt-4 text-sm text-gray-500 dark:text-gray-400">
            No child cards found.
          </div>
          <div v-else class="relative ml-3 mt-4 space-y-3 border-l-2 border-gray-200 pl-5 dark:border-gray-700 sm:ml-5 sm:pl-7" data-tree-branch>
            <div
              v-for="child in epic.children"
              :key="child.key"
              :data-tree-child="child.key"
              :data-status-state="statusState(child)"
              :data-completed="isCompleted(child)"
              :class="isCompleted(child) ? 'opacity-70' : ''"
              class="relative rounded-xl border border-gray-200 bg-gray-50/70 p-3 shadow-sm before:absolute before:-left-5 before:top-5 before:w-5 before:border-t-2 before:border-gray-200 dark:border-gray-700 dark:bg-gray-900/30 dark:before:border-gray-700 sm:p-4"
            >
              <span :class="statusDotClass(child)" class="absolute -left-[1.8125rem] top-3.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800"></span>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div class="min-w-0 text-sm">
                  <a :href="jiraUrl(child.key)" target="_blank" rel="noopener" class="font-medium text-primary-600 dark:text-blue-400 hover:underline">{{ child.key }}</a>
                   <span class="ml-2 break-words text-gray-700 dark:text-gray-300" :class="isCompleted(child) ? 'line-through' : ''">{{ child.summary }}</span>
                </div>
                <span :data-status-badge="child.key" class="inline-flex shrink-0 items-center self-start rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap" :class="statusClass(child)" :data-status-category="child.status.category">
                  {{ statusLabel(child) }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <div class="flex flex-wrap gap-x-2 gap-y-1">
                  <span v-for="label in visibleLabels(child.labels)" :key="label" class="text-gray-600 dark:text-gray-300">{{ label }}</span>
                  <span v-if="visibleLabels(child.labels).length === 0" class="text-gray-400 dark:text-gray-500">—</span>
                </div>
                <span class="whitespace-nowrap">Updated {{ formatDate(child.updated) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
