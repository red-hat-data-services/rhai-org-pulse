<script setup>
import { usePopover } from '../composables/usePopover'
import {
  ALIGNMENT_LEGEND_NOTES,
  alignmentLegendEntries
} from '../utils/tv-fv-alignment-display.js'

var props = defineProps({
  variant: { type: String, default: 'icon' },
  align: { type: String, default: 'left' }
})

var { isVisible, isPinned, popoverId, onMouseEnter, onMouseLeave, onClick, dismiss, onKeyDown } = usePopover()

var entries = alignmentLegendEntries()
var notes = ALIGNMENT_LEGEND_NOTES
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
    aria-label="Align legend"
  >
    <span
      v-if="props.variant === 'button'"
      class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Legend
    </span>
    <svg
      v-else
      class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>

    <div
      v-if="isVisible"
      :data-popover-id="popoverId"
      role="dialog"
      aria-live="polite"
      class="absolute z-50 top-full mt-1 w-80 max-w-[min(320px,90vw)] max-h-[min(28rem,70vh)] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs text-left font-normal"
      :class="props.align === 'right' ? 'right-0' : 'left-0'"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
        <span class="font-semibold text-gray-900 dark:text-gray-100">TV/FV Align legend</span>
        <button
          v-if="isPinned"
          type="button"
          class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          aria-label="Close align legend"
          @click.stop="dismiss"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="px-3 py-2 text-gray-700 dark:text-gray-300 space-y-3">
        <ul class="space-y-2">
          <li v-for="entry in entries" :key="entry.key" class="flex items-start gap-2">
            <span class="inline-flex items-center gap-0.5 mt-0.5 shrink-0">
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                :class="entry.chipClass"
              >{{ entry.label }}</span>
              <span
                v-if="entry.secondaryChipClass"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                :class="entry.secondaryChipClass"
              >{{ entry.label }}</span>
            </span>
            <span>{{ entry.help }}</span>
          </li>
        </ul>
        <div class="space-y-1.5 pt-1 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
          <p v-for="(note, idx) in notes" :key="idx">{{ note }}</p>
        </div>
      </div>
    </div>
  </span>
</template>
