<script setup>
import { computed } from 'vue'

const props = defineProps({
  dor: { type: Object, default: null },
  dod: { type: Object, default: null },
  planningStatus: { type: String, default: '' }
})

var STATUS_LABELS = {
  'not-ready': 'Not Ready',
  'in-planning': 'In Planning',
  'ready-for-execution': 'Ready'
}

var STATUS_CLASSES = {
  'not-ready': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  'in-planning': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'ready-for-execution': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
}

var statusLabel = computed(function() {
  return STATUS_LABELS[props.planningStatus] || props.planningStatus || ''
})

var statusBadgeClass = computed(function() {
  return STATUS_CLASSES[props.planningStatus] || ''
})

var dodChecks = computed(function() {
  if (!props.dod || !props.dod.checks) return []
  return props.dod.checks
})

var dorPassed = computed(function() {
  return props.dor && props.dor.passed
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">Planning Status</span>
      <span
        v-if="planningStatus"
        class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
        :class="statusBadgeClass"
      >{{ statusLabel }}</span>
    </div>

    <div>
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Definition of Done</div>
      <div v-for="check in dodChecks" :key="check.id" class="flex items-center gap-2 py-0.5 text-xs">
        <svg v-if="check.passed" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span :class="check.passed ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'">{{ check.label }}</span>
        <span v-if="check.detail && !check.passed" class="text-gray-400 dark:text-gray-500 truncate">{{ check.detail }}</span>
      </div>
    </div>

    <div class="border-t border-gray-100 dark:border-gray-700 pt-2">
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Definition of Ready</div>
      <div v-if="dorPassed" class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        All checks passed
      </div>
      <div v-else class="text-xs text-red-600 dark:text-red-400">
        Blockers not resolved
      </div>
    </div>
  </div>
</template>
