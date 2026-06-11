<script setup>
import { computed } from 'vue'

const props = defineProps({
  dor: { type: Object, default: null },
  dod: { type: Object, default: null },
  planningStatus: { type: String, default: '' },
  planningChecks: { type: Object, default: null }
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

var STRAT_BADGE_CLASSES = {
  'human-sign-off': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400',
  'rubric-pass': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  'needs-attention': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'not-assessed': 'bg-gray-100 dark:bg-gray-500/20 text-gray-500 dark:text-gray-400'
}

var STRAT_BADGE_LABELS = {
  'human-sign-off': 'Signed Off',
  'rubric-pass': 'Rubric Pass',
  'needs-attention': 'Needs Attention',
  'not-assessed': 'Not Assessed'
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

var dorBlockers = computed(function() {
  if (!props.dor || !props.dor.blockers) return []
  return props.dor.blockers
})

var dorWarnings = computed(function() {
  if (!props.dor || !props.dor.warnings) return []
  return props.dor.warnings
})

var hasActiveBlockers = computed(function() {
  return dorBlockers.value.some(function(b) {
    return b.detail !== 'strat-creator-disabled' && b.detail !== 'rice-disabled'
  })
})

var failedWarningCount = computed(function() {
  return dorWarnings.value.filter(function(w) { return !w.passed }).length
})

function isBlockerDisabled(blocker) {
  return blocker.detail === 'strat-creator-disabled' || blocker.detail === 'rice-disabled'
}

function stratBadgeClass(detail) {
  return STRAT_BADGE_CLASSES[detail] || STRAT_BADGE_CLASSES['not-assessed']
}

function stratBadgeLabel(detail) {
  return STRAT_BADGE_LABELS[detail] || detail
}
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

    <!-- DoR Blockers -->
    <div v-if="hasActiveBlockers">
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Definition of Ready — Blockers</div>
      <div v-for="blocker in dorBlockers" :key="blocker.id" class="py-0.5 text-xs">
        <div v-if="!isBlockerDisabled(blocker)" class="flex items-center gap-2">
          <svg v-if="blocker.passed" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <svg v-else class="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span :class="blocker.passed ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'">{{ blocker.label }}</span>
          <!-- Strat-creator badge for B1 -->
          <span
            v-if="blocker.id === 'DoR-B1' && blocker.detail && blocker.detail !== 'strat-creator-disabled'"
            class="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
            :class="stratBadgeClass(blocker.detail)"
          >{{ stratBadgeLabel(blocker.detail) }}</span>
          <!-- RICE detail for B2 -->
          <span
            v-if="blocker.id === 'DoR-B2' && !blocker.passed"
            class="text-gray-400 dark:text-gray-500"
          >{{ blocker.detail }}</span>
        </div>
      </div>
    </div>

    <!-- DoR Warnings -->
    <div v-if="dorWarnings.length > 0">
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
        Definition of Ready — Warnings
        <span v-if="failedWarningCount > 0" class="text-yellow-600 dark:text-yellow-400 font-normal ml-1">({{ failedWarningCount }})</span>
      </div>
      <div v-for="warning in dorWarnings" :key="warning.id" class="flex items-center gap-2 py-0.5 text-xs">
        <svg v-if="warning.passed" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span :class="warning.passed ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'">{{ warning.label }}</span>
        <span v-if="warning.detail && !warning.passed" class="text-gray-400 dark:text-gray-500 truncate">{{ warning.detail }}</span>
        <!-- Escalation indicator -->
        <span
          v-if="warning.escalated"
          class="inline-block px-1 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
          title="Blocking feature also fails DoR"
        >escalated</span>
      </div>
    </div>

    <!-- DoD Checks -->
    <div class="border-t border-gray-100 dark:border-gray-700 pt-2">
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

    <!-- Planning Readiness Checks (DoR-P series) -->
    <div v-if="planningChecks && planningChecks.checks" class="border-t border-gray-100 dark:border-gray-700 pt-2">
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
        Planning Readiness
        <span v-if="planningChecks.hasHardBlockers" class="text-red-600 dark:text-red-400 font-normal ml-1">({{ planningChecks.hardBlockersFailed.length }} blocker{{ planningChecks.hardBlockersFailed.length !== 1 ? 's' : '' }})</span>
        <span v-else class="text-green-600 dark:text-green-400 font-normal ml-1">({{ planningChecks.passedCount }}/{{ planningChecks.totalCount }} passed)</span>
      </div>
      <div v-for="check in planningChecks.checks" :key="check.id" class="flex items-center gap-2 py-0.5 text-xs">
        <svg v-if="check.passed" class="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span :class="check.passed ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'">{{ check.label }}</span>
        <span v-if="check.detail" class="text-gray-400 dark:text-gray-500 truncate">{{ check.detail }}</span>
      </div>
    </div>
  </div>
</template>
