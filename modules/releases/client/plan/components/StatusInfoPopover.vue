<script setup>
import { usePopover } from '../composables/usePopover'

var { isVisible, isPinned, popoverId, onMouseEnter, onMouseLeave, onClick, dismiss, onKeyDown } = usePopover()
</script>

<template>
  <span
    class="relative inline-flex ml-1 align-middle"
    :data-popover-trigger="popoverId"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click.stop="onClick"
    @keydown="onKeyDown"
    :aria-expanded="isVisible"
    tabindex="0"
    role="button"
    aria-label="Status info"
  >
    <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>

    <div
      v-if="isVisible"
      :data-popover-id="popoverId"
      role="dialog"
      aria-live="polite"
      class="absolute z-50 left-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span class="font-semibold text-gray-900 dark:text-gray-100">Status Info</span>
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
      <div class="px-3 py-2 text-gray-700 dark:text-gray-300 space-y-2">
        <p>Status reflects feature readiness against the Planning Phase Definition of Ready (FPDoR).</p>
        <div>
          <div class="font-semibold text-gray-900 dark:text-gray-100 mb-1">Statuses:</div>
          <ul class="space-y-0.5 pl-2">
            <li><span class="font-medium text-red-600 dark:text-red-400">Not Ready</span> -- FPDoR not passed</li>
            <li><span class="font-medium text-yellow-600 dark:text-yellow-400">In Planning</span> -- partially passing FPDoR</li>
            <li><span class="font-medium text-green-600 dark:text-green-400">Ready</span> -- all applicable FPDoR items passed</li>
          </ul>
        </div>
        <p class="text-gray-500 dark:text-gray-400">
          Checklist source of truth:
          <a
            href="https://redhat.atlassian.net/wiki/spaces/RHAI/pages/442958832/Planning+Phase+-+Definition+of+Ready+Definition+of+Done"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-600 dark:text-primary-400 hover:underline"
            @click.stop
          >Planning Phase DoR / DoD</a>.
          N/A items do not block readiness. Rubric scores are informational only.
        </p>
      </div>
    </div>
  </span>
</template>
