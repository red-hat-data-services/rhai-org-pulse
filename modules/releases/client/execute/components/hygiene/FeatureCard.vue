<script setup>
import { computed } from 'vue'

const props = defineProps({
  feature: {
    type: Object,
    required: true
  }
})

defineEmits(['click'])

const violationCount = computed(() => {
  const violations = props.feature.violations
  if (!violations) return 0
  return Array.isArray(violations) ? violations.length : 0
})

const hasViolations = computed(() => violationCount.value > 0)

const colorLabel = computed(() => {
  return props.feature.colorStatus || 'Not Selected'
})
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    @click="$emit('click')"
  >
    <!-- Header: key + violation icon -->
    <div class="flex items-center justify-between gap-2 mb-1">
      <span class="text-primary-600 dark:text-primary-400 font-mono text-xs font-semibold">
        {{ feature.key }}
      </span>
      <svg
        v-if="hasViolations"
        class="w-5 h-5 text-orange-500 dark:text-orange-400 flex-shrink-0 animate-pulse-warning"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      </svg>
      <svg
        v-else
        class="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
      </svg>
    </div>

    <!-- Summary -->
    <p class="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 mb-2">
      {{ feature.summary }}
    </p>

    <!-- Issue type badge -->
    <div v-if="feature.issueType" class="mb-2">
      <span class="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
        {{ feature.issueType }}
      </span>
    </div>

    <!-- Detail rows -->
    <div class="space-y-0.5 text-[11px]">
      <div class="flex gap-1">
        <span class="text-gray-400 dark:text-gray-500 w-16 shrink-0">Status:</span>
        <span class="text-gray-700 dark:text-gray-300 truncate">{{ feature.status || '—' }}</span>
      </div>
      <div class="flex gap-1">
        <span class="text-gray-400 dark:text-gray-500 w-16 shrink-0">Assignee:</span>
        <span
          :class="feature.assignee
            ? 'text-gray-700 dark:text-gray-300'
            : 'text-yellow-600 dark:text-yellow-400 font-medium'"
          class="truncate"
        >{{ feature.assignee || 'Unassigned' }}</span>
      </div>
      <div class="flex gap-1">
        <span class="text-gray-400 dark:text-gray-500 w-16 shrink-0">Team:</span>
        <span class="text-gray-700 dark:text-gray-300 truncate">{{ feature.team || '—' }}</span>
      </div>
      <div v-if="feature.fixVersions && feature.fixVersions.length" class="flex gap-1">
        <span class="text-gray-400 dark:text-gray-500 w-16 shrink-0">Target:</span>
        <span class="text-gray-700 dark:text-gray-300 truncate font-mono text-[10px]">{{ feature.fixVersions.join(', ') }}</span>
      </div>
      <div class="flex gap-1">
        <span class="text-gray-400 dark:text-gray-500 w-16 shrink-0">Color:</span>
        <span class="text-gray-700 dark:text-gray-300 truncate">{{ colorLabel }}</span>
      </div>
    </div>

    <!-- Violation count footer -->
    <div v-if="hasViolations" class="mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-700">
      <span class="text-[10px] font-semibold text-red-600 dark:text-red-400">
        {{ violationCount }} violation{{ violationCount !== 1 ? 's' : '' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-warning {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.animate-pulse-warning {
  animation: pulse-warning 1.5s ease-in-out infinite;
}
</style>
