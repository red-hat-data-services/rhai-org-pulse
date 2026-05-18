<template>
  <div>
    <button
      v-if="expandable"
      data-testid="toggle-button"
      @click="expanded = !expanded"
      class="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium"
    >
      {{ expanded ? 'Hide issues' : `Show ${issues.length} issues` }}
    </button>

    <div v-if="expanded || !expandable" class="mt-1 space-y-1">
      <div
        v-for="issue in issues"
        :key="issue.key"
        data-testid="issue-row"
        class="flex items-center gap-2 py-1.5 px-2 rounded text-sm"
        :class="{ 'bg-amber-50 dark:bg-amber-900/20': isUnestimated(issue) }"
      >
        <svg
          v-if="issue.completed"
          data-testid="completed-check"
          class="h-4 w-4 text-green-500 flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
        <div v-else class="h-4 w-4 flex-shrink-0"></div>

        <a
          :href="issue.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-mono text-xs flex-shrink-0"
        >{{ issue.key }}</a>

        <span class="truncate text-gray-700 dark:text-gray-300 flex-1">{{ issue.summary }}</span>

        <span
          data-testid="points-badge"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0"
          :class="isUnestimated(issue) ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'"
        >{{ issue.storyPoints ?? '—' }}</span>

        <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 w-20 text-right">{{ issue.status }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  issues: {
    type: Array,
    required: true
  },
  expandable: {
    type: Boolean,
    default: true
  }
})

const expanded = ref(false)

function isUnestimated(issue) {
  return issue.storyPoints == null
}
</script>
