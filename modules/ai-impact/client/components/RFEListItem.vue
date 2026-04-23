<script setup>
defineProps({
  rfe: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  assessment: { type: Object, default: null }
})

const emit = defineEmits(['select'])

function getInvolvementLabel(involvement) {
  switch (involvement) {
    case 'both': return 'Created & Revised'
    case 'created': return 'AI Created'
    case 'revised': return 'AI Revised'
    default: return 'No AI'
  }
}

function getInvolvementClass(involvement) {
  switch (involvement) {
    case 'both': return 'bg-blue-500 text-white'
    case 'created': return 'bg-green-500 text-white'
    case 'revised': return 'bg-amber-500 text-white'
    default: return 'bg-gray-200 text-gray-600'
  }
}
</script>

<template>
  <div
    @click="emit('select', rfe)"
    class="p-4 rounded-lg border cursor-pointer transition-all"
    :class="{
      'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500': selected,
      'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700': !selected
    }"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ rfe.key }}</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="getInvolvementClass(rfe.aiInvolvement)"
          >
            {{ getInvolvementLabel(rfe.aiInvolvement) }}
          </span>
        </div>
        <h4 class="font-medium text-sm truncate dark:text-gray-200">{{ rfe.summary }}</h4>
        <div class="flex items-center flex-wrap gap-2 mt-2">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Author</span>
            <span class="text-gray-800 dark:text-gray-100">{{ rfe.creatorDisplayName }}</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Created</span>
            <span class="text-gray-800 dark:text-gray-100">{{ new Date(rfe.created).toLocaleDateString() }}</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Priority</span>
            <span class="text-gray-800 dark:text-gray-100 capitalize">{{ rfe.priority }}</span>
          </span>
          <span
            v-if="assessment"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            :class="assessment.passFail === 'PASS'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'"
          >
            <span class="font-medium" :class="assessment.passFail === 'PASS' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">Score</span>
            {{ assessment.total }}/10
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600"
          >
            <span class="font-medium text-gray-500 dark:text-gray-400">Score</span>
            <span class="text-gray-400 dark:text-gray-500">N/A</span>
          </span>
        </div>
      </div>
      <div class="flex items-center shrink-0">
        <svg class="h-4 w-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  </div>
</template>
