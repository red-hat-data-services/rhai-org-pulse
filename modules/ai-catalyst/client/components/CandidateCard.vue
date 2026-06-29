<script setup>
import { computed } from 'vue'
import { useCategories } from '../composables/useCategories.js'
import CategoryBadge from './CategoryBadge.vue'
import ScoreGauge from './ScoreGauge.vue'

const props = defineProps({
  candidate: { type: Object, required: true }
})

const emit = defineEmits(['select'])

const { getDecisionStatus, getDecisionMeta, getSourceLabel } = useCategories()

const decisionStatus = computed(() => getDecisionStatus(props.candidate))
const decisionMeta = computed(() => getDecisionMeta(decisionStatus.value))
const sourceLabel = computed(() => getSourceLabel(props.candidate.source))
const starsDisplay = computed(() => {
  const s = props.candidate.stars
  if (s == null) return '—'
  return s >= 1000 ? (s / 1000).toFixed(1) + 'K' : String(s)
})
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-400 dark:hover:border-primary-500 transition-colors cursor-pointer"
    @click="emit('select', candidate)"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ candidate.title }}</h3>
        <div class="flex items-center gap-2 mt-1">
          <CategoryBadge :category="candidate.category" />
          <span v-if="candidate.itemType === 'trend'" class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">trend</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <span :class="['w-2 h-2 rounded-full', decisionMeta.dotClass]" :title="decisionMeta.label"></span>
      </div>
    </div>

    <!-- Scores -->
    <div class="flex items-center gap-3 mb-3">
      <ScoreGauge :score="candidate.impactScore" label="Impact" />
      <ScoreGauge
        :score="candidate.boardFeasibilityScore ?? candidate.feasibilityScore"
        label="Feasibility"
        :estimated="candidate.boardFeasibilityEstimated"
      />
      <div class="flex-1"></div>
      <div class="text-right">
        <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
          {{ starsDisplay }}
        </div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ sourceLabel }}</div>
      </div>
    </div>

    <!-- Gate & decision -->
    <div class="flex items-center gap-2 text-xs">
      <span
        v-if="candidate.boardPassesGate != null"
        :class="[
          'px-1.5 py-0.5 rounded',
          candidate.boardPassesGate
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        ]"
      >
        {{ candidate.boardPassesGate ? 'Pass' : 'Fail' }}
      </span>
      <span :class="['px-1.5 py-0.5 rounded', decisionMeta.bgClass, decisionMeta.textClass]">
        {{ decisionMeta.label }}
      </span>
      <span v-if="candidate.language" class="text-gray-400 dark:text-gray-500 ml-auto">{{ candidate.language }}</span>
    </div>
  </div>
</template>
