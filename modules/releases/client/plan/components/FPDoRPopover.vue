<script setup>
import { computed } from 'vue'
import { usePopover } from '../composables/usePopover'

var props = defineProps({
  fpdor: { type: Object, default: null },
  confidence: { type: String, default: '' }
})

var { isVisible, isPinned, popoverId, onMouseEnter, onMouseLeave, onClick, dismiss, onKeyDown } = usePopover()

var hasContent = computed(function() {
  return props.fpdor && props.fpdor.items && props.fpdor.items.length > 0
})

var badgeLabel = computed(function() {
  if (!props.fpdor) return '—'
  return props.fpdor.passedCount + '/' + props.fpdor.totalCount
})

var badgeClass = computed(function() {
  switch (props.confidence) {
    case 'committed': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'ready':     return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    case 'not-ready': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default:          return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
})

var confidenceLabel = computed(function() {
  switch (props.confidence) {
    case 'committed': return 'Ready'
    case 'ready':     return 'Ready'
    case 'not-ready': return 'Not Ready'
    default:          return '—'
  }
})
</script>

<template>
  <span
    class="relative inline-flex"
    :data-popover-trigger="popoverId"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click.stop="onClick"
    @keydown="onKeyDown"
    :aria-expanded="isVisible"
    tabindex="0"
    role="button"
  >
    <!-- Trigger badge -->
    <span
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium cursor-pointer"
      :class="badgeClass"
    >{{ badgeLabel }}</span>

    <!-- Popover -->
    <div
      v-if="isVisible && hasContent"
      :data-popover-id="popoverId"
      role="dialog"
      aria-live="polite"
      class="absolute z-50 left-0 top-full mt-1 w-72 max-w-[min(288px,90vw)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-gray-700 dark:text-gray-200">FPDoR Readiness</span>
          <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
            :class="badgeClass"
          >{{ badgeLabel }}</span>
        </div>
        <button
          v-if="isPinned"
          type="button"
          class="p-0.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close"
          @click.stop="dismiss"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body — flat checklist -->
      <div class="px-3 py-2 max-h-64 overflow-y-auto">
        <div class="space-y-1">
          <div v-for="item in fpdor.items" :key="item.name" class="flex items-center gap-2">
            <svg v-if="item.pass === true" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="item.pass === false" class="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
            </svg>
            <span :class="item.pass === true ? 'text-gray-700 dark:text-gray-300' : item.pass === false ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        v-if="confidence"
        class="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500"
      >
        Confidence: <span class="font-medium" :class="confidence === 'not-ready' ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'">{{ confidenceLabel }}</span>
      </div>
    </div>
  </span>
</template>
