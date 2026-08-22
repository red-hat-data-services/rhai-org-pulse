<script setup>
import { computed } from 'vue'
import { usePopover } from '../composables/usePopover'
import {
  alignmentCategoryLabel,
  alignmentCategoryChipClass,
  buildAlignmentDetail
} from '../utils/tv-fv-alignment-display.js'

var props = defineProps({
  feature: { type: Object, default: null }
})

var { isVisible, isPinned, popoverId, onMouseEnter, onMouseLeave, onClick, dismiss, onKeyDown } = usePopover()

var detail = computed(function() {
  return buildAlignmentDetail(props.feature || {})
})

var chipLabel = computed(function() {
  return alignmentCategoryLabel(props.feature && props.feature.alignmentCategory)
})

var chipClass = computed(function() {
  return alignmentCategoryChipClass(props.feature && props.feature.alignmentCategory)
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
    :aria-label="'TV/FV alignment: ' + chipLabel"
  >
    <span
      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer"
      :class="chipClass"
    >{{ chipLabel }}</span>

    <div
      v-if="isVisible"
      :data-popover-id="popoverId"
      role="dialog"
      aria-live="polite"
      class="absolute z-50 left-0 top-full mt-1 w-72 max-w-[min(288px,90vw)] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs text-left font-normal"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-gray-900 dark:text-gray-100">TV/FV Align</span>
          <span
            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            :class="chipClass"
          >{{ chipLabel }}</span>
        </div>
        <button
          v-if="isPinned"
          type="button"
          class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          aria-label="Close alignment details"
          @click.stop="dismiss"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="px-3 py-2 text-gray-700 dark:text-gray-300 space-y-2">
        <p class="font-medium text-gray-900 dark:text-gray-100">{{ detail.summary }}</p>
        <p>{{ detail.categoryHelp }}</p>
        <div v-if="detail.requested.length || detail.committed.length" class="space-y-1 text-[11px]">
          <p v-if="detail.requested.length">
            <span class="font-semibold text-gray-500 dark:text-gray-400">Target Version:</span>
            {{ detail.requested.join(', ') }}
          </p>
          <p v-else>
            <span class="font-semibold text-gray-500 dark:text-gray-400">Target Version:</span>
            none
          </p>
          <p v-if="detail.committed.length">
            <span class="font-semibold text-gray-500 dark:text-gray-400">Fix Version:</span>
            {{ detail.committed.join(', ') }}
          </p>
          <p v-else>
            <span class="font-semibold text-gray-500 dark:text-gray-400">Fix Version:</span>
            none
          </p>
        </div>
      </div>
    </div>
  </span>
</template>
