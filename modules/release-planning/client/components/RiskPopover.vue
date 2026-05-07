<script setup>
import { computed } from 'vue'
import { usePopover } from '../composables/usePopover'
import { formatDate as sharedFormatDate } from '@shared/client'

const props = defineProps({
  level: { type: String, default: 'green' },
  flags: { type: Array, default: () => [] },
  flagCount: { type: Number, default: 0 },
  override: { type: Object, default: null },
  dor: { type: Object, default: null },
  variant: { type: String, default: 'full' }
})

var hasContent = computed(function() {
  return (props.flags && props.flags.length > 0) || props.override
})

var { isVisible, isPinned, popoverId, onMouseEnter, onMouseLeave, onClick, dismiss, onKeyDown } = usePopover()

var displayLevel = computed(function() {
  if (props.override) return props.override.riskOverride || props.level
  return props.level
})

var levelLabel = computed(function() {
  var l = displayLevel.value
  if (l === 'red') return 'Red'
  if (l === 'yellow') return 'Yellow'
  return 'Green'
})

var levelDotClass = computed(function() {
  var l = displayLevel.value
  if (l === 'red') return 'bg-red-500'
  if (l === 'yellow') return 'bg-yellow-500'
  return 'bg-green-500'
})

var headerBorderClass = computed(function() {
  var l = displayLevel.value
  if (l === 'red') return 'border-red-200 dark:border-red-500/30'
  if (l === 'yellow') return 'border-yellow-200 dark:border-yellow-500/30'
  return 'border-green-200 dark:border-green-500/30'
})

var severityClasses = {
  high: 'text-red-700 dark:text-red-400',
  medium: 'text-yellow-700 dark:text-yellow-400',
  low: 'text-gray-500 dark:text-gray-400'
}

function formatDate(iso) {
  return sharedFormatDate(iso, { fallback: '', includeTime: false })
}
</script>

<template>
  <span
    class="relative inline-flex"
    :data-popover-trigger="popoverId"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click="onClick"
    @keydown="onKeyDown"
    :aria-expanded="isVisible"
    tabindex="0"
    role="button"
  >
    <slot />

    <div
      v-if="isVisible && hasContent"
      :data-popover-id="popoverId"
      role="dialog"
      aria-live="polite"
      class="absolute z-50 left-0 top-full mt-1 w-96 max-w-[min(384px,90vw)] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 text-xs"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b" :class="headerBorderClass">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full flex-shrink-0" :class="levelDotClass"></span>
          <span class="font-semibold text-gray-900 dark:text-gray-100">Risk: {{ levelLabel }}</span>
          <span v-if="flagCount > 0" class="text-gray-500 dark:text-gray-400">({{ flagCount }} flag{{ flagCount !== 1 ? 's' : '' }})</span>
        </div>
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

      <!-- Override section -->
      <div
        v-if="override"
        class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-500/10"
      >
        <div class="text-amber-700 dark:text-amber-400 font-semibold">
          Override: {{ override.riskOverride }}
          <span v-if="override.reason" class="font-normal"> -- "{{ override.reason }}"</span>
        </div>
        <div v-if="override.updatedBy" class="text-gray-500 dark:text-gray-400 mt-0.5">
          by {{ override.updatedBy }}<span v-if="override.updatedAt"> on {{ formatDate(override.updatedAt) }}</span>
        </div>
      </div>

      <!-- Flags body -->
      <div class="px-3 py-2 max-h-64 overflow-y-auto">
        <div class="space-y-2">
          <div v-for="(flag, idx) in flags" :key="idx">
            <div class="flex items-baseline gap-1">
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ flag.category }}</span>
              <span class="text-[10px]" :class="severityClasses[flag.severity] || severityClasses.medium">({{ flag.severity }})</span>
            </div>
            <div class="text-gray-600 dark:text-gray-400 mt-0.5 pl-0.5">{{ flag.message }}</div>
          </div>
        </div>
      </div>

      <!-- DoR summary (full variant) -->
      <div
        v-if="variant === 'full' && dor"
        class="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
      >
        DoR: {{ dor.completionPct }}% ({{ dor.checkedCount }}/{{ dor.totalCount }} items)
      </div>
    </div>
  </span>
</template>
