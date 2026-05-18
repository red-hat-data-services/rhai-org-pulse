<script setup>
import { computed } from 'vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({
  epics: { type: Array, required: true }
})

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

const priorityStyle = {
  'Blocker': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  'Critical': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'Major': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'Normal': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  'Minor': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400',
  'Undefined': 'bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-500'
}

function isClosedOrResolvedStatus(status) {
  const s = String(status || '').trim().toLowerCase()
  return s === 'closed' || s === 'resolved'
}

function epicStats(epic) {
  const issues = epic.issues || []
  const total = issues.length
  const done = issues.filter(i => i.statusCategory === 'Done').length
  const inProgress = issues.filter(i => i.statusCategory === 'In Progress').length
  const todo = issues.filter(i => i.statusCategory === 'To Do').length
  // "Blocked" is only when the item is still open and explicitly marked blocked.
  // Jira priority "Blocker" is not reliable as a blocked signal.
  const blocked = issues.filter(i => !isClosedOrResolvedStatus(i.status) && i.isBlocked === true).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { issues, total, done, inProgress, todo, blocked, pct }
}

function ageDays(isoDate) {
  if (!isoDate) return null
  return Math.floor((new Date() - new Date(isoDate)) / (1000 * 60 * 60 * 24))
}

function formatAge(days) {
  if (days === null) return ''
  if (days === 0) return 'today'
  if (days === 1) return '1d'
  if (days < 30) return days + 'd'
  if (days < 365) return Math.floor(days / 30) + 'mo'
  return Math.floor(days / 365) + 'y'
}

function isStale(epic) {
  if (epic.statusCategory !== 'In Progress') return false
  const age = ageDays(epic.updated)
  return age !== null && age > 7
}

function progressBarColor(pct) {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

const epicData = computed(() =>
  props.epics.map(epic => ({ epic, stats: epicStats(epic) }))
)
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
    <div
      v-for="{ epic, stats } in epicData"
      :key="epic.key"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <!-- Epic header -->
      <div class="px-4 pt-3 pb-2">
        <div class="flex items-center justify-between gap-2 mb-1">
          <div class="flex items-center gap-2 min-w-0">
            <a
              :href="JIRA_BASE + epic.key"
              class="text-primary-600 dark:text-blue-400 hover:underline font-mono text-xs font-semibold flex-shrink-0"
              target="_blank"
            >{{ epic.key }}</a>
            <StatusBadge :status="epic.status" />
            <span
              v-if="epic.priority && epic.priority !== 'Undefined'"
              class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0"
              :class="priorityStyle[epic.priority] || priorityStyle['Undefined']"
            >{{ epic.priority }}</span>
          </div>
          <div class="text-right text-xs flex-shrink-0">
            <span v-if="epic.assignee" class="text-gray-500 dark:text-gray-400">{{ epic.assignee }}</span>
            <span v-else class="text-yellow-600 dark:text-yellow-500 font-medium">Unassigned</span>
          </div>
        </div>
        <h4 class="text-gray-900 dark:text-gray-100 text-sm font-medium leading-snug">{{ epic.summary }}</h4>
      </div>

      <!-- Progress bar -->
      <div class="px-4 pb-2">
        <div class="flex items-center gap-2">
          <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="progressBarColor(stats.pct)"
              :style="{ width: stats.pct + '%' }"
            />
          </div>
          <span class="text-xs font-bold w-10 text-right" :class="{
            'text-green-600 dark:text-green-400': stats.pct >= 70,
            'text-yellow-600 dark:text-yellow-400': stats.pct >= 40 && stats.pct < 70,
            'text-red-600 dark:text-red-400': stats.pct < 40
          }">{{ stats.pct }}%</span>
        </div>
      </div>

      <!-- Counts breakdown -->
      <div class="px-4 pb-2 flex items-center gap-3 text-xs">
        <span class="text-green-600 dark:text-green-400">
          <span class="font-semibold">{{ stats.done }}</span> Done
        </span>
        <span class="text-gray-300 dark:text-gray-600">|</span>
        <span class="text-blue-600 dark:text-blue-400">
          <span class="font-semibold">{{ stats.inProgress }}</span> Active
        </span>
        <span class="text-gray-300 dark:text-gray-600">|</span>
        <span class="text-gray-500 dark:text-gray-400">
          <span class="font-semibold">{{ stats.todo }}</span> Backlog
        </span>
        <template v-if="stats.blocked > 0">
          <span class="text-gray-300 dark:text-gray-600">|</span>
          <span class="text-red-600 dark:text-red-400 font-semibold">
            {{ stats.blocked }} Blocked
          </span>
        </template>
      </div>

      <!-- Active issues list -->
      <div v-if="stats.inProgress > 0" class="px-4 pb-2 pt-1 border-t border-gray-100 dark:border-gray-700/50">
        <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-wide font-medium">Active Issues</div>
        <div class="space-y-1">
          <div
            v-for="issue in stats.issues.filter(i => !isClosedOrResolvedStatus(i.status)).slice(0, 5)"
            :key="issue.key"
            class="flex items-center gap-2 text-xs"
          >
            <a :href="JIRA_BASE + issue.key" class="text-primary-600 dark:text-blue-400 hover:underline font-mono flex-shrink-0" target="_blank">
              {{ issue.key }}
            </a>
            <span class="text-gray-700 dark:text-gray-300 truncate">{{ issue.summary }}</span>
            <span v-if="issue.assignee" class="text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">{{ issue.assignee }}</span>
          </div>
        </div>
      </div>

      <!-- Footer pills -->
      <div class="px-4 pb-3 pt-1 flex flex-wrap items-center gap-1.5">
        <!-- Components -->
        <span
          v-for="c in (epic.components || []).slice(0, 2)"
          :key="c"
          class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400"
        >{{ c }}</span>
        <span
          v-if="(epic.components || []).length > 2"
          class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
        >+{{ epic.components.length - 2 }}</span>

        <!-- Labels -->
        <span
          v-for="label in (epic.labels || []).slice(0, 2)"
          :key="label"
          class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400"
        >{{ label }}</span>
        <span
          v-if="(epic.labels || []).length > 2"
          class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
        >+{{ epic.labels.length - 2 }}</span>

        <!-- Age -->
        <span
          v-if="epic.created"
          class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
        >{{ formatAge(ageDays(epic.created)) }} old</span>

        <!-- Stale warning -->
        <span
          v-if="isStale(epic)"
          class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400"
        >
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75h.007v.008H12v-.008z"/></svg>
          Stale
        </span>
      </div>
    </div>

    <div v-if="epics.length === 0" class="col-span-full text-center text-gray-500 dark:text-gray-400 py-8">
      No epics found for this feature.
    </div>
  </div>
</template>
