<script setup>
import { computed } from 'vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({
  epics: { type: Array, required: true }
})

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

function epicStats(epic) {
  const issues = epic.issues || []
  const total = issues.length
  const done = issues.filter(i => i.statusCategory === 'Done').length
  const inProgress = issues.filter(i => i.statusCategory === 'In Progress').length
  const todo = issues.filter(i => i.statusCategory === 'To Do').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { issues, total, done, inProgress, todo, pct }
}

const epicData = computed(() =>
  props.epics.map(epic => ({ epic, stats: epicStats(epic) }))
)
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="{ epic, stats } in epicData"
      :key="epic.key"
      class="bg-surface rounded-lg border border-gray-700 p-4"
    >
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <a
              :href="JIRA_BASE + epic.key"
              class="text-blue-400 hover:underline font-mono text-xs"
              target="_blank"
            >{{ epic.key }}</a>
            <StatusBadge :status="epic.status" />
          </div>
          <h4 class="text-white text-sm font-medium truncate">{{ epic.summary }}</h4>
        </div>
        <div class="text-right text-xs text-gray-400">
          <div v-if="epic.assignee">{{ epic.assignee }}</div>
          <div v-else class="text-yellow-500">Unassigned</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="mb-3">
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span>{{ stats.done }} / {{ stats.total }} issues</span>
          <span>{{ stats.pct }}%</span>
        </div>
        <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-green-500 rounded-full transition-all"
            :style="{ width: stats.pct + '%' }"
          />
        </div>
      </div>

      <!-- Issue status breakdown -->
      <div class="flex gap-4 text-xs">
        <span class="text-green-400">
          {{ stats.done }} Done
        </span>
        <span class="text-blue-400">
          {{ stats.inProgress }} Active
        </span>
        <span class="text-gray-400">
          {{ stats.todo }} Backlog
        </span>
      </div>

      <!-- Active issues list -->
      <div v-if="stats.inProgress > 0" class="mt-3 pt-3 border-t border-gray-700">
        <div class="text-xs text-gray-500 mb-2">Active Issues:</div>
        <div class="space-y-1">
          <div
            v-for="issue in stats.issues.filter(i => i.statusCategory === 'In Progress').slice(0, 5)"
            :key="issue.key"
            class="flex items-center gap-2 text-xs"
          >
            <a :href="JIRA_BASE + issue.key" class="text-blue-400 hover:underline font-mono" target="_blank">
              {{ issue.key }}
            </a>
            <span class="text-gray-300 truncate">{{ issue.summary }}</span>
            <span v-if="issue.assignee" class="text-gray-500 ml-auto flex-shrink-0">{{ issue.assignee }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="epics.length === 0" class="text-center text-gray-500 py-8">
      No epics found for this feature.
    </div>
  </div>
</template>
