<template>
  <div class="px-6 py-4 border-l-4" :class="accent">
    <div class="flex items-start gap-3 flex-wrap">
      <a
        v-if="bug.jira_url"
        :href="bug.jira_url"
        target="_blank"
        rel="noopener"
        class="font-mono font-semibold text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0"
      >{{ bug.bug_key || 'JIRA' }}</a>
      <span v-else class="font-mono font-semibold text-sm text-gray-500 dark:text-gray-400 shrink-0">
        {{ bug.bug_key || 'No JIRA key' }}
      </span>

      <StatusBadge v-if="bug.category" :value="bug.category" />
      <StatusBadge v-if="bug.action" :value="bug.action" />
      <span v-if="bug.opened" class="inline-block px-2 py-0.5 rounded-full text-[0.68rem] font-semibold bg-blue-600 text-white">Opened</span>

      <p class="flex-1 min-w-[200px] text-sm text-gray-700 dark:text-gray-300">{{ bug.error_summary || '—' }}</p>
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
      <span v-if="bug.rhoaieng_component || bug.component">{{ bug.rhoaieng_component || bug.component }}</span>
      <span v-if="bug.rhoai_version">Version {{ bug.rhoai_version }}</span>
      <span v-if="bug.workflow">Workflow: {{ bug.workflow }}</span>
      <span v-if="bug.status">Status: {{ bug.status }}</span>
      <span v-if="bug.confidence">Confidence: {{ bug.confidence }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import StatusBadge from './StatusBadge.vue'

const props = defineProps({
  bug: { type: Object, required: true }
})

// Left accent echoes the report's priority stripe, keyed off category.
const accent = computed(() => {
  const c = String(props.bug.category || '').toUpperCase()
  if (c === 'PRODUCT_BUG' || c === 'CREDENTIAL_EXPOSURE') return 'border-red-500'
  if (c === 'ENVIRONMENT') return 'border-amber-500'
  if (c === 'SPEC_DEFECT') return 'border-yellow-500'
  if (c === 'AUTOMATION_BUG') return 'border-purple-500'
  return 'border-gray-300 dark:border-gray-600'
})
</script>
