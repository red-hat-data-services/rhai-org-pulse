<script setup>
import { computed } from 'vue'

const props = defineProps({
  planningStatus: { type: String, default: '' },
  fpdor: { type: Object, default: null }
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
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">Status</span>
      <span
        v-if="planningStatus"
        class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
        :class="statusBadgeClass"
      >{{ statusLabel }}</span>
    </div>

    <!-- FPDoR Readiness -->
    <div v-if="fpdor && fpdor.items" class="border-t border-gray-100 dark:border-gray-700 pt-2">
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
        FPDoR Readiness
        <span class="font-normal ml-1" :class="fpdor.passedCount === fpdor.totalCount ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">({{ fpdor.passedCount }}/{{ fpdor.totalCount }} passed)</span>
      </div>
      <div v-for="item in fpdor.items" :key="item.name" class="flex items-start gap-2 py-0.5 text-xs">
        <svg v-if="item.pass === true" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else-if="item.pass === false" class="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
        </svg>
        <div class="flex-1 min-w-0">
          <span :class="item.pass === true ? 'text-gray-700 dark:text-gray-300' : item.pass === false ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'">{{ item.name }}</span>
          <span v-if="item.humanVerified" class="inline-flex items-center ml-1 px-1 py-0 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" title="Human verified via strat-creator sign-off">Verified</span>
          <div v-if="item.detail && item.pass !== true" class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{{ item.detail }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
