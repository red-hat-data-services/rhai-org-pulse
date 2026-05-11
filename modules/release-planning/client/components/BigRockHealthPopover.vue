<script setup>
import { computed } from 'vue'
import { usePopover } from '../composables/usePopover'

var MAX_FEATURES = 10

const props = defineProps({
  worstLevel: { type: String, default: 'green' },
  features: { type: Array, default: () => [] },
  totalFlags: { type: Number, default: 0 }
})

var { isVisible, isPinned, popoverId, onMouseEnter, onMouseLeave, onClick, dismiss, onKeyDown } = usePopover()

var levelLabel = computed(function() {
  var l = props.worstLevel
  if (l === 'red') return 'Critical'
  if (l === 'yellow') return 'At Risk'
  return 'OK'
})

var levelDotClass = computed(function() {
  var l = props.worstLevel
  if (l === 'red') return 'bg-red-500'
  if (l === 'yellow') return 'bg-yellow-500'
  return 'bg-green-500'
})

var headerBorderClass = computed(function() {
  var l = props.worstLevel
  if (l === 'red') return 'border-red-200 dark:border-red-500/30'
  if (l === 'yellow') return 'border-yellow-200 dark:border-yellow-500/30'
  return 'border-green-200 dark:border-green-500/30'
})

var flaggedFeatures = computed(function() {
  return props.features.filter(function(f) { return f.flagCount > 0 })
})

var displayedFeatures = computed(function() {
  return flaggedFeatures.value.slice(0, MAX_FEATURES)
})

var remainingCount = computed(function() {
  return Math.max(0, flaggedFeatures.value.length - MAX_FEATURES)
})

function featureLevelLabel(level) {
  if (level === 'red') return 'Red'
  if (level === 'yellow') return 'Yellow'
  return 'Green'
}

function featureLevelClass(level) {
  if (level === 'red') return 'text-red-600 dark:text-red-400'
  if (level === 'yellow') return 'text-yellow-600 dark:text-yellow-400'
  return 'text-green-600 dark:text-green-400'
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
      v-if="isVisible && flaggedFeatures.length > 0"
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
          <span class="font-semibold text-gray-900 dark:text-gray-100">Health: {{ levelLabel }}</span>
          <span class="text-gray-500 dark:text-gray-400">({{ flaggedFeatures.length }} feature{{ flaggedFeatures.length !== 1 ? 's' : '' }})</span>
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

      <!-- Feature list -->
      <div class="px-3 py-2 max-h-64 overflow-y-auto">
        <div class="space-y-2">
          <div v-for="f in displayedFeatures" :key="f.key">
            <div class="flex items-baseline gap-1.5">
              <span class="font-mono text-gray-900 dark:text-gray-100">{{ f.key }}</span>
              <span class="font-semibold" :class="featureLevelClass(f.level)">{{ featureLevelLabel(f.level) }}</span>
              <span v-if="f.flagCount > 0" class="text-gray-500 dark:text-gray-400">({{ f.flagCount }} flag{{ f.flagCount !== 1 ? 's' : '' }})</span>
            </div>
            <div class="text-gray-500 dark:text-gray-400 mt-0.5 pl-0.5">
              {{ f.flagCategories.join(', ') }}
            </div>
          </div>
          <div v-if="remainingCount > 0" class="text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
            +{{ remainingCount }} more feature{{ remainingCount !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>
    </div>
  </span>
</template>
