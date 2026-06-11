<script setup>
import { usePopover } from '../composables/usePopover'

defineProps({
  versionedCount: { type: Number, default: 0 },
  missingVersionCount: { type: Number, default: 0 },
  committedCount: { type: Number, default: 0 },
  targetedCount: { type: Number, default: 0 },
  distinctVersions: { type: Array, default: () => [] }
})

var { isVisible, isPinned, popoverId, onMouseEnter, onMouseLeave, onClick, dismiss, onKeyDown } = usePopover()
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
    aria-label="Version summary"
  >
    <span class="text-xs cursor-pointer" :class="missingVersionCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'">
      {{ versionedCount }} versioned<span v-if="missingVersionCount > 0">, {{ missingVersionCount }} missing</span>
    </span>

    <div
      v-if="isVisible"
      :data-popover-id="popoverId"
      role="dialog"
      aria-live="polite"
      class="absolute z-50 left-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span class="font-semibold text-gray-900 dark:text-gray-100">Version Summary</span>
        <button
          v-if="isPinned"
          @click.stop="dismiss"
          class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          aria-label="Close popover"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="px-3 py-2 space-y-2">
        <!-- Distinct version badges -->
        <div v-if="distinctVersions.length > 0">
          <div class="text-gray-500 dark:text-gray-400 mb-1">Fix Versions:</div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="v in distinctVersions"
              :key="v"
              class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
            >{{ v }}</span>
          </div>
        </div>

        <!-- Warning count -->
        <div v-if="missingVersionCount > 0" class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {{ missingVersionCount }} feature{{ missingVersionCount !== 1 ? 's' : '' }} missing version assignment
        </div>

        <!-- Breakdown -->
        <div class="text-gray-600 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">
          {{ committedCount }} committed, {{ targetedCount }} targeted<span v-if="missingVersionCount > 0">, {{ missingVersionCount }} unversioned</span>
        </div>
      </div>
    </div>
  </span>
</template>
