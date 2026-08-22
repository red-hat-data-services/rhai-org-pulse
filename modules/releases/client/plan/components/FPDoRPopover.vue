<script setup>
import { computed } from 'vue'
import { usePopover } from '../composables/usePopover'
import { FPDOR_CONFLUENCE_URL } from '../utils/feature-readiness-export.js'
import {
  worstFailedSeverity,
  severityBadgeClass,
  severityLabel
} from '../utils/fpdor-severity.js'

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
  var applicable = props.fpdor.applicableCount != null ? props.fpdor.applicableCount : props.fpdor.totalCount
  return props.fpdor.passedCount + '/' + applicable
})

var failSeverity = computed(function() {
  return worstFailedSeverity(props.fpdor)
})

var badgeClass = computed(function() {
  return severityBadgeClass(failSeverity.value)
})

var badgeTitle = computed(function() {
  if (!props.fpdor) return ''
  if (!failSeverity.value) return 'Ready — all applicable FPDoR items pass'
  return 'Not Ready — worst fail severity: ' + severityLabel(failSeverity.value)
})

var isReady = computed(function() {
  if (props.fpdor && props.fpdor.allApplicablePassed != null) return !!props.fpdor.allApplicablePassed
  return !failSeverity.value
})

var isCommitted = computed(function() {
  return props.confidence === 'committed'
})

var mandatoryItems = computed(function() {
  if (!props.fpdor || !props.fpdor.items) return []
  return props.fpdor.items.filter(function(i) { return i.group === 'mandatory' })
})

var criteriaItems = computed(function() {
  if (!props.fpdor || !props.fpdor.items) return []
  return props.fpdor.items.filter(function(i) { return i.group !== 'mandatory' })
})

var confluenceUrl = computed(function() {
  return (props.fpdor && props.fpdor.confluenceUrl) || FPDOR_CONFLUENCE_URL
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
    :title="badgeTitle"
  >
    <!-- Trigger badge — color from fail severity, not Fix Version -->
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
      class="absolute z-50 left-0 top-full mt-1 w-80 max-w-[min(320px,90vw)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs"
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

      <!-- Body — grouped checklist -->
      <div class="px-3 py-2 max-h-72 overflow-y-auto space-y-3">
        <div v-if="mandatoryItems.length">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Mandatory fields</p>
          <div class="space-y-1">
            <div v-for="item in mandatoryItems" :key="item.name" class="flex items-start gap-2">
              <svg v-if="item.pass === true" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else-if="item.pass === false" class="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
              </svg>
              <div class="min-w-0">
                <span :class="item.pass === true ? 'text-gray-700 dark:text-gray-300' : item.pass === false ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'">{{ item.name }}</span>
                <div v-if="item.detail" class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{{ item.detail }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="criteriaItems.length">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">Criteria</p>
          <div class="space-y-1">
            <div v-for="item in criteriaItems" :key="item.name" class="flex items-start gap-2">
              <svg v-if="item.pass === true" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else-if="item.pass === false" class="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4" />
              </svg>
              <div class="min-w-0">
                <span :class="item.pass === true ? 'text-gray-700 dark:text-gray-300' : item.pass === false ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'">{{ item.name }}</span>
                <div v-if="item.detail" class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{{ item.detail }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer — readiness vs commitment kept separate -->
      <div class="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 min-w-0">
          <span>
            Readiness:
            <span
              class="font-medium"
              :class="isReady ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'"
            >{{ isReady ? 'Ready' : 'Not Ready' }}</span>
          </span>
          <span v-if="isCommitted" class="font-medium text-blue-600 dark:text-blue-400">Committed</span>
        </span>
        <a
          :href="confluenceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 dark:text-primary-400 hover:underline shrink-0"
          @click.stop
        >Confluence DoR</a>
      </div>
    </div>
  </span>
</template>
