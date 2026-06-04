<script setup>
import ForYouMultiSelect from './ForYouMultiSelect.vue'

defineProps({
  boardColumns: { type: Array, default: () => [] },
  stageFilter: { type: Array, default: () => [] },
  priorityFilter: { type: Array, default: () => [] },
  stageOptions: { type: Array, default: () => [] },
  priorityOptions: { type: Array, default: () => [] },
  componentFilter: { type: Array, default: () => [] },
  availableItemComponents: { type: Array, default: () => [] },
  jiraHost: { type: String, default: null }
})

const emit = defineEmits(['navigate', 'update:stageFilter', 'update:priorityFilter', 'update:componentFilter'])

const columnColorClass = {
  gray: 'border-t-gray-400',
  red: 'border-t-red-500',
  amber: 'border-t-amber-500',
  blue: 'border-t-blue-500',
  green: 'border-t-green-500'
}

const countBadgeClass = {
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
}

function jiraUrl(key, host) {
  if (!host) return null
  return `${host}/browse/${key}`
}

const priorityColors = {
  Blocker: 'bg-red-600 dark:bg-red-500',
  Critical: 'bg-red-500 dark:bg-red-400',
  High: 'bg-orange-500 dark:bg-orange-400',
  Major: 'bg-amber-500 dark:bg-amber-400',
  Medium: 'bg-yellow-500 dark:bg-yellow-400',
  Normal: 'bg-blue-400 dark:bg-blue-300',
  Minor: 'bg-gray-400 dark:bg-gray-500'
}

const guideBase = '#/ai-impact/ai-factory-guide?from=state-of-the-union&section='

const columnGuidance = {
  'not-assessed': {
    text: 'RFEs that haven\'t been through the quality rubric yet. The pipeline will pick them up on its next run.',
    guide: 'rfe-review'
  },
  'needs-revision': {
    text: 'RFEs that failed scoring and couldn\'t be auto-fixed. Open in Jira, check the AI comments, and revise the WHAT and WHY.',
    guide: 'rfe-review'
  },
  'passed-with-caveats': {
    text: 'RFEs that passed scoring but have minor issues the automation couldn\'t resolve. Check Jira comments for specifics.',
    guide: 'rfe-review'
  },
  'ready-to-advance': {
    text: 'RFEs that passed quality checks. Add the scope label in Jira to queue them for strategy creation.',
    guide: 'rfe-review'
  },
  'queued-for-pipeline': {
    text: 'RFEs waiting for the automated pipeline to create a strategy feature. No action needed.',
    guide: 'feature-review'
  },
  'rejected': {
    text: 'Features the AI review recommended rejecting. Check review comments and decide whether to revise the RFE or close it.',
    guide: 'feature-review'
  },
  'revise-required': {
    text: 'Features with issues in feasibility, testability, scope, or architecture. Check scoring and revise the strategy in Jira.',
    guide: 'feature-review'
  },
  'awaiting-signoff': {
    text: 'Features that passed AI scoring and need human sign-off from a staff engineer, architect, or SME.',
    guide: 'feature-review'
  },
  'signed-off': {
    text: 'Features that have been reviewed and approved. Ready to move into implementation.',
    guide: 'implementation'
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Filters -->
    <div class="flex items-center gap-3">
      <ForYouMultiSelect
        :modelValue="stageFilter"
        :options="stageOptions"
        placeholder="All Stages"
        @update:modelValue="emit('update:stageFilter', $event)"
      />
      <ForYouMultiSelect
        :modelValue="priorityFilter"
        :options="priorityOptions"
        placeholder="All Priorities"
        @update:modelValue="emit('update:priorityFilter', $event)"
      />
      <ForYouMultiSelect
        v-if="availableItemComponents.length > 0"
        :modelValue="componentFilter"
        :options="availableItemComponents"
        placeholder="All Components"
        @update:modelValue="emit('update:componentFilter', $event)"
      />
    </div>

    <!-- Board -->
    <div class="overflow-x-auto -mx-6 px-6 pb-4">
      <div class="flex gap-3" style="min-width: max-content;">
        <div
          v-for="(col, colIdx) in boardColumns"
          :key="col.id"
          class="w-72 shrink-0 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-t-4 flex flex-col"
          :class="columnColorClass[col.color] || 'border-t-gray-400'"
        >
          <!-- Column header -->
          <div class="px-3 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-1 min-w-0">
              <span class="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{{ col.label }}</span>
              <div v-if="columnGuidance[col.id]" class="relative group shrink-0">
                <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div
                  class="absolute top-full pt-1 z-20 hidden group-hover:block w-64"
                  :class="colIdx >= boardColumns.length - 3 ? 'right-0' : 'left-0'"
                >
                  <div
                    class="p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50"
                  >
                    <p>{{ columnGuidance[col.id].text }}</p>
                    <a
                      :href="guideBase + columnGuidance[col.id].guide"
                      class="inline-flex items-center gap-0.5 mt-2 font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >Learn more
                      <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <span
              class="text-xs font-bold px-1.5 py-0.5 rounded-full ml-2 shrink-0"
              :class="countBadgeClass[col.color] || countBadgeClass.gray"
            >{{ col.items.length }}</span>
          </div>

          <!-- Cards -->
          <div class="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
            <div
              v-for="item in col.items"
              :key="item.key"
              class="bg-gray-50 dark:bg-gray-700/50 rounded-md p-2.5 border border-gray-100 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
            >
              <div class="flex items-center gap-1.5 mb-1">
                <button
                  @click="emit('navigate', item)"
                  class="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >{{ item.key }}</button>
                <a
                  v-if="jiraUrl(item.key, jiraHost)"
                  :href="jiraUrl(item.key, jiraHost)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                  title="Open in Jira"
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <span class="text-[10px] uppercase font-medium text-gray-400 dark:text-gray-500">{{ item.type }}</span>
              </div>
              <p class="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{{ item.summary }}</p>
              <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span
                  v-if="item.priority && item.priority !== 'None' && item.priority !== 'Undefined'"
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="priorityColors[item.priority] || 'bg-gray-400'"
                  :title="item.priority"
                />
                <span
                  v-if="item.waitDays > 0"
                  class="text-[10px] text-gray-500 dark:text-gray-400"
                >{{ item.waitDays }}d</span>
              </div>
            </div>
            <div v-if="col.items.length === 0" class="text-[10px] text-gray-400 dark:text-gray-500 text-center py-3">
              No items
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
