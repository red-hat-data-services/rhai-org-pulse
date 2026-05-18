<template>
  <div
    v-if="issues.length > 0"
    data-testid="unestimated-panel"
    class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4"
  >
    <div class="flex items-center gap-2 mb-2">
      <svg
        data-testid="warning-icon"
        class="h-5 w-5 text-amber-500 dark:text-amber-400"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <span class="text-sm font-medium text-amber-800 dark:text-amber-300">{{ issues.length }} unestimated {{ issues.length === 1 ? 'issue' : 'issues' }}</span>
    </div>

    <IssueList :issues="issues" :expandable="true" />
  </div>
</template>

<script setup>
import IssueList from './IssueList.vue'

defineProps({
  issues: {
    type: Array,
    required: true
  }
})
</script>
